// Sincronização das reviews para o KV do Reviews Hub — com duas fontes.
//
// 1. Google (API v4 «Google My Business API»), pela conta de serviço do
//    relatório mensal. Lê e publica. Incremental: as reviews vêm por
//    «updateTime desc», basta ler até passar a última sync (2 dias de folga).
// 2. DataForSEO (Google Reviews API), quando a v4 está desligada/sem quota
//    no projeto da Google Cloud. Só lê; a publicação passa a «Copiar e
//    responder no Google». É assíncrona: cada sync recolhe as tarefas
//    prontas e pede as seguintes (ver dataforseo.ts).
//
// A lista de perfis vem SEMPRE da Google (APIs v1, já aprovadas e ligadas) —
// é daí que saem os place_id que a DataForSEO usa. Cada sync testa a v4 com
// um pedido: no dia em que a API for ligada, a plataforma muda sozinha.

import { getHubConfig } from "./config";
import {
  dfsConfigured,
  getReviewTask,
  postReviewTasks,
  type DfsTask,
} from "./dataforseo";
import {
  GbpError,
  fetchReviewsPage,
  gbpToken,
  googleReviewsConfigured,
  listClientLocations,
  type ReviewsPage,
} from "./google";
import {
  acquireSyncLock,
  getDfsState,
  getDrafts,
  getLocations,
  getReviewsForLocation,
  getSyncState,
  logActivity,
  refreshSummary,
  releaseSyncLock,
  saveDfsState,
  saveDrafts,
  saveLocations,
  saveReviewsForLocation,
  saveSyncState,
} from "./store";
import type { HubLocation, HubReview, HubSyncState } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Refazer a lista de perfis e ler tudo de novo uma vez por semana. */
const FULL_SYNC_EVERY = 7 * DAY;
/** Teto por salão. */
const MAX_REVIEWS_PER_LOCATION = 3000;
const PAUSE_MS = 220;
/** DataForSEO: pedir as mais recentes de cada salão no máximo de 2 em 2 h. */
const DFS_INCREMENTAL_EVERY = 2 * HOUR;
/** DataForSEO: uma tarefa que não volta em 3 h é pedida outra vez. */
const DFS_TASK_TIMEOUT = 3 * HOUR;
/** DataForSEO: quanto tempo uma sync espera pelas tarefas prioritárias. */
const DFS_WAIT_MS = 150_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SyncResult =
  | { status: "running" }
  | { status: "error"; state: HubSyncState }
  | {
      status: "ok";
      state: HubSyncState;
      /** Reviews que não existiam antes desta sync (para a automação). */
      newReviews: HubReview[];
    };

type SourceRun = {
  allReviews: HubReview[];
  newReviews: HubReview[];
  /** reviewId → quando a resposta atual foi publicada/editada. */
  repliedAt: Map<string, number>;
  failures: number;
  firstError: GbpError | null;
  fullDone: boolean;
  pending: number;
};

/** A marca «via hub/auto/manual» de uma resposta nossa sobrevive à sync, e
 *  uma resposta que marcámos há menos de 48 h continua marcada enquanto o
 *  Google ainda não a mostra. */
function carryOver(fresh: HubReview, old: HubReview | undefined): HubReview {
  if (!old?.reply) return fresh;
  const same = (a: string, b: string) =>
    a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
  if (fresh.reply) {
    return old.reply.via && same(fresh.reply.text, old.reply.text)
      ? { ...fresh, reply: { ...fresh.reply, via: old.reply.via, by: old.reply.by } }
      : fresh;
  }
  if (old.reply.via && Date.now() - Date.parse(old.reply.updated) < 2 * DAY) {
    return { ...fresh, reply: old.reply };
  }
  return fresh;
}

/** Junta o que chegou ao que estava guardado. `replace` = leitura completa
 *  (o que não veio desapareceu da Google); senão, só atualiza/acrescenta. */
function merge(stored: HubReview[], fetched: HubReview[], replace: boolean): HubReview[] {
  const byId = new Map(stored.map((r) => [r.id, r]));
  let merged: HubReview[];
  if (replace) {
    merged = fetched.map((r) => carryOver(r, byId.get(r.id)));
  } else {
    for (const r of fetched) byId.set(r.id, carryOver(r, byId.get(r.id)));
    merged = [...byId.values()];
  }
  merged.sort((a, b) => b.created.localeCompare(a.created));
  return merged.slice(0, MAX_REVIEWS_PER_LOCATION);
}

