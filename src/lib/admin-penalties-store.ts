// Disciplinary record per team member — SuperAdmin only.
//
// Deliberate design calls for this domain:
//
//  • REMOVAL IS A SOFT DELETE, WITH A REASON. A disciplinary log that can be
//    silently erased is worth nothing — the first dispute about "who deleted
//    what" destroys its credibility. Removed entries stay in the history,
//    struck through, showing who removed them and why. They stop counting
//    towards any score immediately.
//  • THE EMPLOYEE NAME IS DENORMALISED onto each entry, so history survives a
//    rename or a departure from the roster.
//  • `occurredOn` IS SEPARATE FROM `createdAt` — incidents get logged days
//    later, and the record should say when it happened, not when it was typed.
//  • THE ACTIVE SCORE ONLY COUNTS THE LAST 12 MONTHS. Something from two years
//    ago shouldn't weigh the same as last week; the entry stays in history but
//    stops counting. This keeps the tool corrective rather than punitive.
//
// One KV key holds every entry — the roster is ~10 people, so a single
// read/write serves the whole page (no per-employee fan-out).

import { kv } from "@vercel/kv";

const KEY = "admin-penalties";
const MAX = 2000;

/** 1 = leve (cinzento) · 2 = médio (amarelo) · 3 = grave (vermelho). */
export const PENALTY_SEVERITIES = [1, 2, 3] as const;
export type PenaltySeverity = (typeof PENALTY_SEVERITIES)[number];

export const SEVERITY_LABEL: Record<PenaltySeverity, string> = {
  1: "Leve",
  2: "Médio",
  3: "Grave",
};

/** Tailwind-ish token per severity, consumed by the UI chips. */
export const SEVERITY_TONE: Record<
  PenaltySeverity,
  { text: string; border: string; bg: string; dot: string }
> = {
  1: {
    text: "text-white/70",
    border: "border-white/18",
    bg: "bg-white/[0.06]",
    dot: "bg-white/45",
  },
  2: {
    text: "text-amber-200/90",
    border: "border-amber-400/30",
    bg: "bg-amber-500/[0.10]",
    dot: "bg-amber-400",
  },
  3: {
    text: "text-red-200/90",
    border: "border-red-400/35",
    bg: "bg-red-500/[0.12]",
    dot: "bg-red-400",
  },
};

export type Penalty = {
  id: string;
  employeeId: string;
  /** Denormalised so the record survives roster changes. */
  employeeName: string;
  /** Departments at time of logging — lets the overview group historically. */
  departments: string[];
  severity: PenaltySeverity;
  title: string;
  description: string;
  /** ISO yyyy-mm-dd — when the incident happened. */
  occurredOn: string;
  createdAt: number;
  /** Display name of whoever logged it. */
  createdBy: string;
  /** Soft delete — the entry stays in history but stops counting. */
  removedAt?: number | null;
  removedBy?: string | null;
  removalReason?: string | null;
};

export const penaltiesStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

/** Entries older than this stop counting towards the active score. */
export const ACTIVE_WINDOW_MONTHS = 12;

function isSeverity(v: unknown): v is PenaltySeverity {
  return v === 1 || v === 2 || v === 3;
}

function normalise(raw: unknown): Penalty | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.employeeId !== "string") return null;
  if (!isSeverity(o.severity)) return null;
  return {
    id: o.id,
    employeeId: o.employeeId,
    employeeName:
      typeof o.employeeName === "string" ? o.employeeName : o.employeeId,
    departments: Array.isArray(o.departments)
      ? o.departments.filter((d): d is string => typeof d === "string")
      : [],
    severity: o.severity,
    title: typeof o.title === "string" ? o.title : "",
    description: typeof o.description === "string" ? o.description : "",
    occurredOn:
      typeof o.occurredOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.occurredOn)
        ? o.occurredOn
        : new Date(
            typeof o.createdAt === "number" ? o.createdAt : 0,
          )
            .toISOString()
            .slice(0, 10),
    createdAt: typeof o.createdAt === "number" ? o.createdAt : 0,
    createdBy: typeof o.createdBy === "string" ? o.createdBy : "—",
    removedAt: typeof o.removedAt === "number" ? o.removedAt : null,
    removedBy: typeof o.removedBy === "string" ? o.removedBy : null,
    removalReason:
      typeof o.removalReason === "string" ? o.removalReason : null,
  };
}

export async function listPenalties(): Promise<Penalty[]> {
  if (!penaltiesStorageConfigured) return [];
  try {
    const stored = await kv.get<unknown[]>(KEY);
    if (!Array.isArray(stored)) return [];
    return stored
      .map(normalise)
      .filter((p): p is Penalty => p !== null)
      // Newest incident first.
      .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt - a.createdAt);
  } catch (err) {
    console.error("KV penalties read failed:", err);
    return [];
  }
}

