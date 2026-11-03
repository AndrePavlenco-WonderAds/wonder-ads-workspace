// Google Business Profile Performance integration for the Monthly Report.
//
// Auth: the SAME service account + domain-wide delegation used by GA4/GSC
// (google-auth.ts), impersonating GOOGLE_IMPERSONATE_SUBJECT (seo@wonder-ads.com)
// — who has access to every client's Business Profile. The only extra setup is
// the `business.manage` scope on the delegation + the three GBP APIs enabled +
// GBP API access approved by Google (see the report module docs).
//
// Location resolution: EVERY listing whose websiteUri host is the client's
// website is the client's (v78.65 — before, only the first match was pulled,
// so a 7-unit clinic reported one unit). The alphabetically-first one is the
// main listing unless `report-config.gbpLocationId` pins another; the rest
// come along as auto-discovered profiles, named after the unit. Listings with
// another (or no) website are added by hand in `extraGbpProfiles`. Any
// failure → status (the report falls back to manual GBP input, never a
// fabricated number).

import { kv } from "@vercel/kv";
import { getGoogleAccessToken, googleAuthConfigured } from "./google-auth";
import { CLIENT_WEBSITES } from "./client-meta";

const SCOPES = ["https://www.googleapis.com/auth/business.manage"];

// Persist the discovered location list in KV so a single successful listing is
// reused for days — the accounts/locations endpoints have a very low GBP quota
// and 429 under repeated calls, so we hit them as rarely as possible.
const kvConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);
const LOC_KV_KEY = "gbp:locations:all";
const LOC_KV_TTL_MS = 7 * 24 * 60 * 60_000;

const DAILY_METRICS = [
  "WEBSITE_CLICKS",
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
] as const;

type MetricPair = { value: number; previous: number | null };

type GbpMetrics = {
  websiteClicks: MetricPair;
  callClicks: MetricPair;
  directions: MetricPair;
};

/** The client's main listing: auto-matched by website host, or pinned.
 *  `label` is the unit's name (brand prefix stripped) and is only set when the
 *  client has more than one listing — a single listing needs no name. */
export type GbpMainReport =
  | { status: "not-configured" }
  | { status: "no-location" }
  | { status: "error"; message: string }
  | ({ status: "ok"; locationName: string; label?: string } & GbpMetrics);

/** One of the client's OTHER listings — another unit, a second brand. Either
 *  auto-discovered by website (id `L<locationId>`) or configured by hand
 *  (label + location id). Never "no-location": it answers or it errors. */
export type GbpExtraProfileReport =
  | { id: string; label: string; status: "error"; message: string }
  | ({ id: string; label: string; status: "ok"; locationName: string } & GbpMetrics);

export type GbpMonthlyReport = {
  main: GbpMainReport;
  /** Empty for the clients with a single listing (most of them). */
  profiles: GbpExtraProfileReport[];
};

/** Runtime guard: each listing costs two Performance API calls per report,
 *  fetched one listing at a time. 30 keeps a cold run under the generate
 *  route's budget; the biggest client today has 17. */
const MAX_AUTO_GBP_LOCATIONS = 30;

/** fetch that retries on Google's rate-limit / transient errors (429/503).
 *  The Business Profile APIs have a low default per-project quota, so the
 *  accounts + locations listing 429s easily; a short exponential backoff (with
 *  Retry-After honoured) gets low-volume calls through. Pinning a client's
 *  gbpLocationId avoids the listing entirely, which is the real fix at scale. */
