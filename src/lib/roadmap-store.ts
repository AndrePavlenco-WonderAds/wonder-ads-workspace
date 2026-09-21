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

// ---------- Horizon: CALENDAR months, four "weeks" each ----------
//
// v77.42 made the plan's length a number of CALENDAR months anchored to
// `startDate` (a fixed 4-week "month" was 28 days, so a 6-month package
// that began on 4 May read "Month 6" in late September and ended on 18
// October instead of running into November). v77.43 fixes what that
// exposed: a calendar month holds ~4.35 seven-day weeks, so months were
// rendering with a 5th column. The model now is:
//
//   • `months`  = the package length the client signed (3–12).
//   • end date  = startDate + `months` calendar months (exclusive).
//   • month k   = [startDate + k months, startDate + k+1 months).
//   • weeks     = EXACTLY four per month (`months × 4`): weeks 1–3 of a
//                 month are 7 days, week 4 runs to the month's last day
//                 (8–10 days; 7 only in a 28-day month). Week N sits in
//                 month ⌊(N−1)/4⌋ and starts 7·((N−1) mod 4) days into it.
//
// So "Month 5 of 6" is a real calendar month, the 6-month plan ends when
// the contract ends, and the board never shows a fifth column.
//
// Legacy blobs: `weeks` (a multiple of 4) without `months` is read as
// `weeks / 4` months. Blobs without `weekModel` (everything written before
// v77.43, including v77.42's 7-day weeks) have their task indexes remapped
// ON READ by date — each task lands in the week whose span contains the
// day it used to start on — so nothing moves on the calendar. Nothing is
// rewritten in KV until the consultant's next save.

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
export const FALLBACK_TOTAL_WEEKS = 12;
/** Weeks per calendar month — every month of the plan has exactly four
 *  week columns (see the header comment for how the 4th absorbs the
 *  month's remaining days). */
export const WEEKS_PER_MONTH = 4;
/** Marker on a blob whose task week indexes follow the month-quarter
 *  model. Blobs without it (pre-v77.43) index weeks as 7-day steps from
 *  `startDate` and are remapped on read — see {@link migrateWeekModel}. */
export const WEEK_MODEL_MONTH_QUARTERS = 2;

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

/** How many week columns the plan has: always four per calendar month —
 *  12 for a quarter, 24 for six months, 48 for a year. */
export function roadmapWeeks(roadmap: Pick<Roadmap, "months" | "weeks">): number {
  return roadmapMonthCount(roadmap) * WEEKS_PER_MONTH;
}

/** Epoch ms of the first day of calendar month `k` (0-based) of the plan.
 *  Beyond the plan (k ≥ months) it keeps counting real months, which is
 *  what "past the horizon" arithmetic needs. NaN for a broken startDate. */
function monthStartMs(startDate: string, k: number): number {
  return parseISO(addCalendarMonths(startDate, k));
}

/** ISO date of the FIRST day of week N (1-indexed): week N sits in month
 *  ⌊(N−1)/4⌋ and starts 7·((N−1) mod 4) days into it. */
export function weekStartDate(
  roadmap: Pick<Roadmap, "startDate">,
  weekIndex: number,
): string {
  const n = Math.max(1, Math.floor(weekIndex));
  const k = Math.floor((n - 1) / WEEKS_PER_MONTH);
  const j = (n - 1) % WEEKS_PER_MONTH;
  const monthStart = monthStartMs(roadmap.startDate, k);
  if (Number.isNaN(monthStart)) return roadmap.startDate;
  return toISO(monthStart + j * 7 * DAY_MS);
}

/** ISO date of the LAST day of week N (inclusive). Weeks 1–3 of a month
 *  are 7 days; week 4 runs to the day before the next month starts. */
export function weekEndDate(
  roadmap: Pick<Roadmap, "startDate">,
  weekIndex: number,
): string {
  const n = Math.max(1, Math.floor(weekIndex));
  const k = Math.floor((n - 1) / WEEKS_PER_MONTH);
  const j = (n - 1) % WEEKS_PER_MONTH;
  const monthStart = monthStartMs(roadmap.startDate, k);
  if (Number.isNaN(monthStart)) return roadmap.startDate;
  if (j < WEEKS_PER_MONTH - 1) {
    return toISO(monthStart + (j * 7 + 6) * DAY_MS);
  }
  return toISO(monthStartMs(roadmap.startDate, k + 1) - DAY_MS);
}

/** Days in week N: 7 for weeks 1–3 of a month, 7–10 for week 4. */
export function weekDayCount(
  roadmap: Pick<Roadmap, "startDate">,
  weekIndex: number,
): number {
  const a = parseISO(weekStartDate(roadmap, weekIndex));
  const b = parseISO(weekEndDate(roadmap, weekIndex));
  if (Number.isNaN(a) || Number.isNaN(b)) return 7;
  return Math.round((b - a) / DAY_MS) + 1;
}

/** 1-based index of the week whose span contains the instant `at`. 0
 *  before the plan starts; NOT clamped at the end — it keeps counting real
 *  months, so a value above {@link roadmapWeeks} means "past the horizon"
 *  and the difference says by how many weeks. */
export function weekIndexAt(
  roadmap: Pick<Roadmap, "startDate">,
  at: number,
): number {
  const start = parseISO(roadmap.startDate);
  if (Number.isNaN(start) || at < start) return 0;
  // Walk month boundaries from the start; five years is far beyond any
  // plan and any "past horizon" a consultant will still be looking at.
  for (let k = 0; k < 60; k++) {
    const next = monthStartMs(roadmap.startDate, k + 1);
    if (Number.isNaN(next)) break;
    if (at < next) {
      const into = Math.floor(
        (at - monthStartMs(roadmap.startDate, k)) / (7 * DAY_MS),
      );
      return k * WEEKS_PER_MONTH + Math.min(WEEKS_PER_MONTH - 1, into) + 1;
    }
  }
  return 60 * WEEKS_PER_MONTH + 1;
}

