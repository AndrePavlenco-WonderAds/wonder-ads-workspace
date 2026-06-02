"use client";

// SuperAdmin Control Suite — single flat table of every client across
// every department. The panel owns a `records` Map keyed by slug so
// the rollup tiles recompute the instant any row saves — no refresh
// required. Each row receives the current record + an onSaved callback
// it fires after the API returns a 200.

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, LogOut, Loader2 } from "lucide-react";
import { AdminClientRow } from "./admin-client-row";
import type {
  AdminClientRecord,
  ClientDepartment,
} from "@/lib/admin-clients-store";
import {
  adminRecordKey,
  cadenceMonths,
  formatMoney,
  nextBillingDate,
} from "@/lib/admin-clients-store";
import type { LogoBgMode, LogoSizing } from "@/lib/client-meta";

export type AdminClientView = {
  slug: string;
  title: string;
  icon: string | null;
  /** Real brand-logo bundle so each row can render via LogoChip
   *  the same way the SEO DPT cards do. */
  logo: string | null;
  logoBgMode: LogoBgMode;
  logoSizing: LogoSizing;
  gradient: string;
  /** Which department THIS row represents. */
  department: ClientDepartment;
  /** All departments the client appears in (drives the cross-dept
   *  badge on each row + the legacy-record migration hint sent to
   *  the API). */
  clientDepartments: ClientDepartment[];
  record: AdminClientRecord;
};

type SortColumn =
  | "client"
  | "cadence"
  | "starting"
  | "next"
  | "consultants"
  | "value"
  | "status";

type SortState = { col: SortColumn; dir: "asc" | "desc" } | null;

export function AdminPanel({ clients }: { clients: AdminClientView[] }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // Per-(slug, dept) record state — seeded from server props, updated
  // every time a row's Save returns. Drives both the rollup tiles AND
  // the row's live initial value so the UI stays in sync without
  // router.refresh().
  const [records, setRecords] = useState<Map<string, AdminClientRecord>>(
    () => {
      const m = new Map<string, AdminClientRecord>();
      for (const c of clients) {
        m.set(adminRecordKey(c.slug, c.department), c.record);
      }
      return m;
    },
  );

  const handleSaved = useCallback((record: AdminClientRecord) => {
    setRecords((prev) => {
      const next = new Map(prev);
      next.set(adminRecordKey(record.slug, record.department), record);
      return next;
    });
  }, []);

  // Sortable column state. Clicking the same column cycles asc → desc →
  // off (default order from the server). Null = the default order.
  const [sort, setSort] = useState<SortState>(null);
  function cycleSort(col: SortColumn) {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  }

  const totalClients = useMemo(
    () => new Set(clients.map((c) => c.slug)).size,
    [clients],
  );

  // Active MRR — EUR only. Each per-dept row contributes its own
  // monthlyValue independently, so shared SEO + ADS clients sum to
  // their true total without double-counting.
  const mrrEur = useMemo(() => {
    let total = 0;
    for (const c of clients) {
      const r = records.get(adminRecordKey(c.slug, c.department));
      if (
        r &&
        r.status === "active" &&
        r.currency === "EUR" &&
        r.monthlyValue
      ) {
        total += r.monthlyValue;
      }
    }
    return total;
  }, [clients, records]);

  // Apply the active sort against the live `records` map so changes
  // saved on one row immediately re-rank the table.
  const sortedClients = useMemo(() => {
    if (!sort) return clients;
    const { col, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    function value(c: AdminClientView): string | number {
      const r = records.get(adminRecordKey(c.slug, c.department)) ?? c.record;
      switch (col) {
        case "client":
          return c.title.toLowerCase();
        case "cadence":
          return cadenceMonths(r.billingCadence);
        case "starting":
          return r.startingDate ?? "9999-99-99";
        case "next": {
          const nb = nextBillingDate(r.startingDate, r.billingCadence);
          return nb ? nb.getTime() : Number.POSITIVE_INFINITY;
        }
        case "consultants":
          // Sort by consultant count, ties broken by first consultant
          // name so the order is stable.
          return `${String(r.consultants.length).padStart(3, "0")}|${
            (r.consultants[0] ?? "").toLowerCase()
          }`;
        case "value":
          return r.monthlyValue ?? Number.POSITIVE_INFINITY;
        case "status":
          return r.status;
      }
    }
    return [...clients].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }, [clients, records, sort]);

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Projects</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45">
            Every client across every department — edit independently per row.
          </p>
        </div>
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
      </header>

      {/* Roll-up tiles. MRR tile glows emerald when populated so a
          glance at the header tells you the agency's healthy. EUR-only —
          the agency bills in euros. */}
      <section
        aria-label="Roll-up"
        className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <RollupTile label="Clients" value={String(totalClients)} />
        <RollupTile
          label="MRR"
          value={mrrEur > 0 ? formatMoney(mrrEur, "EUR") : "—"}
          tone={mrrEur > 0 ? "emerald" : "neutral"}
        />
      </section>

      {/* Single flat client table */}
      <section aria-label="Clients" className="mt-10">
        <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.02]">
          <table className="w-full min-w-[1200px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/8 bg-black/30 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                <SortableTh
                  label="Client"
                  col="client"
                  sort={sort}
                  onClick={cycleSort}
                  className="px-4"
                />
                <SortableTh
                  label="Billing cadence"
                  col="cadence"
                  sort={sort}
                  onClick={cycleSort}
                />
                <SortableTh
                  label="Starting date"
                  col="starting"
                  sort={sort}
                  onClick={cycleSort}
                />
                <SortableTh
                  label="Next billing"
                  col="next"
                  sort={sort}
                  onClick={cycleSort}
                />
                <SortableTh
                  label="Consultants"
                  col="consultants"
                  sort={sort}
                  onClick={cycleSort}
                />
                <SortableTh
                  label="Monthly value"
                  col="value"
                  sort={sort}
                  onClick={cycleSort}
                />
                <SortableTh
                  label="Status"
                  col="status"
                  sort={sort}
                  onClick={cycleSort}
                />
                <th className="px-3 py-2.5">Notes</th>
                <th className="px-3 py-2.5">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-[12px] text-white/40"
                  >
                    No clients yet.
                  </td>
                </tr>
              ) : (
                sortedClients.map((c) => {
                  const key = adminRecordKey(c.slug, c.department);
                  const live = records.get(key) ?? c.record;
                  return (
                    <AdminClientRow
                      key={key}
                      slug={c.slug}
                      title={c.title}
                      icon={c.icon}
                      logo={c.logo}
                      logoBgMode={c.logoBgMode}
                      logoSizing={c.logoSizing}
                      gradient={c.gradient}
                      department={c.department}
                      clientDepartments={c.clientDepartments}
                      initial={live}
                      onSaved={handleSaved}
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

function SortableTh({
  label,
  col,
  sort,
  onClick,
  className = "px-3",
}: {
  label: string;
  col: SortColumn;
  sort: SortState;
  onClick: (c: SortColumn) => void;
  className?: string;
}) {
  const isActive = sort?.col === col;
  const dir = isActive ? sort?.dir : null;
  const ariaSort =
    dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none";
  return (
    <th
      className={`${className} py-2.5`}
      aria-sort={ariaSort as "ascending" | "descending" | "none"}
    >
      <button
        type="button"
        onClick={() => onClick(col)}
        className={`inline-flex items-center gap-1.5 rounded text-left text-[10px] font-bold uppercase tracking-[0.16em] transition ${
          isActive
            ? "text-emerald-200"
            : "text-white/50 hover:text-white"
        }`}
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        {dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : dir === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
        )}
      </button>
    </th>
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