async function fetchWithRetry(
  url: string | URL,
  init: RequestInit,
  retries = 3,
  baseDelayMs = 700,
): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, init);
    if ((res.status !== 429 && res.status !== 503) || attempt >= retries) {
      return res;
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : baseDelayMs * 2 ** attempt;
    await new Promise((r) => setTimeout(r, Math.min(wait, 8000)));
    attempt++;
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Normalise a stored location id to the API's "locations/<id>" resource name. */
function toLocationName(v: string): string {
  const id = v.replace(/^locations\//, "").trim();
  return `locations/${id}`;
}

// --- Location discovery (cached, best-effort) ------------------------------

type GbpLocation = { name: string; websiteUri?: string; title?: string };
let cachedLocations: { list: GbpLocation[]; expires: number } | null = null;

async function readKvLocations(): Promise<GbpLocation[] | null> {
  if (!kvConfigured) return null;
  try {
    const c = await kv.get<{ list: GbpLocation[]; ts: number }>(LOC_KV_KEY);
    if (c && Array.isArray(c.list) && Date.now() - c.ts < LOC_KV_TTL_MS) {
      return c.list;
    }
  } catch {
    /* KV miss / off — fall through to API */
  }
  return null;
}

async function writeKvLocations(list: GbpLocation[]): Promise<void> {
  if (!kvConfigured) return;
  try {
    await kv.set(LOC_KV_KEY, { list, ts: Date.now() });
  } catch {
    /* best-effort cache — never block on it */
  }
}

/** All locations the service account can see. Prefers the in-memory cache, then
 *  the KV cache (survives cold starts + the 30-min in-memory window), and only
 *  hits the rate-limited accounts/locations APIs as a last resort. `force`
 *  bypasses both caches for an explicit refresh. On a successful API listing the
 *  result is written to KV so future calls (and report generation) skip the API
 *  entirely — the durable fix for the low GBP quota. */
async function listAllLocations(
  token: string,
  force = false,
): Promise<GbpLocation[]> {
  if (!force) {
    if (cachedLocations && cachedLocations.expires > Date.now()) {
      return cachedLocations.list;
    }
    const kvList = await readKvLocations();
    if (kvList) {
      cachedLocations = { list: kvList, expires: Date.now() + 30 * 60_000 };
      return kvList;
    }
  }
  const out: GbpLocation[] = [];
  // 1) list accounts
  const accRes = await fetchWithRetry(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!accRes.ok) {
    const detail = accRes.status === 429 ? " (rate limit / quota da API GBP)" : "";
    throw new Error(`accounts ${accRes.status}${detail}`);
  }
  const accJson = (await accRes.json()) as { accounts?: { name?: string }[] };
  // 2) list locations per account
  for (const acc of accJson.accounts ?? []) {
    if (!acc.name) continue;
    let pageToken: string | undefined;
    do {
      const url = new URL(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations`,
      );
      url.searchParams.set("readMask", "name,title,websiteUri");
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const locRes = await fetchWithRetry(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!locRes.ok) break;
      const locJson = (await locRes.json()) as {
        locations?: GbpLocation[];
        nextPageToken?: string;
      };
      out.push(...(locJson.locations ?? []));
      pageToken = locJson.nextPageToken;
    } while (pageToken);
  }
  cachedLocations = { list: out, expires: Date.now() + 30 * 60_000 };
  await writeKvLocations(out);
  return out;
}

const bareId = (name: string) => name.replace(/^locations\//, "").trim();

/** Strip the brand prefix the client's listings share — "Physiohub Estoril",
 *  "Physiohub Expo" → "Estoril", "Expo"; "Cidália Cabeleireiros - Alegro
 *  Sintra" → "Alegro Sintra". The report lists every unit under a card that
 *  already says whose listings they are, so repeating the brand 14 times only
 *  buries the one word that differs. The prefix is cut at a word boundary
 *  only, and a title that IS the bare prefix ("Cidália Cabeleireiros", the
 *  flagship) keeps its full name. Exported for the config card. */
export function gbpUnitLabels(titles: string[]): string[] {
  const clean = titles.map((t) => t.trim() || "—");
  if (clean.length < 2) return clean;
  const SEP = /[\s\-–—·|:,/()]/;
  let prefix = clean[0];
  for (const t of clean.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < t.length && prefix[i] === t[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  // "Physiohub E" (Expo + Estoril) is not a prefix anyone would read: unless
  // every title ends or breaks right after it, back off to the last separator.
  const onBoundary = clean.every(
    (t) => t.length === prefix.length || SEP.test(t[prefix.length]),
  );
  if (!onBoundary) {
    let cut = prefix.length;
    while (cut > 0 && !SEP.test(prefix[cut - 1])) cut--;
    prefix = prefix.slice(0, cut);
  }
  if (prefix.trim().length < 3) return clean;
  return clean.map((t) => {
    const rest = t.slice(prefix.length).replace(/^[\s\-–—·|:,/]+/, "").trim();
    return rest || t;
  });
}

/** The listings whose website is the client's, alphabetical by title so the
 *  main one (first) is stable across cache refreshes — the API returns them
 *  in no particular order. */
function matchingLocations(list: GbpLocation[], host: string): GbpLocation[] {
  return list
    .filter((l) => l.websiteUri && hostOf(l.websiteUri) === host)
    .sort(
      (a, b) =>
        (a.title ?? "").localeCompare(b.title ?? "", "pt", { sensitivity: "base" }) ||
        a.name.localeCompare(b.name),
    );
}

export type GbpDiscoveredLocation = { id: string; title: string; label: string };

/** Which listings a report covers, from the location list: the main one
 *  (pinned, else the first by website match) plus every other website match
 *  that wasn't configured by hand. Pure, so the report build and the config
 *  card agree on it. */
function planLocations(
  list: GbpLocation[],
  host: string | null,
  pinned: string | null,
  manualIds: Set<string>,
): {
  main: (GbpDiscoveredLocation & { name: string; matched: boolean }) | null;
  auto: (GbpDiscoveredLocation & { name: string })[];
} {
  const matches = host ? matchingLocations(list, host) : [];
  const mainName = pinned ? toLocationName(pinned) : (matches[0]?.name ?? null);
  if (!mainName) return { main: null, auto: [] };
  const mainLoc = list.find((l) => l.name === mainName);
  const autoLocs = matches
    .filter((l) => l.name !== mainName && !manualIds.has(bareId(l.name)))
    .slice(0, MAX_AUTO_GBP_LOCATIONS);
  // Unit names are relative to each other: the shared brand prefix only
  // exists across the whole set, main included.
  const titled = [...(mainLoc ? [mainLoc] : []), ...autoLocs];
  const labels = gbpUnitLabels(titled.map((l) => l.title ?? bareId(l.name)));
  const labelOf = new Map(titled.map((l, i) => [l.name, labels[i]] as const));
  return {
    main: {
      id: bareId(mainName),
      name: mainName,
      title: mainLoc?.title ?? bareId(mainName),
      label: labelOf.get(mainName) ?? mainLoc?.title ?? bareId(mainName),
      matched: Boolean(mainLoc),
    },
    auto: autoLocs.map((l) => ({
      id: bareId(l.name),
      name: l.name,
      title: l.title ?? bareId(l.name),
      label: labelOf.get(l.name) ?? l.title ?? bareId(l.name),
    })),
  };
}

/** The listings the report will cover for a client, from the CACHED location
 *  list only — no API call, so the report page can show them on every render.
 *  null when nothing is cached yet (generating a report fills the cache). */
export async function discoverGbpLocationsForClient(
  slug: string,
  opts: { pinnedLocationId: string | null; manualLocationIds: string[] },
): Promise<{ main: GbpDiscoveredLocation | null; auto: GbpDiscoveredLocation[] } | null> {
  const host = CLIENT_WEBSITES[slug] ? hostOf(CLIENT_WEBSITES[slug]) : null;
  const list =
    cachedLocations && cachedLocations.expires > Date.now()
      ? cachedLocations.list
      : await readKvLocations();
  if (!list) return null;
  const plan = planLocations(
    list,
    host,
    opts.pinnedLocationId,
    new Set(opts.manualLocationIds.map(bareId)),
  );
  return {
    main: plan.main ? { id: plan.main.id, title: plan.main.title, label: plan.main.label } : null,
    auto: plan.auto.map(({ id, title, label }) => ({ id, title, label })),
  };
}

/** Diagnostic: every location the service account can see, with the exact
 *  websiteUri the auto-match compares against. Powers the admin GBP endpoint so
 *  a mismatch (wrong/missing website on a listing) is visible and the right
 *  location id can be pinned per client. Bypasses the location cache. */
export async function listGbpLocationsForDiagnostics(refresh = false): Promise<
  | { status: "not-configured" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      fromCache: boolean;
      locations: { id: string; title?: string; websiteUri?: string; websiteHost: string | null }[];
    }
> {
  if (!googleAuthConfigured) return { status: "not-configured" };
  try {
    // Serve from cache when we can (no API call, no 429). Only touch the API on
    // an explicit ?refresh=1 or when nothing is cached yet.
    let list: GbpLocation[] | null = null;
    if (!refresh) {
      list =
        cachedLocations && cachedLocations.expires > Date.now()
          ? cachedLocations.list
          : await readKvLocations();
    }
    const fromCache = list !== null;
    if (!list) {
      const token = await getGoogleAccessToken(SCOPES);
      list = await listAllLocations(token, true);
    }
    return {
      status: "ok",
      fromCache,
      locations: list.map((l) => ({
        id: l.name.replace(/^locations\//, ""),
        title: l.title,
        websiteUri: l.websiteUri,
        websiteHost: l.websiteUri ? hostOf(l.websiteUri) : null,
      })),
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "GBP request failed",
    };
  }
}

// --- Performance fetch ------------------------------------------------------

const ymd = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
};

/** Sum each daily metric over a range, returning a per-metric total. */
async function fetchRangeTotals(
  token: string,
  locationName: string,
  range: { startDate: string; endDate: string },
): Promise<Record<string, number>> {
  const url = new URL(
    `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries`,
  );
  for (const m of DAILY_METRICS) url.searchParams.append("dailyMetrics", m);
  const s = ymd(range.startDate);
  const e = ymd(range.endDate);
  url.searchParams.set("dailyRange.start_date.year", String(s.year));
  url.searchParams.set("dailyRange.start_date.month", String(s.month));
  url.searchParams.set("dailyRange.start_date.day", String(s.day));
  url.searchParams.set("dailyRange.end_date.year", String(e.year));
  url.searchParams.set("dailyRange.end_date.month", String(e.month));
  url.searchParams.set("dailyRange.end_date.day", String(e.day));

  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GBP performance ${res.status}. ${text.slice(0, 160)}`);
  }
  const json = (await res.json()) as {
    multiDailyMetricTimeSeries?: {
      dailyMetricTimeSeries?: {
        dailyMetric?: string;
        timeSeries?: { datedValues?: { value?: string }[] };
      }[];
    }[];
  };
  const totals: Record<string, number> = {};
  for (const multi of json.multiDailyMetricTimeSeries ?? []) {
    for (const series of multi.dailyMetricTimeSeries ?? []) {
      const metric = series.dailyMetric ?? "";
      const sum = (series.timeSeries?.datedValues ?? []).reduce(
        (t, d) => t + Number(d.value ?? 0),
        0,
      );
      totals[metric] = (totals[metric] ?? 0) + sum;
    }
  }
  return totals;
}

/** Current + previous month for one location, as the report's metric pairs. */
async function fetchLocationMetrics(
  token: string,
  locationName: string,
  windows: {
    current: { startDate: string; endDate: string };
    previous: { startDate: string; endDate: string };
  },
): Promise<GbpMetrics> {
  const [cur, prev] = await Promise.all([
    fetchRangeTotals(token, locationName, windows.current),
    fetchRangeTotals(token, locationName, windows.previous).catch(
      () => ({}) as Record<string, number>,
    ),
  ]);
  const pair = (metric: string): MetricPair => ({
    value: cur[metric] ?? 0,
    previous: metric in prev ? prev[metric] : null,
  });
  return {
    websiteClicks: pair("WEBSITE_CLICKS"),
    callClicks: pair("CALL_CLICKS"),
    directions: pair("BUSINESS_DIRECTION_REQUESTS"),
  };
}

/** GBP click metrics for a client over a calendar month vs. the prior month —
 *  the main listing, every other listing that shares the client's website
 *  (auto-discovered), plus any extra Business Profiles configured by hand.
 *  Returns a status the report can fall back on (manual input) when GBP isn't
 *  set up yet — never a fabricated zero.
 *
 *  Each profile fails on its own: one unit's listing erroring leaves the other
 *  units (and the main one) with real numbers. */
export async function getGbpMonthlyReport(
  slug: string,
  opts: {
    current: { startDate: string; endDate: string };
    previous: { startDate: string; endDate: string };
    locationIdOverride?: string | null;
    /** Hand-configured listings beyond the main one — see
     *  report-config.extraGbpProfiles. Listings sharing the client's website
     *  need no configuring: they are discovered here. */
    extraProfiles?: { id: string; label: string; locationId: string }[];
  },
): Promise<GbpMonthlyReport> {
  const extras = opts.extraProfiles ?? [];
  if (!googleAuthConfigured) {
    return {
      main: { status: "not-configured" },
      profiles: extras.map((p) => ({
        id: p.id,
        label: p.label,
        status: "error" as const,
        message: "sem service account Google",
      })),
    };
  }

  let token: string;
  try {
    token = await getGoogleAccessToken(SCOPES);
  } catch (err) {
    const message = err instanceof Error ? err.message : "GBP auth failed";
    return {
      main: { status: "error", message },
      profiles: extras.map((p) => ({ id: p.id, label: p.label, status: "error" as const, message })),
    };
  }

  // Which listings are this client's. The location list is cache-first (KV,
  // 7 days); only a cold cache touches the rate-limited listing APIs. If that
  // fails, a pinned main still works on its own — nothing is auto-discovered,
  // and the failure is reported as such rather than as "no listing found".
  const pinned = opts.locationIdOverride ?? null;
  const host = CLIENT_WEBSITES[slug] ? hostOf(CLIENT_WEBSITES[slug]) : null;
  const manualIds = new Set(extras.map((e) => bareId(e.locationId)));
  let plan: ReturnType<typeof planLocations>;
  let listError: string | null = null;
  try {
    const list = host || pinned ? await listAllLocations(token) : [];
    plan = planLocations(list, host, pinned, manualIds);
  } catch (err) {
    listError = err instanceof Error ? err.message : "GBP request failed";
    plan = planLocations([], null, pinned, manualIds);
  }
  // One listing needs no unit name; with several, every block is named.
  const multi = plan.auto.length + extras.length > 0;

  const main: GbpMainReport = await (async () => {
    if (!plan.main) {
      return listError
        ? { status: "error" as const, message: listError }
        : { status: "no-location" as const };
    }
    try {
      const metrics = await fetchLocationMetrics(token, plan.main.name, opts);
      return {
        status: "ok" as const,
        locationName: plan.main.name,
        ...(multi && plan.main.matched ? { label: plan.main.label } : {}),
        ...metrics,
      };
    } catch (err) {
      return {
        status: "error" as const,
        message: err instanceof Error ? err.message : "GBP request failed",
      };
    }
  })();

  // Sequential on purpose: the Business Profile APIs have a low per-project
  // quota and 429 under bursts. A handful of listings costs a few hundred ms
  // more and is far likelier to actually return data. Auto-discovered units
  // first (they are the main listing's siblings), then the hand-configured.
  const queue: { id: string; label: string; locationName: string }[] = [
    ...plan.auto.map((l) => ({ id: `L${l.id}`, label: l.label, locationName: l.name })),
    ...extras.map((p) => ({ id: p.id, label: p.label, locationName: toLocationName(p.locationId) })),
  ];
  const profiles: GbpExtraProfileReport[] = [];
  for (const p of queue) {
    try {
      const metrics = await fetchLocationMetrics(token, p.locationName, opts);
      profiles.push({ id: p.id, label: p.label, status: "ok", locationName: p.locationName, ...metrics });
    } catch (err) {
      profiles.push({
        id: p.id,
        label: p.label,
        status: "error",
        message: err instanceof Error ? err.message : "GBP request failed",
      });
    }
  }

  return { main, profiles };
}
