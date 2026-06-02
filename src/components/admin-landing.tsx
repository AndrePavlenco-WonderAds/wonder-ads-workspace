"use client";

// Post-gate chooser inside the SuperAdmin Control Suite. Two big
// blocks — Projects and Employees — surface the two manageable
// rosters in the suite. Each block carries a live count + a brand
// gradient border that pulses on hover.

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Users, ArrowRight, LogOut, Loader2 } from "lucide-react";

type ChoiceBlock = {
  href: string;
  title: string;
  blurb: string;
  count: number;
  badge: string;
  Icon: typeof FolderKanban;
};

export function AdminLanding({
  projectsCount,
  employeesCount,
}: {
  projectsCount: number;
  employeesCount: number;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const blocks: ChoiceBlock[] = [
    {
      href: "/admin/projects",
      title: "Projects",
      blurb:
        "Every client across SEO + ADS. Billing cadence, starting date, consultants, monthly value, status, notes.",
      count: projectsCount,
      badge: projectsCount === 1 ? "client" : "clients",
      Icon: FolderKanban,
    },
    {
      href: "/admin/employees",
      title: "Employees",
      blurb:
        "The team roster + payroll. Role, department, payment cadence, salary, status, notes.",
      count: employeesCount,
      badge: employeesCount === 1 ? "employee" : "employees",
      Icon: Users,
    },
  ];

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
            Choose what to manage.
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

      <section
        aria-label="Manageable rosters"
        className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2"
      >
        {blocks.map((b) => {
          const { Icon } = b;
          return (
            <Link
              key={b.href}
              href={b.href}
              className="brand-gradient-border group relative overflow-hidden rounded-2xl bg-white/[0.035] p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06] sm:p-7"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-30 blur-3xl transition-opacity duration-300 group-hover:opacity-60"
                style={{ background: "var(--brand-gradient)" }}
              />

              <div className="relative flex items-start justify-between">
                <span
                  aria-hidden
                  className="brand-gradient-bg flex h-12 w-12 items-center justify-center rounded-2xl shadow-[0_10px_40px_-10px_rgba(120,61,245,0.65)]"
                >
                  <Icon className="h-6 w-6 text-white" strokeWidth={2.25} />
                </span>
                <span className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">
                  {b.count} {b.badge}
                </span>
              </div>

              <h2 className="relative mt-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {b.title}
              </h2>
              <p className="relative mt-2 max-w-md text-sm text-white/55">
                {b.blurb}
              </p>

              <div className="relative mt-6 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/85 transition group-hover:gap-2.5 group-hover:text-white">
                Open {b.title.toLowerCase()}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
