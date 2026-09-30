// Sincronização das reviews do Google para o KV do Reviews Hub.
//
// Incremental por omissão: as reviews vêm ordenadas por «updateTime desc»,
// por isso basta ler páginas até passar a última sync (com 2 dias de folga
// para edições atrasadas) — tipicamente 1 pedido por salão. A primeira vez de
// cada salão, e a sync completa (1×/semana ou a pedido), leem tudo e
// substituem a lista — é assim que uma review apagada na Google desaparece.

import { getHubConfig } from "./config";
import {
  GbpError,
  fetchReviewsPage,
  gbpToken,
  googleReviewsConfigured,
  listClientLocations,
} from "./google";
import {
  acquireSyncLock,
  getDrafts,
  getLocations,
  getReviewsForLocation,
  getSyncState,
  logActivity,
  refreshSummary,
  releaseSyncLock,
  saveDrafts,
  saveLocations,
  saveReviewsForLocation,
  saveSyncState,
} from "./store";
import type { HubLocation, HubReview, HubSyncState } from "./types";

const DAY = 24 * 60 * 60 * 1000;
/** Refazer a lista de perfis e ler tudo de novo uma vez por semana. */
const FULL_SYNC_EVERY = 7 * DAY;
/** Teto por salão — mantém cada chave KV longe do limite de tamanho. */
const MAX_REVIEWS_PER_LOCATION = 3000;
const PAUSE_MS = 220;

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

export async function syncReviews(
  slug: string,
  opts: { full?: boolean; by?: string } = {},
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
    Boolean(opts.full) ||
    !prev.lastFullSyncAt ||
    now - prev.lastFullSyncAt > FULL_SYNC_EVERY;

  try {
    const token = await gbpToken();

    let locations = await getLocations(slug);
    if (full || locations.length === 0) {
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

    const since = prev.lastSyncAt ? prev.lastSyncAt - 2 * DAY : null;
    const newReviews: HubReview[] = [];
    const allReviews: HubReview[] = [];
    /** reviewId → quando a resposta atual foi publicada/editada. */
    const repliedAt = new Map<string, number>();
    let failures = 0;
    let firstError: GbpError | null = null;

    for (const loc of locations) {
      try {
        const stored = await getReviewsForLocation(slug, loc.id);
        const knownIds = new Set(stored.map((r) => r.id));
        const readAll = full || stored.length === 0 || !since;
        const fetched: HubReview[] = [];
        let pageToken: string | undefined;
        let totals: { average: number | null; total: number | null } = {
          average: null,
          total: null,
        };
        do {
          const page = await fetchReviewsPage(token, loc, pageToken);
          if (totals.total === null) {
            totals = { average: page.averageRating, total: page.totalReviewCount };
          }
          fetched.push(...page.reviews);
          pageToken = page.nextPageToken ?? undefined;
          const oldest = page.reviews[page.reviews.length - 1];
          if (!readAll && oldest && since && Date.parse(oldest.updated) < since) break;
          if (fetched.length >= MAX_REVIEWS_PER_LOCATION) break;
          if (pageToken) await sleep(PAUSE_MS);
        } while (pageToken);

        let merged: HubReview[];
        if (readAll) {
          // Mantém a marca «via hub/auto» das respostas que publicámos.
          const prevById = new Map(stored.map((r) => [r.id, r]));
          merged = fetched.map((r) => {
            const old = prevById.get(r.id);
            return old?.reply?.via && r.reply && r.reply.text === old.reply.text
              ? { ...r, reply: { ...r.reply, via: old.reply.via, by: old.reply.by } }
              : r;
          });
        } else {
          const byId = new Map(stored.map((r) => [r.id, r]));
          for (const r of fetched) {
            const old = byId.get(r.id);
            byId.set(
              r.id,
              old?.reply?.via && r.reply && r.reply.text === old.reply.text
                ? { ...r, reply: { ...r.reply, via: old.reply.via, by: old.reply.by } }
                : r,
            );
          }
          merged = [...byId.values()];
        }
        merged.sort((a, b) => b.created.localeCompare(a.created));
        merged = merged.slice(0, MAX_REVIEWS_PER_LOCATION);

        for (const r of fetched) {
          if (!knownIds.has(r.id) && stored.length > 0) newReviews.push(r);
          if (r.reply) repliedAt.set(r.id, Date.parse(r.reply.updated) || 0);
        }
        await saveReviewsForLocation(slug, loc.id, merged);
        allReviews.push(...merged);
        loc.total = totals.total ?? merged.length;
        loc.average = totals.average ?? loc.average;
        loc.syncedAt = Date.now();
        loc.error = null;
      } catch (err) {
        failures++;
        const e = err instanceof GbpError ? err : new GbpError(String(err), "other", 0);
        firstError ??= e;
        loc.error = e.message;
        allReviews.push(...(await getReviewsForLocation(slug, loc.id)));
        // Quota a zero ou API desligada falham em todos — não vale a pena
        // gastar pedidos nos restantes salões.
        if (e.kind === "quota" || e.kind === "api-disabled" || e.kind === "not-configured") {
          for (const rest of locations.slice(locations.indexOf(loc) + 1)) {
            rest.error = e.message;
            allReviews.push(...(await getReviewsForLocation(slug, rest.id)));
          }
          failures = locations.length;
          break;
        }
      }
      await sleep(PAUSE_MS);
    }

    await saveLocations(slug, locations);

    // Uma review respondida fora da plataforma (no Google) depois de o
    // rascunho ter sido feito deixa de precisar dele. Um rascunho mais novo
    // do que a resposta é alguém a reescrevê-la aqui — fica.
    const drafts = await getDrafts(slug);
    let draftsChanged = false;
    for (const [id, draft] of Object.entries(drafts)) {
      const at = repliedAt.get(id);
      if (at !== undefined && at >= draft.updatedAt) {
        delete drafts[id];
        draftsChanged = true;
      }
    }
    if (draftsChanged) await saveDrafts(slug, drafts);

    const allFailed = failures === locations.length;
    const state: HubSyncState = {
      lastSyncAt: allFailed ? prev.lastSyncAt : Date.now(),
      lastFullSyncAt: full && failures === 0 ? Date.now() : prev.lastFullSyncAt,
      ok: failures === 0,
      error: firstError
        ? allFailed
          ? firstError.message
          : `${failures} de ${locations.length} salões falharam: ${firstError.message}`
        : null,
      errorKind: firstError?.kind ?? null,
      fixUrl: firstError?.fixUrl ?? null,
      reviewsStored: allReviews.length,
      locations: locations.length,
      newLastRun: newReviews.length,
    };
    await saveSyncState(slug, state);
    await refreshSummary(slug, { reviews: allReviews, locations, drafts });
    if (newReviews.length > 0 || opts.by) {
      await logActivity(slug, {
        at: Date.now(),
        kind: "sync",
        text:
          newReviews.length > 0
            ? `${newReviews.length} ${newReviews.length === 1 ? "review nova" : "reviews novas"} do Google`
            : "Sincronização manual com o Google",
        ...(opts.by ? { by: opts.by } : {}),
      });
    }
    return allFailed ? { status: "error", state } : { status: "ok", state, newReviews };
  } catch (err) {
    const e = err instanceof GbpError ? err : new GbpError(
      err instanceof Error ? err.message : String(err),
      "other",
      0,
    );
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

/** Para a página: a lista de perfis mais recente sem tocar na Google. */
export async function locationById(
  slug: string,
  locId: string,
): Promise<HubLocation | null> {
  const list = await getLocations(slug);
  return list.find((l) => l.id === locId) ?? null;
}
