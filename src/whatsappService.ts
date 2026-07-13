import axios from "axios";
import { AlertConfig, ScoredAd } from "./types.js";
import { logger } from "./logger.js";

const levelLabels = {
  alta: "🔥 Oportunidade alta",
  media: "🟡 Oportunidade media",
  baixa: "⚪ Oportunidade baixa"
};

function formatPrice(ad: ScoredAd) {
  if (ad.precoTexto) return ad.precoTexto;
  if (typeof ad.preco === "number") {
    return ad.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return "Preço não informado";
}

export async function sendWhatsappMessage(alert: AlertConfig, ad: ScoredAd) {
  const apiKey = alert.whatsappApiKey || process.env.CALLMEBOT_API_KEY;
  const phone = alert.whatsappPhone || process.env.WHATSAPP_PHONE || process.env.CALLMEBOT_PHONE;

  if (!apiKey || !phone) {
    logger.error("API Key ou número de telefone do WhatsApp ausentes.");
    return;
  }

  const alertHeader = ad.isPriceDrop
    ? `📉 *REDUÇÃO DE PREÇO!*\nDe ~${ad.oldPriceTexto || ""}~ para *${formatPrice(ad)}*\n`
    : "🔴 *Novo anúncio encontrado!*\n";

  const rawMessage = [
    alertHeader,
    `*${levelLabels[ad.classificacao]}*`,
    "",
    `🎯 *Alerta:* ${alert.nome}`,
    `📌 *Produto:* ${ad.titulo}`,
    `💰 *Preço:* ${formatPrice(ad)}`,
    `📍 *Local:* ${ad.localizacao ?? "Não informado"}`,
    `📊 *Score:* ${ad.score}`,
    `🔗 *Link:* ${ad.link}`
  ].join("\n");

  const message = encodeURIComponent(rawMessage);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${message}&apikey=${apiKey}`;

  try {
    await axios.get(url, { timeout: 15000 });
    logger.info(`Mensagem enviada com sucesso pelo WhatsApp para o número ${phone}.`);
  } catch (error) {
    logger.error("Erro ao enviar mensagem pelo WhatsApp:", error);
  }
}
