import { AlertConfig, OlxAd } from "./types.js";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const containsAny = (text: string, words: string[]) =>
  words.some((word) => text.includes(normalize(word)));

const containsRequiredWords = (text: string, words: string[]) => {
  if (words.length === 0) return true;
  return words.some((word) => text.includes(normalize(word)));
};

const containsAllRequiredWords = (text: string, words: string[]) =>
  words.every((word) => text.includes(normalize(word)));

export function shouldKeepAd(alert: AlertConfig, ad: OlxAd): { keep: boolean; reason?: string } {
  const text = normalize(`${ad.titulo} ${ad.descricaoCurta ?? ""}`);
  const title = normalize(ad.titulo);

  if (!containsRequiredWords(title, alert.palavrasObrigatorias)) {
    return { keep: false, reason: "titulo nao contem palavras obrigatorias" };
  }

  if (!containsAllRequiredWords(title, alert.palavrasObrigatoriasTodas ?? [])) {
    return { keep: false, reason: "titulo nao contem todas as palavras obrigatorias" };
  }

  if (containsAny(text, alert.palavrasBloqueadas ?? [])) {
    return { keep: false, reason: "contem palavra bloqueada" };
  }

  if (typeof alert.precoMinimo === "number" && typeof ad.preco === "number" && ad.preco < alert.precoMinimo) {
    return { keep: false, reason: "preco abaixo do minimo configurado" };
  }

  if (typeof alert.precoMaximo === "number" && typeof ad.preco === "number" && ad.preco > alert.precoMaximo) {
    return { keep: false, reason: "preco acima do maximo configurado" };
  }

  if ((typeof alert.precoMinimo === "number" || typeof alert.precoMaximo === "number") && typeof ad.preco !== "number") {
    return { keep: false, reason: "preco nao identificado" };
  }

  return { keep: true };
}
