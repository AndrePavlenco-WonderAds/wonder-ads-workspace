// Instant skeleton shown while /seo/[slug]/review SSRs (cold function +
// Notion fetch can take a few seconds). Gives consultants immediate
// feedback that the click registered, instead of 10s of blank screen.

import { PageShell } from "@/components/page-shell";

export default function ReviewLoading() {
  return (
    <PageShell wide>
      <div className="animate-fade-up mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-white/10" />
          <div>
            <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-7 w-56 animate-pulse rounded bg-white/15" />
            <div className="mt-2 h-2.5 w-72 animate-pulse rounded bg-white/8" />
          </div>
        </div>
      </div>
      <div className="mt-8 space-y-3">
        <div className="h-9 w-full animate-pulse rounded-lg bg-white/[0.05]" />
        <div className="h-9 w-full animate-pulse rounded-lg bg-white/[0.04]" />
        <div className="h-9 w-full animate-pulse rounded-lg bg-white/[0.04]" />
        <div className="h-9 w-full animate-pulse rounded-lg bg-white/[0.04]" />
      </div>
    </PageShell>
  );
}
