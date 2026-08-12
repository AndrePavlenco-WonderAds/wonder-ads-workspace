// Web Dept project board — KV-backed state for the Kanban board, the
// per-project detail pages, the activity log, and the per-project asset
// + credential vault.
//
// Storage layout (all under the `web:` namespace):
//   web:project:<id>      → WebProject JSON (credential secrets are
//                           stored as opaque ciphertext, never plain)
//   web:projects:index    → Redis SET of project ids
//   web:activity          → Redis LIST (newest first), capped to MAX_LOG
//
// Mirrors the get/set + normalise discipline of roadmap-store: every
// write runs through `normaliseProject` so a bad client payload can't
// corrupt the blob, and the public serializer strips ciphertext before
// anything reaches the browser.

import { kv } from "@vercel/kv";
import { encryptSecret, isEncrypted } from "./web-creds";
import {
  WEB_CRED_KINDS,
  WEB_PRIORITIES,
  WEB_STATUSES,
  normaliseStoredRevisions,
  slugify,
  type PublicWebAssets,
  type PublicWebProject,
  type WebActivity,
  type WebAssetFile,
  type WebComment,
  type WebCredKind,
  type DeliveryRevision,
  type WebDeliveryRights,
  type WebResource,
  type WebStatus,
} from "./web-shared";

// Re-export the shared presentation enums/labels so server callers can
// keep importing them from the store.
export {
  WEB_STATUSES,
  WEB_STATUS_LABEL,
  WEB_PRIORITIES,
  WEB_CRED_KINDS,
} from "./web-shared";
export type {
  WebStatus,
  WebPriority,
  WebCredKind,
  WebComment,
  WebAssetFile,
  WebDeliveryRights,
  WebResource,
  PublicWebProject,
  WebActivity,
  WebActivityKind,
} from "./web-shared";

const PROJECT_PREFIX = "web:project:";
const INDEX_KEY = "web:projects:index";
const ACTIVITY_KEY = "web:activity";
const MAX_LOG = 500;

export const webStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// ---------------------------------------------------------------------------
// Server-only types — carry the encrypted secret the public shapes drop.
// ---------------------------------------------------------------------------

/** A single access credential. `secretEnc` is ciphertext from
 *  web-creds.encryptSecret — NEVER sent to the browser (stripped by
 *  toPublicProject). */
export type WebCredential = {
  id: string;
  label: string;
  kind: WebCredKind;
  url?: string;
  username?: string;
  secretEnc?: string;
  notes?: string;
  updatedAt: number;
};

export type WebProjectAssets = {
  notes: string;
  dos: string[];
  donts: string[];
  brandingKitUrl?: string;
  brandingFiles: WebAssetFile[];
  onboardingFormUrl?: string;
  onboardingFiles: WebAssetFile[];
  files: WebAssetFile[];
  credentials: WebCredential[];
  resources: WebResource[];
};

export type WebProject = {
  id: string;
  name: string;
  clientName: string;
  clientSlug: string;
  assigneeUsername: string;
  assigneeName: string;
  status: WebStatus;
  priority: import("./web-shared").WebPriority;
  startDate: string | null;
  /** Linhas de re-planeamento da entrega — ver DeliveryRevision. */
  deliveryRevisions: DeliveryRevision[];
  /** Data de entrega prevista — trancada depois de gravada. Ver
   *  `resolveDeadline` para a regra completa. */
  deadline: string | null;
  deadlineSetByUsername: string | null;
  deadlineSetByName: string | null;
  deadlineSetAt: number | null;
  order: number;
  comments: WebComment[];
  assets: WebProjectAssets;
  createdAt: number;
  updatedAt: number;
};

// ---------------------------------------------------------------------------
// id + small helpers
// ---------------------------------------------------------------------------

