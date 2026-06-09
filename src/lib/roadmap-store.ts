// Per-client 12-week SEO Roadmap — operational Kanban-style state.
//
// Distinct from the `client-roadmap` action which produces a narrative
// markdown deliverable for the client. This is the INTERNAL execution
// view the consultant works against day-to-day: tasks bucketed by week,
// status colour-coded, current-week highlighted by `startDate` offset.
//
// One "current" roadmap per client at a time. When the consultant
// regenerates (typically every 3 months / 12 weeks), the previous one is
// pushed to the archive so the history stays auditable.

import { kv } from "@vercel/kv";

const CURRENT_PREFIX = "roadmap:current:";
const ARCHIVE_PREFIX = "roadmap:archive:";
const MAX_ARCHIVE = 12; // ~3 years of quarterly roadmaps

export const roadmapStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export const ROADMAP_STATUSES = [
  "not_started",
  "in_progress",
  "pending_review",
  "implemented",
] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export const ROADMAP_PILLARS = [
  "technical",
  "on-page",
  "off-page",
  "local",
  "content",
  "research",
] as const;
export type RoadmapPillar = (typeof ROADMAP_PILLARS)[number];

export type RoadmapTask = {
  /** Stable random id. */
  id: string;
  /** 1–12 — which week column the task lives in. */
  week: number;
  title: string;
  description?: string;
  status: RoadmapStatus;
  pillar: RoadmapPillar;
  /** Sort order within the week column. Lower = higher up. */
  order: number;
  /** Epoch ms when status was last changed — drives warnings (e.g. tasks
   *  stuck in pending_review). */
  statusChangedAt: number;
  createdAt: number;
};

export type RoadmapSourcePhoto = {
  /** Vercel Blob URL — same one the consultant uploaded via @vercel/blob/client. */
  url: string;
  /** Original file name (decoded from the URL pathname). */
  name: string;
};

export type Roadmap = {
  id: string;
  clientSlug: string;
  /** ISO date (YYYY-MM-DD) — Monday of week 1 of THIS roadmap cycle.
   *  Distinct from `onboardingDate`: when a roadmap is regenerated /
   *  reset partway through the engagement, `startDate` moves to the
   *  Monday of the new Week 1 while `onboardingDate` stays pinned to
   *  the original agency-engagement date. */
  startDate: string;
  /** ISO date (YYYY-MM-DD) — when the client originally onboarded with
   *  the agency. Surfaced as a small "Onboarded: DD/MM/YYYY" chip on
   *  the board so the consultant always has the historical anchor
   *  even after the roadmap has been reset/regenerated. Optional;
   *  older roadmaps without it just don't show the chip. */
  onboardingDate?: string;
  /** Epoch ms — when this roadmap was first generated. */
  generatedAt: number;
  tasks: RoadmapTask[];
  /** Warning ids the consultant has dismissed. Recomputed on read so
   *  warnings that re-trigger from a different cause produce a fresh id. */
  dismissedWarnings: { id: string; dismissedAt: number }[];
  /** SEO-pro diagnosis the agent wrote before sequencing tasks. Short
   *  paragraph — surfaces what the agent saw in the site + photos.
   *  Optional (older roadmaps generated before v74.19 won't have it). */
  auditSummary?: string;
  /** Reference photos the consultant uploaded for this generation —
   *  preserved so the consultant can see what the plan was grounded in. */
  sourcePhotos?: RoadmapSourcePhoto[];
};

function currentKey(slug: string): string {
  return `${CURRENT_PREFIX}${slug}`;
}

function archiveKey(slug: string): string {
  return `${ARCHIVE_PREFIX}${slug}`;
}

export async function getCurrentRoadmap(slug: string): Promise<Roadmap | null> {
  if (!roadmapStorageConfigured) return null;
  try {
    const v = await kv.get<Roadmap>(currentKey(slug));
    return v ?? null;
  } catch (err) {
    console.error("roadmap read failed:", err);
    return null;
  }
}

/** Like getCurrentRoadmap but always returns a usable Roadmap — when no
 *  roadmap is on file yet, an empty one (12 blank weeks, today as
 *  startDate, no tasks) is created and persisted so the board renders
 *  immediately. Consultants click Generate to have Claude fill it in,
 *  but the grid works manually without any AI call too. */
export async function ensureRoadmap(slug: string): Promise<Roadmap> {
  const existing = await getCurrentRoadmap(slug);
  if (existing) return existing;
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
  const blank: Roadmap = {
    id: newRoadmapId(),
    clientSlug: slug,
    startDate: today,
    generatedAt: Date.now(),
    tasks: [],
    dismissedWarnings: [],
  };
  if (roadmapStorageConfigured) {
    try {
      await kv.set(currentKey(slug), blank);
    } catch (err) {
      console.error("roadmap blank-init failed:", err);
    }
  }
  return blank;
}

