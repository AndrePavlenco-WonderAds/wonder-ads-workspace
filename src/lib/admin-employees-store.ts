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
  "Web",
  "Operations",
  "Founder",
] as const;
export type EmployeeDepartment = (typeof EMPLOYEE_DEPARTMENTS)[number];

export type AdminEmployeeRecord = {
  /** Stable identifier — slugified at creation, never changes after. */
  id: string;
  /** Display name (e.g. "Manuel Silva"). */
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
  /** MUST match the credential username in `auth/credentials.ts` for
   *  everyone who has a workspace login — that id is the bridge that ties
   *  a roster row to its account (access column + exam clock). */
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
  /** Defaults to "active". Only set it for people who are already off the
   *  books, so the roster doesn't lie about who is working here today. */
  status?: EmployeeStatus;
};

// v76.31: the seed roster is now ONE ROW PER WORKSPACE LOGIN, plus the
// people who work here without one. Before this it listed five names while
// thirteen accounts could log in — the four web designers, João B. and the
// three SuperAdmins existed only in the credential table, so the C-suite's
// roster and the app's real access list disagreed about who works here.
//
// Salaries are deliberately left empty where they were never given to the
// app: an empty cell shows up in rose as "Needs salary", which is the honest
// state. A guessed number would quietly poison the payroll roll-up.
export const SEED_EMPLOYEES: SeedEmployee[] = [
  // ── Founder + SuperAdmins ────────────────────────────────────────────
  {
    id: "andre",
    name: "André Pavlenco",
    emailHandle: "andre",
    role: "Founder",
    departments: ["Founder"],
    startingDate: "2026-05-12",
  },
  {
    id: "alex",
    name: "Alex",
    emailHandle: "alex",
    role: "SuperAdmin",
    departments: ["Founder"],
    startingDate: "2026-05-12",
  },
  {
    id: "alice",
    name: "Alice",
    emailHandle: "alice",
    role: "SuperAdmin",
    departments: ["Operations"],
    startingDate: "2026-05-12",
  },
  // ── SEO ──────────────────────────────────────────────────────────────
  {
    id: "fran-r",
    name: "Fran. Rosa",
    emailHandle: "fran",
    role: "SEO Consultant",
    departments: ["SEO"],
    monthlyValueEur: 1000,
    startingDate: "2026-03-17",
  },
  {
    id: "manuel-s",
    name: "Manuel Silva",
    emailHandle: "manuel",
    role: "SEO Consultant",
    departments: ["SEO"],
    monthlyValueEur: 400,
    // Manuel starts the day after this release (today is 2026-06-02).
    startingDate: "2026-06-03",
  },
  {
    id: "andre-pereira",
    name: "André Pereira",
    emailHandle: "andre.pereira",
    role: "SEO Consultant",
    departments: ["SEO"],
    // Monthly rate not provided yet — left null until populated.
    startingDate: "2026-06-17",
  },
  {
    id: "joao-b",
    name: "João B.",
    emailHandle: "joao.batista",
    role: "SEO Consultant",
    departments: ["SEO"],
    startingDate: "2026-07-23",
  },
  // ── ADS ──────────────────────────────────────────────────────────────
  {
    id: "germano-c",
    name: "Germano C.",
    emailHandle: "germano",
    role: "ADS Consultant",
    departments: ["ADS"],
    monthlyValueEur: 1000,
    // Germano start date not provided yet — left null until populated.
  },
  // ── Web ──────────────────────────────────────────────────────────────
  {
    id: "mike",
    name: "Mike Nobre",
    emailHandle: "mike",
    role: "Web Designer",
    departments: ["Web"],
    startingDate: "2026-06-16",
  },
  {
    id: "gustavo",
    name: "Gustavo Rotini",
    emailHandle: "gustavo",
    role: "Web Designer",
    departments: ["Web"],
    startingDate: "2026-06-16",
  },
  {
    id: "renan",
    name: "Renan Alves",
    emailHandle: "renan",
    role: "Web Designer",
    departments: ["Web"],
    startingDate: "2026-06-16",
  },
  {
    id: "cylas",
    name: "Cylas",
    emailHandle: "cylas",
    role: "Web Designer",
    departments: ["Web"],
    startingDate: "2026-06-23",
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

/** Sem acentos, sem pontuação, minúsculas — a chave com que o roster e a
 *  lista de consultores de um cliente se encontram. */
export function rosterNameKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Chave da carteira ativa de uma linha do roster.
 *
 *  O nome GUARDADO na linha não serve: o registo do Manuel foi gravado como
 *  "Manuel S." e os clientes dele estão atribuídos a "Manuel Silva", por isso
 *  a coluna «Active portfolio» dizia-lhe «None active» com cinco clientes na
 *  mão. O nome do seed é o canónico — quando o id é de seed, é esse que conta;
 *  para contratações fora da lista, o nome da própria linha. */
export function portfolioKeyFor(id: string, name: string): string {
  const seed = SEED_EMPLOYEES.find((s) => s.id === id);
  return rosterNameKey(seed?.name ?? name);
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
    status: seed.status ?? "active",
    notes: "",
    updatedAt: new Date(0).toISOString(),
  };
}

/** Build a fresh record for a brand-new hire (no seed match). Every
 *  operational field can be supplied up front so the Add form can capture
 *  the full picture (starting date, department, salary, status, notes) in
 *  one shot instead of leaving them null to fill in later. */
export function newEmployeeRecord(input: {
  id: string;
  name: string;
  email: string;
  role?: string;
  departments?: string[];
  startingDate?: string | null;
  monthlyValue?: number | null;
  status?: EmployeeStatus;
  notes?: string;
}): AdminEmployeeRecord {
  return {
    id: input.id,
    name: input.name,
    email: input.email,
    role: input.role ?? "",
    departments: input.departments ?? [],
    startingDate: input.startingDate ?? null,
    paymentCadence: "monthly",
    currency: "EUR",
    monthlyValue: input.monthlyValue ?? null,
    status: input.status ?? "onboarding",
    notes: input.notes ?? "",
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
  startingDate?: string | null;
  monthlyValue?: number | null;
  status?: EmployeeStatus;
  notes?: string;
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
  const record = newEmployeeRecord({ id, ...input });
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
