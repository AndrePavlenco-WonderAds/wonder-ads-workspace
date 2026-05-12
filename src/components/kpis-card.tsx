import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";

export function KpisCard({ href = "/seo/kpis" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="brand-gradient-border animate-fade-up group relative flex flex-col gap-6 overflow-hidden rounded-2xl bg-white/[0.04] p-6 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-white/[0.07] sm:flex-row sm:items-center sm:justify-between sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-80"
        style={{ background: "var(--brand-gradient)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-50"
        style={{ background: "var(--brand-gradient)" }}
      />

      <div className="relative z-10 flex items-center gap-5">
        <div className="relative">
          <div
            className="brand-gradient-bg flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_10px_40px_-6px_rgba(120,61,245,0.7)] transition-transform duration-500 group-hover:scale-110"
            aria-hidden
          >
            <Activity className="h-6 w-6 text-white" strokeWidth={2.25} />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-2xl opacity-60 blur-xl"
            style={{ background: "var(--brand-gradient)" }}
          />
        </div>

        <div>
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
            Framework
          </span>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="brand-gradient-text">SEO DPT KPIs</span>
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/60 sm:text-base">
            Monthly performance evaluation · 3 pillars · quarterly bonus
          </p>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2 text-sm font-medium text-white/80 transition-colors group-hover:text-white sm:text-base">
        <span>View framework</span>
        <ArrowUpRight
          className="h-5 w-5 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1"
          aria-hidden
        />
      </div>
    </Link>
  );
}
