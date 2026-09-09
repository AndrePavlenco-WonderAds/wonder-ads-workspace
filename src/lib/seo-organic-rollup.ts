// Department-wide organic-visitor rollup for the SEO landing page (v77.14).
//
// Why this module replaced the old `getSeoOrganicVisitors30d` in ga4.ts:
// that version fired ~20 live GA4 calls at once, each under a 12 s timeout
// that ALSO covered the cold-start property-index build, swallowed every
// failure, and cached whatever sum survived in the Data Cache for 30 min.
// On a bad minute (429 from Google, slow index build on a fresh lambda) two
// thirds of the clients dropped out and the badge sat at 3–4k instead of
// 12–13k until the cache rolled over. A partial sum was being served as
// the truth.
//
// Now:
//  - the numbers live in ONE KV snapshot, per client, with the previous
//    30-day window and a daily series alongside;
//  - the page renders from the snapshot instantly and, when it's older
//    than 30 min, refreshes it AFTER the response (next/server `after`)
//    under a KV lock — never on the render path, never twice at once;
//  - the refresh warms the GA4 index first, runs 4 clients at a time and
//    retries 429/5xx with backoff;
//  - a client whose fetch still fails keeps its last known good value (for
//    up to 7 days) instead of vanishing from the total, and a snapshot with
//    gaps is retried after 5 min instead of 30.

import { kv } from "@vercel/kv";
import { after } from "next/server";
import { googleAuthConfigured } from "./google-auth";
import {
  Ga4ApiError,
  resolveGa4Property,
  runReport,
  warmGa4Index,
} from "./ga4";

const SNAPSHOT_KEY = "seo:organic-30d:snapshot";
const SNAPSHOT_TTL_S = 30 * 24 * 3600;
const LOCK_KEY = "seo:organic-30d:refresh-lock";
const LOCK_TTL_S = 180;
/** Age at which a complete snapshot is refreshed in the background. */
const FRESH_MS = 30 * 60_000;
/** Age at which a snapshot with gaps is retried. */
const RETRY_PARTIAL_MS = 5 * 60_000;
/** How long a client's last good value keeps counting when its fetch fails. */
const STALE_KEEP_MS = 7 * 24 * 60 * 60_000;
const CONCURRENCY = 4;
const PER_CLIENT_TIMEOUT_MS = 25_000;
const DAYS = 30;

const kvConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

type ClientValue = {
  /** Organic-search users, last 30 days. */
  users: number;
  /** Same metric, the 30 days before that. */
  prevUsers: number;
  /** Organic-search sessions per day, oldest → yesterday (30 entries). */
  daily: number[];
  /** When this value was fetched. */
  at: number;
};

type Snapshot = {
  v: 1;
  computedAt: number;
  perClient: Record<string, ClientValue>;
  /** Fetch failed in the last refresh — kept their previous value, if any. */
  failed: string[];
  /** No GA4 property resolved in the last refresh — nothing to count. */
  noProperty: string[];
};

export type SeoOrganicClient = {
  slug: string;
  users: number;
  prevUsers: number;
  /** True when the number was carried over from an earlier refresh. */
  stale: boolean;
};

export type SeoOrganicRollup = {
  /** False when the Google service account isn't configured at all. */
  configured: boolean;
  /** Sum of organic-search users, last 30 days, over the requested slugs. */
  total: number;
  /** Same sum for the previous 30-day window. */
  prevTotal: number;
  /** Daily organic sessions summed across clients, oldest → yesterday. */
  daily: number[];
  clientsWithData: number;
  clientsStale: number;
  computedAt: number | null;
  perClient: SeoOrganicClient[];
};

const EMPTY: SeoOrganicRollup = {
  configured: true,
  total: 0,
  prevTotal: 0,
  daily: Array.from({ length: DAYS }, () => 0),
  clientsWithData: 0,
  clientsStale: 0,
  computedAt: null,
  perClient: [],
};

/** Organic-search visitors (GA4 `totalUsers`, Organic Search channel, last
 *  30 days) across the given SEO clients, from the KV snapshot. Fast on the
 *  render path: the only await is one KV read, except on the very first
 *  call ever, which builds the snapshot inline so the page has something
 *  real to show. */
