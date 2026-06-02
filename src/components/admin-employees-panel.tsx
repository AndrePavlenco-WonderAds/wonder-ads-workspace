"use client";

// Employees panel — mirrors AdminPanel for clients but renders the
// team roster, exposes an inline "+ Add employee" form, and rolls up
// payroll in EUR at the top. Each row also shows an Active portfolio
// column — total monthly value the employee currently consults on +
// active-client count, computed server-side from the projects roster.

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Loader2,
  ArrowLeft,
  UserPlus,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { AdminEmployeeRow, type EmployeePortfolio } from "./admin-employee-row";
import { formatMoney } from "@/lib/admin-clients-store";
import type { AdminEmployeeRecord } from "@/lib/admin-employees-store";

export function AdminEmployeesPanel({
  employees,
  portfolios,
}: {
  employees: AdminEmployeeRecord[];
  /** Keyed by employee name (matches admin client `consultants[]`). */
  portfolios: Record<string, EmployeePortfolio>;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [records, setRecords] = useState<Map<string, AdminEmployeeRecord>>(
    () => {
      const m = new Map<string, AdminEmployeeRecord>();
      for (const e of employees) m.set(e.id, e);
      return m;
    },
  );
  const [order, setOrder] = useState<string[]>(() => employees.map((e) => e.id));

  // Inline add-employee form
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("");
  const [addState, setAddState] = useState<"idle" | "saving" | "error">("idle");
  const [addError, setAddError] = useState<string | null>(null);

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
    try {
      const res = await fetch(`/api/admin/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName,
          email: addEmail,
          role: addRole,
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
      setAddName("");
      setAddEmail("");
      setAddRole("");
      setShowAdd(false);
      setAddState("idle");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
      setAddState("error");
    }
  }

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

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin-auth", { method: "DELETE" });
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

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
          <div className="flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
            <span className="brand-gradient-bg inline-flex h-1.5 w-1.5 rounded-full" />
            SuperAdmin · Employees
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Team Roster</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45">
            Everyone on the payroll — edit independently per row.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_8px_28px_-6px_rgba(120,61,245,0.55)] transition hover:opacity-90"
          >
            {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAdd ? "Cancel" : "Add employee"}
          </button>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-white/80 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          >
            {loggingOut ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            Log out
          </button>
        </div>
      </header>

      {/* Add-employee inline form (toggled) */}
      {showAdd && (
        <form
          onSubmit={submitAdd}
          className="mt-6 rounded-2xl border border-white/12 bg-white/[0.03] p-4"
        >
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
            <UserPlus className="h-3.5 w-3.5" />
            New employee
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Full name (e.g. Maria L.)"
              required
              className="rounded-md border border-white/12 bg-white/[0.05] px-3 py-2 text-[12.5px] text-white outline-none transition focus:border-white/30 placeholder:text-white/35"
            />
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="email@wonder-ads.com"
              required
              className="rounded-md border border-white/12 bg-white/[0.05] px-3 py-2 text-[12.5px] text-white outline-none transition focus:border-white/30 placeholder:text-white/35"
            />
            <input
              type="text"
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              placeholder="Role (e.g. SEO Consultant)"
              className="rounded-md border border-white/12 bg-white/[0.05] px-3 py-2 text-[12.5px] text-white outline-none transition focus:border-white/30 placeholder:text-white/35"
            />
          </div>
          {addError && (
            <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {addError}
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={addState === "saving" || !addName || !addEmail}
              className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
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
                  const portfolio =
                    portfolios[r.name] ?? {
                      activeClients: 0,
                      totalEur: 0,
                      sampleTitles: [],
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
