import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";
import type { ClientPalette } from "@/lib/client-colors";
import { paletteToGradient } from "@/lib/client-colors";

export type ClientCardProps = {
  title: string;
  icon: string | null;
  href: string;
  consultant: string;
  palette: ClientPalette;
  index?: number;
};

export function ClientCard({
  title,
  icon,
  href,
  consultant,
  palette,
  index = 0,
}: ClientCardProps) {
  const gradient = paletteToGradient(palette);
  const gradientSoft = paletteToGradient(palette, 135);

  return (
    <Link
      href={href}
      style={
        {
          "--client-grad": gradient,
        } as React.CSSProperties
      }
      className="brand-gradient-border animate-fade-up group relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-white/[0.06]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-15 blur-2xl transition-all duration-500 group-hover:opacity-55"
        style={{ background: gradientSoft, animationDelay: `${index * 0.04}s` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px opacity-50 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: gradient }}
      />

      <div className="relative flex items-start justify-between">
        <div className="relative">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg shadow-[0_8px_28px_-6px_rgba(0,0,0,0.5)] ring-1 ring-white/10 transition-transform duration-500 group-hover:scale-110"
            style={{ background: gradient }}
            aria-hidden
          >
            <span className="leading-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">
              {icon ?? "🌐"}
            </span>
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-xl opacity-45 blur-lg transition-opacity duration-500 group-hover:opacity-80"
            style={{ background: gradient }}
          />
        </div>
        <ArrowUpRight
          className="h-4 w-4 text-white/30 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
          aria-hidden
        />
      </div>

      <div className="relative">
        <h3 className="text-base font-semibold tracking-tight text-white">
          {title}
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs">
          <UserRound className="h-3 w-3 text-white/50" />
          <span className="font-medium text-white/75">{consultant}</span>
        </p>
      </div>
    </Link>
  );
}