function isSystemic(e: GbpError): boolean {
  return (
    e.kind === "quota" ||
    e.kind === "api-disabled" ||
    e.kind === "not-configured" ||
    e.kind === "permission"
  );
}

function emptyRun(): SourceRun {
  return {
    allReviews: [],
    newReviews: [],
    repliedAt: new Map(),
    failures: 0,
    firstError: null,
    fullDone: false,
    pending: 0,
  };
}

// ── Fonte 1: Google ────────────────────────────────────────────────────
async function syncFromGoogle(
  slug: string,
  token: string,
  locations: HubLocation[],
  prev: HubSyncState,
  full: boolean,
  firstPage: ReviewsPage,
): Promise<SourceRun> {
  // Vindo da DataForSEO os ids são outros — a primeira leitura pela Google
  // é sempre completa, para substituir tudo.
  const switching = prev.source !== "gbp";
  const since = prev.lastSyncAt && !switching ? prev.lastSyncAt - 2 * DAY : null;
  const run = emptyRun();
  run.fullDone = full || switching;

  for (const [idx, loc] of locations.entries()) {
    try {
      const stored = await getReviewsForLocation(slug, loc.id);
      const knownIds = new Set(stored.map((r) => r.id));
      const readAll = full || switching || stored.length === 0 || !since;
      const fetched: HubReview[] = [];
      let totals: { average: number | null; total: number | null } = {
        average: null,
        total: null,
      };
      let page: ReviewsPage | null = idx === 0 ? firstPage : null;
      let pageToken: string | undefined;
      do {
        page ??= await fetchReviewsPage(token, loc, pageToken);
        if (totals.total === null) {
          totals = { average: page.averageRating, total: page.totalReviewCount };
        }
        fetched.push(...page.reviews);
        pageToken = page.nextPageToken ?? undefined;
        const oldest = page.reviews[page.reviews.length - 1];
        page = null;
        if (!readAll && oldest && since && Date.parse(oldest.updated) < since) break;
        if (fetched.length >= MAX_REVIEWS_PER_LOCATION) break;
        if (pageToken) await sleep(PAUSE_MS);
      } while (pageToken);

      const merged = merge(stored, fetched, readAll);
      for (const r of fetched) {
        if (!knownIds.has(r.id) && stored.length > 0 && !switching) run.newReviews.push(r);
        if (r.reply) run.repliedAt.set(r.id, Date.parse(r.reply.updated) || 0);
      }
      await saveReviewsForLocation(slug, loc.id, merged);
      run.allReviews.push(...merged);
      loc.total = totals.total ?? merged.length;
      loc.average = totals.average ?? loc.average;
      loc.syncedAt = Date.now();
      loc.error = null;
    } catch (err) {
      run.failures++;
      const e = err instanceof GbpError ? err : new GbpError(String(err), "other", 0);
      run.firstError ??= e;
      loc.error = e.message;
      run.allReviews.push(...(await getReviewsForLocation(slug, loc.id)));
    }
    await sleep(PAUSE_MS);
  }
  return run;
}

