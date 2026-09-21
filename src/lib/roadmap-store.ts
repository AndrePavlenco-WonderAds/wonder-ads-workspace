// Per-client SEO Roadmap (3–12 calendar months) — operational
// Kanban-style state.
//
// Distinct from the `client-roadmap` action which produces a narrative
// markdown deliverable for the client. This is the INTERNAL execution
// view the consultant works against day-to-day: tasks bucketed by week,
// status colour-coded, current-week highlighted by `startDate` offset.
//
// One "current" roadmap per client at a time. When the consultant
// regenerates (typically when a package renews), the previous one is
// pushed to the archive so the history stays auditable.

import { kv } from "@vercel/kv";
import { getAdminRecord } from "./admin-clients-store";

const CURRENT_PREFIX = "roadmap:current:";
const ARCHIVE_PREFIX = "roadmap:archive:";
const MAX_ARCHIVE = 12; // ~3 years of quarterly roadmaps

// ---------- Horizon: CALENDAR months, derived weeks ----------
//
// v77.42 — the plan's length is a number of CALENDAR months, anchored to
// `startDate`. Until now a "month" was a fixed 4-week block (28 days), so
// every month drifted 2–3 days short of the calendar and, after five of
// them, a 6-month package that began on 4 May was reading "Month 6" in
// late September and ending on 18 October instead of running into
// November. Weeks are still the unit the board works in (one column per
// 7 days from `startDate`), but how many of them a plan has — and which
// month each one belongs to — now falls out of real dates:
//
//   • `months`  = the package length the client signed (3–12).
//   • end date  = startDate + `months` calendar months (exclusive).
//   • weeks     = every 7-day column that starts before the end date, so
//                 a 6-month plan is 26 or 27 weeks depending on the
//                 start date, never a flat 24.
//   • month k   = the weeks whose first day falls inside
//                 [startDate + k months, startDate + k+1 months). Months
//                 therefore hold 4 OR 5 week columns.
//
// Legacy blobs carry `weeks` (a multiple of 4) and no `months`; they are
// read as `weeks / 4` months and gain their missing calendar weeks on the
// spot. No task moves: week N still starts on the same date as before, so
// nothing written under the old model is lost or shifted.

/** A brand-new roadmap covers at least one quarter. */
export const MIN_ROADMAP_MONTHS = 3;
/** Hard ceiling: a full year. Keeps the board (and the KV blob) bounded
 *  no matter how many times the plan is extended. */
export const MAX_ROADMAP_MONTHS = 12;
/** The extension steps the consultant can pick, in months. Three sizes
 *  because three different situations: +1 closes out a plan that only
 *  needs a few more weeks, +3 is the ordinary quarterly renewal, and +6
 *  matches an account that already signed for a longer term — making
 *  that consultant click "+3" twice was busywork that also logged two
 *  extensions for one decision. */
export const ROADMAP_EXTEND_MONTHS = [1, 3, 6] as const;
/** Plan lengths offered when generating. The same terms the agency sells
 *  (see client-renewal-store), so a fresh roadmap can cover the whole
 *  package instead of one quarter of it. */
export const ROADMAP_GENERATE_MONTHS = [3, 6, 9, 12] as const;
/** Week count shown for a client with NO roadmap on file (admin tables).
 *  Display-only; a real roadmap always derives its own count. */
export const FALLBACK_TOTAL_WEEKS = 13;

const DAY_MS = 86_400_000;

function parseISO(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

function toISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `iso` plus `months` calendar months, keeping the day-of-month when it
 *  exists in the target month and clamping to its last day otherwise
 *  (31 Jan + 1 → 28/29 Feb). Negative `months` walks backwards. */
export function addCalendarMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** The plan's length in calendar months, clamped into [MIN, MAX].
 *  Reads `months` when present; falls back to the legacy 4-week `weeks`
 *  field (`24 → 6`), and to one quarter when neither is set. */
export function roadmapMonthCount(
  roadmap: Pick<Roadmap, "months" | "weeks">,
): number {
  const raw =
    typeof roadmap.months === "number" && Number.isFinite(roadmap.months)
      ? Math.round(roadmap.months)
      : typeof roadmap.weeks === "number" && Number.isFinite(roadmap.weeks)
        ? Math.round(roadmap.weeks / 4)
        : MIN_ROADMAP_MONTHS;
  return Math.max(MIN_ROADMAP_MONTHS, Math.min(MAX_ROADMAP_MONTHS, raw));
}

type Horizon = Pick<Roadmap, "startDate" | "months" | "weeks">;

/** Month count after growing the plan by `add` months, capped at a year. */
export function monthsAfterExtend(current: number, add: number): number {
  return Math.min(MAX_ROADMAP_MONTHS, current + add);
}

/** Month count after cutting `remove` months off the end, floored at the
 *  one-quarter minimum. */
export function monthsAfterRemove(current: number, remove: number): number {
  return Math.max(MIN_ROADMAP_MONTHS, current - remove);
}

/** First day AFTER the plan (exclusive end): startDate + months. */
export function roadmapEndDate(roadmap: Horizon): string {
  return addCalendarMonths(roadmap.startDate, roadmapMonthCount(roadmap));
}

/** The plan's last day (inclusive) — what "ends on" means to a human. */
export function roadmapLastDay(roadmap: Horizon): string {
  const end = parseISO(roadmapEndDate(roadmap));
  if (Number.isNaN(end)) return roadmap.startDate;
  return toISO(end - DAY_MS);
}

/** How many 7-day week columns the plan has: every week that STARTS
 *  before the end date. 13–14 for a quarter, 26–27 for six months, 52–53
 *  for a year — the exact number depends on the start date. */
export function roadmapWeeks(roadmap: Horizon): number {
  const months = roadmapMonthCount(roadmap);
  const start = parseISO(roadmap.startDate);
  const end = parseISO(addCalendarMonths(roadmap.startDate, months));
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    // Unparseable start date (never written by normaliseRoadmap, but KV
    // is KV): fall back to the average month length.
    return Math.ceil((months * 30.4375) / 7);
  }
  return Math.max(1, Math.ceil((end - start) / (7 * DAY_MS)));
}

