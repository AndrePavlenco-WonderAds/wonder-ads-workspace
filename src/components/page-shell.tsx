import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { BackgroundDecor } from "./background-decor";
import { WonderAdsLogo } from "./wonder-ads-logo";
import { HeaderClock } from "./header-clock";
import { getCurrentVersion } from "@/lib/changelog";

export function PageShell({
  children,
  wide = false,
  sessionTimer = false,
  backHref,
  backLabel,
}: {
  children: ReactNode;
  /** Full-bleed layout — used by project pages so the brief + files split
   *  has room to breathe. Defaults to the standard max-w-7xl container. */
  wide?: boolean;
  /** Show the "Working on this for" timer in the header — used on project
   *  pages so consultants can see how long they've been on a client. */
  sessionTimer?: boolean;
  /** Optional back-navigation. When set, renders a persistent "← Back to
   *  X" pill in the header next to the WonderAds logo. Use on every
   *  nested page (client, action, result) so consultants always have a
   *  visible escape hatch without scrolling. */
  backHref?: string;
  backLabel?: string;
}) {
  const version = getCurrentVersion();
  const widthClass = wide ? "max-w-none" : "max-w-7xl";
  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
      <BackgroundDecor />

      <header
        className={`relative z-30 mx-auto flex w-full ${widthClass} items-center justify-between gap-4 px-6 py-6 sm:px-10 sm:py-8`}
      >
        <div className="flex items-center gap-4">
          <WonderAdsLogo />
          {backHref && backLabel && (
            <Link
              href={backHref}
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-[color:var(--brand-purple)]/45 hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>
                Back to <span className="font-semibold">{backLabel}</span>
              </span>
            </Link>
          )}
        </div>
        <div className="hidden sm:block">
          <HeaderClock sessionTimer={sessionTimer} />
        </div>
      </header>

      <main
        className={`relative z-20 mx-auto flex w-full ${widthClass} flex-col px-6 pb-20 pt-6 sm:px-10 sm:pb-24`}
      >
        {children}

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-xs text-white/40 sm:mt-20">
          <span>© {new Date().getFullYear()} Wonder Ads. All Rights Reserved.</span>
          <span>
            Found a bug or have feedback? Email{" "}
            <a
              href="mailto:andre@wonder-ads.com"
              className="text-white/55 underline-offset-2 transition hover:text-white hover:underline"
            >
              andre@wonder-ads.com
            </a>
          </span>
          <Link
            href="/changelog"
            className="font-mono transition hover:text-white"
            aria-label={`View changelog — workspace v${version}`}
          >
            workspace.v{version}
          </Link>
        </footer>
      </main>
    </div>
  );
}