export function newId(prefix = "p"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  // Accept yyyy-mm-dd; anything unparseable becomes null.
  return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fb;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function strList(v: unknown): string[] {
  return arr(v)
    .map((x) => str(x).trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Normalisation — every PUT/POST payload is sanitised before it touches
// KV. Secrets are handled specially: a payload carries a credential's
// NEW plaintext under `secret`; if present + non-empty we encrypt it,
// otherwise we keep the prior ciphertext (looked up from `prevById`).
// ---------------------------------------------------------------------------

function normaliseFile(v: unknown): WebAssetFile | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const url = str(o.url).trim();
  if (!url) return null;
  return {
    id: str(o.id) || newId("f"),
    name: str(o.name) || url,
    url,
    kind: oneOf(o.kind, ["image", "video", "document", "link"] as const, "link"),
    addedAt: num(o.addedAt, Date.now()),
  };
}

function normaliseCredential(
  v: unknown,
  prev: Map<string, WebCredential>,
): WebCredential | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const id = str(o.id) || newId("c");
  const label = str(o.label).trim();
  if (!label) return null;
  const existing = prev.get(id);

  // Secret resolution: a fresh plaintext under `secret` wins; if the
  // payload instead echoes back ciphertext under `secretEnc` keep it;
  // otherwise inherit the previous record's ciphertext. An explicit
  // empty `secret` ("") clears it.
  let secretEnc: string | undefined = existing?.secretEnc;
  if (typeof o.secret === "string") {
    secretEnc = o.secret.trim() ? encryptSecret(o.secret) : undefined;
  } else if (typeof o.secretEnc === "string" && isEncrypted(o.secretEnc)) {
    secretEnc = o.secretEnc;
  }

  return {
    id,
    label,
    kind: oneOf(o.kind, WEB_CRED_KINDS, "other"),
    url: str(o.url).trim() || undefined,
    username: str(o.username).trim() || undefined,
    secretEnc,
    notes: str(o.notes).trim() || undefined,
    updatedAt: num(o.updatedAt, Date.now()),
  };
}

export function normaliseAssets(
  v: unknown,
  prev?: WebProjectAssets,
): WebProjectAssets {
  const o = (v ?? {}) as Record<string, unknown>;
  const prevCreds = new Map(
    (prev?.credentials ?? []).map((c) => [c.id, c] as const),
  );
  return {
    notes: str(o.notes),
    dos: strList(o.dos),
    donts: strList(o.donts),
    brandingKitUrl: str(o.brandingKitUrl).trim() || undefined,
    brandingFiles: arr(o.brandingFiles)
      .map(normaliseFile)
      .filter((f): f is WebAssetFile => f !== null),
    onboardingFormUrl: str(o.onboardingFormUrl).trim() || undefined,
    onboardingFiles: arr(o.onboardingFiles)
      .map(normaliseFile)
      .filter((f): f is WebAssetFile => f !== null),
    files: arr(o.files)
      .map(normaliseFile)
      .filter((f): f is WebAssetFile => f !== null),
    credentials: arr(o.credentials)
      .map((c) => normaliseCredential(c, prevCreds))
      .filter((c): c is WebCredential => c !== null),
    resources: arr(o.resources)
      .map((r) => {
        const ro = (r ?? {}) as Record<string, unknown>;
        const url = str(ro.url).trim();
        const label = str(ro.label).trim();
        if (!url && !label) return null;
        return { id: str(ro.id) || newId("r"), label: label || url, url };
      })
      .filter((r): r is WebResource => r !== null),
  };
}

// ---------------------------------------------------------------------------
// Data de entrega prevista — o único campo do projeto que o payload NÃO
// manda. É write-once: quem tem `canSet` põe-na uma vez, e a partir daí
// só `canOverride` (SuperAdmin) lhe toca. Tudo o resto do payload é
// aceite normalmente, por isso um board desatualizado a reenviar a data
// antiga continua a poder mover cards e editar campos.
// ---------------------------------------------------------------------------

type DeadlineState = {
  deadline: string | null;
  deadlineSetByUsername: string | null;
  deadlineSetByName: string | null;
  deadlineSetAt: number | null;
};

/** Porque é que um write à data foi recusado:
 *  - "locked"    → já existe uma data e o autor não é SuperAdmin.
 *  - "forbidden" → ainda não existe data mas o autor não é do dept Web. */
export type DeadlineDenial = "locked" | "forbidden";

export const DEADLINE_DENIAL_MESSAGE: Record<DeadlineDenial, string> = {
  locked:
    "A data de entrega prevista já foi definida e não pode ser alterada. Só um SuperAdmin a pode corrigir.",
  // Sem "projeto" no texto: a mesma mensagem serve projetos e tickets
  // desde a v76.50.
  forbidden:
    "Só o departamento Web pode definir a data de entrega prevista.",
};

/** Diz se o payload tenta mexer na data sem ter direito a isso. Devolve
 *  `null` quando o write é legítimo — incluindo o caso mais comum, em que
 *  a data vem igual à guardada e portanto não há alteração nenhuma. */
export function deadlineWriteDenial(
  payload: unknown,
  // Só se lê `prev.deadline` — por isso o parâmetro aceita qualquer coisa
  // que tenha data de entrega. É o que permite aos TICKETS usarem esta
  // mesma função (v76.50) em vez de terem uma cópia da regra que mais tarde
  // divergiria da dos projetos.
  prev: { deadline: string | null } | null | undefined,
  rights: WebDeliveryRights,
): DeadlineDenial | null {
  const o = (payload ?? {}) as Record<string, unknown>;
  const requested = isoOrNull(o.deadline);
  const current = prev?.deadline ?? null;
  if (requested === current) return null;
  if (current !== null) return rights.canOverride ? null : "locked";
  return rights.canSet ? null : "forbidden";
}

/** Resolve o estado final da data a partir do payload + do que está
 *  guardado. Nunca lança: um write sem direitos devolve simplesmente o
 *  estado anterior intacto, para que uma rota que se esqueça de chamar
 *  `deadlineWriteDenial` falhe fechada em vez de aberta. */
function resolveDeadline(
  o: Record<string, unknown>,
  prev: WebProject | null | undefined,
  rights: WebDeliveryRights,
  actor: { username: string; name: string } | undefined,
  now: number,
): DeadlineState {
  const current = prev?.deadline ?? null;
  const keep: DeadlineState = {
    deadline: current,
    deadlineSetByUsername: prev?.deadlineSetByUsername ?? null,
    deadlineSetByName: prev?.deadlineSetByName ?? null,
    deadlineSetAt: prev?.deadlineSetAt ?? null,
  };

  const requested = isoOrNull(o.deadline);
  if (requested === current) return keep;

  const allowed = current !== null ? rights.canOverride : rights.canSet;
  if (!allowed) return keep;

  // Limpar a data destranca-a — é a única saída para um engano gravado,
  // e só um SuperAdmin lá chega (current !== null ⇒ canOverride).
  if (requested === null) {
    return {
      deadline: null,
      deadlineSetByUsername: null,
      deadlineSetByName: null,
      deadlineSetAt: null,
    };
  }

  return {
    deadline: requested,
    deadlineSetByUsername: actor?.username ?? null,
    deadlineSetByName: actor?.name ?? null,
    deadlineSetAt: now,
  };
}

function normaliseComment(v: unknown): WebComment | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const body = str(o.body).trim();
  if (!body) return null;
  return {
    id: str(o.id) || newId("m"),
    authorUsername: str(o.authorUsername),
    authorName: str(o.authorName) || "Someone",
    body,
    createdAt: num(o.createdAt, Date.now()),
  };
}

