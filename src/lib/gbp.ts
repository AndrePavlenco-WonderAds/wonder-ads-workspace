// Google Business Profile Performance integration for the Monthly Report.
//
// Auth: the SAME service account + domain-wide delegation used by GA4/GSC
// (google-auth.ts), impersonating GOOGLE_IMPERSONATE_SUBJECT (seo@wonder-ads.com)
// — who has access to every client's Business Profile. The only extra setup is
// the `business.manage` scope on the delegation + the three GBP APIs enabled +
// GBP API access approved by Google (see the report module docs).
//
// Location resolution: the per-client `report-config.gbpLocationId` override
// wins; otherwise we auto-discover by matching the client's website host
// against each location's websiteUri. Any failure → status (the report falls
// back to manual GBP input, never a fabricated number).

import { getGoogleAccessToken, googleAuthConfigured } from "./google-auth";
import { CLIENT_WEBSITES } from "./client-meta";

const SCOPES = ["https://www.googleapis.com/auth/business.manage"];

const DAILY_METRICS = [
  "WEBSITE_CLICKS",
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
] as const;

type MetricPair = { value: number; previous: number | null };

export type GbpMonthlyReport =
  | { status: "not-configured" }
  | { status: "no-location" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      locationName: string;
      websiteClicks: MetricPair;
      callClicks: MetricPair;
      directions: MetricPair;
    };

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

async function listAllLocations(token: string): Promise<GbpLocation[]> {
  if (cachedLocations && cachedLocations.expires > Date.now()) {
    return cachedLocations.list;
  }
  const out: GbpLocation[] = [];
  // 1) list accounts
  const accRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!accRes.ok) throw new Error(`accounts ${accRes.status}`);
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
      const locRes = await fetch(url, {
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
  return out;
}

async function resolveLocationName(
  slug: string,
  token: string,
  override: string | null,
): Promise<string | null> {
  if (override) return toLocationName(override);
  const host = CLIENT_WEBSITES[slug] ? hostOf(CLIENT_WEBSITES[slug]) : null;
  if (!host) return null;
  try {
    const locations = await listAllLocations(token);
    const match = locations.find(
      (l) => l.websiteUri && hostOf(l.websiteUri) === host,
    );
    return match?.name ?? null;
  } catch {
    return null;
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

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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

/** GBP click metrics for a client over a calendar month vs. the prior month.
 *  Returns a status the report can fall back on (manual input) when GBP isn't
 *  set up yet — never a fabricated zero. */
export async function getGbpMonthlyReport(
  slug: string,
  opts: {
    current: { startDate: string; endDate: string };
    previous: { startDate: string; endDate: string };
    locationIdOverride?: string | null;
  },
): Promise<GbpMonthlyReport> {
  if (!googleAuthConfigured) return { status: "not-configured" };

  try {
    const token = await getGoogleAccessToken(SCOPES);
    const locationName = await resolveLocationName(
      slug,
      token,
      opts.locationIdOverride ?? null,
    );
    if (!locationName) return { status: "no-location" };

    const [cur, prev] = await Promise.all([
      fetchRangeTotals(token, locationName, opts.current),
      fetchRangeTotals(token, locationName, opts.previous).catch(
        () => ({}) as Record<string, number>,
      ),
    ]);

    const pair = (metric: string): MetricPair => ({
      value: cur[metric] ?? 0,
      previous: metric in prev ? prev[metric] : null,
    });

    return {
      status: "ok",
      locationName,
      websiteClicks: pair("WEBSITE_CLICKS"),
      callClicks: pair("CALL_CLICKS"),
      directions: pair("BUSINESS_DIRECTION_REQUESTS"),
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "GBP request failed",
    };
  }
}
