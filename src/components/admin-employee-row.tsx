"use client";

// Editable row inside the Employees table — simplified for v74.14.
// Removed: payment cadence + next pay (everyone gets paid monthly,
// the column was noise) and the € / $ currency selector (agency
// pays in euros only). Added: Active portfolio column showing how
// many active clients each employee manages + total monthly value.

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Save,
  Check,
  X,
  Building2,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { formatMoney } from "@/lib/admin-clients-store";
import {
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_STATUSES,
  SEED_EMPLOYEES,
  type AdminEmployeeRecord,
  type EmployeeStatus,
} from "@/lib/admin-employees-store";
import { formatDate } from "@/lib/dates";

export type EmployeePortfolio = {
  activeClients: number;
  totalEur: number;
  /** Per-client breakdown for the hover popover. Each entry includes
   *  the client title, monthly value (in EUR), and the list of
   *  departments the client is on so the popover can show context. */
  breakdown: Array<{
    slug: string;
    title: string;
    valueEur: number;
    departments: string[];
  }>;
};

type Props = {
  initial: AdminEmployeeRecord;
  portfolio: EmployeePortfolio;
  onSaved?: (record: AdminEmployeeRecord) => void;
  onDeleted?: (id: string) => void;
};

const STATUS_PILL: Record<EmployeeStatus, string> = {
  active: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
  onboarding: "border-sky-400/35 bg-sky-500/10 text-sky-200",
  "on-leave": "border-amber-400/35 bg-amber-500/10 text-amber-200",
  offboarded: "border-rose-400/35 bg-rose-500/10 text-rose-200",
};

const DEPT_PILL: Record<string, string> = {
  SEO: "border-[#783DF5]/40 bg-[#783DF5]/12 text-[#d4c4ff]",
  ADS: "border-[#C535C9]/40 bg-[#C535C9]/12 text-[#f4c5f1]",
  Web: "border-cyan-400/45 bg-cyan-500/12 text-cyan-200",
  Operations: "border-amber-400/35 bg-amber-500/10 text-amber-200",
  Founder: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
};

function arraysShallowEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: "Active",
  onboarding: "Onboarding",
  "on-leave": "On leave",
  offboarded: "Offboarded",
};

