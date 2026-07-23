"use client";

// Employees panel — mirrors AdminPanel for clients but renders the
// team roster, exposes an inline "+ Add employee" form, and rolls up
// payroll in EUR at the top. Each row also shows an Active portfolio
// column — total monthly value the employee currently consults on +
// active-client count, computed server-side from the projects roster.

import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Loader2,
  ArrowLeft,
  UserPlus,
  Plus,
  X,
  Mail,
  Briefcase,
  CalendarDays,
  Euro,
  Building2,
  BadgeCheck,
  StickyNote,
} from "lucide-react";
import Link from "next/link";
import {
  AdminEmployeeRow,
  DEPT_PILL,
  STATUS_PILL,
  STATUS_LABEL,
  type EmployeePortfolio,
} from "./admin-employee-row";
import { formatMoney } from "@/lib/admin-clients-store";
import {
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_STATUSES,
  type AdminEmployeeRecord,
  type EmployeeStatus,
} from "@/lib/admin-employees-store";

/** Derive a work-email handle from the first name (accent-stripped),
 *  mirroring the seed roster's `${handle}@wonder-ads.com` convention so
 *  the email pre-fills the moment you type a name. */
function suggestEmail(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const handle = first
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "");
  return handle ? `${handle}@wonder-ads.com` : "";
}

