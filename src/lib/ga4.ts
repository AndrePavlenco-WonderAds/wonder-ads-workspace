// Google Analytics 4 integration for the GA4 Metrics panel.
//
// Reuses the same service account + domain-wide delegation as the Search
// Console integration (see google-auth.ts). Property resolution is automatic:
// we list the GA4 properties the impersonated user can see, read each one's
// web data stream, and match clients by website domain.

import { CLIENT_WEBSITES } from "./client-meta";
import { getGoogleAccessToken, googleAuthConfigured } from "./google-auth";
import type { Ga4Data, Ga4Metric } from "./analytics";

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

/** Every GA4 property the impersonated user can access. */
async function listProperties(token: string): Promise<PropertySummary[]> {
  if (cachedProps && cachedProps.expires > Date.now()) return cachedProps.list;

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

async function getDomainIndex(token: string): Promise<Map<string, string>> {
  if (cachedDomainIndex && cachedDomainIndex.expires > Date.now()) {
    return cachedDomainIndex.map;
  }
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

// --- Reporting --------------------------------------------------------------

type ReportRow = {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
};

async function runReport(
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

const METRIC_DEFS: {
  name: string;
  key: Ga4Metric["key"];
  label: string;
  format: Ga4Metric["format"];
}[] = [
  { name: "totalUsers", key: "users", label: "Users (30d)", format: "number" },
  { name: "sessions", key: "sessions", label: "Sessions", format: "number" },
  {
    name: "engagementRate",
    key: "engagement",
    label: "Engagement",
    format: "percent",
  },
  {
    name: "keyEvents",
    key: "conversions",
    label: "Conversions",
    format: "number",
  },
];

/** 30-day GA4 metrics for a client (vs the prior 30 days) plus a daily
 *  sessions trend for the sparkline. */
export async function getGa4Data(slug: string): Promise<Ga4Data> {
  if (!googleAuthConfigured) return { status: "not-configured" };

  try {
    const token = await getGoogleAccessToken(SCOPES);
    const propertyId = await resolvePropertyId(slug, token);
    if (!propertyId) return { status: "no-property" };

    const [totalsRows, trendRows] = await Promise.all([
      runReport(token, propertyId, {
        dateRanges: [
          { startDate: "30daysAgo", endDate: "yesterday" },
          { startDate: "60daysAgo", endDate: "31daysAgo" },
        ],
        metrics: METRIC_DEFS.map((m) => ({ name: m.name })),
      }),
      runReport(token, propertyId, {
        dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
    ]);

    // With multiple date ranges, GA4 adds a dateRange dimension to each row.
    const current = totalsRows.find(
      (r) => r.dimensionValues?.[0]?.value === "date_range_0",
    );
    const previous = totalsRows.find(
      (r) => r.dimensionValues?.[0]?.value === "date_range_1",
    );
    const cur = current?.metricValues ?? [];
    const prev = previous?.metricValues ?? [];

    const metrics: Ga4Metric[] = METRIC_DEFS.map((def, i) => ({
      key: def.key,
      label: def.label,
      format: def.format,
      value: Number(cur[i]?.value ?? 0),
      previous: Number(prev[i]?.value ?? 0),
    }));

    const trend = trendRows.map((r) =>
      Number(r.metricValues?.[0]?.value ?? 0),
    );

    return { status: "ok", propertyId, metrics, trend };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error ? err.message : "Analytics request failed",
    };
  }
}