export async function getSeoOrganicVisitors30d(
  slugs: string[],
): Promise<SeoOrganicRollup> {
  if (!googleAuthConfigured) return { ...EMPTY, configured: false };

  if (!kvConfigured) {
    // No KV (local dev without env): compute inline, nothing to persist.
    return summarize(await refreshSnapshot(slugs, null), slugs);
  }

  const snapshot = await readSnapshot();
  if (!snapshot) {
    return summarize(await refreshSnapshot(slugs, null), slugs);
  }

  if (needsRefresh(snapshot, slugs)) {
    try {
      after(() =>
        refreshSnapshot(slugs, snapshot).catch((err) => {
          console.error("seo-organic-rollup: background refresh failed:", err);
        }),
      );
    } catch {
      /* outside a request scope — serve the snapshot, refresh next time */
    }
  }
  return summarize(snapshot, slugs);
}

function needsRefresh(snapshot: Snapshot, slugs: string[]): boolean {
  const age = Date.now() - snapshot.computedAt;
  const hasGaps = snapshot.failed.length > 0;
  if (age > (hasGaps ? RETRY_PARTIAL_MS : FRESH_MS)) return true;
  // A client that is new to the board and hasn't been looked at yet.
  const seen = new Set([
    ...Object.keys(snapshot.perClient),
    ...snapshot.failed,
    ...snapshot.noProperty,
  ]);
  return slugs.some((s) => !seen.has(s));
}

function summarize(snapshot: Snapshot, slugs: string[]): SeoOrganicRollup {
  const perClient: SeoOrganicClient[] = [];
  const daily = Array.from({ length: DAYS }, () => 0);
  let total = 0;
  let prevTotal = 0;
  let clientsStale = 0;
  for (const slug of slugs) {
    const v = snapshot.perClient[slug];
    if (!v || typeof v.users !== "number") continue;
    const stale = v.at < snapshot.computedAt;
    total += v.users;
    prevTotal += v.prevUsers;
    if (stale) clientsStale += 1;
    (Array.isArray(v.daily) ? v.daily : []).forEach((n, i) => {
      if (i < DAYS && typeof n === "number") daily[i] += n;
    });
    perClient.push({ slug, users: v.users, prevUsers: v.prevUsers, stale });
  }
  return {
    configured: true,
    total,
    prevTotal,
    daily,
    clientsWithData: perClient.length,
    clientsStale,
    computedAt: snapshot.computedAt,
    perClient,
  };
}

// --- Snapshot storage -------------------------------------------------------

async function readSnapshot(): Promise<Snapshot | null> {
  try {
    const raw = await kv.get<unknown>(SNAPSHOT_KEY);
    return isSnapshot(raw) ? raw : null;
  } catch (err) {
    console.error("seo-organic-rollup: KV read failed:", err);
    return null;
  }
}

async function writeSnapshot(snapshot: Snapshot): Promise<void> {
  if (!kvConfigured) return;
  try {
    await kv.set(SNAPSHOT_KEY, snapshot, { ex: SNAPSHOT_TTL_S });
  } catch (err) {
    console.error("seo-organic-rollup: KV write failed:", err);
  }
}

function isSnapshot(raw: unknown): raw is Snapshot {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return (
    r.v === 1 &&
    typeof r.computedAt === "number" &&
    typeof r.perClient === "object" &&
    r.perClient !== null &&
    Array.isArray(r.failed) &&
    Array.isArray(r.noProperty)
  );
}

async function acquireLock(): Promise<boolean> {
  if (!kvConfigured) return true;
  try {
    const res = await kv.set(LOCK_KEY, Date.now(), {
      nx: true,
      ex: LOCK_TTL_S,
    });
    return res === "OK";
  } catch {
    // A KV blip shouldn't stop a refresh — better twice than never.
    return true;
  }
}

async function releaseLock(): Promise<void> {
  if (!kvConfigured) return;
  try {
    await kv.del(LOCK_KEY);
  } catch {
    /* expires on its own */
  }
}

// --- Refresh ----------------------------------------------------------------