export function AdminEmployeesPanel({
  employees,
  portfolios,
}: {
  employees: AdminEmployeeRecord[];
  /** Keyed by employee name (matches admin client `consultants[]`). */
  portfolios: Record<string, EmployeePortfolio>;
}) {
  const [records, setRecords] = useState<Map<string, AdminEmployeeRecord>>(
    () => {
      const m = new Map<string, AdminEmployeeRecord>();
      for (const e of employees) m.set(e.id, e);
      return m;
    },
  );
  const [order, setOrder] = useState<string[]>(() => employees.map((e) => e.id));

  // Inline add-employee form — captures the full record up front so a new
  // hire lands ready-to-go instead of a bare stub you edit later.
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  // Once the email is hand-edited we stop auto-filling it from the name.
  const [emailTouched, setEmailTouched] = useState(false);
  const [addRole, setAddRole] = useState("");
  const [addDepartments, setAddDepartments] = useState<string[]>([]);
  const [addStartingDate, setAddStartingDate] = useState("");
  const [addSalary, setAddSalary] = useState("");
  const [addStatus, setAddStatus] = useState<EmployeeStatus>("onboarding");
  const [addNotes, setAddNotes] = useState("");
  const [addState, setAddState] = useState<"idle" | "saving" | "error">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  const resetAddForm = useCallback(() => {
    setAddName("");
    setAddEmail("");
    setEmailTouched(false);
    setAddRole("");
    setAddDepartments([]);
    setAddStartingDate("");
    setAddSalary("");
    setAddStatus("onboarding");
    setAddNotes("");
    setAddError(null);
    setAddState("idle");
  }, []);

  const toggleAddDept = useCallback((dept: string) => {
    setAddDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept],
    );
  }, []);

  const handleSaved = useCallback((record: AdminEmployeeRecord) => {
    setRecords((prev) => {
      const next = new Map(prev);
      next.set(record.id, record);
      return next;
    });
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setRecords((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setOrder((prev) => prev.filter((x) => x !== id));
  }, []);

  async function submitAdd(e: FormEvent) {
    e.preventDefault();
    setAddState("saving");
    setAddError(null);
    const salaryTrimmed = addSalary.trim();
    try {
      const res = await fetch(`/api/admin/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName,
          email: addEmail,
          role: addRole,
          departments: addDepartments,
          startingDate: addStartingDate || null,
          monthlyValue: salaryTrimmed === "" ? null : Number(salaryTrimmed),
          status: addStatus,
          notes: addNotes,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { record: AdminEmployeeRecord };
      setRecords((prev) => {
        const next = new Map(prev);
        next.set(json.record.id, json.record);
        return next;
      });
      setOrder((prev) => [...prev, json.record.id]);
      resetAddForm();
      setShowAdd(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
      setAddState("error");
    }
  }

  const closeAddForm = useCallback(() => {
    resetAddForm();
    setShowAdd(false);
  }, [resetAddForm]);

  const totalEmployees = order.length;

  const payEur = useMemo(() => {
    let total = 0;
    for (const id of order) {
      const r = records.get(id);
      if (r && r.status === "active" && r.monthlyValue) {
        total += r.monthlyValue;
      }
    }
    return total;
  }, [records, order]);

  // Total EUR currently under consultation across the whole team.
  const portfolioEur = useMemo(() => {
    let total = 0;
    for (const id of order) {
      const r = records.get(id);
      if (!r) continue;
      const p = portfolios[r.name];
      if (p) total += p.totalEur;
    }
    return total;
  }, [records, order, portfolios]);

  return (
    <div className="animate-fade-up mt-2">
      <Link
        href="/admin"
        className="group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Admin
      </Link>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Team Roster</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45">
            Everyone on the payroll — edit independently per row.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (showAdd ? closeAddForm() : setShowAdd(true))}
            className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_8px_28px_-6px_rgba(120,61,245,0.55)] transition hover:opacity-90"
          >
            {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAdd ? "Cancel" : "Add employee"}
          </button>
        </div>
      </header>

      {/* Add-employee inline form (toggled) — the full record captured in
          one pass: identity, department, start date, salary, status, notes. */}
      {showAdd && (
        <form
          onSubmit={submitAdd}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeAddForm();
          }}
          className="animate-fade-up brand-gradient-border mt-6 rounded-2xl bg-white/[0.03] p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
              <span className="brand-gradient-bg inline-flex h-6 w-6 items-center justify-center rounded-md text-white">
                <UserPlus className="h-3.5 w-3.5" />
              </span>
              New employee
            </div>
            <span className="text-[10.5px] text-white/35">
              Everything here is editable later in the row.
            </span>
          </div>

          {/* Identity */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Full name" icon={UserPlus} required>
              <input
                type="text"
                value={addName}
                onChange={(e) => {
                  const v = e.target.value;
                  setAddName(v);
                  // Keep the email in lock-step with the name until it's
                  // been hand-edited.
                  if (!emailTouched) setAddEmail(suggestEmail(v));
                }}
                placeholder="e.g. Maria Lopes"
                required
                autoFocus
                className="w-full rounded-md border border-white/12 bg-white/[0.05] px-3 py-2 text-[12.5px] text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
              />
            </FormField>
            <FormField label="Work email" icon={Mail} required>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => {
                  setEmailTouched(true);
                  setAddEmail(e.target.value);
                }}
                placeholder="email@wonder-ads.com"
                required
                className="w-full rounded-md border border-white/12 bg-white/[0.05] px-3 py-2 text-[12.5px] text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
              />
            </FormField>
          </div>

          {/* Role · start · salary */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Role / title" icon={Briefcase}>
              <input
                type="text"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value)}
                placeholder="e.g. SEO Consultant"
                className="w-full rounded-md border border-white/12 bg-white/[0.05] px-3 py-2 text-[12.5px] text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
              />
            </FormField>
            <FormField label="Starting date" icon={CalendarDays}>
              <input
                type="date"
                value={addStartingDate}
                onChange={(e) => setAddStartingDate(e.target.value)}
                className="w-full rounded-md border border-white/12 bg-white/[0.05] px-3 py-2 text-[12.5px] text-white outline-none transition [color-scheme:dark] focus:border-white/30"
              />
            </FormField>
            <FormField label="Monthly salary" icon={Euro}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px] text-white/45">
                  €
                </span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  inputMode="decimal"
                  value={addSalary}
                  onChange={(e) => setAddSalary(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-md border border-white/12 bg-white/[0.05] py-2 pl-7 pr-11 text-[12.5px] text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10.5px] text-white/35">
                  /mo
                </span>
              </div>
            </FormField>
          </div>

          {/* Departments */}
          <div className="mt-4">
            <FieldLabel label="Departments" icon={Building2} />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EMPLOYEE_DEPARTMENTS.map((d) => {
                const on = addDepartments.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleAddDept(d)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${
                      on
                        ? DEPT_PILL[d] ??
                          "border-white/30 bg-white/10 text-white"
                        : "border-white/12 bg-white/[0.03] text-white/45 hover:border-white/25 hover:text-white/80"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div className="mt-4">
            <FieldLabel label="Status" icon={BadgeCheck} />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EMPLOYEE_STATUSES.map((s) => {
                const on = addStatus === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setAddStatus(s)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${
                      on
                        ? STATUS_PILL[s]
                        : "border-white/12 bg-white/[0.03] text-white/45 hover:border-white/25 hover:text-white/80"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <FieldLabel label="Notes" icon={StickyNote} />
            <textarea
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              rows={2}
              placeholder="Contract quirks, probation end, leave dates… (optional)"
              className="mt-1.5 w-full rounded-md border border-white/12 bg-white/[0.05] px-3 py-2 text-[12.5px] text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
            />
          </div>

          {addError && (
            <p className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {addError}
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-2 border-t border-white/8 pt-4">
            <button
              type="button"
              onClick={closeAddForm}
              className="rounded-md border border-white/12 bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addState === "saving" || !addName.trim() || !addEmail.trim()}
              className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_8px_28px_-6px_rgba(120,61,245,0.55)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addState === "saving" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add employee
            </button>
          </div>
        </form>
      )}

      {/* Roll-up tiles — EUR only. */}
      <section
        aria-label="Roll-up"
        className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <RollupTile label="Employees" value={String(totalEmployees)} />
        <RollupTile
          label="Payroll"
          value={payEur > 0 ? formatMoney(payEur, "EUR") : "—"}
          tone={payEur > 0 ? "emerald" : "neutral"}
        />
        <RollupTile
          label="Active portfolio"
          value={
            portfolioEur > 0 ? formatMoney(portfolioEur, "EUR") : "—"
          }
          tone={portfolioEur > 0 ? "emerald" : "neutral"}
        />
      </section>

      <section aria-label="Employees" className="mt-10">
        <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.02]">
          <table className="w-full min-w-[1300px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/8 bg-black/30 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                <th className="px-4 py-2.5">Employee</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5">Departments</th>
                <th className="px-3 py-2.5">Starting date</th>
                <th className="px-3 py-2.5">Monthly salary</th>
                <th className="px-3 py-2.5">Active portfolio</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Notes</th>
                <th className="px-3 py-2.5">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {order.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-[12px] text-white/40"
                  >
                    No employees yet. Click <strong>Add employee</strong> to get started.
                  </td>
                </tr>
              ) : (
                order.map((id) => {
                  const r = records.get(id);
                  if (!r) return null;
                  const portfolio: EmployeePortfolio =
                    portfolios[r.name] ?? {
                      activeClients: 0,
                      totalEur: 0,
                      breakdown: [],
                    };
                  return (
                    <AdminEmployeeRow
                      key={id}
                      initial={r}
                      portfolio={portfolio}
                      onSaved={handleSaved}
                      onDeleted={handleDeleted}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Small icon + uppercase caption used above every add-form control. */
function FieldLabel({
  label,
  icon: Icon,
  required,
}: {
  label: string;
  icon: typeof UserPlus;
  required?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
      <Icon className="h-3 w-3" />
      {label}
      {required && <span className="text-[color:var(--brand-purple)]">*</span>}
    </span>
  );
}

/** Label + control wrapper so every field lines up on the same grid. */
function FormField({
  label,
  icon,
  required,
  children,
}: {
  label: string;
  icon: typeof UserPlus;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <FieldLabel label={label} icon={icon} required={required} />
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function RollupTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "emerald";
}) {
  const isEmerald = tone === "emerald";
  return (
    <div
      className={`rounded-xl border px-4 py-3 transition ${
        isEmerald
          ? "border-emerald-400/35 bg-emerald-500/[0.06]"
          : "border-white/8 bg-white/[0.025]"
      }`}
    >
      <div
        className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
          isEmerald ? "text-emerald-300/80" : "text-white/45"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-semibold tracking-tight ${
          isEmerald
            ? "text-emerald-200 drop-shadow-[0_0_18px_rgba(52,211,153,0.35)]"
            : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
