// Per-client admin record — billing cadence, starting date, consultant,
// commercial status, monthly value, and free-form notes. Keyed by slug
// in KV so changes propagate across departments and across the team.
//
// The defaults come from existing per-slug overrides (consultant from
// client-overrides.ts, etc.) so a fresh client without an admin record
// renders sensibly. Saving any field promotes the record to KV.

import { kv } from "@vercel/kv";
import { getConsultantForSlug } from "./client-overrides";

const KEY_PREFIX = "admin-client:";

export const BILLING_CADENCES = [
  "monthly",
  "quarterly",
  "semi-annual",
] as const;
export type BillingCadence = (typeof BILLING_CADENCES)[number];

export const CLIENT_STATUSES = [
  "active",
  "paused",
  "onboarding",
  "offboarded",
] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export type AdminClientRecord = {
  slug: string;
  /** Billing cadence — Monthly / Each 3 Months / Each 6 Months (the
   *  three options the user specified). Drives nextBillingDate
   *  computation downstream when starting date is set. */
  billingCadence: BillingCadence;
  /** ISO yyyy-mm-dd — when the engagement started. Renders DD/MM/YYYY
   *  in the UI (per Andre's preference). */
  startingDate: string | null;
  /** Head consultant. Free text so we can name people not yet in the
   *  overrides table. Defaults to getConsultantForSlug(slug). */
  consultant: string;
  /** Current engagement status — drives a coloured pill. */
  status: ClientStatus;
  /** Monthly equivalent value in € (raw number, no formatting). Used
   *  for an at-a-glance MRR roll-up at the top of the admin panel. */
  monthlyValueEur: number | null;
  /** Free-form notes — payment quirks, special invoicing instructions,
   *  client contact preferences, etc. */
  notes: string;
  /** Updated-at ISO timestamp — set automatically on every save. */
  updatedAt: string;
};

export const adminStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export function defaultAdminRecord(slug: string): AdminClientRecord {
  return {
    slug,
    billingCadence: "monthly",
    startingDate: null,
    consultant: getConsultantForSlug(slug),
    status: "active",
    monthlyValueEur: null,
    notes: "",
    updatedAt: new Date(0).toISOString(),
  };
}

/** Load one admin record — KV first, defaults to a derived skeleton. */
export async function getAdminRecord(slug: string): Promise<AdminClientRecord> {
  if (!adminStorageConfigured) return defaultAdminRecord(slug);
  try {
    const stored = await kv.get<AdminClientRecord>(`${KEY_PREFIX}${slug}`);
    if (stored && typeof stored === "object" && stored.slug === slug) {
      return { ...defaultAdminRecord(slug), ...stored };
    }
  } catch (err) {
    console.error("admin-clients KV read failed:", err);
  }
  return defaultAdminRecord(slug);
}

/** Replace an admin record (merging input with defaults). */
export async function saveAdminRecord(
  slug: string,
  patch: Partial<Omit<AdminClientRecord, "slug" | "updatedAt">>,
): Promise<AdminClientRecord> {
  if (!adminStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getAdminRecord(slug);
  const next: AdminClientRecord = {
    ...current,
    ...patch,
    slug,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`${KEY_PREFIX}${slug}`, next);
  return next;
}

/** Load every admin record for an arbitrary slug list. */
export async function getAdminRecords(
  slugs: string[],
): Promise<Record<string, AdminClientRecord>> {
  const entries = await Promise.all(
    slugs.map(async (s) => [s, await getAdminRecord(s)] as const),
  );
  return Object.fromEntries(entries);
}

// ---------------------------------------------------------------------------
// Cadence-derived helpers
// ---------------------------------------------------------------------------

/** Months between billings for a given cadence. */
export function cadenceMonths(c: BillingCadence): number {
  switch (c) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "semi-annual":
      return 6;
  }
}

/** Human label for the cadence (used in the admin UI + the
 *  Pending-Review / Roadmap downstream views). */
export function cadenceLabel(c: BillingCadence): string {
  switch (c) {
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Each 3 months";
    case "semi-annual":
      return "Each 6 months";
  }
}

/** Compute the next billing date from the starting date + cadence,
 *  by stepping forward in `cadenceMonths` increments until we land
 *  on or after today. Returns null when starting date is unset. */
export function nextBillingDate(
  startingDate: string | null,
  cadence: BillingCadence,
  now: Date = new Date(),
): Date | null {
  if (!startingDate) return null;
  const start = new Date(`${startingDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const step = cadenceMonths(cadence);
  const next = new Date(start);
  while (next.getTime() <= now.getTime()) {
    next.setUTCMonth(next.getUTCMonth() + step);
  }
  return next;
}
