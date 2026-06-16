// Employee records for the SuperAdmin Control Suite — KV-backed,
// parallel to admin-clients-store but keyed by employee id (slugified
// name). Seed roster is derived from the canonical CONSULTANTS list so
// the table works the moment the suite opens; additional hires are
// stored in a dedicated index key so we don't lose them on cold reads.

import { kv } from "@vercel/kv";
import {
  BILLING_CADENCES,
  type BillingCadence,
  type Currency,
} from "./admin-clients-store";

const KEY_PREFIX = "admin-employee:";
const INDEX_KEY = "admin-employees:roster";

export const EMPLOYEE_STATUSES = [
  "active",
  "onboarding",
  "on-leave",
  "offboarded",
] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_DEPARTMENTS = [
  "SEO",
  "ADS",
  "Operations",
  "Founder",
] as const;
export type EmployeeDepartment = (typeof EMPLOYEE_DEPARTMENTS)[number];

export type AdminEmployeeRecord = {
  /** Stable identifier — slugified at creation, never changes after. */
  id: string;
  /** Display name (e.g. "Manuel S."). */
  name: string;
  /** Work email — defaults to `${first.toLowerCase()}@wonder-ads.com`. */
  email: string;
  /** Role / title (free text). */
  role: string;
  /** Departments this employee operates in. Multi-select. */
  departments: string[];
  /** ISO yyyy-mm-dd start date. */
  startingDate: string | null;
  /** Pay cadence — reuses the billing-cadence enum. */
  paymentCadence: BillingCadence;
  /** Pay currency. */
  currency: Currency;
  /** Monthly salary in `currency`. */
  monthlyValue: number | null;
  /** Engagement status. */
  status: EmployeeStatus;
  /** Free-form notes (contract quirks, leave dates, etc.). */
  notes: string;
  /** Updated-at ISO timestamp — stamped on every save. */
  updatedAt: string;
};

export const employeesStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// ---------------------------------------------------------------------------
// Default roster — seeded into the panel even before KV has any
// records. Edits promote the record into KV; new hires get appended
// to the roster index alongside their record.
// ---------------------------------------------------------------------------

type SeedEmployee = {
  id: string;
  name: string;
  emailHandle: string;
  role: string;
  departments: string[];
  /** Default monthly salary in EUR. Populated from the agency's
   *  current payroll so the table lands ready-to-use. */
  monthlyValueEur?: number;
  /** ISO yyyy-mm-dd — when the employee joined. */
  startingDate?: string;
};

export const SEED_EMPLOYEES: SeedEmployee[] = [
  {
    id: "manuel-s",
    name: "Manuel S.",
    emailHandle: "manuel",
    role: "SEO Consultant",
    departments: ["SEO"],
    monthlyValueEur: 400,
    // Manuel starts the day after this release (today is 2026-06-02).
    startingDate: "2026-06-03",
  },
  {
    id: "fran-r",
    name: "Fran. R.",
    emailHandle: "fran",
    role: "SEO Consultant",
    departments: ["SEO"],
    monthlyValueEur: 1000,
    startingDate: "2026-03-17",
  },
  {
    id: "yenisey-r",
    name: "Yenisey R.",
    emailHandle: "yeni",
    role: "SEO Consultant",
    departments: ["SEO"],
    monthlyValueEur: 1250,
    startingDate: "2026-04-20",
  },
  {
    id: "germano-c",
    name: "Germano C.",
    emailHandle: "germano",
    role: "ADS Consultant",
    departments: ["ADS"],
    monthlyValueEur: 1000,
    // Germano start date not provided yet — left null until populated.
  },
  {
    id: "andre-pereira",
    name: "André Pereira",
    emailHandle: "andre.pereira",
    role: "SEO Consultant",
    departments: ["SEO"],
    // Monthly rate not provided yet — left null until populated.
    startingDate: "2026-06-15",
  },
];

