"use client";

// Scroll-aware sticky progress bar for the public onboarding hub. Stays hidden
// while the hero (with its progress ring) is on screen, then slides in from the
// top so the client always has their % + a one-tap "Continuar" within reach —
// especially on mobile, where the hero scrolls away fast. Pure presentational,
// no data fetching.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, PartyPopper } from "lucide-react";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

export function OnboardingStickyBar({
  clientTitle,
  pct,
  completedCount,
  total,
  minutesLeft,
  nextHref,
  continueLabel,
  allDone,
}: {
  clientTitle: string;
  pct: number;
  completedCount: number;
  total: number;
  minutesLeft: number;
  nextHref: string | null;
  continueLabel: string;
  allDone: boolean;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!shown}
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        shown
          ? "translate-y-0 opacity-100"
          : "-translate-y-full pointer-events-none opacity-0"
      }`}
    >
      <div className="border-b border-black/8 bg-white/85 backdrop-blur-md shadow-[0_8px_30px_-20px_rgba(0,0,0,0.45)]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
          {/* Ring % */}
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: BRAND_GRADIENT }}
          >
            {pct}%
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-black/75">
              <span className="hidden sm:inline">{clientTitle} · </span>
              {allDone
                ? "Onboarding concluído"
                : `${completedCount}/${total} passos`}
              {!allDone && minutesLeft > 0 && (
                <span className="font-normal text-black/45">
                  {" "}
                  · ~{minutesLeft} min
                </span>
              )}
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/8">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: BRAND_GRADIENT }}
              />
            </div>
          </div>

          {allDone || !nextHref ? (
            <span className="hidden shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-[#783DF5] sm:inline-flex">
              <PartyPopper className="h-4 w-4" />
              Tudo pronto
            </span>
          ) : (
            <Link
              href={nextHref}
              className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition-all hover:brightness-110"
              style={{ background: BRAND_GRADIENT }}
            >
              {continueLabel}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
