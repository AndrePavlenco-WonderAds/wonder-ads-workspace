import Link from "next/link";
import type { ReactNode } from "react";
import { BackgroundDecor } from "./background-decor";
import { WonderAdsLogo } from "./wonder-ads-logo";
import { HeaderClock } from "./header-clock";
import { getCurrentVersion } from "@/lib/changelog";

export function PageShell({
  children,
  wide = false,
  sessionTimer = false,
}: {
  children: ReactNode;
  /** Full-bleed layout — used by project pages so the brief + files split
   *  has room to breathe. Defaults to the standard max-w-7xl container. */
  wide?: boolean;
  /** Show the "Working on this for" timer in the header — used on project
   *  pages so consultants can see how long they've been on a client. */
  sessionTimer?: boolean;
}) {
  const version = getCurrentVersion();
  const widthClass = wide ? "max-w-none" : "max-w-7xl";
  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
      <BackgroundDecor />

      <header
        className={`relative z-30 mx-auto flex w-full ${widthClass} items-center justify-between px-6 py-6 sm:px-10 sm:py-8`}
      >
        <WonderAdsLogo />
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
