import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export type ClientCardProps = {
  title: string;
  icon: string | null;
  href: string;
  index?: number;
};

export function ClientCard({ title, icon, href, index = 0 }: ClientCardProps) {
  return (
    <Link
      href={href}
      className="brand-gradient-border animate-fade-up group relative flex flex-col gap-4 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-white/[0.06]"
      style={{ animationDelay: `${0.05 + index * 0.04}s` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-50"
        style={{ background: "var(--brand-gradient)" }}
      />

      <div className="flex items-start justify-between">
        <div className="relative">
          <div
            className="brand-gradient-bg flex h-10 w-10 items-center justify-center rounded-xl text-lg shadow-[0_6px_20px_-4px_rgba(120,61,245,0.55)] transition-transform duration-500 group-hover:scale-110"
            aria-hidden
          >
            <span className="leading-none">{icon ?? "🌐"}</span>
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-xl opacity-40 blur-lg"
            style={{ background: "var(--brand-gradient)" }}
          />
        </div>
        <ArrowUpRight
          className="h-4 w-4 text-white/30 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
          aria-hidden
        />
      </div>

      <div>
        <h3 className="text-base font-semibold tracking-tight text-white">
          {title}
        </h3>
        <p className="mt-1 text-xs text-white/45 sm:text-sm">Client workspace</p>
      </div>
    </Link>
  );
}