// ── Fonte 2: DataForSEO ────────────────────────────────────────────────
async function syncFromDataForSeo(
  slug: string,
  locations: HubLocation[],
  opts: { full: boolean; manual: boolean; collectOnly: boolean },
): Promise<SourceRun> {
  const started = Date.now();
  const dfs = await getDfsState(slug);
  const byId = new Map(locations.map((l) => [l.id, l]));
  const run = emptyRun();

  const collect = async (locId: string) => {
    const task = dfs.tasks[locId];
    const loc = byId.get(locId);
    if (!task || !loc) {
      delete dfs.tasks[locId];
      return;
    }
    const res = await getReviewTask(task.id, locId).catch((err: unknown) => ({
      status: "error" as const,
      message: err instanceof Error ? err.message : String(err),
    }));
    if (res.status === "pending") {
      if (Date.now() - task.postedAt > DFS_TASK_TIMEOUT) delete dfs.tasks[locId];
      return;
    }
    delete dfs.tasks[locId];
    if (res.status === "error") {
      run.failures++;
      run.firstError ??= new GbpError(`DataForSEO: ${res.message}`, "other", 0);
      loc.error = `DataForSEO: ${res.message}`;
      return;
    }
    const stored = await getReviewsForLocation(slug, locId);
    const knownIds = new Set(stored.map((r) => r.id));
    // Uma leitura completa que volta vazia com reviews guardadas é quase
    // sempre uma falha da DataForSEO — não apaga o que temos.
    const replace = task.full && (res.reviews.length > 0 || stored.length === 0);
    const merged = merge(stored, res.reviews, replace);
    for (const r of res.reviews) {
      if (!knownIds.has(r.id) && stored.length > 0) run.newReviews.push(r);
      if (r.reply) run.repliedAt.set(r.id, Date.parse(r.reply.updated) || 0);
    }
    await saveReviewsForLocation(slug, locId, merged);
    loc.total = res.total ?? loc.total ?? merged.length;
    loc.average = res.average ?? loc.average;
    loc.syncedAt = Date.now();
    loc.error = null;
    if (task.full) dfs.fullAt[locId] = Date.now();
  };

  // 1) Recolher o que ficou a correr da vez anterior.
  for (const locId of Object.keys(dfs.tasks)) await collect(locId);

  // 2) Pedir as seguintes.
  if (!opts.collectOnly) {
    const now = Date.now();
    const specs: { loc: HubLocation; depth: number; priority: 1 | 2; full: boolean }[] = [];
    for (const loc of locations) {
      if (!loc.placeId || dfs.tasks[loc.id]) continue;
      const fullAt = dfs.fullAt[loc.id];
      if (!fullAt || opts.full || now - fullAt > FULL_SYNC_EVERY) {
        // A primeira leitura (ou um pedido à mão) vai em prioridade: chega em
        // ~1 min em vez de até 45.
        specs.push({ loc, depth: 4490, priority: !fullAt || opts.manual ? 2 : 1, full: true });
      } else if (opts.manual || now - (dfs.lastPostAt[loc.id] ?? 0) > DFS_INCREMENTAL_EVERY) {
        specs.push({ loc, depth: opts.manual ? 20 : 10, priority: opts.manual ? 2 : 1, full: false });
      }
    }
    if (specs.length > 0) {
      try {
        const posted: Record<string, DfsTask> = await postReviewTasks(specs);
        for (const [locId, task] of Object.entries(posted)) {
          dfs.tasks[locId] = task;
          dfs.lastPostAt[locId] = task.postedAt;
        }
      } catch (err) {
        run.failures = locations.length;
        run.firstError = new GbpError(err instanceof Error ? err.message : String(err), "other", 0);
      }
    }
  }

  // 3) Esperar pelas prioritárias — quem carregou em «Sincronizar» vê-as já.
  while (
    Object.values(dfs.tasks).some((t) => t.priority === 2) &&
    Date.now() - started < DFS_WAIT_MS
  ) {
    await sleep(8000);
    for (const [locId, t] of Object.entries(dfs.tasks)) {
      if (t.priority === 2) await collect(locId);
    }
  }

  await saveDfsState(slug, dfs);
  run.pending = Object.keys(dfs.tasks).length;
  run.fullDone = locations.every((l) => dfs.fullAt[l.id]);
  for (const loc of locations) {
    run.allReviews.push(...(await getReviewsForLocation(slug, loc.id)));
  }
  return run;
}

