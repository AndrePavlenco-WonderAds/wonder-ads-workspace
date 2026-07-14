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
  "bi-monthly",
  "quarterly",
  "semi-annual",
  "one-off",
] as const;
export type BillingCadence = (typeof BILLING_CADENCES)[number];

export const CLIENT_STATUSES = [
  "active",
  "paused",
  "onboarding",
  "offboarded",
] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

/** How this client gets invoiced — drives the Invoice Type dropdown
 *  column on the Clients table. Canva (subscription billed through
 *  Canva), Contabilidade (handled by the accountant), or Plataforma
 *  (billed through an ad platform / SaaS). */
export const INVOICE_TYPES = ["Canva", "Contabilidade", "Plataforma"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

// Currency type is kept for forward compatibility (the field exists on
// every record) but the UI only offers EUR now — the agency bills in
// euros only. Any record carrying a stale USD value gets coerced to
// EUR on read in `migrateRecord` below.
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

/** Pre-populated starting dates pulled from the team's post-it board.
 *  Used as a fallback when an admin record has `startingDate === null`,
 *  so the roster lands with sane defaults the moment the SuperAdmin
 *  Suite opens. ISO yyyy-mm-dd. Always the "Starting date" — never the
 *  "Re-starting Date" notes that appear below it on the board. */
export const DEFAULT_STARTING_DATES: Record<string, string> = {
  wonderads: "2026-03-30",
  "clinica-em-casa": "2026-02-26",
  "clinica-mimus": "2026-05-04",
  "insync-design": "2026-01-23",  "safe-away": "2026-02-20",
  "sea-yourself": "2026-01-14",
  "a-domingos": "2026-02-23",
  "aeger-prima": "2025-11-19",
  "b-life": "2026-02-09",
  "hds-learning": "2026-01-07",
  "white-clinic": "2026-03-30",
  ihn: "2026-03-30",
  "spine-center": "2026-06-01",
  "fisio-restelo": "2026-02-12",
  "monte-mar": "2026-03-23",
  cdt: "2026-03-23",
  "sentir-saude": "2026-06-15",
  "clinica-fernando-almeida": "2026-06-15",
};

/** Full agency consultant roster — drives the multi-select dropdown on
 *  every admin row. Source of truth: client-overrides.ts (SEO) + the
 *  ADS roster. Keep in sync when a new consultant joins. */
export const CONSULTANTS = [
  "Manuel Silva",
  "Fran. Rosa",
  "Yenisey Rodriguez",
  "Germano C.",
  "André Pereira",
] as const;
export type Consultant = (typeof CONSULTANTS)[number];

/** Renames that should auto-apply when reading an old admin record —
 *  so a saved consultant field carrying an old short form picks up the
 *  current full name without manual cleanup. v74.31.2: the three SEO
 *  consultants moved from short ("Fran. R.") to full names ("Fran.
 *  Rosa"); the André P. / Luana N. entries preserve the older v74.10
 *  handover chain into Manuel. */
const CONSULTANT_RENAMES: Record<string, string> = {
  "Manuel S.": "Manuel Silva",
  "Fran. R.": "Fran. Rosa",
  "Yenisey R.": "Yenisey Rodriguez",
  "André P.": "Manuel Silva",
  "Luana N.": "Manuel Silva", // older legacy → handover chain
};

/** Departments a client row can belong to. Used as a typed dimension
 *  of the per-(slug, department) record key — kept in sync with the
 *  pill-coloring map in admin-client-row.tsx. */
export const CLIENT_DEPARTMENTS = ["SEO", "ADS", "Web", "CRM"] as const;
export type ClientDepartment = (typeof CLIENT_DEPARTMENTS)[number];

/** Canonical department for each consultant — drives both the
 *  consultant-default-on-create logic AND the legacy-record split
 *  on read (a legacy record holding [Yenisey, Germano] gets
 *  attributed Yenisey → SEO row, Germano → ADS row). */
export const CONSULTANT_DEPARTMENT: Record<string, ClientDepartment> = {
  "Manuel Silva": "SEO",
  "Fran. Rosa": "SEO",
  "Yenisey Rodriguez": "SEO",
  "Germano C.": "ADS",
  "André Pereira": "SEO",
};

/** Department a legacy single-row record's monthlyValue should be
 *  attributed to when the client spans multiple departments. We pick
 *  the FIRST of the client's departments in this order so the
 *  conversion is deterministic. Lower index wins. */
export const LEGACY_VALUE_DEPT_PRIORITY: ClientDepartment[] = [
  "SEO",
  "ADS",
  "Web",
  "CRM",
];

export type AdminClientRecord = {
  slug: string;
  /** Which department this row belongs to. Multi-dept clients have
   *  one row per department so each consultant team owns their own
   *  budget slice — no more double-counting in MRR or in per-employee
   *  Active Portfolio totals. */
  department: ClientDepartment;
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
  /** Current engagement status — drives a coloured pill. Retained for
   *  the Employees page's Active-Portfolio rollup even though the
   *  Clients table no longer surfaces it as a column (v74.46). */
  status: ClientStatus;
  /** How this client is invoiced — Canva / Contabilidade / Plataforma. */
  invoiceType: InvoiceType;
  /** Editable invoice date for this row (ISO yyyy-mm-dd). Replaced the
   *  derived "next billing" column in v74.46 — empty by default; the
   *  team fills it in manually. */
  invoiceDate: string | null;
  /** Billing currency for this client. Mixed-currency rosters are
   *  rolled up per-currency in the panel header. */
  currency: Currency;
  /** Monthly equivalent value (raw number in the client's currency,
   *  no symbol). Used for the Active MRR roll-ups. */
  monthlyValue: number | null;
  /** Total contract value the client pays when paying upfront (raw
   *  number, no symbol). Informational column — does NOT feed MRR. */
  totalValue: number | null;
  /** IVA amount in EUR for this row — editable, empty by default.
   *  Summed across the table into the "Obrigações Fiscais" tile. */
  iva: number | null;
  /** Free-form notes — payment quirks, special invoicing instructions,
   *  client contact preferences, etc. */
  notes: string;
  /** Updated-at ISO timestamp — set automatically on every save. */
  updatedAt: string;
};

export const adminStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export function defaultAdminRecord(
  slug: string,
  department: ClientDepartment,
): AdminClientRecord {
  // Seed the consultant from the canonical override map ONLY when it
  // aligns with the row's department — otherwise leave empty so the
  // consultant picker reflects reality (Yenisey on the SEO row of a
  // shared client, Germano on the ADS row, etc.).
  const seedName = getConsultantForSlug(slug);
  const seedDept =
    seedName !== "Unassigned" ? CONSULTANT_DEPARTMENT[seedName] : undefined;
  return {
    slug,
    department,
    billingCadence: "monthly",
    startingDate: DEFAULT_STARTING_DATES[slug] ?? null,
    consultants:
      seedName !== "Unassigned" && seedDept === department ? [seedName] : [],
    status: "active",
    invoiceType: "Plataforma",
    invoiceDate: null,
    currency: "EUR",
    monthlyValue: null,
    totalValue: null,
    iva: null,
    notes: "",
    updatedAt: new Date(0).toISOString(),
  };
}

/** Per-(slug, dept) KV key. Department is lower-cased so the key is
 *  stable across casing nuances. */
function recordKey(slug: string, department: ClientDepartment): string {
  return `${KEY_PREFIX}${slug}:${department.toLowerCase()}`;
}

/** Legacy single-row key — `admin-client:<slug>`. Predates the
 *  per-department split (v74.15). Read once per slug to migrate. */
function legacyKey(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

/** Legacy record shape — pre-per-department / pre-multi-consultant /
 *  pre-currency. Used to migrate older KV entries on read so saves
 *  from before v74.15 keep rendering correctly. */
type LegacyAdminRecord = Omit<
  AdminClientRecord,
  "department" | "invoiceType" | "invoiceDate" | "iva"
> & {
  department?: ClientDepartment;
  consultant?: string;
  monthlyValueEur?: number | null;
  // v74.46 additions — optional on read so pre-v74.46 records migrate.
  invoiceType?: InvoiceType;
  invoiceDate?: string | null;
  iva?: number | null;
};

/** Common normalisation — currency coerced to EUR, consultants array
 *  + renames applied, startingDate backfilled. Used by BOTH the new
 *  per-dept reader and the legacy fallback so they share one
 *  source of truth for the field-level cleanup. */
function normaliseFields(
  raw: LegacyAdminRecord,
  slug: string,
  department: ClientDepartment,
): AdminClientRecord {
  const base = defaultAdminRecord(slug, department);
  const rawConsultants: string[] =
    Array.isArray(raw.consultants) && raw.consultants.length > 0
      ? raw.consultants.filter((c) => typeof c === "string" && c.trim())
      : typeof raw.consultant === "string" && raw.consultant.trim()
        ? [raw.consultant.trim()]
        : base.consultants;
  const consultants = Array.from(
    new Set(rawConsultants.map((c) => CONSULTANT_RENAMES[c] ?? c)),
  );
  const monthlyValue =
    typeof raw.monthlyValue === "number"
      ? raw.monthlyValue
      : typeof raw.monthlyValueEur === "number"
        ? raw.monthlyValueEur
        : base.monthlyValue;
  // Agency bills in EUR only as of v74.14.
  const currency: Currency = "EUR";
  const startingDate =
    raw.startingDate ?? DEFAULT_STARTING_DATES[slug] ?? null;
  const invoiceType: InvoiceType = (
    INVOICE_TYPES as readonly string[]
  ).includes(raw.invoiceType as string)
    ? (raw.invoiceType as InvoiceType)
    : base.invoiceType;
  const invoiceDate =
    typeof raw.invoiceDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.invoiceDate)
      ? raw.invoiceDate
      : base.invoiceDate;
  const iva = typeof raw.iva === "number" ? raw.iva : base.iva;
  const totalValue =
    typeof raw.totalValue === "number" ? raw.totalValue : base.totalValue;
  return {
    ...base,
    ...raw,
    slug,
    department,
    consultants,
    currency,
    monthlyValue,
    totalValue,
    startingDate,
    invoiceType,
    invoiceDate,
    iva,
  };
}

/** Split a legacy single record into a per-dept record for the
 *  caller-requested department.
 *
 *  - Consultants are filtered to those whose canonical department
 *    matches the target dept (Yenisey/Manuel/Fran → SEO row only,
 *    Germano → ADS row only). Unknown consultants pass through to
 *    every dept so we don't silently drop them.
 *  - The monthlyValue gets attributed to the LEGACY_VALUE_DEPT_PRIORITY
 *    winner only — other dept rows of the same client get null so
 *    the value is never double-counted in MRR. */
function deriveFromLegacy(
  legacy: LegacyAdminRecord,
  slug: string,
  department: ClientDepartment,
  clientDepartments: ClientDepartment[],
): AdminClientRecord {
  const base = normaliseFields(legacy, slug, department);
  const consultants = base.consultants.filter((name) => {
    const canonical = CONSULTANT_DEPARTMENT[name];
    return canonical === undefined || canonical === department;
  });
  // Pick the priority winner present in this client's departments.
  const priorityWinner = LEGACY_VALUE_DEPT_PRIORITY.find((d) =>
    clientDepartments.includes(d),
  );
  const monthlyValue =
    priorityWinner === department ? base.monthlyValue : null;
  return { ...base, consultants, monthlyValue };
}

/** Load one admin record by (slug, department). Read order:
 *    1. Per-dept key `admin-client:<slug>:<dept>` (current shape)
 *    2. Legacy single-row key `admin-client:<slug>` (pre-v74.15) —
 *       derived per `deriveFromLegacy`
 *    3. Default skeleton
 */
export async function getAdminRecord(
  slug: string,
  department: ClientDepartment,
  clientDepartments: ClientDepartment[] = [department],
): Promise<AdminClientRecord> {
  if (!adminStorageConfigured) return defaultAdminRecord(slug, department);
  try {
    const stored = await kv.get<LegacyAdminRecord>(
      recordKey(slug, department),
    );
    if (stored && typeof stored === "object" && stored.slug === slug) {
      return normaliseFields(stored, slug, department);
    }
  } catch (err) {
    console.error("admin-clients KV read failed (per-dept):", err);
  }
  try {
    const legacy = await kv.get<LegacyAdminRecord>(legacyKey(slug));
    if (legacy && typeof legacy === "object" && legacy.slug === slug) {
      return deriveFromLegacy(legacy, slug, department, clientDepartments);
    }
  } catch (err) {
    console.error("admin-clients KV read failed (legacy):", err);
  }
  return defaultAdminRecord(slug, department);
}

/** Replace a per-(slug, dept) admin record (merging input with the
 *  current persisted state). */
export async function saveAdminRecord(
  slug: string,
  department: ClientDepartment,
  patch: Partial<
    Omit<AdminClientRecord, "slug" | "department" | "updatedAt">
  >,
  clientDepartments: ClientDepartment[] = [department],
): Promise<AdminClientRecord> {
  if (!adminStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getAdminRecord(slug, department, clientDepartments);
  const next: AdminClientRecord = {
    ...current,
    ...patch,
    slug,
    department,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(recordKey(slug, department), next);
  return next;
}

/** Load every admin record for a list of (slug, department) pairs.
 *  The page-level callers build the union of merged client rosters,
 *  expand each shared client into its per-dept rows, then call this
 *  with one entry per row. */
export async function getAdminRecords(
  rows: Array<{ slug: string; departments: ClientDepartment[] }>,
): Promise<Record<string, AdminClientRecord>> {
  const entries: Array<[string, AdminClientRecord]> = [];
  await Promise.all(
    rows.map(async (row) => {
      for (const dept of row.departments) {
        const key = `${row.slug}::${dept}`;
        const rec = await getAdminRecord(row.slug, dept, row.departments);
        entries.push([key, rec]);
      }
    }),
  );
  return Object.fromEntries(entries);
}

/** Composite key used by callers to look up a record in the map
 *  returned by `getAdminRecords`. Keep in sync with the format
 *  produced inside `getAdminRecords` above. */
export function adminRecordKey(
  slug: string,
  department: ClientDepartment,
): string {
  return `${slug}::${department}`;
}

// ---------------------------------------------------------------------------
// Cadence-derived helpers
// ---------------------------------------------------------------------------

/** Months between billings for a given cadence. One-off has no recurring
 *  interval → 0 (callers must treat 0 as "no next billing"). */
export function cadenceMonths(c: BillingCadence): number {
  switch (c) {
    case "monthly":
      return 1;
    case "bi-monthly":
      return 2;
    case "quarterly":
      return 3;
    case "semi-annual":
      return 6;
    case "one-off":
      return 0;
  }
}

/** Human label for the cadence (used in the admin UI + the
 *  Pending-Review / Roadmap downstream views). */
export function cadenceLabel(c: BillingCadence): string {
  switch (c) {
    case "monthly":
      return "Monthly";
    case "bi-monthly":
      return "Each 2 months";
    case "quarterly":
      return "Each 3 months";
    case "semi-annual":
      return "Each 6 months";
    case "one-off":
      return "One-off";
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
  // One-off (step 0) has no recurring next billing.
  if (step <= 0) return null;
  const next = new Date(start);
  while (next.getTime() <= now.getTime()) {
    next.setUTCMonth(next.getUTCMonth() + step);
  }
  return next;
}
