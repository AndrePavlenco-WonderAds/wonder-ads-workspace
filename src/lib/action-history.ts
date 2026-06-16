import { kv } from "@vercel/kv";
import type { DomainMetrics } from "./seo-tools/dataforseo";
import type { SiteVitals } from "./audit-prep-store";
import type { KwResearchPack } from "./seo-tools/keyword-research";
import type { KwCluster } from "./kw-cluster-parser";

const KEY_PREFIX = "action-history:";
const MAX_ENTRIES = 30;

export const historyConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type HistoryEntry = {
  id: string;
  createdAt: number;
  clientSlug: string;
  actionSlug: string;
  inputs: Record<string, string>;
  output: string;
  model: string;
  /** Structured metrics persisted alongside the markdown — currently only
   *  populated for SEO Audit when DataforSEO is configured. Powers the
   *  dashboard cards on the result page. */
  metrics?: DomainMetrics;
  /** PageSpeed Insights — mobile + desktop. Includes lab and CrUX field
   *  data. Powers the Core Web Vitals card on the dashboard. */
  vitals?: SiteVitals;
  /** Raw keyword research pack — DataforSEO suggestions/ideas/domain/
   *  competitor results. Populated for Keyword Research runs. Powers the
   *  interactive KeywordResearchDashboard component. */
  kwResearch?: KwResearchPack;
  /** Clusters parsed out of Claude's keyword-research analysis. Each
   *  cluster has its keyword rows with intent, priority, suggested page,
   *  why. Surfaced in the dashboard as a first-class data source
   *  alongside the raw DataforSEO data. */
  kwClusters?: KwCluster[];
};

function key(clientSlug: string, actionSlug: string): string {
  return `${KEY_PREFIX}${clientSlug}:${actionSlug}`;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Pretty result-id format used in URLs: `YYYY-MM-DD-HHMM-xx`.
 *  Sortable by date, readable, ~unique enough (collisions within the same
 *  minute are extremely unlikely thanks to the 2-char random suffix). */
export function makeResultId(when: Date = new Date()): string {
  const date = when.toISOString().slice(0, 10);
  const hh = String(when.getHours()).padStart(2, "0");
  const mm = String(when.getMinutes()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 4);
  return `${date}-${hh}${mm}-${suffix}`;
}

/** Display-only version of a result id — strips the HHMM block so we
 *  don't disclose the minute the run was kicked off. The full id with
 *  HHMM is preserved in URLs + storage; this is only used in places
 *  the consultant or the client sees (cover page, result header,
 *  history list). */
export function formatDisplayResultId(id: string): string {
  const m = id.match(/^(\d{4}-\d{2}-\d{2})-\d{3,4}-([a-z0-9]+)$/i);
  if (m) return `${m[1]}-${m[2]}`;
  return id;
}

/** Fetch the N most-recent history entries across every action slug
 *  registered in PILLARS for a single client. Used by the Monthly Report
 *  and Client Roadmap actions to ground Claude in what's actually been
 *  done on this account. Sorted newest-first. */
export async function listRecentHistoryAcrossActions(
  clientSlug: string,
  actionSlugs: string[],
  limit = 20,
): Promise<HistoryEntry[]> {
  if (!historyConfigured) return [];
  const all: HistoryEntry[] = [];
  for (const slug of actionSlugs) {
    try {
      const entries = await listHistory(clientSlug, slug);
      all.push(...entries);
    } catch {
      // best-effort
    }
  }
  all.sort((a, b) => b.createdAt - a.createdAt);
  return all.slice(0, limit);
}

export async function listHistory(
  clientSlug: string,
  actionSlug: string,
): Promise<HistoryEntry[]> {
  if (!historyConfigured) return [];
  try {
    const stored = await kv.get<HistoryEntry[]>(key(clientSlug, actionSlug));
    if (!Array.isArray(stored)) return [];
    return stored;
  } catch (err) {
    console.error("history list failed:", err);
    return [];
  }
}

export async function appendHistory(
  entry: Omit<HistoryEntry, "id" | "createdAt"> & {
    id?: string;
    /** Preserve a prior timestamp (e.g. when a follow-up refine rewrites
     *  the output in place — the "Generated" date should stay pinned to
     *  the original run, not jump to the edit time). Defaults to now. */
    createdAt?: number;
  },
): Promise<HistoryEntry> {
  const full: HistoryEntry = {
    ...entry,
    id: entry.id ?? newId(),
    createdAt: entry.createdAt ?? Date.now(),
  };
  if (!historyConfigured) return full;
  try {
    const current = await listHistory(entry.clientSlug, entry.actionSlug);
    // If a record with the same id already exists (e.g. a retry of the same
    // generation), replace it rather than duplicating.
    const filtered = current.filter((e) => e.id !== full.id);
    const next = [full, ...filtered].slice(0, MAX_ENTRIES);
    await kv.set(key(entry.clientSlug, entry.actionSlug), next);
  } catch (err) {
    console.error("history append failed:", err);
  }
  return full;
}

export async function getHistoryEntry(
  clientSlug: string,
  actionSlug: string,
  id: string,
): Promise<HistoryEntry | null> {
  const all = await listHistory(clientSlug, actionSlug);
  return all.find((e) => e.id === id) ?? null;
}

export async function deleteHistoryEntry(
  clientSlug: string,
  actionSlug: string,
  id: string,
): Promise<void> {
  if (!historyConfigured) return;
  try {
    const current = await listHistory(clientSlug, actionSlug);
    const next = current.filter((e) => e.id !== id);
    await kv.set(key(clientSlug, actionSlug), next);
  } catch (err) {
    console.error("history delete failed:", err);
  }
}
