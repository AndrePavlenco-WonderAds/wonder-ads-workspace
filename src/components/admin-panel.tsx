"use client";

// Admin Control Panel — clean table view of every client across every
// department. Rows are independently editable; each shows a Save
// button when dirty and persists to KV via /api/admin/clients/[slug].
// The header carries a logout button + a per-department MRR roll-up.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { AdminClientRow } from "./admin-client-row";
import type { AdminClientRecord } from "@/lib/admin-clients-store";

export type AdminClientView = {
  slug: string;
  title: string;
  icon: string | null;
  departments: string[]; // ["SEO"], ["ADS"], ["SEO", "ADS"]
  record: AdminClientRecord;
};

type Department = {
  id: string;
  name: string;
  blurb: string;
  clients: AdminClientView[];
};

export function AdminPanel({
  departments,
}: {
  departments: Department[];
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const totalClients = useMemo(
    () => new Set(departments.flatMap((d) => d.clients.map((c) => c.slug))).size,
    [departments],
  );

  const totalMrr = useMemo(() => {
    const seen = new Set<string>();
    let total = 0;
    for (const d of departments) {
      for (const c of d.clients) {
        if (seen.has(c.slug)) continue;
        seen.add(c.slug);
        if (c.record.monthlyValueEur && c.record.status === "active") {
          total += c.record.monthlyValueEur;
        }
      }
    }
    return total;
  }, [departments]);

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
            Admin Panel · Wonder Ads
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Admin Control Panel</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Clients grouped by department. Edit billing cadence, starting
            date, head consultant, monthly value, status and notes —
            changes save independently per row.
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
        <RollupTile
          label="Departments"
          value={String(departments.length)}
        />
        <RollupTile
          label="Active MRR"
          value={
            totalMrr > 0
              ? new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                }).format(totalMrr)
              : "—"
          }
        />
        <RollupTile
          label="Engagements"
          value={String(
            departments.reduce(
              (acc, d) =>
                acc + d.clients.filter((c) => c.record.status === "active").length,
              0,
            ),
          )}
        />
      </section>

      {/* Per-department tables */}
      <div className="mt-10 space-y-12">
        {departments.map((d) => (
          <section key={d.id} aria-label={`${d.name} clients`}>
            <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                  {d.name}
                </h2>
                <p className="mt-1 text-[12px] text-white/45">{d.blurb}</p>
              </div>
              <span className="text-[11px] text-white/40">
                {d.clients.length} client{d.clients.length === 1 ? "" : "s"}
              </span>
            </header>

            <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.02]">
              <table className="w-full min-w-[1200px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/8 bg-black/30 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                    <th className="px-4 py-2.5">Client</th>
                    <th className="px-3 py-2.5">Billing cadence</th>
                    <th className="px-3 py-2.5">Starting date</th>
                    <th className="px-3 py-2.5">Next billing</th>
                    <th className="px-3 py-2.5">Consultant</th>
                    <th className="px-3 py-2.5">Monthly value</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Notes</th>
                    <th className="px-3 py-2.5">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {d.clients.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-[12px] text-white/40"
                      >
                        No clients in this department yet.
                      </td>
                    </tr>
                  ) : (
                    d.clients.map((c) => (
                      <AdminClientRow
                        key={`${d.id}:${c.slug}`}
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
        ))}
      </div>
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
