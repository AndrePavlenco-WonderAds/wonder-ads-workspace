// Per-client TARGET keyword list — the keywords we want to rank for.
//
// Distinct from <TrackedKeywords/> which surfaces what the domain ALREADY
// ranks for via GSC. This is the editorial wish-list: targets the
// consultant has committed to (often pushed from a Keyword Research run's
// "Tracking shortlist" section, or hand-added).
//
// Once we have GSC delegation, we can cross-reference this list against
// live GSC positions to render "target → current rank → trend" rows on the
// client page. For now it's a curation layer that consultants own.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "target-keywords:";
const MAX_TARGETS = 200;

export type TargetKeywordIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational"
  | null;

export type TargetKeyword = {
  /** Lowercased keyword — the dedupe key. */
  keyword: string;
  /** Epoch ms when added. */
  addedAt: number;
  /** Where this keyword came from. */
  source: "keyword-research" | "manual" | "import";
  /** Optional: which Keyword Research result the keyword was pushed from. */
  resultId?: string;
  intent?: TargetKeywordIntent;
  searchVolume?: number | null;
  difficulty?: number | null;
};

export const targetKwStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

export async function listTargetKeywords(
  slug: string,
): Promise<TargetKeyword[]> {
  if (!targetKwStorageConfigured) return [];
  try {
    const stored = await kv.get<TargetKeyword[]>(key(slug));
    return Array.isArray(stored) ? stored : [];
  } catch (err) {
    console.error("target keywords read failed:", err);
    return [];
  }
}

/** Merge new keywords into the list (deduped by lowercase keyword). Returns
 *  the saved list. */
export async function addTargetKeywords(
  slug: string,
  incoming: TargetKeyword[],
): Promise<{ saved: TargetKeyword[]; added: number; skipped: number }> {
  if (!targetKwStorageConfigured) {
    return { saved: [], added: 0, skipped: 0 };
  }
  const current = await listTargetKeywords(slug);
  const existingKeys = new Set(current.map((k) => k.keyword.toLowerCase()));
  const additions: TargetKeyword[] = [];
  let skipped = 0;
  for (const k of incoming) {
    const norm = k.keyword.trim().toLowerCase();
    if (!norm) continue;
    if (existingKeys.has(norm)) {
      skipped++;
      continue;
    }
    additions.push({ ...k, keyword: norm });
    existingKeys.add(norm);
  }
  // Newest first.
  const next = [...additions, ...current].slice(0, MAX_TARGETS);
  await kv.set(key(slug), next);
  return { saved: next, added: additions.length, skipped };
}

export async function removeTargetKeyword(
  slug: string,
  keyword: string,
): Promise<TargetKeyword[]> {
  if (!targetKwStorageConfigured) return [];
  const current = await listTargetKeywords(slug);
  const norm = keyword.trim().toLowerCase();
  const next = current.filter((k) => k.keyword.toLowerCase() !== norm);
  await kv.set(key(slug), next);
  return next;
}
