// Presentational "my week" view for an SEO consultant — the roster
// summary strip + one card per client showing THIS week's tasks (what to
// do first / second), mirroring the SuperAdmin roadmap cards but with the
// actual task list. Server component (no interactivity beyond links).

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Clock,
  ListTodo,
} from "lucide-react";
import type {
  ConsultantWeekClient,
  ConsultantWeekView,
} from "@/lib/roadmap-admin-helpers";
import type { RoadmapPillar, RoadmapStatus } from "@/lib/roadmap-store";

const HEALTH_CHIP: Record<
  ConsultantWeekClient["health"],
  { label: string; className: string }
> = {
  "on-track": {
    label: "On track",
    className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
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

const STATUS_META: Record<
  RoadmapStatus,
  { label: string; dot: string; text: string }
> = {
  not_started: { label: "To do", dot: "bg-white/45", text: "text-white/85" },
  in_progress: {
    label: "In progress",
    dot: "bg-amber-400",
    text: "text-amber-100",
  },
  pending_review: {
    label: "For approval",
    dot: "bg-violet-400",
    text: "text-violet-100",
  },
  implemented: {
    label: "Done",
    dot: "bg-emerald-400",
    text: "text-emerald-200/70",
  },
};

const PILLAR_LABEL: Record<RoadmapPillar, string> = {
  technical: "Technical",
  "on-page": "On-Page",
  "off-page": "Off-Page",
  local: "Local",
  content: "Content",
  research: "Research",
};

export function ConsultantWeekView({ view }: { view: ConsultantWeekView }) {
  const t = view.totals;
  return (
    <div className="mt-8 space-y-7">
      {/* Roster summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          icon={CalendarRange}
          label="Projects"
          value={`${t.withRoadmap}/${t.clients}`}
          sub="with a roadmap"
        />
        <Stat
          icon={ListTodo}
          label="This week"
          value={t.thisWeekTasks}
          sub="tasks scheduled"
          accent="brand"
        />
        <Stat
          icon={Clock}
          label="To tackle"
          value={t.thisWeekRemaining}
          sub="not done yet"
          accent={t.thisWeekRemaining > 0 ? "amber" : "emerald"}
        />
        <Stat
          icon={AlertTriangle}
          label="Overdue"
          value={t.overdue}
          sub="past weeks"
          accent={t.overdue >= 5 ? "rose" : t.overdue > 0 ? "amber" : "muted"}
        />
        <Stat
          icon={CheckCircle2}
          label="For approval"
          value={t.pendingApproval}
          sub="with the client"
          accent={t.pendingApproval > 0 ? "violet" : "muted"}
        />
      </div>

      {view.notionUnavailable && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          ⚠️ Notion is unreachable right now — some projects may be missing.
        </div>
      )}

      {view.clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center text-sm text-white/45">
          No clients assigned to you yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {view.clients.map((c) => (
            <ClientWeekCard key={c.slug} client={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientWeekCard({ client }: { client: ConsultantWeekClient }) {
  const chip = HEALTH_CHIP[client.health];
  const pct =
    client.totalTasks > 0
      ? Math.round((client.doneTasks / client.totalTasks) * 100)
      : 0;
  // Order: not-done first (the actual to-do list), done last, greyed.
  const ordered = [...client.thisWeekTasks].sort((a, b) => {
    const ad = a.status === "implemented" ? 1 : 0;
    const bd = b.status === "implemented" ? 1 : 0;
    return ad - bd;
  });
  const remaining = client.thisWeekTasks.filter(
    (t) => t.status !== "implemented",
  ).length;

  return (
    <article className="brand-gradient-border flex flex-col rounded-2xl bg-white/[0.025] p-5 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-white">
            {client.title}
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-white/40">
            /seo/{client.slug}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${chip.className}`}
        >
          {chip.label}
        </span>
      </div>

      {/* Progress */}
      {client.hasRoadmap ? (
        <>
          <div className="mt-4 flex items-baseline justify-between text-[11px] text-white/55">
            <span>
              Week{" "}
              <span className="font-semibold text-white/85">
                {client.currentWeek}
              </span>{" "}
              of 12
            </span>
            <span>
              {client.doneTasks}/{client.totalTasks} done
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="brand-gradient-bg h-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* This week's tasks */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                This week
              </h3>
              <span className="text-[11px] text-white/40">
                {remaining > 0
                  ? `${remaining} to do`
                  : client.thisWeekTasks.length > 0
                    ? "all done ✓"
                    : "—"}
              </span>
            </div>
            {client.thisWeekTasks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] px-3 py-4 text-center text-[12px] text-white/35">
                Nothing scheduled for week {client.currentWeek}.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {ordered.map((task, i) => {
                  const meta = STATUS_META[task.status];
                  const done = task.status === "implemented";
                  return (
                    <li
                      key={task.id}
                      className={`flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 ${
                        done ? "opacity-55" : ""
                      }`}
                    >
                      <span className="mt-0.5 w-4 shrink-0 text-center text-[11px] font-semibold text-white/35">
                        {i + 1}
                      </span>
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[12.5px] leading-snug ${
                            done
                              ? "text-white/55 line-through"
                              : "text-white/90"
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] text-white/40">
                          <span
                            className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-px uppercase tracking-wide"
                          >
                            {PILLAR_LABEL[task.pillar] ?? task.pillar}
                          </span>
                          <span className={meta.text}>{meta.label}</span>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Secondary nudges */}
          {(client.overduePastWeeks > 0 || client.pendingApproval > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px]">
              {client.overduePastWeeks > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                  <AlertTriangle className="h-3 w-3" />
                  {client.overduePastWeeks} overdue
                </span>
              )}
              {client.pendingApproval > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-violet-200">
                  <CheckCircle2 className="h-3 w-3" />
                  {client.pendingApproval} for approval
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-white/10 bg-white/[0.015] px-3 py-5 text-center text-[12px] text-white/40">
          No roadmap generated yet.
        </p>
      )}

      <Link
        href={`/seo/${client.slug}/roadmap`}
        className="group mt-4 inline-flex items-center justify-end gap-1.5 text-[12px] font-medium text-white/55 transition hover:text-white"
      >
        Open board
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent = "default",
}: {
  icon: typeof ListTodo;
  label: string;
  value: string | number;
  sub: string;
  accent?: "default" | "brand" | "amber" | "rose" | "emerald" | "violet" | "muted";
}) {
  const valueColor =
    accent === "amber"
      ? "text-amber-200"
      : accent === "rose"
        ? "text-rose-200"
        : accent === "emerald"
          ? "text-emerald-200"
          : accent === "violet"
            ? "text-violet-200"
            : accent === "muted"
              ? "text-white/55"
              : "text-white";
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div
        className={`mt-1.5 text-2xl font-bold leading-none tracking-tight ${
          accent === "brand" ? "brand-gradient-text" : valueColor
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10.5px] text-white/40">{sub}</div>
    </div>
  );
}
