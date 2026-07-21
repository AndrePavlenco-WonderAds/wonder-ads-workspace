// Google Analytics 4 integration for the GA4 Metrics panel.
//
// Reuses the same service account + domain-wide delegation as the Search
// Console integration (see google-auth.ts). Property resolution is automatic:
// we list the GA4 properties the impersonated user can see, read each one's
// web data stream, and match clients by website domain.

import { unstable_cache } from "next/cache";
import { CLIENT_WEBSITES } from "./client-meta";
import { getGoogleAccessToken, googleAuthConfigured } from "./google-auth";
import type { Ga4Channel, Ga4Data, Ga4Metric } from "./analytics";

const SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"];

/** Per-client GA4 property ID override (numeric, no "properties/" prefix).
 *  Only needed when domain matching can't find the right property. */
const GA4_PROPERTY_OVERRIDES: Record<string, string> = {};

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// --- Property discovery -----------------------------------------------------

type PropertySummary = { propertyId: string; displayName: string };

let cachedProps: { list: PropertySummary[]; expires: number } | null = null;
// In-flight guard: when many callers (e.g. the SEO organic-visitors
// rollup fanning out across ~21 clients) hit this at once on a cold
// cache, they'd each rebuild the full property list. Share one build.
let propsInFlight: Promise<PropertySummary[]> | null = null;

/** Every GA4 property the impersonated user can access. */
async function listProperties(token: string): Promise<PropertySummary[]> {
  if (cachedProps && cachedProps.expires > Date.now()) return cachedProps.list;
  if (propsInFlight) return propsInFlight;
  propsInFlight = buildProperties(token).finally(() => {
    propsInFlight = null;
  });
  return propsInFlight;
}

async function buildProperties(token: string): Promise<PropertySummary[]> {
  const out: PropertySummary[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
    );
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Analytics Admin API responded ${res.status}. ${text.slice(0, 180)}`,
      );
    }
    const json = (await res.json()) as {
      accountSummaries?: {
        propertySummaries?: { property?: string; displayName?: string }[];
      }[];
      nextPageToken?: string;
    };
    for (const acc of json.accountSummaries ?? []) {
      for (const p of acc.propertySummaries ?? []) {
        const id = p.property?.replace("properties/", "");
        if (id) out.push({ propertyId: id, displayName: p.displayName ?? id });
      }
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  cachedProps = { list: out, expires: Date.now() + 30 * 60_000 };
  return out;
}

// Website host → GA4 property ID, built lazily from each property's web
// data streams. Cached because it's a fan-out of requests.
let cachedDomainIndex: { map: Map<string, string>; expires: number } | null =
  null;
// Same in-flight guard for the (expensive, fan-out) domain index build —
// without it, 21 concurrent client lookups each fan out across every
// property's dataStreams, a request storm that can time out and make the
// whole rollup come back empty.
let domainIndexInFlight: Promise<Map<string, string>> | null = null;

async function getDomainIndex(token: string): Promise<Map<string, string>> {
  if (cachedDomainIndex && cachedDomainIndex.expires > Date.now()) {
    return cachedDomainIndex.map;
  }
  if (domainIndexInFlight) return domainIndexInFlight;
  domainIndexInFlight = buildDomainIndex(token).finally(() => {
    domainIndexInFlight = null;
  });
  return domainIndexInFlight;
}

async function buildDomainIndex(token: string): Promise<Map<string, string>> {
  const props = await listProperties(token);
  const map = new Map<string, string>();
  await Promise.all(
    props.map(async ({ propertyId }) => {
      try {
        const res = await fetch(
          `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/dataStreams`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          dataStreams?: { webStreamData?: { defaultUri?: string } }[];
        };
        for (const ds of json.dataStreams ?? []) {
          const host = ds.webStreamData?.defaultUri
            ? hostFromUrl(ds.webStreamData.defaultUri)
            : null;
          if (host && !map.has(host)) map.set(host, propertyId);
        }
      } catch {
        /* skip this property */
      }
    }),
  );
  cachedDomainIndex = { map, expires: Date.now() + 30 * 60_000 };
  return map;
}

async function resolvePropertyId(
  slug: string,
  token: string,
): Promise<string | null> {
  const override = GA4_PROPERTY_OVERRIDES[slug];
  if (override) return override;
  const site = CLIENT_WEBSITES[slug];
  const host = site ? hostFromUrl(site) : null;
  if (!host) return null;
  const index = await getDomainIndex(token);
  return index.get(host) ?? null;
}

/** Resolve a client to a live GA4 token + property id in one call. Returns
 *  null when Google auth isn't configured or no property matches the client's
 *  domain. Exposed so the Monthly Report data layer (report/ga4-report.ts) can
 *  reuse the exact token + property resolution the panel uses. */
export async function resolveGa4Property(
  slug: string,
  propertyIdOverride?: string | null,
): Promise<{ token: string; propertyId: string } | null> {
  if (!googleAuthConfigured) return null;
  const token = await getGoogleAccessToken(SCOPES);
  const propertyId = propertyIdOverride?.trim()
    ? propertyIdOverride.trim()
    : await resolvePropertyId(slug, token);
  if (!propertyId) return null;
  return { token, propertyId };
}

// --- Reporting --------------------------------------------------------------

type ReportRow = {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
};

export async function runReport(
  token: string,
  propertyId: string,
  body: unknown,
): Promise<ReportRow[]> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Analytics Data API responded ${res.status}. ${text.slice(0, 180)}`,
    );
  }
  const json = (await res.json()) as { rows?: ReportRow[] };
  return json.rows ?? [];
}