export async function addPenalty(input: {
  employeeId: string;
  employeeName: string;
  departments: string[];
  severity: PenaltySeverity;
  title: string;
  description: string;
  occurredOn: string;
  createdBy: string;
  nowMs: number;
}): Promise<Penalty> {
  if (!penaltiesStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const entry: Penalty = {
    id: crypto.randomUUID(),
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    departments: input.departments,
    severity: input.severity,
    title: input.title.slice(0, 160),
    description: input.description.slice(0, 4000),
    occurredOn: input.occurredOn,
    createdAt: input.nowMs,
    createdBy: input.createdBy,
    removedAt: null,
    removedBy: null,
    removalReason: null,
  };
  const all = await listPenalties();
  await kv.set(KEY, [entry, ...all].slice(0, MAX));
  return entry;
}

/** Soft-remove. The entry stays in history for auditability — it just stops
 *  counting and renders struck through. */
export async function removePenalty(
  id: string,
  by: string,
  reason: string,
  nowMs: number,
): Promise<boolean> {
  if (!penaltiesStorageConfigured) return false;
  const all = await listPenalties();
  const found = all.find((p) => p.id === id);
  if (!found || found.removedAt) return false;
  await kv.set(
    KEY,
    all.map((p) =>
      p.id === id
        ? {
            ...p,
            removedAt: nowMs,
            removedBy: by,
            removalReason: reason.slice(0, 500) || null,
          }
        : p,
    ),
  );
  return true;
}

/** Restore a soft-removed entry (an accidental removal shouldn't need a
 *  re-type of the whole record). */
export async function restorePenalty(id: string): Promise<boolean> {
  if (!penaltiesStorageConfigured) return false;
  const all = await listPenalties();
  const found = all.find((p) => p.id === id);
  if (!found || !found.removedAt) return false;
  await kv.set(
    KEY,
    all.map((p) =>
      p.id === id
        ? { ...p, removedAt: null, removedBy: null, removalReason: null }
        : p,
    ),
  );
  return true;
}

/** True while an entry still counts: not removed, and inside the active
 *  window. */
export function isActive(p: Penalty, now: Date = new Date()): boolean {
  if (p.removedAt) return false;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - ACTIVE_WINDOW_MONTHS);
  return p.occurredOn >= cutoff.toISOString().slice(0, 10);
}

export type RiskLevel = "clean" | "watch" | "concern" | "critical";

export const RISK_LABEL: Record<RiskLevel, string> = {
  clean: "Sem ocorrências",
  watch: "Atenção",
  concern: "Preocupante",
  critical: "Crítico",
};

/** Weighted score → risk band. Severity doubles as its own weight, so one
 *  grave (3) lands in "concern" on its own while three leves (1+1+1) take
 *  the same three points to get there. */
export function riskOf(score: number): RiskLevel {
  if (score <= 0) return "clean";
  if (score <= 2) return "watch";
  if (score <= 5) return "concern";
  return "critical";
}

export type EmployeePenaltySummary = {
  employeeId: string;
  employeeName: string;
  departments: string[];
  /** Weighted sum of ACTIVE entries (last 12 months, not removed). */
  activeScore: number;
  activeCount: number;
  bySeverity: Record<PenaltySeverity, number>;
  /** Every entry ever, newest first — including removed + expired. */
  history: Penalty[];
  lastOccurredOn: string | null;
  risk: RiskLevel;
};

/** Group penalties per employee. `roster` seeds the list so someone with a
 *  clean sheet still appears — the point is to see everyone, not only the
 *  people with a record. */
export function summarise(
  penalties: Penalty[],
  roster: { id: string; name: string; departments: string[] }[],
  now: Date = new Date(),
): EmployeePenaltySummary[] {
  const byEmployee = new Map<string, EmployeePenaltySummary>();

  const blank = (
    id: string,
    name: string,
    departments: string[],
  ): EmployeePenaltySummary => ({
    employeeId: id,
    employeeName: name,
    departments,
    activeScore: 0,
    activeCount: 0,
    bySeverity: { 1: 0, 2: 0, 3: 0 },
    history: [],
    lastOccurredOn: null,
    risk: "clean",
  });

  for (const e of roster) {
    byEmployee.set(e.id, blank(e.id, e.name, e.departments));
  }

  for (const p of penalties) {
    let row = byEmployee.get(p.employeeId);
    if (!row) {
      // Logged against someone no longer on the roster — keep them visible
      // rather than dropping their record on the floor.
      row = blank(p.employeeId, p.employeeName, p.departments);
      byEmployee.set(p.employeeId, row);
    }
    row.history.push(p);
    if (!row.lastOccurredOn || p.occurredOn > row.lastOccurredOn) {
      row.lastOccurredOn = p.occurredOn;
    }
    if (isActive(p, now)) {
      row.activeScore += p.severity;
      row.activeCount += 1;
      row.bySeverity[p.severity] += 1;
    }
  }

  for (const row of byEmployee.values()) {
    row.risk = riskOf(row.activeScore);
  }

  return [...byEmployee.values()].sort(
    (a, b) =>
      b.activeScore - a.activeScore ||
      a.employeeName.localeCompare(b.employeeName),
  );
}
