// Lightweight strip rendered at the top of every client SEO page.
//
// Replaces the static "What are we working on now, boss?" prompt with a
// live, contextual summary of the current week's tasks pulled from the
// roadmap KV bucket. Falls back to a "Generate a roadmap" CTA when no
// roadmap exists.

import Link from "next/link";
import { ArrowRight, Map, Sparkles } from "lucide-react";
import {
  getCurrentRoadmap,
  currentWeekIndex,
  type RoadmapStatus,
} from "@/lib/roadmap-store";

const STATUS_DOT: Record<RoadmapStatus, string> = {
  not_started: "bg-white/35",
  in_progress: "bg-sky-400",
  pending_review: "bg-amber-400",
  implemented: "bg-emerald-400",
};

const STATUS_LABEL: Record<RoadmapStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  pending_review: "Pending review",
  implemented: "Implemented",
};

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
  const currentTasks = roadmap.tasks
    .filter((t) => t.week === week)
    .sort((a, b) => a.order - b.order);
  const inFlight = currentTasks.filter((t) => t.status === "in_progress");
  const pendingReview = currentTasks.filter(
    (t) => t.status === "pending_review",
  );
  const summary = `Week ${week >= 1 && week <= 12 ? week : "—"} of 12 · ${currentTasks.length} task${currentTasks.length === 1 ? "" : "s"}${inFlight.length > 0 ? ` · ${inFlight.length} in flight` : ""}${pendingReview.length > 0 ? ` · ${pendingReview.length} pending review` : ""}`;

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
      {currentTasks.slice(0, 3).map((t) => (
        <Link
          key={t.id}
          href={`/seo/${slug}/roadmap`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1 text-[11px] text-white/75 transition hover:border-white/25 hover:bg-white/[0.05] hover:text-white"
          title={`${STATUS_LABEL[t.status]} — ${t.title}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status]}`}
            aria-hidden
          />
          <span className="max-w-[16rem] truncate">{t.title}</span>
        </Link>
      ))}
      {currentTasks.length > 3 && (
        <span className="text-[11px] text-white/45">
          +{currentTasks.length - 3} more
        </span>
      )}
    </div>
  );
}
