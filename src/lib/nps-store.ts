// Per-client SEO satisfaction survey store ("NPS quiz").
//
// One KV blob per client (slug-keyed) holding the full submission history
// plus the send/cadence metadata (when the last link was sent, when the
// next survey is due, and the reminder cadence in months).
//
// The public quiz form writes submissions via /api/nps/[slug]/submit (no
// auth — the slug is the share secret, same trust model as the Pending
// Review table). Consultants read the history on /seo/[slug]/nps and log a
// "send" via /api/nps/[slug]/send.

import { kv } from "@vercel/kv";
import { computeNpsScores, type NpsScores } from "@/lib/nps-questions";

const KEY_PREFIX = "nps:";
const MAX_SUBMISSIONS = 100;
const MAX_SENDS = 100;
const COMMENT_MAX = 4000;
const IDENT_MAX = 160;

/** Default reminder cadence — SEO satisfaction is surveyed every 60 days. */
export const DEFAULT_CADENCE_DAYS = 60;
export const CADENCE_OPTIONS = [30, 60, 90] as const;

export const npsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type NpsSubmission = {
  id: string;
  /** Epoch ms when the client submitted. */
  submittedAt: number;
  /** Raw answers, keyed by question name (13 rated + derived). */
  answers: Record<string, number>;
  comment: string | null;
  /** Free-form "Name — Company" the client optionally left. */
  identification: string | null;
  /** Consultant on the account at submit time (snapshot). */
  consultant: string | null;
  /** Derived scores, stored so the list view doesn't recompute. */
  scores: NpsScores;
};

export type NpsSend = {
  at: number;
  /** Employee name who logged the send, when known. */
  by: string | null;
};

export type NpsMeta = {
  lastSentAt: number | null;
  /** Epoch ms the next survey should go out. Derived on read from the last
   *  activity + cadence, so it always reflects the current cadence. */
  nextDueAt: number | null;
  cadenceDays: number;
  sends: NpsSend[];
};

export type NpsRecord = {
  submissions: NpsSubmission[];
  meta: NpsMeta;
};

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

function emptyMeta(): NpsMeta {
  return {
    lastSentAt: null,
    nextDueAt: null,
    cadenceDays: DEFAULT_CADENCE_DAYS,
    sends: [],
  };
}

function normalizeRecord(raw: Partial<NpsRecord> | null): NpsRecord {
  const submissions = Array.isArray(raw?.submissions) ? raw!.submissions : [];
  const meta = (raw?.meta ?? emptyMeta()) as Partial<NpsMeta>;
  const cadenceDays =
    typeof meta.cadenceDays === "number" ? meta.cadenceDays : DEFAULT_CADENCE_DAYS;
  const normMeta: NpsMeta = {
    lastSentAt: meta.lastSentAt ?? null,
    nextDueAt: meta.nextDueAt ?? null,
    cadenceDays,
    sends: Array.isArray(meta.sends) ? meta.sends : [],
  };
  // The next-due date is always derived from the latest activity so it
  // reflects the current cadence (and heals legacy month-based records).
  normMeta.nextDueAt = deriveNextDue(normMeta, submissions);
  return { submissions, meta: normMeta };
}

/** Add N days to an epoch ms timestamp. */
export function addDays(fromMs: number, days: number): number {
  return fromMs + days * 86_400_000;
}

/** Next survey due = last send (or last submission) + cadence. Null when
 *  the client has never been sent a survey and never answered one. */
function deriveNextDue(
  meta: Pick<NpsMeta, "lastSentAt" | "cadenceDays">,
  submissions: NpsSubmission[],
): number | null {
  const anchor = meta.lastSentAt ?? submissions[0]?.submittedAt ?? null;
  return anchor === null ? null : addDays(anchor, meta.cadenceDays);
}

export async function getNpsRecord(slug: string): Promise<NpsRecord> {
  if (!npsStorageConfigured) return normalizeRecord(null);
  try {
    const stored = await kv.get<Partial<NpsRecord>>(key(slug));
    return normalizeRecord(stored);
  } catch (err) {
    console.error("nps read failed:", err);
    return normalizeRecord(null);
  }
}

