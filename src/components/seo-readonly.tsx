"use client";

// Read-only mode for the SEO project pages.
//
// Web designers can OPEN the SEO client project pages (to see what's
// shipping) but must not change anything — every edit, AI generation,
// approval and delete is off-limits for them. The hard guarantee lives
// server-side in middleware (the SEO write-gate rejects their POST/PUT/
// PATCH/DELETE regardless of the UI). THIS context is the matching UX:
// it lets the interactive components hide their edit affordances so a
// viewer never clicks a button that would just 403.
//
// Default is `false`, so any component consuming `useSeoReadOnly()`
// outside a provider (e.g. reused on an ADS/Web page) behaves exactly as
// before — full edit.

import { createContext, useContext, type ReactNode } from "react";
import { Eye } from "lucide-react";

const SeoReadOnlyContext = createContext(false);

export function SeoReadOnlyProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return (
    <SeoReadOnlyContext.Provider value={value}>
      {children}
    </SeoReadOnlyContext.Provider>
  );
}

/** True when the current viewer may see this SEO page but not change it. */
export function useSeoReadOnly(): boolean {
  return useContext(SeoReadOnlyContext);
}

/** Sticky banner shown at the top of a read-only SEO project page so the
 *  viewer understands why the edit controls are gone. */
export function ReadOnlyBanner() {
  return (
    <div className="animate-fade-up mt-6 flex items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-100/90">
      <Eye className="h-4 w-4 shrink-0 text-amber-300" />
      <span>
        <strong className="font-semibold">Read-only.</strong> You can view this
        SEO project but not make changes — editing, AI actions and approvals are
        reserved for the SEO team.
      </span>
    </div>
  );
}
