// Shown when a logged-in but non-SuperAdmin user opens /admin or
// /changelog. Replaces the old "type the superadmin password" gate —
// access is decided by the username on the session cookie, not by an
// extra password challenge.

import Link from "next/link";
import { ArrowLeft, Lock, ShieldX } from "lucide-react";

export function AccessDenied({
  title = "Access Denied",
  description = "This area is reserved for SuperAdmins (Andre, Alex, Alice). If you think you should have access, ping Andre.",
  backHref = "/",
  backLabel = "Back to workspace",
  username,
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  /** Shown in a small "signed in as …" line so the user can sanity-check
   *  whether they're on the right account. */
  username?: string | null;
}) {
  return (
    <section className="animate-fade-up mt-12 flex justify-center sm:mt-20">
      <div className="brand-gradient-border w-full max-w-md rounded-2xl bg-white/[0.035] p-8 backdrop-blur-md">
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 shadow-[0_10px_40px_-8px_rgba(244,63,94,0.5)]"
          >
            <ShieldX className="h-6 w-6 text-rose-300" strokeWidth={2.25} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-2 max-w-xs text-sm text-white/65">{description}</p>
          {username && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10.5px] uppercase tracking-[0.18em] text-white/45">
              <Lock className="h-3 w-3" />
              Signed in as {username}
            </p>
          )}
        </div>
        <Link
          href={backHref}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>
    </section>
  );
}
