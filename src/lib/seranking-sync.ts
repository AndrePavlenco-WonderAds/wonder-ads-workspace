// Provision + sync one client's SE Ranking project from their Target Keywords.
//
// Idempotent by design: it adopts a project that already exists for the domain
// (the team hand-built B-Life and Mimus before this existed), reuses whatever
// search engine that project is already checking — including a hand-tuned local
// region, which is better than the national default we'd otherwise add — and
// only pushes keywords SE Ranking isn't tracking yet. Running it twice is a
// no-op; running it after adding targets pushes just the new ones.

import { getClientWebsite } from "./client-meta";
import { listTargetKeywords } from "./target-keywords-store";
import { dedupeKeywords, type DroppedKeyword } from "./seranking-dedupe";
import {
  addKeywords,
  addSearchEngine,
  createSite,
  engineForSlug,
  findSiteForSlug,
  listSiteEngines,
  listSiteKeywords,
} from "./seranking";
import {
  getSeRankingLink,
  saveSeRankingLink,
  type SeRankingLink,
} from "./seranking-store";

/** Clients deliberately kept out of SE Ranking. InSync Design is an Australian
 *  jewellery e-commerce whose 200 informational long-tail targets ("what is a
 *  brooch", "how to clean earrings") would eat a third of the tracked-keyword
 *  quota to answer questions the rank tracker isn't the right tool for. */
export const SERANKING_EXCLUDED = new Set(["insync-design"]);

export type SyncOutcome = {
  slug: string;
  ok: boolean;
  /** Whether we made the project or adopted an existing one. */
  created: boolean;
  siteId?: number;
  /** Target keywords before the near-duplicate collapse. */
  targets: number;
  /** Keywords we intend SE Ranking to track (post-collapse). */
  tracked: number;
  /** Keywords pushed on THIS run (0 when already in sync). */
  added: number;
  dropped: DroppedKeyword[];
  message?: string;
};

/** Sync a single client. Never throws — a failure for one client must not
 *  abort a bulk run, so the error travels back in the outcome. */
export async function syncClientToSeRanking(
  slug: string,
  clientTitle: string,
): Promise<SyncOutcome> {
  const base: SyncOutcome = {
    slug,
    ok: false,
    created: false,
    targets: 0,
    tracked: 0,
    added: 0,
    dropped: [],
  };

  try {
    if (SERANKING_EXCLUDED.has(slug)) {
      return { ...base, message: "Cliente excluído do rank tracking." };
    }
    const website = getClientWebsite(slug);
    if (!website) {
      return { ...base, message: "Cliente sem website configurado." };
    }

    const targets = await listTargetKeywords(slug);
    if (targets.length === 0) {
      return { ...base, message: "Cliente sem target keywords." };
    }
    const { kept, dropped } = dedupeKeywords(targets);

    // 1. Project — reuse the KV link, else match by domain, else create.
    const existing = await getSeRankingLink(slug);
    let siteId = existing?.siteId;
    let created = false;
    if (!siteId) {
      const found = await findSiteForSlug(slug);
      if (found) {
        siteId = found.id;
      } else {
        siteId = await createSite(website, clientTitle);
        created = true;
      }
    }

    // 2. Search engine — only add one when the project has none. A project
    //    the team set up by hand already points at the right local region.
    let engines = await listSiteEngines(siteId);
    if (engines.length === 0) {
      await addSearchEngine(siteId, engineForSlug(slug));
      engines = await listSiteEngines(siteId);
    }
    const siteEngineIds = engines.map((e) => e.site_engine_id);
    if (siteEngineIds.length === 0) {
      return {
        ...base,
        created,
        siteId,
        targets: targets.length,
        message: "Não foi possível configurar o motor de busca do projeto.",
      };
    }

    // 3. Keywords — push only what isn't tracked yet.
    const already = new Set(
      (await listSiteKeywords(siteId)).map((k) => k.name.trim().toLowerCase()),
    );
    const missing = kept
      .map((k) => k.keyword)
      .filter((k) => !already.has(k.trim().toLowerCase()));
    const added = await addKeywords(siteId, missing, siteEngineIds);

    const link: SeRankingLink = {
      siteId,
      siteEngineIds,
      trackedCount: already.size + added,
      dropped,
      syncedAt: Date.now(),
    };
    await saveSeRankingLink(slug, link);

    return {
      slug,
      ok: true,
      created,
      siteId,
      targets: targets.length,
      tracked: link.trackedCount,
      added,
      dropped,
    };
  } catch (err) {
    return {
      ...base,
      message: err instanceof Error ? err.message : "Sync falhou.",
    };
  }
}