/** Sanitise a full project payload. `prev` (the stored record) lets us
 *  preserve credential ciphertext + createdAt across edits.
 *
 *  `opts.rights` decide se a data de entrega prevista no payload é aceite
 *  ou ignorada; omitir `opts` é o mesmo que não ter direito nenhum, por
 *  isso um caller distraído nunca abre a tranca por acidente. */
export function normaliseProject(
  v: unknown,
  id: string,
  prev?: WebProject | null,
  opts?: {
    rights?: WebDeliveryRights;
    actor?: { username: string; name: string };
  },
): WebProject {
  const o = (v ?? {}) as Record<string, unknown>;
  const now = Date.now();
  const delivery = resolveDeadline(
    o,
    prev,
    opts?.rights ?? { canSet: false, canOverride: false },
    opts?.actor,
    now,
  );
  return {
    id,
    name: str(o.name).trim() || "Untitled project",
    clientName: str(o.clientName).trim(),
    // Explicit slug wins; otherwise derive from the client name so legacy
    // records (saved before the registry existed) still join their client.
    clientSlug: slugify(str(o.clientSlug).trim() || str(o.clientName)),
    assigneeUsername: str(o.assigneeUsername).trim(),
    assigneeName: str(o.assigneeName).trim() || "Unassigned",
    status: oneOf(o.status, WEB_STATUSES, "negotiation"),
    priority: oneOf(o.priority, WEB_PRIORITIES, "medium"),
    startDate: isoOrNull(o.startDate),
    ...delivery,
    deliveryRevisions: normaliseStoredRevisions(o.deliveryRevisions),
    order: num(o.order, now),
    comments: arr(o.comments)
      .map(normaliseComment)
      .filter((c): c is WebComment => c !== null),
    assets: normaliseAssets(o.assets, prev?.assets),
    createdAt: prev?.createdAt ?? num(o.createdAt, now),
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Public serialization — strip ciphertext before crossing to the client.
// ---------------------------------------------------------------------------

/** Strip credential ciphertext from an asset bundle, replacing each
 *  secret with a `hasSecret` flag. Shared by projects + the client
 *  registry so neither ever leaks a `secretEnc` to the browser. */
export function toPublicAssets(assets: WebProjectAssets): PublicWebAssets {
  return {
    ...assets,
    credentials: assets.credentials.map((c) => {
      const { secretEnc, ...rest } = c;
      return { ...rest, hasSecret: Boolean(secretEnc) };
    }),
  };
}

export function toPublicProject(p: WebProject): PublicWebProject {
  return { ...p, assets: toPublicAssets(p.assets) };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Mesma razão do `hydrateTicket`: campos acrescentados depois já não estão
 *  nos projetos antigos do KV, e as leituras não passam por
 *  `normaliseProject`. Sem isto, mover um projeto anterior à v76.52 de
 *  Client Feedback para In Progress dava 500 ao espalhar um
 *  `deliveryRevisions` inexistente. */
function hydrateProject(p: WebProject): WebProject {
  return {
    ...p,
    comments: Array.isArray(p.comments) ? p.comments : [],
    deliveryRevisions: Array.isArray(p.deliveryRevisions)
      ? p.deliveryRevisions
      : [],
    deadline: p.deadline ?? null,
    deadlineSetByUsername: p.deadlineSetByUsername ?? null,
    deadlineSetByName: p.deadlineSetByName ?? null,
    deadlineSetAt: p.deadlineSetAt ?? null,
  };
}

export async function getProject(id: string): Promise<WebProject | null> {
  if (!webStorageConfigured) return null;
  const raw = await kv.get<WebProject>(PROJECT_PREFIX + id);
  return raw ? hydrateProject(raw) : null;
}

export async function getAllProjects(): Promise<WebProject[]> {
  if (!webStorageConfigured) return [];
  const ids = await kv.smembers(INDEX_KEY);
  if (!ids || ids.length === 0) return [];
  const keys = ids.map((id) => PROJECT_PREFIX + id);
  const rows = await kv.mget<WebProject[]>(...keys);
  return rows.filter((r): r is WebProject => Boolean(r)).map(hydrateProject);
}

export async function saveProject(p: WebProject): Promise<void> {
  if (!webStorageConfigured) return;
  await kv.set(PROJECT_PREFIX + p.id, p);
  await kv.sadd(INDEX_KEY, p.id);
}

export async function deleteProject(id: string): Promise<void> {
  if (!webStorageConfigured) return;
  await kv.del(PROJECT_PREFIX + id);
  await kv.srem(INDEX_KEY, id);
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export async function logActivity(
  entry: Omit<WebActivity, "id" | "at"> & { at?: number },
): Promise<void> {
  if (!webStorageConfigured) return;
  const full: WebActivity = {
    id: newId("a"),
    at: entry.at ?? Date.now(),
    ...entry,
  };
  await kv.lpush(ACTIVITY_KEY, JSON.stringify(full));
  await kv.ltrim(ACTIVITY_KEY, 0, MAX_LOG - 1);
}

export async function getActivity(limit = 200): Promise<WebActivity[]> {
  if (!webStorageConfigured) return [];
  const rows = await kv.lrange<string | WebActivity>(ACTIVITY_KEY, 0, limit - 1);
  return rows
    .map((r) => {
      if (typeof r === "string") {
        try {
          return JSON.parse(r) as WebActivity;
        } catch {
          return null;
        }
      }
      // @vercel/kv may auto-deserialize JSON strings on read.
      return r as WebActivity;
    })
    .filter((r): r is WebActivity => Boolean(r));
}