export async function saveCurrentRoadmap(roadmap: Roadmap): Promise<Roadmap> {
  if (!roadmapStorageConfigured) return roadmap;
  await kv.set(currentKey(roadmap.clientSlug), roadmap);
  return roadmap;
}

export async function archiveAndReplace(
  slug: string,
  next: Roadmap,
): Promise<Roadmap> {
  if (!roadmapStorageConfigured) return next;
  const existing = await getCurrentRoadmap(slug);
  if (existing) {
    try {
      const archive =
        (await kv.get<Roadmap[]>(archiveKey(slug))) ?? [];
      const updated = [existing, ...archive].slice(0, MAX_ARCHIVE);
      await kv.set(archiveKey(slug), updated);
    } catch (err) {
      console.error("roadmap archive failed:", err);
    }
  }
  await kv.set(currentKey(slug), next);
  return next;
}

export async function listArchivedRoadmaps(slug: string): Promise<Roadmap[]> {
  if (!roadmapStorageConfigured) return [];
  try {
    const v = await kv.get<Roadmap[]>(archiveKey(slug));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** 1-based week index given the roadmap's startDate and a clock value.
 *  Returns 0 if the roadmap hasn't started yet, and a value > 12 if it's
 *  already past. */
export function currentWeekIndex(
  roadmap: Pick<Roadmap, "startDate">,
  now: number = Date.now(),
): number {
  const start = new Date(roadmap.startDate + "T00:00:00Z").getTime();
  if (Number.isNaN(start)) return 0;
  const days = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  if (days < 0) return 0;
  return Math.floor(days / 7) + 1;
}

/** ISO date (YYYY-MM-DD) of the Monday of week N (1-indexed). */
export function weekStartDate(
  roadmap: Pick<Roadmap, "startDate">,
  weekIndex: number,
): string {
  const start = new Date(roadmap.startDate + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() + (weekIndex - 1) * 7);
  return start.toISOString().slice(0, 10);
}

/** Default starting date when generating a brand-new roadmap: the next
 *  Monday from `from` (or today if `from` is already a Monday). */
export function nextMondayISO(from: Date = new Date()): string {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const offset = dow === 1 ? 0 : (8 - dow) % 7;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function newRoadmapId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newTaskId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- Warnings ----------

export type RoadmapWarning = {
  /** Stable hash of the trigger so dismissals tie to the same cause. */
  id: string;
  severity: "info" | "warning" | "critical";
  message: string;
  /** Task ids the warning references — clicking the warning can scroll
   *  to / highlight these. */
  taskIds: string[];
};

const PENDING_REVIEW_DAY_THRESHOLD = 7;
const FALLING_BEHIND_TASK_THRESHOLD = 2;

/** Compute the warnings that should currently be shown for this roadmap.
 *  Pure function — given the roadmap and a clock value, returns the
 *  warnings the consultant would see now. The caller filters out the
 *  ones in `dismissedWarnings`. */
export function computeWarnings(
  roadmap: Roadmap,
  now: number = Date.now(),
): RoadmapWarning[] {
  const out: RoadmapWarning[] = [];
  const week = currentWeekIndex(roadmap, now);

  // Pending-review stalls: any task in pending_review for > N days.
  const stalledReviews = roadmap.tasks.filter((t) => {
    if (t.status !== "pending_review") return false;
    const days = Math.floor((now - t.statusChangedAt) / (1000 * 60 * 60 * 24));
    return days >= PENDING_REVIEW_DAY_THRESHOLD;
  });
  if (stalledReviews.length > 0) {
    const daysList = stalledReviews
      .map((t) => Math.floor((now - t.statusChangedAt) / (86400 * 1000)))
      .sort((a, b) => b - a);
    out.push({
      id: `stalled-review:${stalledReviews
        .map((t) => t.id)
        .sort()
        .join(",")}`,
      severity: "warning",
      message:
        stalledReviews.length === 1
          ? `1 task has been pending client review for ${daysList[0]} days — chase the approval.`
          : `${stalledReviews.length} tasks have been pending client review for ${daysList[0]}+ days — chase the approvals.`,
      taskIds: stalledReviews.map((t) => t.id),
    });
  }

  // Falling-behind: tasks NOT in `implemented` whose week is BEFORE the
  // current week. Excludes the current week itself (those are still in
  // play). Only flags when the backlog exceeds the threshold.
  //
  // v74.23.2: split the message by reason so the consultant can tell at
  // a glance "5 of these are stuck with the client, not with me" vs
  // "12 of these I never touched". The breakdown drives whether you
  // need to chase the client, sit down and do the work, or both.
  if (week >= 2) {
    const overdue = roadmap.tasks.filter(
      (t) => t.week < week && t.status !== "implemented",
    );
    if (overdue.length >= FALLING_BEHIND_TASK_THRESHOLD) {
      const stuckWithClient = overdue.filter(
        (t) => t.status === "pending_review",
      );
      const inFlight = overdue.filter((t) => t.status === "in_progress");
      const untouched = overdue.filter((t) => t.status === "not_started");
      const parts: string[] = [];
      if (stuckWithClient.length > 0) {
        parts.push(
          `${stuckWithClient.length} stuck with client (pending review)`,
        );
      }
      if (inFlight.length > 0) {
        parts.push(`${inFlight.length} still in progress`);
      }
      if (untouched.length > 0) {
        parts.push(`${untouched.length} not started yet`);
      }
      const breakdown = parts.length > 0 ? ` — ${parts.join(" · ")}.` : ".";
      out.push({
        id: `falling-behind:${overdue
          .map((t) => t.id)
          .sort()
          .join(",")}`,
        severity: overdue.length >= 5 ? "critical" : "warning",
        message: `${overdue.length} task${overdue.length === 1 ? "" : "s"} from past weeks aren't done yet${breakdown}`,
        taskIds: overdue.map((t) => t.id),
      });
    }
  }

  // Empty current week: useful early-warning when nothing is actively in
  // flight in the column you should be working on.
  if (week >= 1 && week <= 12) {
    const currentTasks = roadmap.tasks.filter((t) => t.week === week);
    const inFlight = currentTasks.filter(
      (t) => t.status === "in_progress" || t.status === "pending_review",
    );
    if (currentTasks.length === 0) {
      out.push({
        id: `empty-current-week:${week}`,
        severity: "info",
        message: `Week ${week} has no tasks scheduled — add something or pull work from a later week.`,
        taskIds: [],
      });
    } else if (inFlight.length === 0 && week <= 12) {
      out.push({
        id: `nothing-in-flight:${week}:${currentTasks.length}`,
        severity: "info",
        message: `Week ${week}: ${currentTasks.length} task${currentTasks.length === 1 ? "" : "s"} scheduled but nothing in flight yet.`,
        taskIds: currentTasks.map((t) => t.id),
      });
    }
  }

  return out;
}

/** Sanitise an incoming Roadmap to the shape we trust. Used in the PUT
 *  route so consultant edits can't corrupt the KV blob. */
export function normaliseRoadmap(input: unknown, clientSlug: string): Roadmap {
  const raw = (input ?? {}) as Partial<Roadmap>;
  const now = Date.now();
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newRoadmapId(),
    clientSlug,
    startDate:
      typeof raw.startDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate)
        ? raw.startDate
        : nextMondayISO(),
    onboardingDate:
      typeof raw.onboardingDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(raw.onboardingDate)
        ? raw.onboardingDate
        : undefined,
    generatedAt:
      typeof raw.generatedAt === "number" ? raw.generatedAt : now,
    tasks: Array.isArray(raw.tasks)
      ? raw.tasks
          .map((t, i) => normaliseTask(t, i, now))
          .filter((t): t is RoadmapTask => t !== null)
      : [],
    dismissedWarnings: Array.isArray(raw.dismissedWarnings)
      ? raw.dismissedWarnings
          .filter(
            (d): d is { id: string; dismissedAt: number } =>
              typeof d === "object" &&
              d !== null &&
              typeof (d as { id?: unknown }).id === "string" &&
              typeof (d as { dismissedAt?: unknown }).dismissedAt === "number",
          )
          .slice(0, 50)
      : [],
    auditSummary:
      typeof raw.auditSummary === "string" && raw.auditSummary.trim()
        ? raw.auditSummary.trim().slice(0, 2000)
        : undefined,
    sourcePhotos: Array.isArray(raw.sourcePhotos)
      ? raw.sourcePhotos
          .filter(
            (p): p is RoadmapSourcePhoto =>
              typeof p === "object" &&
              p !== null &&
              typeof (p as { url?: unknown }).url === "string" &&
              typeof (p as { name?: unknown }).name === "string",
          )
          .slice(0, 8)
      : undefined,
  };
}

function normaliseTask(
  input: unknown,
  fallbackOrder: number,
  now: number,
): RoadmapTask | null {
  const raw = (input ?? {}) as Partial<RoadmapTask>;
  if (!raw.title || typeof raw.title !== "string") return null;
  const week = Math.max(1, Math.min(12, Math.floor(Number(raw.week) || 1)));
  const status: RoadmapStatus =
    typeof raw.status === "string" &&
    (ROADMAP_STATUSES as readonly string[]).includes(raw.status)
      ? (raw.status as RoadmapStatus)
      : "not_started";
  const pillar: RoadmapPillar =
    typeof raw.pillar === "string" &&
    (ROADMAP_PILLARS as readonly string[]).includes(raw.pillar)
      ? (raw.pillar as RoadmapPillar)
      : "technical";
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newTaskId(),
    week,
    title: raw.title.trim().slice(0, 240),
    description:
      typeof raw.description === "string"
        ? raw.description.slice(0, 4000)
        : undefined,
    status,
    pillar,
    order:
      typeof raw.order === "number" && Number.isFinite(raw.order)
        ? raw.order
        : fallbackOrder,
    statusChangedAt:
      typeof raw.statusChangedAt === "number" ? raw.statusChangedAt : now,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
  };
}
