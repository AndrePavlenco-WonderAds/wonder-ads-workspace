// Stored metadata for generated ADS reports, per client. We don't store
// the PDF binary — the report page re-renders the saved KPI snapshot and
// the PDF button reopens it for print/save (same print-to-PDF approach as
// the Monthly Report). Keyed `ads-reports:<slug>` in KV.

import { kv } from "@vercel/kv";
import type { AdsKpis } from "./ads-data";

const KEY_PREFIX = "ads-reports:";
const MAX_REPORTS = 100;

export const adsReportsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type AdsReport = {
  id: string;
  slug: string;
  /** Human label, e.g. "Report semanal" / "Report mensal". */
  kind: string;
  /** Window label captured at generation time. */
  windowLabel: string;
  platform: "all" | "google" | "meta";
  /** When the report was requested (epoch ms). */
  requestedAt: number;
  /** KPI snapshot at request time — null when no platform was connected. */
  kpis: AdsKpis | null;
};

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

function sanitize(arr: unknown, slug: string): AdsReport[] {
  if (!Array.isArray(arr)) return [];
  const out: AdsReport[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : crypto.randomUUID(),
      slug,
      kind: typeof r.kind === "string" ? r.kind.slice(0, 80) : "Report",
      windowLabel:
        typeof r.windowLabel === "string" ? r.windowLabel.slice(0, 80) : "",
      platform:
        r.platform === "google" || r.platform === "meta" ? r.platform : "all",
      requestedAt:
        typeof r.requestedAt === "number" ? r.requestedAt : Date.now(),
      kpis:
        r.kpis && typeof r.kpis === "object"
          ? (r.kpis as AdsKpis)
          : null,
    });
    if (out.length >= MAX_REPORTS) break;
  }
  // newest first
  return out.sort((a, b) => b.requestedAt - a.requestedAt);
}

export async function getAdsReports(slug: string): Promise<AdsReport[]> {
  if (!adsReportsStorageConfigured) return [];
  try {
    const stored = await kv.get<unknown>(key(slug));
    return sanitize(stored, slug);
  } catch (err) {
    console.error("ads-reports KV read failed:", err);
    return [];
  }
}

export async function addAdsReport(
  slug: string,
  report: Omit<AdsReport, "id" | "slug" | "requestedAt"> & {
    requestedAt?: number;
  },
): Promise<AdsReport> {
  if (!adsReportsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getAdsReports(slug);
  const entry: AdsReport = {
    id: crypto.randomUUID(),
    slug,
    kind: report.kind,
    windowLabel: report.windowLabel,
    platform: report.platform,
    requestedAt: report.requestedAt ?? Date.now(),
    kpis: report.kpis,
  };
  const next = sanitize([entry, ...current], slug).slice(0, MAX_REPORTS);
  await kv.set(key(slug), next);
  return entry;
}

export async function getAdsReport(
  slug: string,
  id: string,
): Promise<AdsReport | null> {
  const all = await getAdsReports(slug);
  return all.find((r) => r.id === id) ?? null;
}

export async function deleteAdsReport(
  slug: string,
  id: string,
): Promise<AdsReport[]> {
  if (!adsReportsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getAdsReports(slug);
  const next = current.filter((r) => r.id !== id);
  await kv.set(key(slug), next);
  return next;
}