export function AdminEmployeeRow({
  initial,
  portfolio,
  onSaved,
  onDeleted,
}: Props) {
  const [draft, setDraft] = useState<AdminEmployeeRecord>(initial);
  const [saved, setSaved] = useState<AdminEmployeeRecord>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deptOpen, setDeptOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deptRef = useRef<HTMLDivElement | null>(null);

  const isSeed = SEED_EMPLOYEES.some((s) => s.id === draft.id);

  useEffect(() => {
    if (!deptOpen) return;
    function onDown(e: MouseEvent) {
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) {
        setDeptOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDeptOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [deptOpen]);

  const dirty =
    draft.name !== saved.name ||
    draft.email !== saved.email ||
    draft.role !== saved.role ||
    !arraysShallowEqual(draft.departments, saved.departments) ||
    draft.startingDate !== saved.startingDate ||
    draft.monthlyValue !== saved.monthlyValue ||
    draft.status !== saved.status ||
    draft.notes !== saved.notes;

  function toggleDept(name: string) {
    setDraft((d) => {
      const has = d.departments.includes(name);
      return {
        ...d,
        departments: has
          ? d.departments.filter((c) => c !== name)
          : [...d.departments, name],
      };
    });
  }

  async function save() {
    setState("saving");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/employees/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          role: draft.role,
          departments: draft.departments,
          startingDate: draft.startingDate,
          currency: "EUR",
          monthlyValue: draft.monthlyValue,
          status: draft.status,
          notes: draft.notes,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { record: AdminEmployeeRecord };
      setSaved(json.record);
      setDraft(json.record);
      setState("saved");
      onSaved?.(json.record);
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  function reset() {
    setDraft(saved);
    setState("idle");
    setErrorMsg(null);
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setState("saving");
    try {
      const res = await fetch(`/api/admin/employees/${draft.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      onDeleted?.(draft.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  const isEmpty = draft.monthlyValue === null;
  // Click-toggled popover for the Active portfolio cell. Closes on
  // outside-click + Escape, just like the consultants/departments
  // dropdowns above. Was hover-triggered in v74.15 — switched to
  // click so it's keyboard + mobile friendly and stays open while
  // the consultant reads the list.
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const portfolioRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!portfolioOpen) return;
    function onDown(e: MouseEvent) {
      if (
        portfolioRef.current &&
        !portfolioRef.current.contains(e.target as Node)
      ) {
        setPortfolioOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPortfolioOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [portfolioOpen]);
  const sortedBreakdown = (portfolio.breakdown ?? [])
    .slice()
    .sort((a, b) => b.valueEur - a.valueEur);
  const billedClients = sortedBreakdown.filter((c) => c.valueEur > 0).length;
  const unbilledClients = portfolio.activeClients - billedClients;

  return (
    <tr
      className="border-b border-white/5 align-top transition hover:bg-white/[0.015]"
      data-dirty={dirty ? "true" : "false"}
    >
      {/* Employee */}
      <td className="px-4 py-3.5">
        <div className="space-y-1.5">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Full name"
            className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[13px] font-semibold text-white outline-none transition focus:border-white/30 placeholder:text-white/35"
          />
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="email@wonder-ads.com"
            className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-white/75 outline-none transition focus:border-white/30 placeholder:text-white/35"
          />
        </div>
      </td>

      {/* Role */}
      <td className="px-3 py-3.5">
        <input
          type="text"
          value={draft.role}
          onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          placeholder="e.g. SEO Consultant"
          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[12px] text-white outline-none transition focus:border-white/30 placeholder:text-white/35"
        />
      </td>

      {/* Departments — multi-select */}
      <td className="px-3 py-3.5">
        <div ref={deptRef} className="relative">
          <button
            type="button"
            onClick={() => setDeptOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-left text-[12px] text-white outline-none transition hover:border-white/20 focus:border-white/30"
            aria-haspopup="listbox"
            aria-expanded={deptOpen}
          >
            <span className="flex flex-1 flex-wrap items-center gap-1">
              {draft.departments.length === 0 ? (
                <span className="text-white/35">—</span>
              ) : (
                draft.departments.map((d) => (
                  <span
                    key={d}
                    className={`rounded border px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.14em] ${
                      DEPT_PILL[d] ??
                      "border-white/15 bg-white/[0.05] text-white/85"
                    }`}
                  >
                    {d}
                  </span>
                ))
              )}
            </span>
            <ChevronDown
              className={`h-3 w-3 shrink-0 text-white/40 transition ${
                deptOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {deptOpen && (
            <div
              role="listbox"
              aria-multiselectable="true"
              className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border border-white/12 bg-[#0c0c12] py-1 shadow-2xl shadow-black/60"
            >
              <div className="border-b border-white/8 px-2.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/45">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  Assign departments
                </span>
              </div>
              {EMPLOYEE_DEPARTMENTS.map((name) => {
                const checked = draft.departments.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleDept(name)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-white/85 transition hover:bg-white/[0.04]"
                    role="option"
                    aria-selected={checked}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                        checked
                          ? "brand-gradient-bg border-transparent"
                          : "border-white/25 bg-transparent"
                      }`}
                    >
                      {checked && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </td>

      {/* Starting date */}
      <td className="px-3 py-3.5">
        <input
          type="date"
          value={draft.startingDate ?? ""}
          onChange={(e) =>
            setDraft({ ...draft, startingDate: e.target.value || null })
          }
          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[12px] text-white outline-none transition focus:border-white/30"
        />
        <div className="mt-1 text-[10.5px] text-white/40">
          {draft.startingDate
            ? `Joined ${formatDate(draft.startingDate)}`
            : "Not set"}
        </div>
      </td>

      {/* Monthly salary — EUR only, emphasized, rose when empty */}
      <td className="px-3 py-3.5">
        <div className="flex items-stretch gap-1">
          <div
            className={`flex shrink-0 items-center justify-center rounded-md border px-2.5 text-[13px] font-semibold ${
              isEmpty
                ? "border-rose-400/45 bg-rose-500/[0.08] text-rose-200"
                : "brand-gradient-bg border-transparent text-white"
            }`}
            aria-hidden
            title="Euros"
          >
            €
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={draft.monthlyValue ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft({
                ...draft,
                monthlyValue: raw === "" ? null : Number(raw),
                currency: "EUR",
              });
            }}
            placeholder="—"
            className={`w-full rounded-md border px-2.5 py-2 text-right text-[14px] font-semibold tabular-nums outline-none transition focus:border-white/40 ${
              isEmpty
                ? "border-rose-400/55 bg-rose-500/[0.08] text-rose-100 placeholder:text-rose-300/70 focus:border-rose-300 shadow-[0_0_0_1px_rgba(244,63,94,0.18)]"
                : "border-white/18 bg-white/[0.05] text-white placeholder:text-white/35"
            }`}
          />
        </div>
        <div
          className={`mt-1 text-right text-[10.5px] ${
            isEmpty ? "font-semibold text-rose-300" : "text-white/45"
          }`}
        >
          {isEmpty ? "Needs salary" : "/ mo · EUR"}
        </div>
      </td>

      {/* Active portfolio — who they're consulting for + their MRR.
          Hover reveals a popover with one row per client (title +
          monthly value + dept badges) sorted by value desc. */}
      <td className="px-3 py-3.5">
        {portfolio.activeClients === 0 ? (
          <div className="rounded-md border border-white/8 bg-white/[0.02] px-2 py-1.5 text-[11.5px] text-white/40">
            None active
          </div>
        ) : (
          <div ref={portfolioRef} className="relative">
            <button
              type="button"
              onClick={() => setPortfolioOpen((o) => !o)}
              className={`block w-full rounded-md border px-2 py-1.5 text-left transition ${
                portfolioOpen
                  ? "border-emerald-300/65 bg-emerald-500/[0.12]"
                  : "border-emerald-400/30 bg-emerald-500/[0.06] hover:border-emerald-300/55 hover:bg-emerald-500/[0.09]"
              }`}
              aria-haspopup="true"
              aria-expanded={portfolioOpen}
            >
              <div className="text-[13px] font-semibold tabular-nums text-emerald-200">
                {formatMoney(portfolio.totalEur, "EUR")}
              </div>
              <div className="mt-0.5 text-[10.5px] text-white/55">
                {portfolio.activeClients} active client
                {portfolio.activeClients === 1 ? "" : "s"} ·{" "}
                <span className="text-emerald-300/80">
                  {portfolioOpen ? "click to close" : "click for details"}
                </span>
              </div>
            </button>
            {portfolioOpen && sortedBreakdown.length > 0 && (
              <div
                role="dialog"
                aria-label="Active portfolio breakdown"
                className="animate-fade-up absolute left-0 top-full z-40 mt-1 w-[300px] rounded-lg border border-emerald-400/40 bg-[#0c0c12] shadow-2xl shadow-black/70"
              >
                <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300/85">
                    Active portfolio
                  </span>
                  <span className="text-[10.5px] font-semibold tabular-nums text-emerald-200">
                    {formatMoney(portfolio.totalEur, "EUR")}
                  </span>
                </div>
                <ul className="max-h-[260px] divide-y divide-white/5 overflow-y-auto py-1">
                  {sortedBreakdown.map((c) => (
                    <li
                      key={c.slug}
                      className="flex items-start justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium text-white/85">
                          {c.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {c.departments.map((d) => (
                            <span
                              key={d}
                              className={`rounded border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.14em] ${
                                DEPT_PILL[d] ??
                                "border-white/15 bg-white/[0.05] text-white/65"
                              }`}
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div
                        className={`shrink-0 text-right text-[12.5px] font-semibold tabular-nums ${
                          c.valueEur > 0 ? "text-emerald-200" : "text-white/35"
                        }`}
                      >
                        {c.valueEur > 0
                          ? formatMoney(c.valueEur, "EUR")
                          : "—"}
                      </div>
                    </li>
                  ))}
                </ul>
                {unbilledClients > 0 && (
                  <div className="border-t border-white/8 px-3 py-2 text-[10.5px] text-white/40">
                    {unbilledClients} client
                    {unbilledClients === 1 ? "" : "s"} active without a
                    set monthly value yet.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-3.5">
        <select
          value={draft.status}
          onChange={(e) =>
            setDraft({ ...draft, status: e.target.value as EmployeeStatus })
          }
          className={`w-full rounded-md border px-2 py-1.5 text-[12px] font-medium outline-none transition focus:border-white/30 ${STATUS_PILL[draft.status]}`}
        >
          {EMPLOYEE_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-[#111] text-white">
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </td>

      {/* Notes */}
      <td className="px-3 py-3.5">
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          rows={2}
          placeholder="Contract quirks, leave dates, etc."
          className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[12px] text-white outline-none transition focus:border-white/30 placeholder:text-white/35"
        />
      </td>

      {/* Save / state / delete */}
      <td className="px-3 py-3.5">
        <div className="flex flex-col items-stretch gap-1.5">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || state === "saving"}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
              state === "saved"
                ? "border border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
                : state === "error"
                  ? "border border-rose-400/45 bg-rose-500/15 text-rose-100"
                  : dirty
                    ? "brand-gradient-bg text-white shadow-[0_6px_22px_-4px_rgba(120,61,245,0.55)] hover:opacity-90"
                    : "cursor-not-allowed border border-white/8 bg-white/[0.02] text-white/30"
            }`}
          >
            {state === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
            {state === "saved" && <Check className="h-3 w-3" />}
            {state === "error" && <X className="h-3 w-3" />}
            {(state === "idle" || state === "saving") &&
              dirty &&
              state !== "saving" && <Save className="h-3 w-3" />}
            {state === "saving"
              ? "Saving"
              : state === "saved"
                ? "Saved"
                : state === "error"
                  ? "Failed"
                  : dirty
                    ? "Save"
                    : "Saved"}
          </button>
          {dirty && state !== "saving" && (
            <button
              type="button"
              onClick={reset}
              className="text-[10.5px] text-white/40 transition hover:text-white/70"
            >
              Discard changes
            </button>
          )}
          {state === "error" && errorMsg && (
            <span
              className="block max-w-[160px] truncate text-[10px] text-rose-300"
              title={errorMsg}
            >
              {errorMsg}
            </span>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={state === "saving"}
            className={`mt-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px] transition ${
              confirmDelete
                ? "border-rose-400/60 bg-rose-500/15 text-rose-100"
                : "border-white/8 bg-transparent text-white/40 hover:border-rose-400/40 hover:text-rose-200"
            }`}
            title={
              isSeed
                ? "Resets this seed employee to defaults"
                : "Remove this employee"
            }
          >
            <Trash2 className="h-3 w-3" />
            {confirmDelete ? "Confirm" : isSeed ? "Reset" : "Remove"}
          </button>
        </div>
      </td>
    </tr>
  );
}
