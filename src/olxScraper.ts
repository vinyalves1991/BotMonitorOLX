import axios from "axios";
import * as cheerio from "cheerio";
import { OlxAd } from "./types.js";
import { logger } from "./logger.js";

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function absoluteUrl(url: string) {
  try {
    return new URL(url, "https://www.olx.com.br").toString();
  } catch {
    return url;
  }
}

function extractPrice(text: string): { value?: number; label?: string } {
  const match = text.match(/R\$\s?[\d.\s]+(?:,\d{2})?/i);
  if (!match) return {};

  const label = match[0].replace(/\s+/g, " ").trim();
  const value = Number(label.replace(/[^\d,]/g, "").replace(",", "."));

  return Number.isFinite(value) ? { value, label } : { label };
}

function extractAdId(link: string) {
  try {
    const url = new URL(link);
    const idFromQuery = url.searchParams.get("ad_id") ?? url.searchParams.get("id");
    if (idFromQuery) return idFromQuery;

    const numbers = url.pathname.match(/\d{6,}/g);
    if (numbers?.length) return numbers[numbers.length - 1];

    return url.pathname.replace(/[^\w-]/g, "-");
  } catch {
    return link;
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function pickTitle($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>, linkText: string) {
  const aria = element.attr("aria-label");
  const titleAttr = element.attr("title");
  const imageAlt = element.find("img[alt]").first().attr("alt");
  const heading = element.find("h2, h3").first().text();

  const candidates = [aria, titleAttr, imageAlt, heading, linkText]
    .filter(Boolean)
    .map((item) => cleanText(String(item)));

  const withoutPrice = candidates.map((item) => item.replace(/R\$\s?[\d.\s]+(?:,\d{2})?/i, "").trim());
  return withoutPrice.find((item) => item.length >= 5) ?? "Anuncio OLX";
}

function extractLocation(text: string) {
  const patterns = [
    /(?:Rio de Janeiro|Niteroi|Niterói|Sao Goncalo|São Gonçalo|Duque de Caxias|Nova Iguacu|Nova Iguaçu|RJ)(?:\s*-\s*[A-Z]{2})?/i,
    /[A-Z][a-zA-ZÀ-ÿ\s]+,\s*[A-Z]{2}/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return cleanText(match[0]);
  }

  return undefined;
}

function collectCardText(element: cheerio.Cheerio<any>) {
  const chunks: string[] = [];
  let current = element;

  for (let level = 0; level < 8 && current.length > 0; level += 1) {
    const text = cleanText(current.text());
    if (text && !chunks.includes(text)) {
      chunks.push(text);
    }

    if (/R\$\s?[\d.\s]+(?:,\d{2})?/i.test(text) && text.length > 40) {
      break;
    }

    current = current.parent();
  }

  return cleanText(chunks.join(" "));
}

function parseHtml(html: string): OlxAd[] {
  const $ = cheerio.load(html);
  const ads = new Map<string, OlxAd>();

  $("a[href]").each((_, node) => {
    const element = $(node);
    const href = element.attr("href");
    if (!href) return;

    const link = absoluteUrl(href);
    if (!link.includes("olx.com.br")) return;
    if (!/\/(item|d)\//.test(link) && !/\d{6,}/.test(link)) return;

    const contextText = collectCardText(element);
    const title = pickTitle($, element, element.text());
    const price = extractPrice(contextText);
    const id = extractAdId(link);

    if (!id || title.length < 5 || ads.has(id)) return;

    ads.set(id, {
      id,
      titulo: title,
      preco: price.value,
      precoTexto: price.label,
      link,
      localizacao: extractLocation(contextText),
      data: undefined,
      descricaoCurta: contextText.slice(0, 600)
    });
  });

  return [...ads.values()];
}

type FetchResult = {
  html: string;
  finalUrl: string;
};

function isOlxHomeRedirect(finalUrl: string) {
  try {
    const parsed = new URL(finalUrl);
    return parsed.hostname === "www.olx.com.br" && parsed.pathname === "/" && !parsed.search;
  } catch {
    return false;
  }
}

async function fetchWithPlaywright(url: string): Promise<FetchResult> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent,
      locale: "pt-BR",
      viewport: { width: 1366, height: 768 }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    const html = await page.content();
    const finalUrl = page.url();
    await browser.close();
    return { html, finalUrl };
  } catch (error) {
    throw new Error(`Fallback Playwright falhou: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchWithAxios(url: string): Promise<FetchResult> {
  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      "User-Agent": userAgent,
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: "https://www.olx.com.br/",
      "Cache-Control": "no-cache",
      Pragma: "no-cache"
    },
    maxRedirects: 3,
    validateStatus: (status) => status >= 200 && status < 400
  });

  return {
    html: response.data,
    finalUrl: response.request?.res?.responseUrl ?? url
  };
}

async function fetchHtml(url: string): Promise<FetchResult> {
  const mode = process.env.OLX_FETCH_MODE ?? "playwright";

  if (mode === "axios") {
    return fetchWithAxios(url);
  }

  if (mode === "auto") {
    try {
      return await fetchWithAxios(url);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        logger.warn("OLX retornou 403 no Axios. Tentando Playwright.");
        return fetchWithPlaywright(url);
      }
      throw error;
    }
  }

  return fetchWithPlaywright(url);
}

async function fetchWithRetry(url: string, attempts = 2): Promise<FetchResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchHtml(url);
    } catch (error) {
      lastError = error;
      logger.warn(`Falha ao buscar OLX. Tentativa ${attempt}/${attempts}.`);
      await sleep(1500 * attempt);
    }
  }

  throw lastError;
}

export async function scrapeOlxSearch(url: string): Promise<OlxAd[]> {
  const { html, finalUrl } = await fetchWithRetry(url);

  if (isOlxHomeRedirect(finalUrl)) {
    throw new Error(`A OLX redirecionou a busca para a home. Verifique urlBuscaOlx: ${url}`);
  }

  const ads = parseHtml(html);

  if (ads.length === 0) {
    logger.warn("Nenhum anuncio encontrado. A OLX pode ter alterado o HTML ou bloqueado a resposta.");
  }

  return ads;
}

export async function politeDelay(ms = 2500) {
  await sleep(ms);
}