export type RoadmapMonth = {
  /** "Month 3" */
  name: string;
  /** 0-based. */
  index: number;
  /** The week numbers whose first day falls inside this month (4 or 5). */
  weeks: number[];
  /** ISO — first day of the month bucket. */
  start: string;
  /** ISO — last day of the month bucket (inclusive). */
  end: string;
};

/** Group a roadmap's weeks into its calendar months for the board /
 *  report grids. Month k covers [startDate + k months, startDate + k+1
 *  months) and owns every week that begins inside that window. */
export function roadmapMonths(roadmap: Horizon): RoadmapMonth[] {
  const monthCount = roadmapMonthCount(roadmap);
  const totalWeeks = roadmapWeeks(roadmap);
  const bounds: number[] = [];
  for (let k = 0; k <= monthCount; k++) {
    bounds.push(parseISO(addCalendarMonths(roadmap.startDate, k)));
  }
  const out: RoadmapMonth[] = [];
  for (let k = 0; k < monthCount; k++) {
    out.push({
      name: `Month ${k + 1}`,
      index: k,
      weeks: [],
      start: toISO(bounds[k]),
      end: toISO(bounds[k + 1] - DAY_MS),
    });
  }
  for (let w = 1; w <= totalWeeks; w++) {
    const ws = parseISO(weekStartDate(roadmap, w));
    let k = out.findIndex((_, i) => ws >= bounds[i] && ws < bounds[i + 1]);
    if (k < 0) k = out.length - 1; // unparseable dates: park in the last month
    out[k].weeks.push(w);
  }
  return out;
}

/** 1-based calendar month a week column belongs to. 0 before the plan
 *  (week 0), `months + 1` once past its last week. */
export function monthIndexOfWeek(roadmap: Horizon, week: number): number {
  if (week < 1) return 0;
  const months = roadmapMonths(roadmap);
  const hit = months.find((m) => m.weeks.includes(week));
  return hit ? hit.index + 1 : months.length + 1;
}

/** Whole calendar months of the plan already behind us at `now`: 0 during
 *  month 1, 4 once the day that starts month 5 arrives. Used for the
 *  "four months in" Situation Point reminder. */
export function roadmapMonthsElapsed(
  roadmap: Pick<Roadmap, "startDate">,
  now: number = Date.now(),
): number {
  let elapsed = 0;
  for (let k = 1; k <= MAX_ROADMAP_MONTHS + 1; k++) {
    const boundary = parseISO(addCalendarMonths(roadmap.startDate, k));
    if (Number.isNaN(boundary) || now < boundary) break;
    elapsed = k;
  }
  return elapsed;
}

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
  /** 1–totalWeeks — the FIRST week column the task lives in (its start). */
  week: number;
  /** Optional last week the task spans through, inclusive. When set and
   *  greater than `week`, the task is a multi-week task covering the whole
   *  range [week, endWeek] (e.g. a task added to Week 2 with endWeek 4
   *  runs Weeks 2–4). Undefined — or any value ≤ `week` — means an
   *  ordinary single-week task. Use {@link taskEndWeek} /
   *  {@link taskCoversWeek} instead of reading this field directly so the
   *  single-week fallback is handled consistently everywhere. */
  endWeek?: number;
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

/** Last week a task spans through (inclusive). Falls back to the task's
 *  start `week` for single-week tasks or any malformed `endWeek`. */
export function taskEndWeek(
  task: Pick<RoadmapTask, "week" | "endWeek">,
): number {
  const e = task.endWeek;
  if (typeof e !== "number" || !Number.isFinite(e)) return task.week;
  return Math.max(task.week, Math.floor(e));
}

/** How many week columns a task occupies (1 for a single-week task). */
export function taskSpanWeeks(
  task: Pick<RoadmapTask, "week" | "endWeek">,
): number {
  return taskEndWeek(task) - task.week + 1;
}