/** 1-based week index given the roadmap's startDate and a clock value.
 *  Returns 0 if the roadmap hasn't started yet, and a value above
 *  {@link roadmapWeeks} once it's already past. */
export function currentWeekIndex(
  roadmap: Pick<Roadmap, "startDate">,
  now: number = Date.now(),
): number {
  return weekIndexAt(roadmap, now);
}

export type RoadmapMonth = {
  /** "Month 3" */
  name: string;
  /** 0-based. */
  index: number;
  /** The month's four week numbers, e.g. [5, 6, 7, 8] for month 2. */
  weeks: number[];
  /** ISO — first day of the month. */
  start: string;
  /** ISO — last day of the month (inclusive). */
  end: string;
};

/** The plan's calendar months for the board / report grids. Month k
 *  covers [startDate + k months, startDate + k+1 months) and always owns
 *  weeks 4k+1 … 4k+4. */
export function roadmapMonths(roadmap: Horizon): RoadmapMonth[] {
  const monthCount = roadmapMonthCount(roadmap);
  const out: RoadmapMonth[] = [];
  for (let k = 0; k < monthCount; k++) {
    const a = monthStartMs(roadmap.startDate, k);
    const b = monthStartMs(roadmap.startDate, k + 1);
    out.push({
      name: `Month ${k + 1}`,
      index: k,
      weeks: Array.from(
        { length: WEEKS_PER_MONTH },
        (_, j) => k * WEEKS_PER_MONTH + j + 1,
      ),
      start: Number.isNaN(a) ? roadmap.startDate : toISO(a),
      end: Number.isNaN(b) ? roadmap.startDate : toISO(b - DAY_MS),
    });
  }
  return out;
}

/** 1-based calendar month a week column belongs to. 0 before the plan
 *  (week 0), `months + 1` once past its last week. */
export function monthIndexOfWeek(roadmap: Horizon, week: number): number {
  if (week < 1) return 0;
  const months = roadmapMonthCount(roadmap);
  const k = Math.floor((week - 1) / WEEKS_PER_MONTH) + 1;
  return k > months ? months + 1 : k;
}

/** The day week N meant under the 7-day model (pre-v77.43): startDate +
 *  7·(N−1) days. Only used to migrate old blobs. */
function legacyWeekDateMs(startDate: string, week: number): number {
  return parseISO(startDate) + (Math.max(1, Math.floor(week)) - 1) * 7 * DAY_MS;
}

/** Remap a blob written under the 7-day week model to month-quarter
 *  indexes, BY DATE: each task lands in the week whose span contains the
 *  day it used to start on, so nothing moves on the calendar. Two old
 *  weeks can share one new bucket (a month's 5th seven-day step folds
 *  into its week 4). Idempotent — a blob already carrying the marker is
 *  returned as is. Pure; the caller decides whether to persist. */
export function migrateWeekModel(roadmap: Roadmap): Roadmap {
  if (roadmap.weekModel === WEEK_MODEL_MONTH_QUARTERS) return roadmap;
  const total = roadmapWeeks(roadmap);
  const clampIdx = (ms: number): number =>
    Math.max(1, Math.min(total, weekIndexAt(roadmap, ms) || 1));
  const tasks = (Array.isArray(roadmap.tasks) ? roadmap.tasks : []).map(
    (t) => {
      const week = clampIdx(legacyWeekDateMs(roadmap.startDate, t.week));
      let endWeek: number | undefined;
      if (
        typeof t.endWeek === "number" &&
        Number.isFinite(t.endWeek) &&
        t.endWeek > t.week
      ) {
        const e = clampIdx(legacyWeekDateMs(roadmap.startDate, t.endWeek));
        if (e > week) endWeek = e;
      }
      return { ...t, week, endWeek };
    },
  );
  return {
    ...roadmap,
    weekModel: WEEK_MODEL_MONTH_QUARTERS,
    weeks: total,
    tasks,
  };
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
   *  on every save as the DERIVED week count (`months × 4`) so older
   *  readers keep working, but never read when `months` is present. */
  weeks?: number;
  /** Which week-index model the task `week` numbers follow. Absent =
   *  7-day steps from `startDate` (pre-v77.43) → remapped on read by
   *  {@link migrateWeekModel}. {@link WEEK_MODEL_MONTH_QUARTERS} = four
   *  weeks per calendar month. */
  weekModel?: number;
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
    // Week-model migration happens here, on the read path, so every
    // consumer (board, previews, admin, notifications) sees month-quarter
    // indexes without any blob having been rewritten.
    return migrateWeekModel({
      ...v,
      onboardingDate: await resolveOnboardingDate(slug, v.onboardingDate),
    });
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
    weeks: roadmapWeeks({ months: MIN_ROADMAP_MONTHS }),
    weekModel: WEEK_MODEL_MONTH_QUARTERS,
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
    return Array.isArray(v)
      ? v.filter((r) => r && typeof r === "object").map(migrateWeekModel)
      : [];
  } catch {
    return [];
  }
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
  const totalWeeks = roadmapWeeks({ months });
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newRoadmapId(),
    clientSlug,
    months,
    weeks: totalWeeks,
    // Only a client that already speaks the month-quarter model sends the
    // marker. A stale tab (older JS) sends 7-day indexes without it; the
    // blob is stored unflagged and remapped again on the next read.
    weekModel:
      raw.weekModel === WEEK_MODEL_MONTH_QUARTERS
        ? WEEK_MODEL_MONTH_QUARTERS
        : undefined,
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
