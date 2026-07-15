export type AlertConfig = {
  id: string;
  nome: string;
  ativo: boolean;
  termoBusca: string;
  urlBuscaOlx?: string;
  precoMinimo?: number;
  precoMaximo?: number;
  palavrasObrigatorias: string[];
  palavrasObrigatoriasTodas?: string[];
  palavrasBloqueadas?: string[];
  categorias?: string[];
  scoreMinimo?: number;
  maxPaginas?: number;
  quantidadeMaximaPorExecucao?: number;
  enviarTelegram?: boolean;
  telegramChatId?: string | number;
  whatsappPhone?: string;
  whatsappApiKey?: string;
};

export type OlxAd = {
  id: string;
  titulo: string;
  preco?: number;
  precoTexto?: string;
  link: string;
  localizacao?: string;
  data?: string;
  descricaoCurta?: string;
};

export type ScoredAd = OlxAd & {
  score: number;
  classificacao: OpportunityLevel;
  motivosScore: string[];
  isPriceDrop?: boolean;
  oldPriceTexto?: string;
};

export type OpportunityLevel = "alta" | "media" | "baixa";

export type AdHistory = {
  priceTexto: string;
  date: string;
};

export type SentAd = {
  id: string;
  url: string;
  sentAt: string;
  title?: string;
  priceTexto?: string;
  score?: number;
  level?: OpportunityLevel;
  history?: AdHistory[];
};

export type StorageData = SentAd[];

export type RunStats = {
  alertsProcessed: number;
  adsFound: number;
  adsSent: number;
  adsSkipped: number;
  errors: number;
};
