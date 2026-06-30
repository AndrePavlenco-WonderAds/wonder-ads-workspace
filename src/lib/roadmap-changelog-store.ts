// KV persistence for the roadmap changelog. One compact array per client
// under `roadmap:log:<slug>`, capped at MAX_LOG (FIFO) so storage stays
// bounded — worst case ~120 small entries (≈10 KB) per client.

import { kv } from "@vercel/kv";
import { roadmapStorageConfigured } from "./roadmap-store";
import {
  decodeLog,
  type RoadmapLogCompact,
  type RoadmapLogEntry,
  type RoadmapLogEvent,
} from "./roadmap-changelog";

const LOG_PREFIX = "roadmap:log:";
const MAX_LOG = 120;

function logKey(slug: string): string {
  return `${LOG_PREFIX}${slug}`;
}

async function readCompact(slug: string): Promise<RoadmapLogCompact[]> {
  if (!roadmapStorageConfigured) return [];
  try {
    const v = await kv.get<RoadmapLogCompact[]>(logKey(slug));
    return Array.isArray(v) ? v : [];
  } catch (err) {
    console.error("roadmap log read failed:", err);
    return [];
  }
}

/** Newest-first, decoded entries for the UI. */
export async function getRoadmapLog(slug: string): Promise<RoadmapLogEntry[]> {
  const list = await readCompact(slug);
  return decodeLog(list).reverse();
}

/** Append events (best-effort). Skips entirely when there's nothing to log,
 *  so order-only saves cost zero KV ops. */
export async function appendRoadmapLog(
  slug: string,
  events: RoadmapLogEvent[],
  actor?: string,
): Promise<void> {
  if (!roadmapStorageConfigured || events.length === 0) return;
  const t = Math.floor(Date.now() / 1000);
  const stamped: RoadmapLogCompact[] = events.map((e) => ({
    ...e,
    t,
    ...(actor ? { a: actor } : {}),
  }));
  try {
    const existing = await readCompact(slug);
    const merged = [...existing, ...stamped];
    const capped =
      merged.length > MAX_LOG ? merged.slice(merged.length - MAX_LOG) : merged;
    await kv.set(logKey(slug), capped);
  } catch (err) {
    console.error("roadmap log append failed:", err);
  }
}
