// Persistence for generated Monthly Report snapshots. One KV blob per
// client+month (`report:<slug>:<YYYY-MM>`) plus a slim per-client index
// (`report:index:<slug>`) so the client page can list past reports without
// loading every snapshot. Schema-versioned like nps-store: an old shape is
// dropped on read rather than deleted, so the format can evolve safely.

import { kv } from "@vercel/kv";
import {
  REPORT_SCHEMA_VERSION,
  type MonthlyReportSnapshot,
  type ReportStatus,
} from "./report-types";

const SNAP_PREFIX = "report:snap:";
const INDEX_PREFIX = "report:index:";
const MAX_INDEX = 60; // up to 5 years of monthly reports per client

export const reportStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

const snapKey = (slug: string, period: string) =>
  `${SNAP_PREFIX}${slug}:${period}`;
const indexKey = (slug: string) => `${INDEX_PREFIX}${slug}`;

/** One row of the per-client report index (newest-first). */
export type ReportIndexEntry = {
  period: string;
  periodLabel: string;
  status: ReportStatus;
  generatedAt: number;
  hasPdf: boolean;
};

export async function getReport(
  slug: string,
  period: string,
): Promise<MonthlyReportSnapshot | null> {
  if (!reportStorageConfigured) return null;
  try {
    const snap = await kv.get<MonthlyReportSnapshot>(snapKey(slug, period));
    if (!snap || snap.schemaVersion !== REPORT_SCHEMA_VERSION) return null;
    return snap;
  } catch (err) {
    console.error("KV report read failed:", err);
    return null;
  }
}

export async function listReports(slug: string): Promise<ReportIndexEntry[]> {
  if (!reportStorageConfigured) return [];
  try {
    const idx = await kv.get<ReportIndexEntry[]>(indexKey(slug));
    return Array.isArray(idx) ? idx : [];
  } catch (err) {
    console.error("KV report index read failed:", err);
    return [];
  }
}

function toIndexEntry(snap: MonthlyReportSnapshot): ReportIndexEntry {
  return {
    period: snap.period,
    periodLabel: snap.periodLabel,
    status: snap.status,
    generatedAt: snap.generatedAt,
    hasPdf: Boolean(snap.pdfBlobUrl),
  };
}

/** Write a snapshot and refresh its row in the client's index (newest-first,
 *  capped). Replaces any existing snapshot for the same month. */
export async function saveReport(
  snap: MonthlyReportSnapshot,
): Promise<MonthlyReportSnapshot> {
  if (!reportStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  await kv.set(snapKey(snap.slug, snap.period), snap);
  const index = await listReports(snap.slug);
  const next = [
    toIndexEntry(snap),
    ...index.filter((e) => e.period !== snap.period),
  ]
    .sort((a, b) => (a.period < b.period ? 1 : -1))
    .slice(0, MAX_INDEX);
  await kv.set(indexKey(snap.slug), next);
  return snap;
}

/** Merge-patch a stored snapshot (manual inputs, notes, status, pdf url).
 *  Returns null when the snapshot is missing. */
export async function patchReport(
  slug: string,
  period: string,
  patch: Partial<MonthlyReportSnapshot>,
): Promise<MonthlyReportSnapshot | null> {
  const current = await getReport(slug, period);
  if (!current) return null;
  const next: MonthlyReportSnapshot = {
    ...current,
    ...patch,
    slug: current.slug,
    period: current.period,
    schemaVersion: REPORT_SCHEMA_VERSION,
  };
  return saveReport(next);
}

export async function deleteReport(
  slug: string,
  period: string,
): Promise<void> {
  if (!reportStorageConfigured) return;
  try {
    await kv.del(snapKey(slug, period));
    const index = await listReports(slug);
    await kv.set(
      indexKey(slug),
      index.filter((e) => e.period !== period),
    );
  } catch (err) {
    console.error("KV report delete failed:", err);
  }
}
