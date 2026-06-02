"use client";

// SuperAdmin Control Suite — single flat table of every client across
// every department. Rows carry per-department badges (SEO / ADS / both)
// so the list reads at a glance even without section grouping. Each
// row is independently editable; Save persists to KV via
// /api/admin/clients/[slug].

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { AdminClientRow } from "./admin-client-row";
import type { AdminClientRecord } from "@/lib/admin-clients-store";
import { formatMoney } from "@/lib/admin-clients-store";

export type AdminClientView = {
  slug: string;
  title: string;
  icon: string | null;
  departments: string[]; // ["SEO"], ["ADS"], ["SEO", "ADS"]
  record: AdminClientRecord;
};

export function AdminPanel({ clients }: { clients: AdminClientView[] }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const totalClients = clients.length;
  const activeClients = useMemo(
    () => clients.filter((c) => c.record.status === "active").length,
    [clients],
  );

  // Active MRR split by currency — dedupe by slug isn't needed here
  // because the page builds a single deduped clients list.
  const mrrEur = useMemo(
    () =>
      clients
        .filter(
          (c) =>
            c.record.status === "active" &&
            c.record.currency === "EUR" &&
            c.record.monthlyValue,
        )
        .reduce((sum, c) => sum + (c.record.monthlyValue ?? 0), 0),
    [clients],
  );
  const mrrUsd = useMemo(
    () =>
      clients
        .filter(
          (c) =>
            c.record.status === "active" &&
            c.record.currency === "USD" &&
            c.record.monthlyValue,
        )
        .reduce((sum, c) => sum + (c.record.monthlyValue ?? 0), 0),
    [clients],
  );

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
          <div className="flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
            <span className="brand-gradient-bg inline-flex h-1.5 w-1.5 rounded-full" />
            Wonder Ads
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">SuperAdmin Control Suite</span>
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

      {/* Roll-up tiles */}
      <section
        aria-label="Roll-up"
        className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <RollupTile label="Clients" value={String(totalClients)} />
        <RollupTile label="Active" value={String(activeClients)} />
        <RollupTile
          label="MRR €"
          value={mrrEur > 0 ? formatMoney(mrrEur, "EUR") : "—"}
        />
        <RollupTile
          label="MRR $"
          value={mrrUsd > 0 ? formatMoney(mrrUsd, "USD") : "—"}
        />
      </section>

      {/* Single flat client table */}
      <section aria-label="Clients" className="mt-10">
        <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.02]">
          <table className="w-full min-w-[1200px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/8 bg-black/30 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                <th className="px-4 py-2.5">Client</th>
                <th className="px-3 py-2.5">Billing cadence</th>
                <th className="px-3 py-2.5">Starting date</th>
                <th className="px-3 py-2.5">Next billing</th>
                <th className="px-3 py-2.5">Consultants</th>
                <th className="px-3 py-2.5">Monthly value</th>
                <th className="px-3 py-2.5">Status</th>
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
                clients.map((c) => (
                  <AdminClientRow
                    key={c.slug}
                    slug={c.slug}
                    title={c.title}
                    icon={c.icon}
                    departments={c.departments}
                    initial={c.record}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RollupTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}
