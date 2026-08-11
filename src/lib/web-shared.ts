// Client-safe shared types + presentation constants for the Web Dept
// board. Deliberately free of any server-only imports (no node:crypto,
// no @vercel/kv) so it can be pulled into "use client" components. The
// KV store (web-projects-store.ts) re-uses these types and adds the
// server-only `secretEnc` fields + persistence on top.

export const WEB_STATUSES = [
  "negotiation",
  "in_progress",
  "client_feedback",
  "migration",
  "done",
] as const;
export type WebStatus = (typeof WEB_STATUSES)[number];

export const WEB_STATUS_LABEL: Record<WebStatus, string> = {
  negotiation: "Not Started",
  in_progress: "In Progress",
  client_feedback: "Client Feedback",
  migration: "Migration",
  done: "Done",
};

/** Tailwind class bundles per status — board column accent + card tag. */
export const WEB_STATUS_META: Record<
  WebStatus,
  { label: string; short: string; dot: string; tag: string; column: string }
> = {
  negotiation: {
    label: "Not Started",
    short: "Not Started",
    dot: "bg-white/55",
    tag: "border-white/20 bg-white/[0.06] text-white/75",
    column: "border-white/12",
  },
  in_progress: {
    label: "In Progress",
    short: "In Progress",
    dot: "bg-amber-400",
    tag: "border-amber-400/40 bg-amber-500/15 text-amber-100",
    column: "border-amber-400/35",
  },
  client_feedback: {
    label: "Client Feedback",
    short: "Client Feedback",
    dot: "bg-violet-400",
    tag: "border-violet-400/40 bg-violet-500/20 text-violet-100",
    column: "border-violet-400/35",
  },
  migration: {
    label: "Migration",
    short: "Migration",
    dot: "bg-sky-400",
    tag: "border-sky-400/40 bg-sky-500/15 text-sky-100",
    column: "border-sky-400/35",
  },
  done: {
    label: "Done",
    short: "Done",
    dot: "bg-emerald-400",
    tag: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
    column: "border-emerald-400/35",
  },
};

export const WEB_PRIORITIES = ["low", "medium", "high"] as const;
export type WebPriority = (typeof WEB_PRIORITIES)[number];

export const WEB_PRIORITY_META: Record<
  WebPriority,
  { label: string; tag: string }
> = {
  low: { label: "Low", tag: "border-white/15 bg-white/[0.05] text-white/65" },
  medium: {
    label: "Med",
    tag: "border-amber-400/35 bg-amber-500/12 text-amber-100",
  },
  high: {
    label: "High",
    tag: "border-rose-400/40 bg-rose-500/15 text-rose-100",
  },
};

/** O que o utilizador pode fazer à data de entrega prevista de um
 *  projeto. Resolvido no servidor por `webDeliveryRights` (credentials.ts)
 *  e passado às páginas — o tipo vive aqui para os componentes "use
 *  client" não terem de importar a tabela de credenciais. */
export type WebDeliveryRights = { canSet: boolean; canOverride: boolean };

/** UMA NOVA LINHA DE ENTREGA PREVISTA (v76.52).
 *
 *  A data de entrega original é write-once de propósito: é o compromisso
 *  assumido, e poder reescrevê-lo à vontade tirava-lhe o valor. Só que a
 *  realidade tem um caso legítimo e frequente — o cliente devolve o
 *  trabalho com um ajuste, a peça volta para produção, e a entrega passa a
 *  ser outra.
 *
 *  Em vez de deixar corrigir a data (que apagaria a promessa anterior),
 *  ACRESCENTA-SE UMA LINHA. Fica o histórico inteiro: o que foi prometido,
 *  quando mudou, porquê e por quem. É a diferença entre «este trabalho
 *  atrasou-se três vezes por causa de revisões do cliente» e «a data é
 *  esta». */
export type DeliveryRevision = {
  id: string;
  /** Nova entrega prevista, ISO yyyy-mm-dd. */
  date: string;
  /** Porque mudou — «Falta animações», «Cliente pediu outra cor». */
  note: string;
  byUsername: string;
  byName: string;
  at: number;
};

/** Uma passagem de Client Feedback de volta para In Progress obriga a uma
 *  nova linha: o trabalho voltou para a mesa, portanto a data anterior já
 *  não é verdade e alguém tem de dizer qual passa a ser. */
export function requiresDeliveryRevision(
  prevStatus: string,
  nextStatus: string,
): boolean {
  return prevStatus === "client_feedback" && nextStatus === "in_progress";
}

export const DELIVERY_REVISION_REQUIRED_MESSAGE =
  "Ao devolver este trabalho a In Progress tens de indicar a nova data de entrega prevista e o que falta.";

/** Normaliza uma linha vinda do payload. null quando é inutilizável — uma
 *  revisão sem data ou sem nota não serve para nada. */
