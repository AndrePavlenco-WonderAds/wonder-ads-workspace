// KV do Reviews Hub. Tudo debaixo de `rhub:<slug>:…`, chaves novas desta
// funcionalidade — nada aqui mexe em chaves de outras partes da app.
//
//   rhub:<slug>:locations        HubLocation[]  (perfis GMB + conta de cada um)
//   rhub:<slug>:reviews:<locId>:<n>  HubReview[] (blocos de 300 por salão — cada
//                                                escrita fica muito abaixo do
//                                                limite de 1 MB por pedido)
//   rhub:<slug>:chunks           Record<locId, nº de blocos>
//   rhub:<slug>:settings         HubSettings
//   rhub:<slug>:drafts           Record<reviewId, HubDraft>
//   rhub:<slug>:sync             HubSyncState
//   rhub:<slug>:summary          HubSummary     (o chip do SEO lê só isto)
//   rhub:<slug>:activity         HubActivity[]  (as últimas 150)
//   rhub:<slug>:lock             trinco da sync (SET NX EX)
//   rhub:<slug>:dfs              DfsState (tarefas da DataForSEO em curso)

import { kv } from "@vercel/kv";
import { getHubConfig } from "./config";
import { hydrateSettings } from "./defaults";
import { computeSummary } from "./stats";
import type { DfsTask } from "./dataforseo";
import type {
  HubActivity,
  HubDraft,
  HubLocation,
  HubReview,
  HubSettings,
  HubSummary,
  HubSyncState,
} from "./types";

export const hubStoreConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

const k = {
  locations: (s: string) => `rhub:${s}:locations`,
  reviews: (s: string, loc: string, n: number) => `rhub:${s}:reviews:${loc}:${n}`,
  chunks: (s: string) => `rhub:${s}:chunks`,
  settings: (s: string) => `rhub:${s}:settings`,
  drafts: (s: string) => `rhub:${s}:drafts`,
  sync: (s: string) => `rhub:${s}:sync`,
  summary: (s: string) => `rhub:${s}:summary`,
  activity: (s: string) => `rhub:${s}:activity`,
  lock: (s: string) => `rhub:${s}:lock`,
  dfs: (s: string) => `rhub:${s}:dfs`,
};

const ACTIVITY_CAP = 150;
const CHUNK = 300;

const EMPTY_SYNC: HubSyncState = {
  lastSyncAt: null,
  lastFullSyncAt: null,
  ok: true,
  error: null,
  errorKind: null,
};

export async function getLocations(slug: string): Promise<HubLocation[]> {
  if (!hubStoreConfigured) return [];
  const v = await kv.get<HubLocation[]>(k.locations(slug));
  return Array.isArray(v) ? v : [];
}

export async function saveLocations(slug: string, list: HubLocation[]): Promise<void> {
  await kv.set(k.locations(slug), list);
}

async function getChunkMap(slug: string): Promise<Record<string, number>> {
  const v = await kv.get<Record<string, number>>(k.chunks(slug));
  return v && typeof v === "object" ? v : {};
}

async function readChunks(slug: string, loc: string, n: number): Promise<HubReview[]> {
  if (n <= 0) return [];
  const keys = Array.from({ length: n }, (_, i) => k.reviews(slug, loc, i));
  const values = await kv.mget<(HubReview[] | null)[]>(...keys);
  const out: HubReview[] = [];
  for (const v of values) if (Array.isArray(v)) out.push(...v);
  return out;
}

export async function getReviewsForLocation(slug: string, loc: string): Promise<HubReview[]> {
  if (!hubStoreConfigured) return [];
  const map = await getChunkMap(slug);
  return readChunks(slug, loc, map[loc] ?? 0);
}

/** Grava as reviews de um salão em blocos e apaga os blocos que sobrarem de
 *  uma gravação anterior maior. */
