import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ChangelogGate } from "@/components/changelog-gate";
import { CHANGELOG, type ChangelogEntry } from "@/lib/changelog";
import { isChangelogUnlocked } from "@/lib/changelog-auth";

export const metadata = {
  title: "Changelog — Wonder Ads Workspace",
};

function BackToWorkspace() {
  return (
    <Link
      href="/"
      className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      Back to workspace
    </Link>
  );
}

export default async function ChangelogPage() {
  if (!(await isChangelogUnlocked())) {
    return (
      <PageShell>
        <BackToWorkspace />
        <ChangelogGate />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <BackToWorkspace />

      <section className="animate-fade-up mt-10 flex flex-col items-start gap-6 sm:mt-14">
        <div className="relative">
          <div
            className="brand-gradient-bg flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_10px_40px_-8px_rgba(120,61,245,0.7)]"
            aria-hidden
          >
            <Sparkles className="h-7 w-7 text-white" strokeWidth={2.25} />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-2xl opacity-60 blur-2xl"
            style={{ background: "var(--brand-gradient)" }}
          />
        </div>

        <div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
            Changelog
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/65 sm:text-lg">
            Every release of the Wonder Ads Workspace, newest first.
          </p>
        </div>
      </section>

      <ol className="relative mt-14 sm:mt-20">
        {/* The vertical timeline line */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[14px] top-2 bottom-2 w-px sm:left-[18px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(120,61,245,0.7) 0%, rgba(120,61,245,0.18) 60%, rgba(120,61,245,0) 100%)",
          }}
        />

        {CHANGELOG.map((entry, i) => (
          <li
            key={entry.version}
            className="animate-fade-up relative pb-10 pl-12 sm:pl-16"
            style={{ animationDelay: `${0.05 + i * 0.04}s` }}
          >
            <TimelineDot isLatest={i === 0} />
            <Entry entry={entry} isLatest={i === 0} />
          </li>
        ))}
      </ol>
    </PageShell>
  );
}

function TimelineDot({ isLatest }: { isLatest: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute left-0 top-2.5 flex h-7 w-7 items-center justify-center sm:left-1"
    >
      {isLatest && (
        <span
          className="brand-gradient-bg animate-ping-slow absolute inset-0 rounded-full opacity-60"
          style={{ animationDuration: "2.4s" }}
        />
      )}
      <span
        className="relative h-3 w-3 rounded-full ring-2 ring-[color:var(--background)]"
        style={{ background: "var(--brand-gradient)" }}
      />
    </span>
  );
}

function Entry({
  entry,
  isLatest,
}: {
  entry: ChangelogEntry;
  isLatest: boolean;
}) {
  return (
    <article className="brand-gradient-border group relative overflow-hidden rounded-2xl bg-white/[0.035] p-6 backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/[0.06] sm:p-7">
      {isLatest && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-40 blur-3xl"
          style={{ background: "var(--brand-gradient)" }}
        />
      )}

      <header className="relative flex flex-wrap items-center gap-3">
        <span
          className="brand-gradient-bg rounded-full px-3 py-1 text-xs font-bold tracking-tight text-white shadow-[0_6px_22px_-4px_rgba(120,61,245,0.55)]"
          aria-label={`Version ${entry.version}`}
        >
          v{entry.version}
        </span>
        <time className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
          {formatDate(entry.date)}
        </time>
        {isLatest && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
            <span
              aria-hidden
              className="brand-gradient-bg h-1.5 w-1.5 rounded-full shadow-[0_0_10px_rgba(197,53,201,0.85)]"
            />
            Latest
          </span>
        )}
      </header>

      <h2 className="relative mt-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {entry.title}
      </h2>

      <ul className="relative mt-4 space-y-2 text-sm text-white/75 sm:text-base">
        {entry.highlights.map((h, j) => (
          <li key={j} className="flex gap-3">
            <span
              aria-hidden
              className="brand-gradient-bg mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
            />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
