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

export const CURRENCIES = ["EUR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function currencySymbol(c: Currency): string {
  return c === "EUR" ? "€" : "$";
}

export function formatMoney(amount: number, c: Currency): string {
  return new Intl.NumberFormat(c === "EUR" ? "en-GB" : "en-US", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Full agency consultant roster — drives the multi-select dropdown on
 *  every admin row. Source of truth: client-overrides.ts (SEO) + the
 *  ADS roster. Keep in sync when a new consultant joins. */
export const CONSULTANTS = [
  "Manuel S.",
  "Fran. R.",
  "Yenisey R.",
  "Germano C.",
] as const;
export type Consultant = (typeof CONSULTANTS)[number];

/** Renames that should auto-apply when reading an old admin record —
 *  so a saved consultant field carrying "André P." picks up the v74.10
 *  handover to "Manuel S." without manual cleanup. */
const CONSULTANT_RENAMES: Record<string, string> = {
  "André P.": "Manuel S.",
  "Luana N.": "Manuel S.", // older legacy → handover chain
};

export type AdminClientRecord = {
  slug: string;
  /** Billing cadence — Monthly / Each 3 Months / Each 6 Months (the
   *  three options the user specified). Drives nextBillingDate
   *  computation downstream when starting date is set. */
  billingCadence: BillingCadence;
  /** ISO yyyy-mm-dd — when the engagement started. Renders DD/MM/YYYY
   *  in the UI (per Andre's preference). */
  startingDate: string | null;
  /** Head consultants. A client can have one or more — typical setup
   *  is one SEO consultant + the ADS consultant when shared. Free-form
   *  strings (not strictly enum-typed) so the column accepts new hires
   *  without an immediate code change; the dropdown surfaces the
   *  canonical roster from `CONSULTANTS`. */
  consultants: string[];
  /** Current engagement status — drives a coloured pill. */
  status: ClientStatus;
  /** Billing currency for this client. Mixed-currency rosters are
   *  rolled up per-currency in the panel header. */
  currency: Currency;
  /** Monthly equivalent value (raw number in the client's currency,
   *  no symbol). Used for the Active MRR roll-ups. */
  monthlyValue: number | null;
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
  const seed = getConsultantForSlug(slug);
  return {
    slug,
    billingCadence: "monthly",
    startingDate: null,
    consultants: seed === "Unassigned" ? [] : [seed],
    status: "active",
    currency: "EUR",
    monthlyValue: null,
    notes: "",
    updatedAt: new Date(0).toISOString(),
  };
}

/** Legacy record shape — pre-multi-consultant / pre-currency. Used to
 *  migrate older KV entries on read so saves from before v74.10 keep
 *  rendering correctly. */
type LegacyAdminRecord = AdminClientRecord & {
  consultant?: string;
  monthlyValueEur?: number | null;
};

function migrateRecord(
  raw: LegacyAdminRecord,
  slug: string,
): AdminClientRecord {
  const base = defaultAdminRecord(slug);
  // Single-consultant string from pre-v74.10 records → array.
  const rawConsultants: string[] =
    Array.isArray(raw.consultants) && raw.consultants.length > 0
      ? raw.consultants.filter((c) => typeof c === "string" && c.trim())
      : typeof raw.consultant === "string" && raw.consultant.trim()
        ? [raw.consultant.trim()]
        : base.consultants;
  // Apply handover renames (André P. → Manuel S., etc.) and dedupe.
  const consultants = Array.from(
    new Set(rawConsultants.map((c) => CONSULTANT_RENAMES[c] ?? c)),
  );
  // Old EUR-only value → currency-tagged value.
  const monthlyValue =
    typeof raw.monthlyValue === "number"
      ? raw.monthlyValue
      : typeof raw.monthlyValueEur === "number"
        ? raw.monthlyValueEur
        : base.monthlyValue;
  const currency = (CURRENCIES as readonly string[]).includes(raw.currency)
    ? raw.currency
    : base.currency;
  return {
    ...base,
    ...raw,
    slug,
    consultants,
    currency,
    monthlyValue,
  };
}

/** Load one admin record — KV first, defaults to a derived skeleton. */
export async function getAdminRecord(slug: string): Promise<AdminClientRecord> {
  if (!adminStorageConfigured) return defaultAdminRecord(slug);
  try {
    const stored = await kv.get<LegacyAdminRecord>(`${KEY_PREFIX}${slug}`);
    if (stored && typeof stored === "object" && stored.slug === slug) {
      return migrateRecord(stored, slug);
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
