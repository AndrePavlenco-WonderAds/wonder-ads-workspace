// Tipos partilhados entre o servidor e a página do Reviews Hub. Sem imports
// de servidor — este ficheiro entra no bundle do cliente.

export type StarLevel = 1 | 2 | 3 | 4 | 5;
export const STAR_LEVELS: StarLevel[] = [1, 2, 3, 4, 5];

/** Um perfil GMB do cliente (um salão). */
export type HubLocation = {
  /** O número do location, sem o prefixo «locations/». */
  id: string;
  /** A conta GMB dona do perfil — a API v4 das reviews precisa dela no caminho. */
  accountId: string;
  title: string;
  /** O nome curto do salão: «Alma Shopping» em vez de «Cidália Cabeleireiros - Alma Shopping». */
  short: string;
  locality?: string;
  address?: string;
  mapsUri?: string;
  newReviewUri?: string;
  placeId?: string;
  /** Contagem e média oficiais da Google (incluem reviews sem texto). */
  total?: number;
  average?: number;
  syncedAt?: number;
  /** O último erro deste perfil em particular (os outros seguem). */
  error?: string | null;
};

export type HubReply = {
  text: string;
  /** ISO — a Google devolve a data da última edição da resposta. */
  updated: string;
  /** Quem publicou pela plataforma, quando foi por aqui. */
  via?: "hub" | "auto";
  by?: string;
};

export type HubReview = {
  id: string;
  /** Id do perfil (HubLocation.id). */
  loc: string;
  author: string;
  photo?: string;
  anon?: boolean;
  /** 0 quando a Google não diz a nota (raro). */
  stars: 0 | StarLevel;
  /** O texto no idioma original (a tradução automática da Google é retirada). */
  text: string;
  /** ISO */
  created: string;
  /** ISO */
  updated: string;
  reply?: HubReply;
};

export type ResponseMode = "auto" | "approval" | "manual";

export type Strategy = {
  title: string;
  description: string;
  /** Instruções para a IA, em linguagem natural. */
  guidelines: string;
  /** O que a automação faz com as reviews novas deste nível. */
  mode: ResponseMode;
};

export type HubSettings = {
  automation: {
    enabled: boolean;
    /** A automação só toca em reviews criadas depois deste momento — nunca
     *  responde sozinha ao histórico. */
    enabledAt: number | null;
    updatedBy?: string;
  };
  strategies: Record<`${StarLevel}`, Strategy>;
  signature: string;
  tone: string;
  /** Como o cliente quer ser contactado nos casos negativos (opcional). */
  contactLine: string;
  extraRules: string;
  updatedAt?: number;
};

export type DraftStatus = "draft" | "awaiting_approval" | "failed";

export type HubDraft = {
  reviewId: string;
  loc: string;
  text: string;
  status: DraftStatus;
  source: "manual" | "auto";
  createdAt: number;
  updatedAt: number;
  error?: string;
};

export type SyncErrorKind =
  | "not-configured"
  | "quota"
  | "api-disabled"
  | "permission"
  | "other";

export type HubSyncState = {
  lastSyncAt: number | null;
  lastFullSyncAt: number | null;
  ok: boolean;
  error?: string | null;
  errorKind?: SyncErrorKind | null;
  /** Link da Google Cloud para ativar a API, quando o erro é esse. */
  fixUrl?: string | null;
  reviewsStored?: number;
  locations?: number;
  newLastRun?: number;
};

export type HubActivityKind = "reply" | "auto-reply" | "auto-draft" | "sync" | "settings";

export type HubActivity = {
  at: number;
  kind: HubActivityKind;
  text: string;
  by?: string;
  reviewId?: string;
  loc?: string;
};

/** O resumo gravado a cada sync — alimenta o chip do cabeçalho do SEO sem
 *  ler as reviews todas. */
export type HubSummary = {
  average: number | null;
  total: number;
  unanswered: number;
  negativeUnanswered: number;
  awaitingApproval: number;
  syncedAt: number | null;
};

/** Quem está do outro lado da página. */
export type HubViewer =
  | { kind: "client"; canWrite: true }
  | { kind: "team"; name: string; canWrite: boolean };

/** O estado inicial da página (tudo menos a lista de reviews, que vem a seguir). */
export type HubBootstrap = {
  slug: string;
  brand: string;
  logo: string | null;
  locations: HubLocation[];
  settings: HubSettings;
  sync: HubSyncState;
  drafts: Record<string, HubDraft>;
  activity: HubActivity[];
  summary: HubSummary | null;
  viewer: HubViewer;
};