/** True when week `w` falls inside the task's span [week, endWeek]. */
export function taskCoversWeek(
  task: Pick<RoadmapTask, "week" | "endWeek">,
  w: number,
): boolean {
  return w >= task.week && w <= taskEndWeek(task);
}

export type RoadmapSourcePhoto = {
  /** Vercel Blob URL — same one the consultant uploaded via @vercel/blob/client. */
  url: string;
  /** Original file name (decoded from the URL pathname). */
  name: string;
};

export type Roadmap = {
  id: string;
  clientSlug: string;
  /** Length of the plan in CALENDAR months, between
   *  {@link MIN_ROADMAP_MONTHS} and {@link MAX_ROADMAP_MONTHS}. The source
   *  of truth for the horizon since v77.42: the week count and the month
   *  grid derive from `startDate + months` (see {@link roadmapWeeks} /
   *  {@link roadmapMonths}). Optional only for blobs written before that
   *  version — {@link roadmapMonthCount} reads `weeks / 4` for those. */
  months?: number;
  /** LEGACY (pre-v77.42): total weeks as a multiple of 4. Still written
   *  on every save as the DERIVED week count so older readers keep
   *  working, but never read when `months` is present. */
  weeks?: number;
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

/** A data de onboarding em vigor para um cliente.
 *
 *  O campo `onboardingDate` do roadmap só existe nos blobs onde alguém o
 *  gravou à mão — na prática, um punhado deles. Toda a gente vinha sem a
 *  pastilha «Onboarded» na ficha, apesar de a data existir e estar certa na
 *  tabela de Clients do admin, que é onde a equipa a mantém.
 *
 *  Por isso a data resolve-se na LEITURA, com esta ordem:
 *    1. o que estiver gravado no roadmap (uma data afixada à mão ganha
 *       sempre — é o caso de quem teve o roadmap reiniciado a meio);
 *    2. a Starting date do registo de Clients (que já cai sozinha para os
 *       defaults em código quando ninguém lhe mexeu).
 *
 *  Nada é reescrito: a mesma decisão da v76.33 para os consultores que
 *  saíram — a leitura sabe compor a verdade sem tocar em dados gravados. */
export async function resolveOnboardingDate(
  slug: string,
  pinned: string | undefined,
): Promise<string | undefined> {
  if (pinned) return pinned;
  try {
    const record = await getAdminRecord(slug, "SEO", ["SEO"]);
    return record.startingDate ?? undefined;
  } catch {
    return undefined;
  }
}

export async function getCurrentRoadmap(slug: string): Promise<Roadmap | null> {
  if (!roadmapStorageConfigured) return null;
  try {
    const v = await kv.get<Roadmap>(currentKey(slug));
    if (!v) return null;
    return {
      ...v,
      onboardingDate: await resolveOnboardingDate(slug, v.onboardingDate),
    };
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
    months: MIN_ROADMAP_MONTHS,
    weeks: roadmapWeeks({ startDate: today, months: MIN_ROADMAP_MONTHS }),
    startDate: today,
    onboardingDate: await resolveOnboardingDate(slug, undefined),
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
 *  Returns 0 if the roadmap hasn't started yet, and a value above
 *  {@link roadmapWeeks} once it's already past. */
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

/** Sanitise an incoming Roadmap to the shape we trust. Used in the PUT
 *  route so consultant edits can't corrupt the KV blob. */
export function normaliseRoadmap(input: unknown, clientSlug: string): Roadmap {
  const raw = (input ?? {}) as Partial<Roadmap>;
  const now = Date.now();
  const startDate =
    typeof raw.startDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate)
      ? raw.startDate
      : nextMondayISO();
  const months = roadmapMonthCount(raw);
  const totalWeeks = roadmapWeeks({ startDate, months });
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newRoadmapId(),
    clientSlug,
    months,
    weeks: totalWeeks,
    startDate,
    onboardingDate:
      typeof raw.onboardingDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(raw.onboardingDate)
        ? raw.onboardingDate
        : undefined,
    generatedAt:
      typeof raw.generatedAt === "number" ? raw.generatedAt : now,
    tasks: Array.isArray(raw.tasks)
      ? raw.tasks
          .map((t, i) => normaliseTask(t, i, now, totalWeeks))
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
  maxWeek: number,
): RoadmapTask | null {
  const raw = (input ?? {}) as Partial<RoadmapTask>;
  if (!raw.title || typeof raw.title !== "string") return null;
  const week = Math.max(1, Math.min(maxWeek, Math.floor(Number(raw.week) || 1)));
  // endWeek is only kept when it's a real span (strictly after the start
  // week). Anything ≤ week collapses back to a single-week task (undefined)
  // so the "single vs multi" distinction is unambiguous downstream.
  const endWeekRaw = Math.floor(Number(raw.endWeek));
  const endWeek =
    Number.isFinite(endWeekRaw) && endWeekRaw > week
      ? Math.min(maxWeek, endWeekRaw)
      : undefined;
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
    endWeek,
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
