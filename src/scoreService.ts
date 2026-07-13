import { AlertConfig, OlxAd, OpportunityLevel, ScoredAd } from "./types.js";

const positiveWords = ["urgente", "hoje", "preciso vender", "desapego", "baixei", "abaixei", "barato", "negociavel"];
const negativeWords = ["defeito", "sem teste", "trincado", "quebrado", "sucata", "nao liga", "não liga", "retirada de pecas", "retirada de peças"];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function classify(score: number): OpportunityLevel {
  if (score >= 75) return "alta";
  if (score >= 45) return "media";
  return "baixa";
}

export function scoreAd(alert: AlertConfig, ad: OlxAd): ScoredAd {
  const reasons: string[] = [];
  let score = 45;
  const text = normalize(`${ad.titulo} ${ad.descricaoCurta ?? ""}`);

  if (typeof ad.preco === "number" && typeof alert.precoMaximo === "number") {
    const discountRatio = (alert.precoMaximo - ad.preco) / alert.precoMaximo;

    if (discountRatio >= 0.3) {
      score += 30;
      reasons.push("preco muito abaixo do teto");
    } else if (discountRatio >= 0.15) {
      score += 18;
      reasons.push("preco abaixo do teto");
    } else if (discountRatio >= 0) {
      score += 8;
      reasons.push("preco dentro do alvo");
    }
  }

  for (const word of positiveWords) {
    if (text.includes(normalize(word))) {
      score += 8;
      reasons.push(`termo positivo: ${word}`);
    }
  }

  for (const word of negativeWords) {
    if (text.includes(normalize(word))) {
      score -= 18;
      reasons.push(`termo negativo: ${word}`);
    }
  }

  if (ad.titulo.length > 12) {
    score += 4;
  }

  if (ad.localizacao) {
    score += 3;
  }

  const finalScore = clamp(Math.round(score), 0, 100);

  return {
    ...ad,
    score: finalScore,
    classificacao: classify(finalScore),
    motivosScore: reasons
  };
}
