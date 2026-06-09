import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { BackgroundDecor } from "./background-decor";
import { WonderAdsLogo } from "./wonder-ads-logo";
import { HeaderClock } from "./header-clock";
import { UserChip } from "./user-chip";
import { getCurrentVersion } from "@/lib/changelog";

export function PageShell({
  children,
  wide = false,
  sessionTimer = false,
  backHref,
  backLabel,
  transparentHeader = false,
  hideFooter = false,
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
  /** Landing-page variant — drops the header's bottom border and
   *  background panel so the logo + clock sit cleanly on the starfield
   *  instead of inside a card-like strip. Used only on the department
   *  chooser. Header stays non-sticky in this mode (the page is short
   *  and the sticky strip looked floating/unfinished). */
  transparentHeader?: boolean;
  /** Drop the footer (© Wonder Ads + SuperAdmin chip + workspace.v##).
   *  Used by /login so the gate page reads as a clean entry point
   *  rather than a doc with a busy footer. */
  hideFooter?: boolean;
}) {
  const version = getCurrentVersion();
  const widthClass = wide ? "max-w-none" : "max-w-7xl";
  const headerChrome = transparentHeader
    ? "relative bg-transparent"
    : "sticky top-0 z-30 border-b border-white/5 bg-[color:var(--background)]/85 backdrop-blur-md";
  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
      <BackgroundDecor />

      <header
        className={`mx-auto flex w-full ${widthClass} items-center justify-between gap-4 px-6 py-4 sm:px-10 sm:py-5 ${headerChrome}`}
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
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <HeaderClock sessionTimer={sessionTimer} />
          </div>
          {/* Identity + session controls — server component, renders
              null when there's no valid session (e.g. on /login). */}
          <UserChip />
        </div>
      </header>

      <main
        className={`relative z-20 mx-auto flex w-full ${widthClass} flex-col px-6 pb-20 pt-6 sm:px-10 sm:pb-24`}
      >
        {children}

        {!hideFooter && (
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-xs text-white/40 sm:mt-20">
          <span>© {new Date().getFullYear()} Wonder Ads. All Rights Reserved.</span>
          <Link
            href="/admin"
            className="group inline-flex items-center gap-1.5 rounded-md border border-[#783DF5]/45 bg-[#783DF5]/10 px-2.5 py-1 text-[11px] font-semibold tracking-tight text-white/90 shadow-[0_4px_18px_-6px_rgba(120,61,245,0.55)] transition hover:border-[#C535C9]/70 hover:bg-[#783DF5]/18 hover:text-white"
            aria-label="Log in to the SuperAdmin Control Suite"
          >
            <ShieldCheck
              className="h-3 w-3 text-[#C535C9] transition group-hover:text-white"
              strokeWidth={2.5}
            />
            SuperAdmin Suite · Log in
          </Link>
          <Link
            href="/changelog"
            className="font-mono transition hover:text-white"
            aria-label={`View changelog — workspace v${version}`}
          >
            workspace.v{version}
          </Link>
        </footer>
        )}
      </main>
    </div>
  );
}