// Raw GA4 metrics pulled per request (the v1beta runReport cap is 10).
const RAW_METRICS = [
  "totalUsers",
  "newUsers",
  "sessions",
  "screenPageViews",
  "screenPageViewsPerSession",
  "engagementRate",
  "bounceRate",
  "userEngagementDuration",
  "keyEvents",
  "sessionKeyEventRate",
] as const;

/** Map a row's metricValues array onto the RAW_METRICS names. */
function rawMap(values: { value?: string }[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  RAW_METRICS.forEach((name, i) => {
    out[name] = Number(values?.[i]?.value ?? 0);
  });
  return out;
}

/** The display metrics shown in the panel — some direct, one derived. */
function buildMetrics(
  cur: Record<string, number>,
  prev: Record<string, number>,
): Ga4Metric[] {
  const timePerUser = (r: Record<string, number>) =>
    r.totalUsers > 0 ? r.userEngagementDuration / r.totalUsers : 0;

  return [
    m("users", "Users", cur.totalUsers, prev.totalUsers, "number", true),
    m("newUsers", "New Users", cur.newUsers, prev.newUsers, "number", true),
    m("sessions", "Sessions", cur.sessions, prev.sessions, "number", true),
    m(
      "pageviews",
      "Pageviews",
      cur.screenPageViews,
      prev.screenPageViews,
      "number",
      true,
    ),
    m(
      "pagesPerSession",
      "Pages / Session",
      cur.screenPageViewsPerSession,
      prev.screenPageViewsPerSession,
      "decimal",
      true,
    ),
    m(
      "engagement",
      "Engagement",
      cur.engagementRate,
      prev.engagementRate,
      "percent",
      true,
    ),
    m(
      "bounceRate",
      "Bounce Rate",
      cur.bounceRate,
      prev.bounceRate,
      "percent",
      false,
    ),
    m(
      "timePerUser",
      "Time / User",
      timePerUser(cur),
      timePerUser(prev),
      "duration",
      true,
    ),
    m(
      "conversions",
      "Conversions",
      cur.keyEvents,
      prev.keyEvents,
      "number",
      true,
    ),
    m(
      "convRate",
      "Conv. Rate",
      cur.sessionKeyEventRate,
      prev.sessionKeyEventRate,
      "percent",
      true,
    ),
  ];
}

function m(
  key: string,
  label: string,
  value: number,
  previous: number,
  format: Ga4Metric["format"],
  higherIsBetter: boolean,
): Ga4Metric {
  return { key, label, value, previous, format, higherIsBetter };
}

function channelFilter(channel: Ga4Channel) {
  if (channel === "all") return undefined;
  return {
    filter: {
      fieldName: "sessionDefaultChannelGroup",
      stringFilter: { value: channel, matchType: "EXACT" },
    },
  };
}

/** GA4 metrics for a client over the last `days` days (vs the prior equal
 *  window), optionally scoped to one channel, plus a daily sessions trend. */
export async function getGa4Data(
  slug: string,
  days = 28,
  channel: Ga4Channel = "all",
): Promise<Ga4Data> {
  if (!googleAuthConfigured) return { status: "not-configured" };

  try {
    const token = await getGoogleAccessToken(SCOPES);
    const propertyId = await resolvePropertyId(slug, token);
    if (!propertyId) return { status: "no-property" };

    const filter = channelFilter(channel);

    const [totalsRows, trendRows] = await Promise.all([
      runReport(token, propertyId, {
        dateRanges: [
          { startDate: `${days}daysAgo`, endDate: "yesterday" },
          { startDate: `${2 * days}daysAgo`, endDate: `${days + 1}daysAgo` },
        ],
        metrics: RAW_METRICS.map((name) => ({ name })),
        ...(filter ? { dimensionFilter: filter } : {}),
      }),
      runReport(token, propertyId, {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: "yesterday" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
        ...(filter ? { dimensionFilter: filter } : {}),
      }),
    ]);

    // With multiple date ranges, GA4 adds a dateRange dimension to each row.
    const current = totalsRows.find(
      (r) => r.dimensionValues?.[0]?.value === "date_range_0",
    );
    const previous = totalsRows.find(
      (r) => r.dimensionValues?.[0]?.value === "date_range_1",
    );

    const metrics = buildMetrics(
      rawMap(current?.metricValues),
      rawMap(previous?.metricValues),
    );
    const trend = trendRows.map((r) => ({
      date: r.dimensionValues?.[0]?.value ?? "",
      sessions: Number(r.metricValues?.[0]?.value ?? 0),
    }));

    return { status: "ok", propertyId, metrics, trend, days, channel };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error ? err.message : "Analytics request failed",
    };
  }
}

