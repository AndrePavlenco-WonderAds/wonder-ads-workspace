// Transient KV store for the two-phase SEO Audit.
// Phase 1 (prep) saves a record here — either successful fact pack or a
// captured error — so Phase 2 (run) can always tell the user what happened.
// TTL = 1 hour.

import { kv } from "@vercel/kv";
import type { DomainMetrics } from "./seo-tools/dataforseo";
import type { PsiResult } from "./seo-tools/pagespeed";

export type SiteVitals = {
  mobile?: PsiResult | null;
  desktop?: PsiResult | null;
};

const PREFIX = "audit-prep:";
const TTL_SECONDS = 3600;

export type AuditPrep =
  | {
      status: "ok";
      factPack: string;
      metrics: DomainMetrics | null;
      vitals?: SiteVitals;
      preparedAt: number;
      inputUrl: string;
    }
  | {
      status: "error";
      message: string;
      stage: string; // which step failed (e.g. "save", "runSiteAudit")
      preparedAt: number;
      inputUrl: string;
      partialFactPack?: string;
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
