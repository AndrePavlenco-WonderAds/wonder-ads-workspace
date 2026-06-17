// SuperAdmin → Roadmaps view. One section per consultant, showing
// every assigned SEO client + their roadmap progress (current week,
// tasks done, pending review, overdue past-week tasks, overdue
// weeks). Lets Andre see at a glance who's on track vs. falling
// behind across the whole roster.
//
// Server component — no client interactivity needed. Every link drops
// straight into the client's existing /seo/<slug>/roadmap board where
// the actual edits happen.

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  Calendar,
  Mail,
  ArrowRight,
  ClipboardCheck,
} from "lucide-react";
import type {
  ConsultantClientRow,
  ConsultantSection,
  RoadmapAdminSummary,
} from "@/lib/roadmap-admin-helpers";
import { formatDate } from "@/lib/dates";

const HEALTH_CHIP: Record<
  ConsultantClientRow["health"],
  { label: string; className: string }
> = {
  "on-track": {
    label: "On track",
    className:
      "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  },
  behind: {
    label: "Falling behind",
    className: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  },
  critical: {
    label: "Critical",
    className: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  },
  "not-started": {
    label: "Not started",
    className: "border-white/15 bg-white/[0.04] text-white/65",
  },
  "no-roadmap": {
    label: "No roadmap yet",
    className: "border-violet-400/30 bg-violet-500/10 text-violet-200",
  },
};

export function AdminRoadmapsPanel({
  summary,
}: {
  summary: RoadmapAdminSummary;
}) {
  return (
    <div className="animate-fade-up mt-2 space-y-8">
      <header>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">SEO Consultant Roadmaps</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-[12px] text-white/45">
          Every SEO client grouped by Head Consultant. See at a glance which
          week each project is in, what&apos;s done, what&apos;s waiting on the
          client, and where past-week tasks are stacking up. Click any client
          to jump straight into their roadmap board.
        </p>
      </header>

      <RosterTotals totals={summary.totals} />

      {summary.notionUnavailable && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          ⚠️ Notion is unreachable — only roadmaps that have been visited
          recently will show up. Refresh once Notion is back.
        </div>
      )}

      {summary.sections.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {summary.sections.map((section) => (
            <ConsultantBlock key={section.consultant} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}

function RosterTotals({
  totals,
}: {
  totals: RoadmapAdminSummary["totals"];
}) {
  const cards: { label: string; value: string; tone?: "warn" | "danger" }[] = [
    {
      label: "SEO clients",
      value: `${totals.clientsAssigned}`,
    },
    {
      label: "With roadmap",
      value: `${totals.clientsWithRoadmap}/${totals.clientsAssigned}`,
    },
    {
      label: "Consultants active",
      value: `${totals.consultantsActive}`,
    },
    {
      label: "Pending client approval",
      value: `${totals.pendingApproval}`,
      tone: totals.pendingApproval > 0 ? "warn" : undefined,
    },
    {
      label: "Overdue tasks (past weeks)",
      value: `${totals.overdue}`,
      tone:
        totals.overdue >= 10
          ? "danger"
          : totals.overdue > 0
            ? "warn"
            : undefined,
    },
  ];
  return (
    <section
      aria-label="Roster totals"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    >
      {cards.map((c) => {
        const tone =
          c.tone === "danger"
            ? "border-rose-400/35 text-rose-100"
            : c.tone === "warn"
              ? "border-amber-400/30 text-amber-100"
              : "border-white/12 text-white";
        return (
          <div
            key={c.label}
            className={`rounded-xl border ${tone} bg-white/[0.025] px-4 py-3`}
          >
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/55">
              {c.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {c.value}
            </p>
          </div>
        );
      })}
    </section>
  );
}

function ConsultantBlock({ section }: { section: ConsultantSection }) {
  return (
    <section
      aria-label={`${section.consultant} — roadmap progress`}
      className="brand-gradient-border rounded-2xl bg-white/[0.025] p-5 backdrop-blur-md sm:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {section.consultant}
        </h2>
        {section.email && (
          <a
            href={`mailto:${section.email}`}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/55 transition hover:text-white"
          >
            <Mail className="h-3 w-3" />
            {section.email}
          </a>
        )}
        <span className="ml-auto inline-flex flex-wrap items-center gap-3 text-[11px] text-white/55">
          <span>
            <span className="text-white">{section.clients.length}</span>{" "}
            client{section.clients.length === 1 ? "" : "s"}
          </span>
          <span className="text-white/25">·</span>
          <span>
            <span className="text-white">
              {section.withRoadmap}/{section.clients.length}
            </span>{" "}
            have a roadmap
          </span>
          {section.avgCurrentWeek > 0 && (
            <>
              <span className="text-white/25">·</span>
              <span>
                avg week{" "}
                <span className="text-white">{section.avgCurrentWeek}</span> of
                12
              </span>
            </>
          )}
          {section.totalPendingApproval > 0 && (
            <>
              <span className="text-white/25">·</span>
              <span className="text-amber-200">
                {section.totalPendingApproval} waiting on client
              </span>
            </>
          )}
          {section.totalOverdue > 0 && (
            <>
              <span className="text-white/25">·</span>
              <span className="text-rose-200">
                {section.totalOverdue} overdue across{" "}
                {section.totalOverdueWeeks} past week
                {section.totalOverdueWeeks === 1 ? "" : "s"}
              </span>
            </>
          )}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {section.clients.map((client) => (
          <ClientCard key={client.slug} client={client} />
        ))}
      </div>
    </section>
  );
}

function ClientCard({ client }: { client: ConsultantClientRow }) {
  const chip = HEALTH_CHIP[client.health];
  const weekProgressPct =
    client.currentWeek > 0
      ? Math.min(100, Math.round((Math.min(client.currentWeek, 12) / 12) * 100))
      : 0;
  return (
    <article className="relative flex flex-col rounded-xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {client.title}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10.5px] text-white/40">
            /seo/{client.slug}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${chip.className}`}
        >
          {chip.label}
        </span>
      </div>

      {client.hasRoadmap ? (
        <>
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2 text-[11px] text-white/55">
              <span>
                Week{" "}
                <span className="text-white">
                  {client.currentWeek === 0
                    ? "—"
                    : Math.min(client.currentWeek, 12)}
                </span>{" "}
                of 12
                {client.currentWeek > 12 && (
                  <span className="ml-1 text-rose-200">
                    · {client.currentWeek - 12} past horizon
                  </span>
                )}
              </span>
              <span>
                {client.doneTasks}/{client.totalTasks} done
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="brand-gradient-bg h-full transition-all duration-500"
                style={{ width: `${weekProgressPct}%` }}
              />
            </div>
          </div>

          <ul className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
            <li className="rounded-md border border-emerald-400/20 bg-emerald-500/[0.06] px-2 py-1.5">
              <span className="flex items-center gap-1 text-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                Done past weeks
              </span>
              <span className="mt-0.5 block text-base font-semibold text-white">
                {client.donePastWeeks}
              </span>
            </li>
            <li className="rounded-md border border-violet-400/25 bg-violet-500/[0.07] px-2 py-1.5">
              <span className="flex items-center gap-1 text-violet-200">
                <Clock className="h-3 w-3" />
                For approval
              </span>
              <span className="mt-0.5 block text-base font-semibold text-white">
                {client.pendingApproval}
              </span>
            </li>
            <li
              className={`rounded-md border px-2 py-1.5 ${
                client.overduePastWeeks >= 5
                  ? "border-rose-400/40 bg-rose-500/[0.10]"
                  : client.overduePastWeeks >= 2
                    ? "border-amber-400/30 bg-amber-500/[0.07]"
                    : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <span
                className={`flex items-center gap-1 ${
                  client.overduePastWeeks >= 5
                    ? "text-rose-200"
                    : client.overduePastWeeks >= 2
                      ? "text-amber-200"
                      : "text-white/55"
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                Overdue tasks
              </span>
              <span className="mt-0.5 block text-base font-semibold text-white">
                {client.overduePastWeeks}
                {client.overdueWeekCount > 0 && (
                  <span className="ml-1 text-[10.5px] font-medium text-white/45">
                    over {client.overdueWeekCount} wk
                    {client.overdueWeekCount === 1 ? "" : "s"}
                  </span>
                )}
              </span>
            </li>
          </ul>

          {(client.startDate || client.onboardingDate) && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/8 pt-2.5 text-[10.5px] text-white/45">
              {client.onboardingDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Onboarded {formatDate(client.onboardingDate)}
                </span>
              )}
              {client.startDate && (
                <span className="inline-flex items-center gap-1">
                  <Compass className="h-3 w-3" />
                  Cycle start {formatDate(client.startDate)}
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-white/12 bg-white/[0.025] px-3 py-3 text-[11px] text-white/55">
          No roadmap on file yet — open the board to generate one.
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-4 border-t border-white/8 pt-2.5">
        <Link
          href={`/seo/${client.slug}/review`}
          className="group/r inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-white/55 transition hover:text-white"
        >
          <ClipboardCheck className="h-3 w-3" />
          Pending review
        </Link>
        <Link
          href={`/seo/${client.slug}/roadmap`}
          className="group/b inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-white/55 transition hover:text-white"
        >
          Open board
          <ArrowRight className="h-3 w-3 transition group-hover/b:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] px-6 py-16 text-center">
      <Compass
        className="mx-auto h-10 w-10 text-white/35"
        strokeWidth={1.5}
      />
      <p className="mt-3 text-sm text-white/65">
        No consultants on the roster yet — assign SEO clients to a consultant
        in <code className="text-white">src/lib/client-overrides.ts</code> and
        come back.
      </p>
    </div>
  );
}
