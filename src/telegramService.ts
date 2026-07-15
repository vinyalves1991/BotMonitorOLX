import axios from "axios";
import { AlertConfig, ScoredAd } from "./types.js";
import { logger } from "./logger.js";

const levelLabels = {
  alta: "🔥 Oportunidade alta",
  media: "🟡 Oportunidade média",
  baixa: "⚪ Oportunidade baixa"
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatPrice(ad: ScoredAd) {
  if (ad.precoTexto) return ad.precoTexto;
  if (typeof ad.preco === "number") {
    return ad.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return "Preço não informado";
}

export function validateTelegramEnv() {
  const missing = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Variaveis obrigatorias ausentes: ${missing.join(", ")}. Configure .env ou GitHub Secrets.`);
  }
}

export async function sendTelegramMessage(alert: AlertConfig, ad: ScoredAd) {
  validateTelegramEnv();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = alert.telegramChatId || process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const alertHeader = ad.isPriceDrop
    ? `📉 <b>REDUÇÃO DE PREÇO!</b>\nDe <s>${escapeHtml(ad.oldPriceTexto || "")}</s> para <b>${escapeHtml(formatPrice(ad))}</b>\n`
    : "🔴 <b>Novo anúncio encontrado!</b>\n";

  const message = [
    alertHeader,
    `<b>${levelLabels[ad.classificacao]}</b>`,
    "",
    `🎯 <b>Alerta:</b> ${escapeHtml(alert.nome)}`,
    `📌 <b>Produto:</b> ${escapeHtml(ad.titulo)}`,
    `💰 <b>Preço:</b> ${escapeHtml(formatPrice(ad))}`,
    `📍 <b>Local:</b> ${escapeHtml(ad.localizacao ?? "Não informado")}`,
    `📊 <b>Score:</b> ${ad.score}`,
    `🔗 <b>Link:</b> ${escapeHtml(ad.link)}`
  ].join("\n");

  try {
    await axios.post(
      url,
      {
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false
      },
      { timeout: 15000 }
    );
  } catch (error: any) {
    logger.error("Erro ao enviar mensagem pelo Telegram:", error?.response?.data || error.message);
  }
}
