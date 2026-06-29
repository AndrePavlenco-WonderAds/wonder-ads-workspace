"use client";

// SuperAdmin Control Suite — single flat table of every client across
// every department. The panel owns a `records` Map keyed by slug so
// the rollup tiles recompute the instant any row saves — no refresh
// required. Each row receives the current record + an onSaved callback
// it fires after the API returns a 200.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileBarChart,
  Plus,
  Loader2,
  X,
} from "lucide-react";
import { AdminClientRow } from "./admin-client-row";
import { UpcomingActions, type UpcomingInvoice } from "./upcoming-actions";
import type {
  AdminClientRecord,
  ClientDepartment,
} from "@/lib/admin-clients-store";
import {
  adminRecordKey,
  cadenceMonths,
  formatMoney,
  CLIENT_DEPARTMENTS,
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
  /** True when this client was added manually from the admin table
   *  (lives in the extra-clients KV store, deletable from here). */
  isExtra?: boolean;
};

type SortColumn =
  | "client"
  | "cadence"
  | "starting"
  | "invoiceDate"
  | "invoiceType"
  | "value"
  | "iva";

type SortState = { col: SortColumn; dir: "asc" | "desc" } | null;

export function AdminPanel({
  clients,
  userName = "",
}: {
  clients: AdminClientView[];
  userName?: string;
}) {

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

  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  const deleteExtra = useCallback(
    async (slug: string) => {
      const res = await fetch(`/api/admin/extra-clients?slug=${slug}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    },
    [router],
  );

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

  // Obrigações Fiscais — total IVA owed across every row.
  const ivaTotal = useMemo(() => {
    let total = 0;
    for (const c of clients) {
      const r = records.get(adminRecordKey(c.slug, c.department));
      if (r && r.iva) total += r.iva;
    }
    return total;
  }, [clients, records]);

  // Invoices with a set invoice date — feed the Próx. 7/30 dias blocks.
  const upcomingInvoices = useMemo<UpcomingInvoice[]>(() => {
    const out: UpcomingInvoice[] = [];
    for (const c of clients) {
      const r = records.get(adminRecordKey(c.slug, c.department));
      if (r?.invoiceDate) {
        out.push({
          id: `${c.slug}-${c.department}`,
          title: c.title,
          department: c.department,
          date: r.invoiceDate,
        });
      }
    }
    return out;
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
        case "invoiceDate":
          return r.invoiceDate ?? "9999-99-99";
        case "invoiceType":
          return r.invoiceType;
        case "value":
          return r.monthlyValue ?? Number.POSITIVE_INFINITY;
        case "iva":
          return r.iva ?? Number.POSITIVE_INFINITY;
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

  return (
    <div className="animate-fade-up mt-2">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <Typewriter
              text={
                userName ? `How is business, ${userName}?` : "How is business?"
              }
            />
          </h1>
          <p className="mt-1.5 text-[12px] text-white/45">
            Every client across every department — edit independently per row.
            {/* v74.23: workspace logout lives on the header UserChip — no
                per-page button anymore. */}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/12 px-3.5 py-2 text-[12.5px] font-semibold text-emerald-200 transition hover:border-emerald-400/70 hover:bg-emerald-500/20 hover:text-white"
          >
            <Plus className="h-4 w-4" />
            Add client
          </button>
          <Link
            href="/admin/report"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/12 px-3.5 py-2 text-[12.5px] font-semibold text-emerald-200 transition hover:border-emerald-400/70 hover:bg-emerald-500/20 hover:text-white"
          >
            <FileBarChart className="h-4 w-4" />
            Gerar Monthly Report
          </Link>
          {/* v74.60: "Overview Calendário" moved to the new Finances block
              (/admin/finances). */}
        </div>
      </header>

      {/* Roll-up tiles. MRR tile glows emerald when populated so a
          glance at the header tells you the agency's healthy. EUR-only —
          the agency bills in euros. */}
      <section
        aria-label="Roll-up"
        className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <RollupTile label="Clients" value={String(totalClients)} />
        <RollupTile
          label="MRR"
          value={mrrEur > 0 ? formatMoney(mrrEur, "EUR") : "—"}
          tone={mrrEur > 0 ? "emerald" : "neutral"}
        />
        <RollupTile
          label="Obrigações Fiscais"
          value={ivaTotal > 0 ? formatMoney(ivaTotal, "EUR") : "—"}
          tone="rose"
        />
      </section>

      {/* Next actions — invoices + events landing in the next 7 / 30 days */}
      <UpcomingActions invoices={upcomingInvoices} />

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
                  label="Invoice date"
                  col="invoiceDate"
                  sort={sort}
                  onClick={cycleSort}
                />
                <SortableTh
                  label="Invoice type"
                  col="invoiceType"
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
                  label="IVA"
                  col="iva"
                  sort={sort}
                  onClick={cycleSort}
                />
                <th className="px-3 py-2.5">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
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
                      isExtra={c.isExtra}
                      onDelete={c.isExtra ? deleteExtra : undefined}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {addOpen && (
        <AddClientForm
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AddClientForm({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [website, setWebsite] = useState("");
  const [depts, setDepts] = useState<ClientDepartment[]>(["SEO"]);
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  function toggleDept(d: ClientDepartment) {
    setDepts((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  async function submit() {
    if (!title.trim()) {
      setError("Dá um nome ao cliente.");
      return;
    }
    if (depts.length === 0) {
      setError("Escolhe pelo menos um departamento.");
      return;
    }
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/admin/extra-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, departments: depts, website }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falhou");
      setState("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-2xl shadow-black/70">
        <header className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-white">
            Adicionar cliente
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-3.5 px-5 py-5">
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
              Nome do cliente
            </span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Ex.: Kings Gyms"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none transition focus:border-white/30 placeholder:text-white/30"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
              Departamento(s)
            </span>
            <div className="flex flex-wrap gap-2">
              {CLIENT_DEPARTMENTS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDept(d)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
                    depts.includes(d)
                      ? "border-[#783DF5]/55 bg-[#783DF5]/15 text-white"
                      : "border-white/10 bg-white/[0.02] text-white/55 hover:text-white/80"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
              Website (opcional)
            </span>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none transition focus:border-white/30 placeholder:text-white/30"
            />
          </label>
          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11.5px] text-rose-300">
              {error}
            </p>
          )}
          <p className="text-[11px] text-white/40">
            O cliente aparece como nova linha (uma por departamento) com os
            campos a vazio, prontos a preencher.
          </p>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-white/8 bg-black/30 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/12 px-3 py-2 text-[12px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={state === "saving"}
            className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold text-white shadow-[0_6px_22px_-4px_rgba(120,61,245,0.55)] transition hover:opacity-90 disabled:opacity-50"
          >
            {state === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Adicionar
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Types `text` out character-by-character on every mount (so it
 *  re-runs each time the page opens), with a blinking caret. The full
 *  text is rendered transparently underneath to reserve layout space
 *  and avoid reflow as it types. */
function Typewriter({ text }: { text: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) window.clearInterval(id);
    }, 55);
    return () => window.clearInterval(id);
  }, [text]);
  const typing = count < text.length;
  return (
    <span className="relative inline-block">
      {/* Invisible spacer reserves the final width/height */}
      <span aria-hidden className="invisible">
        {text}
      </span>
      <span className="absolute inset-0">
        <span className="brand-gradient-text">{text.slice(0, count)}</span>
        <span
          aria-hidden
          className={`ml-0.5 inline-block w-[2px] -translate-y-[2px] self-stretch bg-[#a98bff] align-middle ${
            typing ? "opacity-100" : "animate-pulse"
          }`}
          style={{ height: "0.9em" }}
        />
      </span>
    </span>
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
  tone?: "neutral" | "emerald" | "rose";
}) {
  const border =
    tone === "emerald"
      ? "border-emerald-400/35 bg-emerald-500/[0.06]"
      : tone === "rose"
        ? "border-rose-400/40 bg-rose-500/[0.07]"
        : "border-white/8 bg-white/[0.025]";
  const labelColor =
    tone === "emerald"
      ? "text-emerald-300/80"
      : tone === "rose"
        ? "text-rose-300/85"
        : "text-white/45";
  const valueColor =
    tone === "emerald"
      ? "text-emerald-200 drop-shadow-[0_0_18px_rgba(52,211,153,0.35)]"
      : tone === "rose"
        ? "text-rose-200 drop-shadow-[0_0_18px_rgba(244,63,94,0.35)]"
        : "text-white";
  return (
    <div className={`rounded-xl border px-4 py-3 transition ${border}`}>
      <div
        className={`text-[10px] font-bold uppercase tracking-[0.18em] ${labelColor}`}
      >
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold tracking-tight ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}