/** Format one metric's value for prompt text. */
function fmtMetric(m: Ga4Metric): string {
  switch (m.format) {
    case "percent":
      return `${(m.value * 100).toFixed(1)}%`;
    case "decimal":
      return m.value.toFixed(2);
    case "duration": {
      const s = Math.round(m.value);
      return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
    }
    default:
      return Math.round(m.value).toLocaleString("en-GB");
  }
}

/** Compact GA4 behavioural summary for the Keyword Research prompt. Used
 *  as owned-data context (engagement, conversions, bounce) so the AI can
 *  weigh conversion potential — not just search demand. Returns null when
 *  GA4 isn't available for this client so callers can skip the section. */
export function formatGa4ForKwPrompt(data: Ga4Data): string | null {
  if (data.status !== "ok") return null;
  const pick = (key: string) => data.metrics.find((m) => m.key === key);
  const lines: string[] = [
    `## GA4 behavioural data (organic + all channels, last ${data.days} days) — OWNED DATA`,
  ];
  for (const key of [
    "users",
    "sessions",
    "engagement",
    "bounceRate",
    "convRate",
    "conversions",
  ]) {
    const m = pick(key);
    if (m) {
      const dir = m.previous
        ? ` (era ${fmtMetric({ ...m, value: m.previous })})`
        : "";
      lines.push(`- **${m.label}:** ${fmtMetric(m)}${dir}`);
    }
  }
  lines.push(
    "Use estes sinais comportamentais para ponderar o *Conversion Potential* no Opportunity Score — não só a procura de pesquisa.",
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Department-wide organic-visitor rollup
// ---------------------------------------------------------------------------

export type SeoOrganicRollup = {
  /** Sum of organic-search users across all clients (last 30 days). */
  total: number;
  /** How many clients actually returned GA4 data (rest skipped silently). */
  clientsWithData: number;
  /** False when the Google service account isn't configured at all. */
  configured: boolean;
};

/** Sum of organic-search visitors (GA4 `totalUsers`, Organic Search channel,
 *  last 30 days) across every SEO client. Cached for 30 minutes so the SEO
 *  landing page never blocks on ~20 live GA4 calls on each render — the
 *  rollup only refreshes on a cache miss. Clients without a GA4 property are
 *  skipped (contribute 0), never invented. */
export const getSeoOrganicVisitors30d = unstable_cache(
  async (slugs: string[]): Promise<SeoOrganicRollup> => {
    if (!googleAuthConfigured) {
      return { total: 0, clientsWithData: 0, configured: false };
    }
    // Per-client cap so one slow GA4 report never stalls the SEO page.
    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([
        p,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);
    const perClient = await Promise.all(
      slugs.map(async (slug) => {
        try {
          const data = await withTimeout(
            getGa4Data(slug, 30, "Organic Search"),
            12_000,
          );
          if (data && data.status === "ok") {
            const users = data.metrics.find((m) => m.key === "users")?.value;
            return typeof users === "number" ? Math.round(users) : null;
          }
        } catch {
          /* skip this client — never fabricate a number */
        }
        return null;
      }),
    );
    let total = 0;
    let clientsWithData = 0;
    for (const v of perClient) {
      if (v !== null) {
        total += v;
        clientsWithData += 1;
      }
    }
    return { total, clientsWithData, configured: true };
  },
  ["seo-organic-visitors-30d-v2"],
  { revalidate: 1800, tags: ["seo-organic-visitors"] },
);