export async function saveReviewsForLocation(
  slug: string,
  loc: string,
  list: HubReview[],
): Promise<void> {
  const map = await getChunkMap(slug);
  const before = map[loc] ?? 0;
  const count = Math.ceil(list.length / CHUNK);
  for (let i = 0; i < count; i++) {
    await kv.set(k.reviews(slug, loc, i), list.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  for (let i = count; i < before; i++) await kv.del(k.reviews(slug, loc, i));
  if (before !== count) {
    // Relê o mapa: outro salão pode ter mudado entretanto na mesma sync.
    const fresh = await getChunkMap(slug);
    await kv.set(k.chunks(slug), { ...fresh, [loc]: count });
  }
}

/** Todas as reviews, de todos os salões (um MGET por salão, em paralelo). */
export async function getAllReviews(
  slug: string,
  locations?: HubLocation[],
): Promise<HubReview[]> {
  if (!hubStoreConfigured) return [];
  const locs = locations ?? (await getLocations(slug));
  if (locs.length === 0) return [];
  const map = await getChunkMap(slug);
  const lists = await Promise.all(locs.map((l) => readChunks(slug, l.id, map[l.id] ?? 0)));
  const out = lists.flat();
  out.sort((a, b) => b.created.localeCompare(a.created));
  return out;
}

export async function getSettings(slug: string): Promise<HubSettings> {
  const cfg = getHubConfig(slug);
  const signature = cfg?.defaultSignature ?? "";
  if (!hubStoreConfigured) return hydrateSettings(null, signature);
  const raw = await kv.get<Partial<HubSettings>>(k.settings(slug));
  return hydrateSettings(raw, signature);
}

export async function saveSettings(slug: string, settings: HubSettings): Promise<void> {
  await kv.set(k.settings(slug), { ...settings, updatedAt: Date.now() });
}

export async function getDrafts(slug: string): Promise<Record<string, HubDraft>> {
  if (!hubStoreConfigured) return {};
  const v = await kv.get<Record<string, HubDraft>>(k.drafts(slug));
  return v && typeof v === "object" ? v : {};
}

export async function saveDrafts(slug: string, drafts: Record<string, HubDraft>): Promise<void> {
  await kv.set(k.drafts(slug), drafts);
}

/** Lê-modifica-grava dos rascunhos. Os rascunhos são poucos e mexidos por
 *  poucas pessoas; a janela de corrida é a do próprio pedido. */
export async function updateDrafts(
  slug: string,
  fn: (drafts: Record<string, HubDraft>) => Record<string, HubDraft>,
): Promise<Record<string, HubDraft>> {
  const next = fn(await getDrafts(slug));
  await saveDrafts(slug, next);
  return next;
}

export async function getSyncState(slug: string): Promise<HubSyncState> {
  if (!hubStoreConfigured) return EMPTY_SYNC;
  const v = await kv.get<HubSyncState>(k.sync(slug));
  return v ? { ...EMPTY_SYNC, ...v } : EMPTY_SYNC;
}

export async function saveSyncState(slug: string, state: HubSyncState): Promise<void> {
  await kv.set(k.sync(slug), state);
}

export async function getSummary(slug: string): Promise<HubSummary | null> {
  if (!hubStoreConfigured) return null;
  return (await kv.get<HubSummary>(k.summary(slug))) ?? null;
}

/** Recalcula o resumo do chip a partir do estado atual. */
export async function refreshSummary(
  slug: string,
  input?: {
    reviews?: HubReview[];
    locations?: HubLocation[];
    drafts?: Record<string, HubDraft>;
  },
): Promise<HubSummary> {
  const locations = input?.locations ?? (await getLocations(slug));
  const [reviews, drafts, sync] = await Promise.all([
    input?.reviews ?? getAllReviews(slug, locations),
    input?.drafts ?? getDrafts(slug),
    getSyncState(slug),
  ]);
  const summary = computeSummary(reviews, locations, drafts, sync.lastSyncAt);
  await kv.set(k.summary(slug), summary);
  return summary;
}

export async function getActivity(slug: string): Promise<HubActivity[]> {
  if (!hubStoreConfigured) return [];
  const v = await kv.get<HubActivity[]>(k.activity(slug));
  return Array.isArray(v) ? v : [];
}

export async function logActivity(slug: string, entry: HubActivity): Promise<void> {
  const list = await getActivity(slug);
  list.unshift(entry);
  await kv.set(k.activity(slug), list.slice(0, ACTIVITY_CAP));
}

/** Trinco da sync — impede duas sincronizações ao mesmo tempo (o cron e um
 *  clique em «Sincronizar agora»). Expira sozinho se a função morrer. */
export async function acquireSyncLock(slug: string, seconds = 290): Promise<boolean> {
  const r = await kv.set(k.lock(slug), Date.now(), { nx: true, ex: seconds });
  return r === "OK";
}

export async function releaseSyncLock(slug: string): Promise<void> {
  await kv.del(k.lock(slug));
}

export async function isSyncRunning(slug: string): Promise<boolean> {
  if (!hubStoreConfigured) return false;
  return (await kv.exists(k.lock(slug))) === 1;
}

/** Aplica uma resposta publicada à review guardada (sem esperar pela sync).
 *  Só reescreve o bloco onde a review está. */
export async function applyReplyToStoredReview(
  slug: string,
  loc: string,
  reviewId: string,
  reply: HubReview["reply"],
): Promise<HubReview | null> {
  const map = await getChunkMap(slug);
  const n = map[loc] ?? 0;
  for (let i = 0; i < n; i++) {
    const chunk = await kv.get<HubReview[]>(k.reviews(slug, loc, i));
    if (!Array.isArray(chunk)) continue;
    const idx = chunk.findIndex((r) => r.id === reviewId);
    if (idx < 0) continue;
    chunk[idx] = { ...chunk[idx], reply };
    await kv.set(k.reviews(slug, loc, i), chunk);
    return chunk[idx];
  }
  return null;
}

/** O que está em curso na DataForSEO (só no modo de leitura). */
export type DfsState = {
  tasks: Record<string, DfsTask>;
  /** Última tarefa pedida por salão. */
  lastPostAt: Record<string, number>;
  /** Última leitura completa por salão. */
  fullAt: Record<string, number>;
};

export async function getDfsState(slug: string): Promise<DfsState> {
  const v = hubStoreConfigured ? await kv.get<Partial<DfsState>>(k.dfs(slug)) : null;
  return { tasks: v?.tasks ?? {}, lastPostAt: v?.lastPostAt ?? {}, fullAt: v?.fullAt ?? {} };
}

export async function saveDfsState(slug: string, state: DfsState): Promise<void> {
  await kv.set(k.dfs(slug), state);
}