/** Most recent submission (submissions are stored newest-first). */
export async function getLatestNps(
  slug: string,
): Promise<NpsSubmission | null> {
  const rec = await getNpsRecord(slug);
  return rec.submissions[0] ?? null;
}

const DUE_WINDOW_MS = 3 * 86_400_000;

/** True when the consultant should act now: the survey was never sent (and
 *  never answered), or the next send is due within 3 days (or overdue).
 *  Drives the pulsing red NPS button on the client page. */
export function npsSendDue(record: NpsRecord, nowMs: number): boolean {
  const { meta, submissions } = record;
  const everEngaged = meta.lastSentAt !== null || submissions.length > 0;
  if (!everEngaged) return true;
  if (meta.nextDueAt === null) return true;
  return meta.nextDueAt - nowMs <= DUE_WINDOW_MS;
}

export type NewSubmission = {
  answers: Record<string, number>;
  comment?: string | null;
  identification?: string | null;
  consultant?: string | null;
};

/** Append a client submission. Recomputes scores server-side (never trust
 *  the client's math) and resets the cadence clock from the submit date. */
export async function addNpsSubmission(
  slug: string,
  input: NewSubmission,
  nowMs: number,
): Promise<NpsSubmission> {
  const rec = await getNpsRecord(slug);
  const scores = computeNpsScores(input.answers);
  const submission: NpsSubmission = {
    id: `nps_${nowMs}_${Math.floor((nowMs % 1000) + rec.submissions.length)}`,
    submittedAt: nowMs,
    answers: input.answers,
    comment: input.comment ? input.comment.slice(0, COMMENT_MAX) : null,
    identification: input.identification
      ? input.identification.slice(0, IDENT_MAX)
      : null,
    consultant: input.consultant ?? null,
    scores,
  };
  const submissions = [submission, ...rec.submissions].slice(0, MAX_SUBMISSIONS);
  const meta: NpsMeta = {
    ...rec.meta,
    // A completed survey resets the "next due" clock.
    nextDueAt: addDays(nowMs, rec.meta.cadenceDays),
  };
  if (npsStorageConfigured) {
    await kv.set(key(slug), { submissions, meta });
  }
  return submission;
}

/** Remove the most recent submission (the "last filled form"). Returns the
 *  removed submission, or null when there was nothing to remove. The
 *  next-due date is re-derived on the next read. SuperAdmin-only — the
 *  route enforces that; the store just does the mutation. */
export async function removeLatestNps(
  slug: string,
): Promise<NpsSubmission | null> {
  const rec = await getNpsRecord(slug);
  if (rec.submissions.length === 0) return null;
  const [removed, ...rest] = rec.submissions;
  if (npsStorageConfigured) {
    await kv.set(key(slug), { submissions: rest, meta: rec.meta });
  }
  return removed;
}

/** Log that the consultant sent the survey link, and schedule the next due
 *  date from now. */
export async function recordNpsSend(
  slug: string,
  by: string | null,
  nowMs: number,
): Promise<NpsMeta> {
  const rec = await getNpsRecord(slug);
  const sends = [{ at: nowMs, by }, ...rec.meta.sends].slice(0, MAX_SENDS);
  const meta: NpsMeta = {
    ...rec.meta,
    lastSentAt: nowMs,
    nextDueAt: addDays(nowMs, rec.meta.cadenceDays),
    sends,
  };
  if (npsStorageConfigured) {
    await kv.set(key(slug), { submissions: rec.submissions, meta });
  }
  return meta;
}

/** Change the reminder cadence and re-anchor the next-due date off the last
 *  send/submission (or now, if neither exists). */
export async function setNpsCadence(
  slug: string,
  cadenceDays: number,
  nowMs: number,
): Promise<NpsMeta> {
  const rec = await getNpsRecord(slug);
  const anchor =
    rec.meta.lastSentAt ?? rec.submissions[0]?.submittedAt ?? nowMs;
  const meta: NpsMeta = {
    ...rec.meta,
    cadenceDays,
    nextDueAt: addDays(anchor, cadenceDays),
  };
  if (npsStorageConfigured) {
    await kv.set(key(slug), { submissions: rec.submissions, meta });
  }
  return meta;
}