export function slugifyEmployee(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function emailFromHandle(handle: string): string {
  return `${handle.toLowerCase()}@wonder-ads.com`;
}

export function defaultEmployeeRecord(seed: SeedEmployee): AdminEmployeeRecord {
  return {
    id: seed.id,
    name: seed.name,
    email: emailFromHandle(seed.emailHandle),
    role: seed.role,
    departments: [...seed.departments],
    startingDate: seed.startingDate ?? null,
    paymentCadence: "monthly",
    currency: "EUR",
    monthlyValue: seed.monthlyValueEur ?? null,
    status: "active",
    notes: "",
    updatedAt: new Date(0).toISOString(),
  };
}

/** Build a fresh record for a brand-new hire (no seed match). */
export function newEmployeeRecord(input: {
  id: string;
  name: string;
  email: string;
  role?: string;
  departments?: string[];
}): AdminEmployeeRecord {
  return {
    id: input.id,
    name: input.name,
    email: input.email,
    role: input.role ?? "",
    departments: input.departments ?? [],
    startingDate: null,
    paymentCadence: "monthly",
    currency: "EUR",
    monthlyValue: null,
    status: "onboarding",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

/** Load one record by id — KV first, falls back to the seed default. */
export async function getEmployeeRecord(
  id: string,
): Promise<AdminEmployeeRecord | null> {
  if (!employeesStorageConfigured) {
    const seed = SEED_EMPLOYEES.find((s) => s.id === id);
    return seed ? defaultEmployeeRecord(seed) : null;
  }
  try {
    const stored = await kv.get<AdminEmployeeRecord>(`${KEY_PREFIX}${id}`);
    if (stored && typeof stored === "object" && stored.id === id) {
      return migrateRecord(stored);
    }
  } catch (err) {
    console.error("admin-employees KV read failed:", err);
  }
  const seed = SEED_EMPLOYEES.find((s) => s.id === id);
  return seed ? defaultEmployeeRecord(seed) : null;
}

type LegacyRecord = AdminEmployeeRecord & Record<string, unknown>;

function migrateRecord(raw: LegacyRecord): AdminEmployeeRecord {
  const validCadence = (BILLING_CADENCES as readonly string[]).includes(
    raw.paymentCadence,
  )
    ? raw.paymentCadence
    : ("monthly" as BillingCadence);
  // Agency pays in euros only as of v74.15 — coerce any stale USD on
  // disk so the rollups stay consistent.
  const validCurrency: Currency = "EUR";
  const validStatus = (EMPLOYEE_STATUSES as readonly string[]).includes(
    raw.status,
  )
    ? raw.status
    : ("active" as EmployeeStatus);
  // Backfill seed-employee payroll + starting dates when the saved
  // record still has them null. Lets v74.15 ship the canonical
  // payroll without touching the KV manually.
  const seed = SEED_EMPLOYEES.find((s) => s.id === raw.id);
  const monthlyValue =
    typeof raw.monthlyValue === "number"
      ? raw.monthlyValue
      : (seed?.monthlyValueEur ?? null);
  const startingDate = raw.startingDate ?? seed?.startingDate ?? null;
  return {
    ...raw,
    departments: Array.isArray(raw.departments) ? raw.departments : [],
    paymentCadence: validCadence,
    currency: validCurrency,
    status: validStatus,
    monthlyValue,
    startingDate,
  };
}

async function loadRosterIndex(): Promise<string[]> {
  if (!employeesStorageConfigured) return [];
  try {
    const ids = await kv.get<string[]>(INDEX_KEY);
    if (Array.isArray(ids)) {
      return ids.filter((id) => typeof id === "string");
    }
  } catch (err) {
    console.error("admin-employees index read failed:", err);
  }
  return [];
}

async function saveRosterIndex(ids: string[]): Promise<void> {
  if (!employeesStorageConfigured) return;
  await kv.set(INDEX_KEY, ids);
}

/** Full roster — seed employees + any added via the API. Deduped by id. */
export async function listEmployees(): Promise<AdminEmployeeRecord[]> {
  const extra = await loadRosterIndex();
  const seedIds = SEED_EMPLOYEES.map((s) => s.id);
  const allIds = Array.from(new Set([...seedIds, ...extra]));
  const records = await Promise.all(
    allIds.map(async (id) => {
      const fromKv = employeesStorageConfigured
        ? await kv
            .get<AdminEmployeeRecord>(`${KEY_PREFIX}${id}`)
            .catch(() => null)
        : null;
      if (fromKv && fromKv.id === id) return migrateRecord(fromKv);
      const seed = SEED_EMPLOYEES.find((s) => s.id === id);
      return seed ? defaultEmployeeRecord(seed) : null;
    }),
  );
  return records.filter(
    (r): r is AdminEmployeeRecord => r !== null,
  );
}

/** Apply a partial patch to an employee record. */
export async function saveEmployeeRecord(
  id: string,
  patch: Partial<Omit<AdminEmployeeRecord, "id" | "updatedAt">>,
): Promise<AdminEmployeeRecord> {
  if (!employeesStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = (await getEmployeeRecord(id)) ?? null;
  if (!current) {
    throw new Error(`Unknown employee id: ${id}`);
  }
  const next: AdminEmployeeRecord = {
    ...current,
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`${KEY_PREFIX}${id}`, next);
  return next;
}

/** Add a new (non-seed) employee. Appends to the roster index and
 *  writes the record. Returns the new record. */
export async function addEmployee(input: {
  name: string;
  email: string;
  role?: string;
  departments?: string[];
}): Promise<AdminEmployeeRecord> {
  if (!employeesStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const baseId = slugifyEmployee(input.name);
  if (!baseId) throw new Error("Name is required.");
  let id = baseId;
  let n = 2;
  // Avoid collisions with existing seeds or stored records.
  const seedIds = new Set(SEED_EMPLOYEES.map((s) => s.id));
  const roster = await loadRosterIndex();
  const taken = new Set([...seedIds, ...roster]);
  while (taken.has(id)) {
    id = `${baseId}-${n++}`;
  }
  const record = newEmployeeRecord({
    id,
    name: input.name,
    email: input.email,
    role: input.role,
    departments: input.departments,
  });
  await kv.set(`${KEY_PREFIX}${id}`, record);
  await saveRosterIndex([...roster, id]);
  return record;
}

/** Remove an employee. Seed employees stay in the seed list — the
 *  record file gets deleted so a fresh read returns the default again.
 *  Custom (added) employees disappear from the roster entirely. */
export async function deleteEmployee(id: string): Promise<void> {
  if (!employeesStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  await kv.del(`${KEY_PREFIX}${id}`);
  const roster = await loadRosterIndex();
  if (roster.includes(id)) {
    await saveRosterIndex(roster.filter((r) => r !== id));
  }
}
