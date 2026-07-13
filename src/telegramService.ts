import axios from "axios";
import { AlertConfig, ScoredAd } from "./types.js";

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
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const message = [
    "🔴 <b>Novo anúncio encontrado!</b>",
    "",
    `<b>${levelLabels[ad.classificacao]}</b>`,
    "",
    `🎯 <b>Alerta:</b> ${escapeHtml(alert.nome)}`,
    `📌 <b>Produto:</b> ${escapeHtml(ad.titulo)}`,
    `💰 <b>Preço:</b> ${escapeHtml(formatPrice(ad))}`,
    `📍 <b>Local:</b> ${escapeHtml(ad.localizacao ?? "Não informado")}`,
    `📊 <b>Score:</b> ${ad.score}`,
    `🔗 <b>Link:</b> ${escapeHtml(ad.link)}`
  ].join("\n");

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
}
