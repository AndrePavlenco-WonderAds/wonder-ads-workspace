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

/** Default reminder cadence — SEO satisfaction is surveyed twice a year. */
export const DEFAULT_CADENCE_MONTHS = 6;
export const CADENCE_OPTIONS = [3, 6, 12] as const;

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
  /** Epoch ms the next survey should go out. */
  nextDueAt: number | null;
  cadenceMonths: number;
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
    cadenceMonths: DEFAULT_CADENCE_MONTHS,
    sends: [],
  };
}

function normalizeRecord(raw: Partial<NpsRecord> | null): NpsRecord {
  const submissions = Array.isArray(raw?.submissions) ? raw!.submissions : [];
  const meta = raw?.meta ?? emptyMeta();
  return {
    submissions,
    meta: {
      lastSentAt: meta.lastSentAt ?? null,
      nextDueAt: meta.nextDueAt ?? null,
      cadenceMonths: meta.cadenceMonths ?? DEFAULT_CADENCE_MONTHS,
      sends: Array.isArray(meta.sends) ? meta.sends : [],
    },
  };
}

/** Add N months to an epoch ms timestamp (calendar-aware). */
export function addMonths(fromMs: number, months: number): number {
  const d = new Date(fromMs);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
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
    nextDueAt: addMonths(nowMs, rec.meta.cadenceMonths),
  };
  if (npsStorageConfigured) {
    await kv.set(key(slug), { submissions, meta });
  }
  return submission;
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
    nextDueAt: addMonths(nowMs, rec.meta.cadenceMonths),
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
  cadenceMonths: number,
  nowMs: number,
): Promise<NpsMeta> {
  const rec = await getNpsRecord(slug);
  const anchor =
    rec.meta.lastSentAt ?? rec.submissions[0]?.submittedAt ?? nowMs;
  const meta: NpsMeta = {
    ...rec.meta,
    cadenceMonths,
    nextDueAt: addMonths(anchor, cadenceMonths),
  };
  if (npsStorageConfigured) {
    await kv.set(key(slug), { submissions: rec.submissions, meta });
  }
  return meta;
}
