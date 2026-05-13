import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export function DepartmentHeader({
  title,
  tagline,
  Icon,
  count,
  countLabel,
  rightSlot,
  extra,
  large = false,
}: {
  title: string;
  tagline: string;
  Icon?: LucideIcon;
  count?: number;
  countLabel?: string;
  rightSlot?: ReactNode;
  extra?: ReactNode;
  large?: boolean;
}) {
  return (
    <>
      <Link
        href="/"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to workspace
      </Link>

      <div className="animate-fade-up mt-10 grid grid-cols-1 gap-10 sm:mt-14 lg:grid-cols-[1fr_auto] lg:items-center">
        <section className="flex flex-col items-start gap-6">
          {Icon && (
            <div className="relative">
              <div
                className="brand-gradient-bg flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_10px_40px_-8px_rgba(120,61,245,0.7)]"
                aria-hidden
              >
                <Icon className="h-7 w-7 text-white" strokeWidth={2.25} />
              </div>
              <div
                aria-hidden
                className="absolute inset-0 -z-10 rounded-2xl opacity-60 blur-2xl"
                style={{ background: "var(--brand-gradient)" }}
              />
            </div>
          )}

          <div>
            <h1
              className={
                large
                  ? "text-5xl font-bold leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl"
                  : "text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl"
              }
            >
              {title}
            </h1>
            <p
              className={
                large
                  ? "mt-5 max-w-2xl text-lg text-white/65 sm:text-xl"
                  : "mt-3 max-w-2xl text-base text-white/65 sm:text-lg"
              }
            >
              {tagline}
            </p>
            {typeof count === "number" && (
              <div className="mt-5">
                <CountBadge value={count} label={countLabel ?? "clients"} />
              </div>
            )}
            {extra && <div className="mt-4">{extra}</div>}
          </div>
        </section>

        {rightSlot && (
          <aside className="lg:max-w-[560px] lg:min-w-[420px]">
            {rightSlot}
          </aside>
        )}
      </div>
    </>
  );
}

function CountBadge({ value, label }: { value: number; label: string }) {
  return (
    <span
      className="animate-count-pop group/badge inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-white backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-white/30 hover:bg-white/[0.1]"
    >
      <span
        aria-hidden
        className="brand-gradient-bg h-2 w-2 rounded-full shadow-[0_0_10px_rgba(197,53,201,0.85)] transition-transform duration-300 group-hover/badge:scale-125"
      />
      <span className="text-base font-bold leading-none tracking-tight">
        {value}
      </span>
      <span className="text-base font-medium uppercase tracking-[0.18em] leading-none text-white/75">
        {label}
      </span>
    </span>
  );
}
