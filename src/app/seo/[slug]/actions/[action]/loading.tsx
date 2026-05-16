import { PageShell } from "@/components/page-shell";

export default function Loading() {
  return (
    <PageShell wide>
      <div className="mt-6 h-3 w-32 animate-pulse rounded bg-white/8" />

      <header className="mt-6 flex flex-wrap items-start gap-5">
        <div className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-white/8" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-3 w-40 animate-pulse rounded bg-white/8" />
          <div className="h-8 w-72 animate-pulse rounded bg-white/8" />
          <div className="h-3 w-96 animate-pulse rounded bg-white/8" />
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="brand-gradient-border h-72 animate-pulse rounded-2xl bg-white/[0.035]" />
          <div className="brand-gradient-border h-48 animate-pulse rounded-2xl bg-white/[0.035]" />
        </div>
        <div className="space-y-3">
          <div className="h-3 w-20 animate-pulse rounded bg-white/8" />
          <div className="h-32 animate-pulse rounded-xl bg-white/[0.025]" />
        </div>
      </div>
    </PageShell>
  );
}
