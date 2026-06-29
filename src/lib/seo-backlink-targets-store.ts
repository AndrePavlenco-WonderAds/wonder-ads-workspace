// KV store for the per-client backlink target pipeline.
//
// Stored as a single KV object under `seo-backlink-targets` keyed by client
// slug → Target[]. Low volume (a handful of clients × a few dozen targets),
// so one get/set of the whole map, mirroring the other admin stores. Pure
// types + sanitisers live in ./seo-backlink-targets (client-safe).

import { kv } from "@vercel/kv";
import {
  sanitizeTargetList,
  sanitizeTargetsMap,
  type BacklinkTarget,
  type TargetsMap,
} from "./seo-backlink-targets";

const KEY = "seo-backlink-targets";

export const targetsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getTargetsMap(): Promise<TargetsMap> {
  if (!targetsStorageConfigured) return {};
  try {
    const stored = await kv.get<unknown>(KEY);
    return sanitizeTargetsMap(stored);
  } catch (err) {
    console.error("seo-backlink-targets KV read failed:", err);
    return {};
  }
}

/** Replace one client's target list and persist the whole map. Returns the
 *  saved list for that client. */
export async function saveClientTargets(
  slug: string,
  targets: unknown,
): Promise<BacklinkTarget[]> {
  if (!targetsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const clean = sanitizeTargetList(targets);
  const map = await getTargetsMap();
  if (clean.length) map[slug] = clean;
  else delete map[slug];
  await kv.set(KEY, map);
  return clean;
}
