// Per-client Meta Title & Description optimization results.
//
// One generation = one MetaTagsResult containing rows[]. Each row is a
// single URL with its CURRENT meta tags (from a fresh crawl) plus the
// OPTIMIZED proposal (from Claude, grounded in keyword-research + brief +
// onboarding). Consultants edit the optimized text inline, send to the
// Pending Review table, export to CSV/DOCX for their dev team.

import { kv } from "@vercel/kv";

const RESULT_PREFIX = "meta-tags:result:";
const INDEX_PREFIX = "meta-tags:index:";
const MAX_RESULTS = 30;

export const metaTagsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type MetaTagsRow = {
  id: string;
  url: string;
  /** Current values from the crawl. Nullable if not present on the page. */
  currentTitle: string | null;
  currentTitleLength: number;
  currentMeta: string | null;
  currentMetaLength: number;
  /** Claude's proposal. Editable by the consultant. */
  optimizedTitle: string;
  optimizedMeta: string;
  /** Char counts kept in sync with the editable fields so the UI can
   *  render the 50-60 / 140-160 sweet-spot indicator without recomputing. */
  optimizedTitleLength: number;
  optimizedMetaLength: number;
  /** Primary keyword Claude assigned (from KW research clusters). */
  primaryKeyword: string | null;
  /** 1-3 supporting keywords from related clusters. */
  secondaryKeywords: string[];
  /** One-line rationale for the consultant scanning the table. */
  reasoning: string;
  /** Issues Claude flagged: missing meta, too-long title, duplicate
   *  with another URL, etc. Pure diagnostic, not blocking. */
  issues: string[];
  createdAt: number;
  updatedAt: number;
};

export type MetaTagsResult = {
  id: string;
  clientSlug: string;
  createdAt: number;
  /** What the consultant submitted on the form. Stored so the result
   *  page can show the scan parameters + the result is reproducible. */
  inputs: {
    websiteUrl: string;
    depth: "Quick" | "Standard" | "Deep";
    focusKeywords?: string;
  };
  /** Which Keyword Research result drove the optimization. */
  kwResearchSourceId: string;
  /** Diagnostic counts surfaced on the result header. */
  stats: {
    pagesCrawled: number;
    pagesWithMissingMeta: number;
    pagesWithLongTitle: number;
    pagesWithShortMeta: number;
  };
  rows: MetaTagsRow[];
};

function resultKey(clientSlug: string, resultId: string): string {
  return `${RESULT_PREFIX}${clientSlug}:${resultId}`;
}

function indexKey(clientSlug: string): string {
  return `${INDEX_PREFIX}${clientSlug}`;
}

export async function getMetaTagsResult(
  clientSlug: string,
  resultId: string,
): Promise<MetaTagsResult | null> {
  if (!metaTagsStorageConfigured) return null;
  try {
    const v = await kv.get<MetaTagsResult>(resultKey(clientSlug, resultId));
    return v ?? null;
  } catch (err) {
    console.error("meta-tags read failed:", err);
    return null;
  }
}

export async function saveMetaTagsResult(
  result: MetaTagsResult,
): Promise<void> {
  if (!metaTagsStorageConfigured) return;
  await kv.set(resultKey(result.clientSlug, result.id), result);
  try {
    const index =
      (await kv.get<{ id: string; createdAt: number; rowsCount: number }[]>(
        indexKey(result.clientSlug),
      )) ?? [];
    const filtered = index.filter((e) => e.id !== result.id);
    filtered.unshift({
      id: result.id,
      createdAt: result.createdAt,
      rowsCount: result.rows.length,
    });
    await kv.set(indexKey(result.clientSlug), filtered.slice(0, MAX_RESULTS));
  } catch (err) {
    console.error("meta-tags index write failed:", err);
  }
}

export async function listMetaTagsResults(
  clientSlug: string,
): Promise<{ id: string; createdAt: number; rowsCount: number }[]> {
  if (!metaTagsStorageConfigured) return [];
  try {
    const v = await kv.get<{ id: string; createdAt: number; rowsCount: number }[]>(
      indexKey(clientSlug),
    );
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function updateMetaTagsRow(
  clientSlug: string,
  resultId: string,
  rowId: string,
  patch: Partial<MetaTagsRow>,
): Promise<MetaTagsResult | null> {
  if (!metaTagsStorageConfigured) return null;
  const existing = await getMetaTagsResult(clientSlug, resultId);
  if (!existing) return null;
  const now = Date.now();
  const next: MetaTagsResult = {
    ...existing,
    rows: existing.rows.map((r) => {
      if (r.id !== rowId) return r;
      const merged = { ...r, ...patch, updatedAt: now };
      // Keep length fields in sync with the editable text fields.
      if (typeof patch.optimizedTitle === "string") {
        merged.optimizedTitleLength = patch.optimizedTitle.length;
      }
      if (typeof patch.optimizedMeta === "string") {
        merged.optimizedMetaLength = patch.optimizedMeta.length;
      }
      return merged;
    }),
  };
  await kv.set(resultKey(clientSlug, resultId), next);
  return next;
}

export async function deleteMetaTagsResult(
  clientSlug: string,
  resultId: string,
): Promise<void> {
  if (!metaTagsStorageConfigured) return;
  try {
    await kv.del(resultKey(clientSlug, resultId));
    const index =
      (await kv.get<{ id: string; createdAt: number; rowsCount: number }[]>(
        indexKey(clientSlug),
      )) ?? [];
    await kv.set(
      indexKey(clientSlug),
      index.filter((e) => e.id !== resultId),
    );
  } catch (err) {
    console.error("meta-tags delete failed:", err);
  }
}

export function newMetaTagsResultId(when: Date = new Date()): string {
  const date = when.toISOString().slice(0, 10);
  const hh = String(when.getHours()).padStart(2, "0");
  const mm = String(when.getMinutes()).padStart(2, "0");
  return `${date}-${hh}${mm}-${Math.random().toString(36).slice(2, 4)}`;
}

export function newMetaTagsRowId(): string {
  return `mt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// SERP-display sweet spots: Google truncates ~60 chars in titles and
// ~155-160 in meta descriptions. These constants are used by the UI to
// colour char-count indicators.
export const TITLE_IDEAL_MIN = 30;
export const TITLE_IDEAL_MAX = 60;
export const META_IDEAL_MIN = 120;
export const META_IDEAL_MAX = 160;
