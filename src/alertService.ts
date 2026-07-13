import { promises as fs } from "node:fs";
import path from "node:path";
import { shouldKeepAd } from "./filterService.js";
import { logger } from "./logger.js";
import { politeDelay, scrapeOlxSearch } from "./olxScraper.js";
import { scoreAd } from "./scoreService.js";
import { loadSentAds, markAsSent, saveSentAds } from "./storageService.js";
import { sendTelegramMessage, validateTelegramEnv } from "./telegramService.js";
import { AlertConfig, RunStats } from "./types.js";

const alertsPath = path.resolve("config", "alerts.json");
const maxPagesHardLimit = 5;
const defaultMaxAdsPerRun = 5;

function defaultOlxUrl(alert: AlertConfig) {
  const query = encodeURIComponent(alert.termoBusca);
  const text = `${alert.id} ${alert.nome} ${alert.termoBusca}`.toLowerCase();
  const path = text.includes("jogo") || text.includes("pokemon") || text.includes("pokémon")
    ? "games/jogos"
    : "games/consoles-de-video-game";

  return `https://www.olx.com.br/${path}/estado-rj/rio-de-janeiro-e-regiao?q=${query}`;
}

function withAlertDefaults(alert: AlertConfig): AlertConfig {
  return {
    ...alert,
    ativo: alert.ativo ?? true,
    urlBuscaOlx: alert.urlBuscaOlx || defaultOlxUrl(alert),
    palavrasObrigatorias: alert.palavrasObrigatorias ?? [alert.termoBusca],
    palavrasBloqueadas: alert.palavrasBloqueadas ?? [],
    maxPaginas: alert.maxPaginas ?? 2,
    ordenarPorRecentes: alert.ordenarPorRecentes ?? true,
    quantidadeMaximaPorExecucao: alert.quantidadeMaximaPorExecucao ?? defaultMaxAdsPerRun,
    enviarTelegram: alert.enviarTelegram ?? true
  };
}

function buildSearchPageUrls(alert: AlertConfig) {
  const maxPages = Math.min(Math.max(alert.maxPaginas ?? 1, 1), maxPagesHardLimit);
  const urls: string[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(alert.urlBuscaOlx ?? defaultOlxUrl(alert));

    if (alert.ordenarPorRecentes !== false) {
      url.searchParams.set("sf", "1");
    }

    if (page > 1) {
      url.searchParams.set("o", String(page));
    } else {
      url.searchParams.delete("o");
    }

    urls.push(url.toString());
  }

  return urls;
}

function validateAlert(alert: AlertConfig, index: number) {
  const label = alert.id ? `${alert.id} (indice ${index})` : `indice ${index}`;

  if (!alert.id || !alert.nome || !alert.termoBusca) {
    throw new Error(`Alerta invalido em ${label}: id, nome e termoBusca sao obrigatorios.`);
  }

  if (
    alert.quantidadeMaximaPorExecucao !== undefined &&
    (!Number.isInteger(alert.quantidadeMaximaPorExecucao) || alert.quantidadeMaximaPorExecucao < 1)
  ) {
    throw new Error(`Alerta ${alert.id} possui quantidadeMaximaPorExecucao invalida.`);
  }

  try {
    const url = new URL(alert.urlBuscaOlx || defaultOlxUrl(alert));
    if (!url.hostname.endsWith("olx.com.br")) {
      throw new Error("host invalido");
    }
  } catch {
    throw new Error(`Alerta ${alert.id} possui urlBuscaOlx invalida.`);
  }
}

export async function loadAlerts(): Promise<AlertConfig[]> {
  const raw = await fs.readFile(alertsPath, "utf-8");
  const alerts = JSON.parse(raw) as AlertConfig[];

  if (!Array.isArray(alerts)) {
    throw new Error("config/alerts.json deve conter uma lista de alertas.");
  }

  alerts.forEach((alert, index) => validateAlert(alert, index));

  return alerts.map(withAlertDefaults);
}

export async function runAlerts(): Promise<RunStats> {
  const stats: RunStats = {
    alertsProcessed: 0,
    adsFound: 0,
    adsSent: 0,
    adsSkipped: 0,
    errors: 0
  };

  const alerts = await loadAlerts();
  const activeAlerts = alerts.filter((alert) => alert.ativo);
  const sentAds = await loadSentAds();

  if (activeAlerts.some((alert) => alert.enviarTelegram)) {
    validateTelegramEnv();
  }

  logger.info(`${activeAlerts.length} alerta(s) ativo(s) encontrado(s).`);

  for (const alert of activeAlerts) {
    stats.alertsProcessed += 1;

    try {
      logger.info(`Executando alerta: ${alert.nome}`);
      const pageUrls = buildSearchPageUrls(alert);
      const ads = [];

      for (const pageUrl of pageUrls) {
        logger.info(`Buscando pagina OLX: ${pageUrl}`);
        ads.push(...(await scrapeOlxSearch(pageUrl)));
        await politeDelay();
      }

      stats.adsFound += ads.length;

      let sentForAlert = 0;
      const maxAdsForAlert = alert.quantidadeMaximaPorExecucao ?? defaultMaxAdsPerRun;

      for (const ad of ads) {
        if (sentForAlert >= maxAdsForAlert) break;

        const uniqueKey = ad.id || ad.link;
        const alreadySent = sentAds.has(uniqueKey) || [...sentAds.values()].some((item) => item.url === ad.link);
        if (alreadySent) {
          stats.adsSkipped += 1;
          continue;
        }

        const filter = shouldKeepAd(alert, ad);
        if (!filter.keep) {
          stats.adsSkipped += 1;
          logger.info(`Ignorando anuncio "${ad.titulo}": ${filter.reason}`);
          continue;
        }

        const scoredAd = scoreAd(alert, ad);
        if (typeof alert.scoreMinimo === "number" && scoredAd.score < alert.scoreMinimo) {
          stats.adsSkipped += 1;
          logger.info(`Ignorando anuncio "${ad.titulo}": score ${scoredAd.score} abaixo do minimo.`);
          continue;
        }

        if (alert.enviarTelegram) {
          await sendTelegramMessage(alert, scoredAd);
        }

        markAsSent(sentAds, uniqueKey, ad.link);
        await saveSentAds(sentAds);
        sentForAlert += 1;
        stats.adsSent += 1;

        logger.info(`Anuncio processado: ${ad.titulo} (${scoredAd.score})`);
        await politeDelay(1000);
      }
    } catch (error) {
      stats.errors += 1;
      logger.error(`Falha no alerta "${alert.nome}". Continuando os proximos.`, error);
    }

    await politeDelay();
  }

  await saveSentAds(sentAds);
  return stats;
}
