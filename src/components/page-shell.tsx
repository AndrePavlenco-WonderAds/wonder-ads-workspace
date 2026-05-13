import type { ReactNode } from "react";
import { BackgroundDecor } from "./background-decor";
import { WonderAdsLogo } from "./wonder-ads-logo";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
      <BackgroundDecor />

      <header className="relative z-30 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        <WonderAdsLogo />
        <nav className="hidden gap-8 text-sm text-white/60 sm:flex">
          <a
            href="https://wonder-ads.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-white"
          >
            wonder-ads.com
          </a>
        </nav>
      </header>

      <main className="relative z-20 mx-auto flex w-full max-w-7xl flex-col px-6 pb-20 pt-6 sm:px-10 sm:pb-24">
        {children}

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40 sm:mt-20">
          <span>© {new Date().getFullYear()} Wonder Ads. All Rights Reserved.</span>
          <span className="font-mono">workspace.v13</span>
        </footer>
      </main>
    </div>
  );
}