// ── A sync ─────────────────────────────────────────────────────────────
export async function syncReviews(
  slug: string,
  opts: { full?: boolean; by?: string; manual?: boolean; collectOnly?: boolean } = {},
): Promise<SyncResult> {
  const cfg = getHubConfig(slug);
  if (!cfg) throw new Error(`Reviews Hub não configurado para ${slug}`);
  if (!googleReviewsConfigured) {
    return {
      status: "error",
      state: {
        ...(await getSyncState(slug)),
        ok: false,
        error: "A conta de serviço da Google não está configurada neste ambiente.",
        errorKind: "not-configured",
      },
    };
  }
  if (!(await acquireSyncLock(slug))) return { status: "running" };

  const prev = await getSyncState(slug);
  const now = Date.now();
  const full =
    Boolean(opts.full) || !prev.lastFullSyncAt || now - prev.lastFullSyncAt > FULL_SYNC_EVERY;

  try {
    const token = await gbpToken();

    let locations = await getLocations(slug);
    if (opts.full || locations.length === 0 || now - (prev.lastFullSyncAt ?? 0) > FULL_SYNC_EVERY) {
      const fresh = await listClientLocations(token, cfg);
      // Guarda os números da última leitura enquanto os novos não chegam.
      const old = new Map(locations.map((l) => [l.id, l]));
      locations = fresh.map((l) => ({
        ...l,
        total: old.get(l.id)?.total,
        average: old.get(l.id)?.average,
        syncedAt: old.get(l.id)?.syncedAt,
      }));
    }
    if (locations.length === 0) {
      throw new GbpError(
        `A conta de serviço não vê nenhum perfil GMB com «${cfg.brand}» no nome.`,
        "permission",
        0,
      );
    }

    // Um pedido à v4 decide a fonte desta sync.
    let gbpError: GbpError | null = null;
    let firstPage: ReviewsPage | null = null;
    if (opts.collectOnly && prev.source === "dfs") {
      gbpError = new GbpError("", "api-disabled", 0, prev.gbpFixUrl ?? null);
    } else {
      try {
        firstPage = await fetchReviewsPage(token, locations[0]);
      } catch (err) {
        const e = err instanceof GbpError ? err : new GbpError(String(err), "other", 0);
        if (!isSystemic(e)) throw e;
        gbpError = e;
      }
    }

    let run: SourceRun;
    let source: "gbp" | "dfs";
    if (!gbpError && firstPage) {
      source = "gbp";
      run = await syncFromGoogle(slug, token, locations, prev, full, firstPage);
    } else if (dfsConfigured()) {
      source = "dfs";
      run = await syncFromDataForSeo(slug, locations, {
        full: Boolean(opts.full),
        manual: Boolean(opts.manual),
        collectOnly: Boolean(opts.collectOnly),
      });
    } else {
      throw gbpError ?? new GbpError("Sem fonte de reviews disponível.", "other", 0);
    }

    await saveLocations(slug, locations);

    // Uma review respondida fora da plataforma depois de o rascunho ter sido
    // feito deixa de precisar dele. Um rascunho mais novo do que a resposta é
    // alguém a reescrevê-la aqui — fica.
    const drafts = await getDrafts(slug);
    let draftsChanged = false;
    for (const [id, draft] of Object.entries(drafts)) {
      const at = run.repliedAt.get(id);
      if (at !== undefined && at >= draft.updatedAt) {
        delete drafts[id];
        draftsChanged = true;
      }
    }
    if (draftsChanged) await saveDrafts(slug, drafts);

    const allFailed = run.failures >= locations.length;
    const e = run.firstError;
    const fullDone = source === "gbp" ? full || run.fullDone : run.fullDone;
    const state: HubSyncState = {
      lastSyncAt: allFailed ? prev.lastSyncAt : Date.now(),
      lastFullSyncAt: fullDone && run.failures === 0 ? Date.now() : prev.lastFullSyncAt,
      ok: run.failures === 0,
      error: e
        ? allFailed
          ? e.message
          : `${run.failures} de ${locations.length} salões falharam: ${e.message}`
        : null,
      errorKind: e?.kind ?? null,
      fixUrl: e?.fixUrl ?? null,
      reviewsStored: run.allReviews.length,
      locations: locations.length,
      newLastRun: run.newReviews.length,
      source,
      publishAvailable: source === "gbp",
      gbpFixUrl: source === "dfs" ? (gbpError?.fixUrl ?? prev.gbpFixUrl ?? null) : null,
      dfsPending: source === "dfs" ? run.pending : 0,
    };
    await saveSyncState(slug, state);
    await refreshSummary(slug, { reviews: run.allReviews, locations, drafts });
    if (run.newReviews.length > 0 || (opts.by && !opts.collectOnly)) {
      await logActivity(slug, {
        at: Date.now(),
        kind: "sync",
        text:
          run.newReviews.length > 0
            ? `${run.newReviews.length} ${run.newReviews.length === 1 ? "review nova" : "reviews novas"} do Google`
            : "Sincronização manual com o Google",
        ...(opts.by ? { by: opts.by } : {}),
      });
    }
    return allFailed
      ? { status: "error", state }
      : { status: "ok", state, newReviews: run.newReviews };
  } catch (err) {
    const e =
      err instanceof GbpError
        ? err
        : new GbpError(err instanceof Error ? err.message : String(err), "other", 0);
    const state: HubSyncState = {
      ...prev,
      ok: false,
      error: e.message,
      errorKind: e.kind,
      fixUrl: e.fixUrl,
    };
    // Um ambiente sem a conta de serviço (localhost) partilha o KV de
    // produção — não pode deixar lá um erro que é só dele.
    if (e.kind !== "not-configured") await saveSyncState(slug, state);
    return { status: "error", state };
  } finally {
    await releaseSyncLock(slug);
  }
}