async function refreshSnapshot(
  slugs: string[],
  prev: Snapshot | null,
): Promise<Snapshot> {
  if (!(await acquireLock())) {
    // Another request is already refreshing — serve what we have.
    return prev ?? emptySnapshot();
  }
  try {
    await warmGa4Index();
    const results = await mapBounded(slugs, CONCURRENCY, fetchClient);
    const now = Date.now();
    const perClient: Record<string, ClientValue> = { ...(prev?.perClient ?? {}) };
    const failed: string[] = [];
    const noProperty: string[] = [];
    slugs.forEach((slug, i) => {
      const r = results[i];
      if (r.kind === "ok") {
        perClient[slug] = { ...r.value, at: now };
      } else if (r.kind === "no-property") {
        noProperty.push(slug);
        delete perClient[slug];
      } else {
        failed.push(slug);
        const old = perClient[slug];
        if (old && now - old.at > STALE_KEEP_MS) delete perClient[slug];
      }
    });
    // Clients no longer on the board (paused, removed) leave the snapshot.
    const wanted = new Set(slugs);
    for (const slug of Object.keys(perClient)) {
      if (!wanted.has(slug)) delete perClient[slug];
    }
    const snapshot: Snapshot = { v: 1, computedAt: now, perClient, failed, noProperty };
    await writeSnapshot(snapshot);
    if (failed.length > 0) {
      const reasons = slugs
        .map((slug, i) => {
          const r = results[i];
          return r.kind === "failed" ? `${slug} (${r.reason})` : null;
        })
        .filter(Boolean)
        .join(", ");
      console.warn(
        `seo-organic-rollup: ${failed.length}/${slugs.length} clients failed — ${reasons}`,
      );
    }
    return snapshot;
  } finally {
    await releaseLock();
  }
}

function emptySnapshot(): Snapshot {
  return { v: 1, computedAt: 0, perClient: {}, failed: [], noProperty: [] };
}

type FetchResult =
  | { kind: "ok"; value: Omit<ClientValue, "at"> }
  | { kind: "no-property" }
  | { kind: "failed"; reason: string };

async function fetchClient(slug: string): Promise<FetchResult> {
  try {
    const r = await withTimeout(fetchClientInner(slug), PER_CLIENT_TIMEOUT_MS);
    return r ?? { kind: "failed", reason: "timeout" };
  } catch (err) {
    return {
      kind: "failed",
      reason: err instanceof Error ? err.message.slice(0, 120) : "error",
    };
  }
}

const ORGANIC_FILTER = {
  filter: {
    fieldName: "sessionDefaultChannelGroup",
    stringFilter: { value: "Organic Search", matchType: "EXACT" },
  },
};

async function fetchClientInner(slug: string): Promise<FetchResult> {
  const resolved = await resolveGa4Property(slug);
  if (!resolved) return { kind: "no-property" };
  const { token, propertyId } = resolved;

  const [totals, trend] = await Promise.all([
    withRetry(() =>
      runReport(token, propertyId, {
        dateRanges: [
          { startDate: `${DAYS}daysAgo`, endDate: "yesterday" },
          { startDate: `${2 * DAYS}daysAgo`, endDate: `${DAYS + 1}daysAgo` },
        ],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: ORGANIC_FILTER,
      }),
    ),
    withRetry(() =>
      runReport(token, propertyId, {
        dateRanges: [{ startDate: `${DAYS}daysAgo`, endDate: "yesterday" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }],
        dimensionFilter: ORGANIC_FILTER,
        limit: 100,
      }),
    ),
  ]);

  return {
    kind: "ok",
    value: {
      users: rangeValue(totals, "date_range_0"),
      prevUsers: rangeValue(totals, "date_range_1"),
      daily: dailySeries(trend),
    },
  };
}

type Row = {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
};

/** With two date ranges GA4 adds a `dateRange` dimension to each row; a
 *  range with zero traffic simply has no row → 0. */
function rangeValue(rows: Row[], range: string): number {
  const row = rows.find((r) => r.dimensionValues?.[0]?.value === range);
  const n = Number(row?.metricValues?.[0]?.value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** 30 entries, oldest → yesterday (UTC calendar), gaps filled with 0. */
function dailySeries(rows: Row[]): number[] {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    const date = r.dimensionValues?.[0]?.value;
    const n = Number(r.metricValues?.[0]?.value ?? 0);
    if (date && Number.isFinite(n)) byDate.set(date, Math.round(n));
  }
  const out: number[] = [];
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1); // yesterday
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10).replace(/-/g, "");
    out.push(byDate.get(key) ?? 0);
  }
  return out;
}

// --- Small async helpers ----------------------------------------------------

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const backoff = [500, 1500, 3500];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err instanceof Ga4ApiError ? err.status : null;
      const transient = status === null || status === 429 || status >= 500;
      const wait = backoff[attempt];
      if (!transient || wait === undefined) throw err;
      await sleep(wait);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolves to null on timeout. The timer is cleared either way so it never
 *  keeps the function alive after the work is done. */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Bounded worker pool — results keep the input order. */
async function mapBounded<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return out;
}
