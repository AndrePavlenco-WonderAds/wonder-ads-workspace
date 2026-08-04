// Which SE Ranking project belongs to which client, plus what the last sync
// did. Stored per client (`seranking:link:<slug>`) so the report build and the
// client-page panel don't have to re-scan the whole SE Ranking account on
// every render.
//
// The dropped-keyword list is kept here on purpose: near-duplicate collapse is
// an editorial decision made on the consultant's behalf, so it has to be
// visible and reversible rather than silently applied. Nothing is ever removed
// from the client's Target Keywords list — the collapse only narrows what we
// push to SE Ranking.

import { kv } from "@vercel/kv";
import type { DroppedKeyword } from "./seranking-dedupe";

const KEY_PREFIX = "seranking:link:";

export type SeRankingLink = {
  siteId: number;
  /** Engines the keywords are checked on (usually one: mobile Google). */
  siteEngineIds: number[];
  /** How many keywords SE Ranking is tracking after the collapse. */
  trackedCount: number;
  /** Near-duplicates we chose not to track, and what we kept instead. */
  dropped: DroppedKeyword[];
  syncedAt: number;
};

export const seRankingStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

const key = (slug: string) => `${KEY_PREFIX}${slug}`;

export async function getSeRankingLink(
  slug: string,
): Promise<SeRankingLink | null> {
  if (!seRankingStorageConfigured) return null;
  try {
    return (await kv.get<SeRankingLink>(key(slug))) ?? null;
  } catch (err) {
    console.error("SE Ranking link read failed:", err);
    return null;
  }
}

export async function saveSeRankingLink(
  slug: string,
  link: SeRankingLink,
): Promise<SeRankingLink> {
  if (!seRankingStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  await kv.set(key(slug), link);
  return link;
}
