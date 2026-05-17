// Transient KV store for the two-phase SEO Audit.
// Phase 1 (prep) saves the tool fact pack here; Phase 2 (run) reads it and
// feeds Claude. TTL = 1 hour — long enough to handle a stalled or retried
// run, short enough that abandoned preps don't pile up.

import { kv } from "@vercel/kv";
import type { DomainMetrics } from "./seo-tools/dataforseo";

const PREFIX = "audit-prep:";
const TTL_SECONDS = 3600;

export type AuditPrep = {
  factPack: string;
  metrics: DomainMetrics | null;
  preparedAt: number;
  inputUrl: string;
};

function key(
  clientSlug: string,
  actionSlug: string,
  resultId: string,
): string {
  return `${PREFIX}${clientSlug}:${actionSlug}:${resultId}`;
}

export async function saveAuditPrep(
  clientSlug: string,
  actionSlug: string,
  resultId: string,
  prep: AuditPrep,
): Promise<void> {
  await kv.set(key(clientSlug, actionSlug, resultId), prep, {
    ex: TTL_SECONDS,
  });
}

export async function loadAuditPrep(
  clientSlug: string,
  actionSlug: string,
  resultId: string,
): Promise<AuditPrep | null> {
  const v = await kv.get<AuditPrep>(key(clientSlug, actionSlug, resultId));
  return v ?? null;
}

export async function clearAuditPrep(
  clientSlug: string,
  actionSlug: string,
  resultId: string,
): Promise<void> {
  try {
    await kv.del(key(clientSlug, actionSlug, resultId));
  } catch (err) {
    console.error("audit-prep clear failed:", err);
  }
}
