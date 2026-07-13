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
  ordenarPorRecentes?: boolean;
  quantidadeMaximaPorExecucao?: number;
  enviarTelegram?: boolean;
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
};

export type OpportunityLevel = "alta" | "media" | "baixa";

export type SentAd = {
  id: string;
  url: string;
  sentAt: string;
};

export type StorageData = SentAd[];

export type RunStats = {
  alertsProcessed: number;
  adsFound: number;
  adsSent: number;
  adsSkipped: number;
  errors: number;
};
