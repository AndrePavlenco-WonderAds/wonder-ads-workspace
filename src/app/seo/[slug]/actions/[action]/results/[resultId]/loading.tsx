import { PageShell } from "@/components/page-shell";

export default function Loading() {
  return (
    <PageShell wide>
      <div className="mt-6 h-3 w-32 animate-pulse rounded bg-white/8" />
      <header className="mt-6 flex flex-wrap items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-xl bg-white/8" />
        <div className="h-3 w-48 animate-pulse rounded bg-white/8" />
      </header>
      <div className="mt-6 h-9 w-72 animate-pulse rounded bg-white/8" />
      <div className="mt-8 brand-gradient-border h-32 animate-pulse rounded-2xl bg-white/[0.035]" />
      <div className="mt-5 brand-gradient-border h-96 animate-pulse rounded-2xl bg-white/[0.035]" />
    </PageShell>
  );
}