export function normaliseDeliveryRevision(
  v: unknown,
  actor: { username: string; name: string },
  now: number,
): DeliveryRevision | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const date = typeof o.date === "string" ? o.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const note = typeof o.note === "string" ? o.note.trim().slice(0, 500) : "";
  if (!note) return null;
  return {
    id:
      typeof o.id === "string" && o.id
        ? o.id
        : `dr_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    date,
    note,
    byUsername: actor.username,
    byName: actor.name,
    at: typeof o.at === "number" ? o.at : now,
  };
}

/** Linhas já guardadas — usado na leitura, onde o autor não se recalcula. */
export function normaliseStoredRevisions(v: unknown): DeliveryRevision[] {
  if (!Array.isArray(v)) return [];
  const out: DeliveryRevision[] = [];
  for (const raw of v) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const date = typeof o.date === "string" ? o.date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({
      id: typeof o.id === "string" ? o.id : `dr_${out.length}`,
      date,
      note: typeof o.note === "string" ? o.note.slice(0, 500) : "",
      byUsername: typeof o.byUsername === "string" ? o.byUsername : "",
      byName: typeof o.byName === "string" ? o.byName : "—",
      at: typeof o.at === "number" ? o.at : 0,
    });
    if (out.length >= 50) break;
  }
  return out;
}

export const WEB_DELIVERY_LOCKED_HINT =
  "Depois de gravada, a data de entrega prevista fica trancada — só um SuperAdmin a pode corrigir.";

export const WEB_CRED_KINDS = [
  "wordpress",
  "hosting",
  "ftp",
  "domain",
  "database",
  "other",
] as const;
export type WebCredKind = (typeof WEB_CRED_KINDS)[number];

export const WEB_CRED_KIND_LABEL: Record<WebCredKind, string> = {
  wordpress: "WordPress",
  hosting: "Hosting / cPanel",
  ftp: "FTP / SFTP",
  domain: "Domain registrar",
  database: "Database",
  other: "Other",
};

/** Browser-safe slug helper — kept in sync with notion.ts `slugify` so a
 *  client's slug is identical whether derived on the server or client.
 *  This is the universal cross-record key for the Web client registry. */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---- Shared (browser-safe) record shapes ----

export type WebComment = {
  id: string;
  authorUsername: string;
  authorName: string;
  body: string;
  createdAt: number;
};

export type WebAssetFile = {
  id: string;
  name: string;
  url: string;
  kind: "image" | "video" | "document" | "link";
  addedAt: number;
};

export type WebResource = {
  id: string;
  label: string;
  url: string;
};

/** Browser-facing credential — no ciphertext, just whether one is set. */
export type PublicWebCredential = {
  id: string;
  label: string;
  kind: WebCredKind;
  url?: string;
  username?: string;
  notes?: string;
  updatedAt: number;
  hasSecret: boolean;
};

export type PublicWebAssets = {
  notes: string;
  dos: string[];
  donts: string[];
  brandingKitUrl?: string;
  brandingFiles: WebAssetFile[];
  onboardingFormUrl?: string;
  onboardingFiles: WebAssetFile[];
  files: WebAssetFile[];
  credentials: PublicWebCredential[];
  resources: WebResource[];
};

export type PublicWebProject = {
  id: string;
  name: string;
  clientName: string;
  /** Slug of the client registry record this project belongs to. Derived
   *  from clientName when not set explicitly (slugify), so legacy projects
   *  still join the right client. */
  clientSlug: string;
  assigneeUsername: string;
  assigneeName: string;
  status: WebStatus;
  priority: WebPriority;
  startDate: string | null;
  /** DATA DE ENTREGA PREVISTA — o compromisso do departamento Web.
   *  Só o dept Web (e SuperAdmins) a pode pôr, e uma vez gravada fica
   *  trancada: só um SuperAdmin a altera. Ver `webDeliveryRights` +
   *  `resolveDeadline` (web-projects-store), que é onde a regra é
   *  imposta — o browser só reflete o que o servidor já decidiu. */
  deadline: string | null;
  /** Quem trancou a data e quando. `null` em projetos que já tinham
   *  data antes desta regra existir (v76.29) — ficam trancados na mesma,
   *  apenas sem autor conhecido. */
  deadlineSetByUsername: string | null;
  deadlineSetByName: string | null;
  deadlineSetAt: number | null;
  order: number;
  comments: WebComment[];
  assets: PublicWebAssets;
  createdAt: number;
  updatedAt: number;
};

/** Browser-facing client registry record — the canonical, reusable
 *  profile for a client. Credential ciphertext is stripped from `assets`
 *  exactly like a project (see PublicWebAssets). */
export type PublicWebClient = {
  slug: string;
  name: string;
  /** Default web designer for this client — pre-selected when creating a
   *  new project for them. */
  defaultAssigneeUsername: string;
  defaultAssigneeName: string;
  assets: PublicWebAssets;
  createdAt: number;
  updatedAt: number;
};

export type WebActivityKind =
  | "created"
  | "moved"
  | "edited"
  | "comment"
  | "asset"
  | "deleted";

export type WebActivity = {
  id: string;
  projectId: string;
  projectName: string;
  actorUsername: string;
  actorName: string;
  kind: WebActivityKind;
  message: string;
  from?: WebStatus;
  to?: WebStatus;
  at: number;
};
