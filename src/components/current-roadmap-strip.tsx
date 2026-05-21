// Lightweight strip rendered at the top of every client SEO page.
//
// Replaces the static "What are we working on now, boss?" prompt with a
// live, contextual summary of the current week's tasks pulled from the
// roadmap KV bucket. Falls back to a "Generate a roadmap" CTA when no
// roadmap exists.

import Link from "next/link";
import { ArrowRight, Map, Sparkles } from "lucide-react";
import { getCurrentRoadmap, currentWeekIndex } from "@/lib/roadmap-store";

export async function CurrentRoadmapStrip({ slug }: { slug: string }) {
  const roadmap = await getCurrentRoadmap(slug);
  if (!roadmap) {
    return (
      <Link
        href={`/seo/${slug}/roadmap`}
        className="brand-gradient-border group mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/65 transition hover:text-white"
      >
        <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
        <span>No roadmap yet — generate a 12-week plan</span>
        <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
      </Link>
    );
  }

  const week = currentWeekIndex(roadmap);
  const inHorizon = week >= 1 && week <= 12;
  const currentTasks = roadmap.tasks
    .filter((t) => t.week === week)
    .sort((a, b) => a.order - b.order);
  // "Pending" = anything not yet implemented. That's the work the
  // consultant still has to do, vs the total count (which includes
  // already-done tasks and is less actionable).
  const currentPending = currentTasks.filter(
    (t) => t.status !== "implemented",
  );
  // Past-week health: any tasks scheduled BEFORE the current week that
  // aren't implemented are overdue. Drives the green-or-red accent chip.
  const pastPending = roadmap.tasks.filter(
    (t) => t.week < week && t.status !== "implemented",
  );
  const summary = `Week ${inHorizon ? week : "—"} of 12 · ${currentPending.length} task${currentPending.length === 1 ? "" : "s"} pending`;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Link
        href={`/seo/${slug}/roadmap`}
        className="brand-gradient-border group inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.07]"
      >
        <Map className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
        <span>{summary}</span>
        <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
      </Link>
      {/* Past-weeks status chip — green when caught up, red when
          behind. Always shown from week 2 onwards so consultants know
          if previous weeks were closed out cleanly. */}
      {inHorizon && week >= 2 && (
        <Link
          href={`/seo/${slug}/roadmap`}
          className={
            pastPending.length === 0
              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
              : "inline-flex items-center gap-1.5 rounded-full border border-rose-400/45 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-500/20"
          }
          title={
            pastPending.length === 0
              ? `Weeks 1-${week - 1} are fully implemented.`
              : `${pastPending.length} task(s) from weeks 1-${week - 1} aren't implemented yet — open the board to catch up.`
          }
        >
          <span
            aria-hidden
            className={
              pastPending.length === 0 ? "text-emerald-300" : "text-rose-300"
            }
          >
            {pastPending.length === 0 ? "✓" : "⚠"}
          </span>
          <span>
            {pastPending.length === 0
              ? `Weeks 1-${week - 1} all done`
              : `Weeks 1-${week - 1} have ${pastPending.length} task${pastPending.length === 1 ? "" : "s"} pending`}
          </span>
        </Link>
      )}
    </div>
  );
}
