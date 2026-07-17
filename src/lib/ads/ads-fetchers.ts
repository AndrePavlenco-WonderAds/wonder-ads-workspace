// Real metric fetchers for Google Ads + Meta. Hand-rolled REST (no SDK), like
// the GA4 integration. App-level credentials come from env; per-client account
// ids are passed in. Any error returns null → the dashboard shows "Conectar
// API" rather than fabricated numbers (the HARD RULE from ads-data.ts).

import "server-only";
import type { AdsKpis, AdsCampaign, AdsWindow } from "@/lib/ads/ads-data";

export type PlatformFetch = {
  kpis: AdsKpis;
  campaigns: AdsCampaign[];
  /** Conversions per day, oldest → newest, length === window days. */
  series: number[];
} | null;

const GOOGLE_ADS_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v21";
const META_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

// ---- Date window ----------------------------------------------------------

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function windowRange(w: AdsWindow): {
  since: string;
  until: string;
  days: number;
  dayKeys: string[];
  labels: string[];
} {
  const days =
    w.mode === "week" ? 7 : w.mode === "month" ? 30 : w.mode === "quarter" ? 90 : w.days;
  const until = new Date();
  const dayKeys: string[] = [];
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(until.getTime() - i * 86400000);
    dayKeys.push(isoDate(d));
    labels.push(`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return {
    since: dayKeys[0],
    until: dayKeys[dayKeys.length - 1],
    days,
    dayKeys,
    labels,
  };
}

// ======================= GOOGLE ADS =======================================

async function getGoogleAdsAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google OAuth token failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Google OAuth: no access_token");
  return json.access_token;
}

type GoogleRow = {
  campaign?: { name?: string };
  segments?: { date?: string };
  metrics?: {
    conversions?: number;
    conversionsValue?: number;
    costMicros?: string | number;
    clicks?: string | number;
    impressions?: string | number;
  };
};

export async function fetchGooglePerformance(
  customerId: string,
  w: AdsWindow,
  refreshToken: string,
): Promise<PlatformFetch> {
  try {
    const { since, until, dayKeys } = windowRange(w);
    const token = await getGoogleAdsAccessToken(refreshToken);
    const query = `
      SELECT campaign.name, segments.date, metrics.conversions,
             metrics.conversions_value, metrics.cost_micros, metrics.clicks,
             metrics.impressions
      FROM campaign
      WHERE segments.date BETWEEN '${since}' AND '${until}'`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
      "content-type": "application/json",
    };
    const loginCid = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/[^0-9]/g, "");
    if (loginCid) headers["login-customer-id"] = loginCid;

    const res = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_VERSION}/customers/${customerId}/googleAds:searchStream`,
      { method: "POST", headers, body: JSON.stringify({ query }) },
    );
    if (!res.ok) {
      throw new Error(`Google Ads API ${res.status}: ${await res.text()}`);
    }
    const chunks = (await res.json()) as Array<{ results?: GoogleRow[] }>;
    const rows: GoogleRow[] = chunks.flatMap((c) => c.results ?? []);

    let spend = 0;
    let conversions = 0;
    let convValue = 0;
    let clicks = 0;
    let impressions = 0;
    const byCampaign = new Map<string, { conv: number; value: number; spend: number }>();
    const byDay = new Map<string, number>();

    for (const r of rows) {
      const m = r.metrics ?? {};
      const cost = Number(m.costMicros ?? 0) / 1_000_000;
      const conv = Number(m.conversions ?? 0);
      const val = Number(m.conversionsValue ?? 0);
      spend += cost;
      conversions += conv;
      convValue += val;
      clicks += Number(m.clicks ?? 0);
      impressions += Number(m.impressions ?? 0);

      const name = r.campaign?.name ?? "—";
      const c = byCampaign.get(name) ?? { conv: 0, value: 0, spend: 0 };
      c.conv += conv;
      c.value += val;
      c.spend += cost;
      byCampaign.set(name, c);

      const date = r.segments?.date;
      if (date) byDay.set(date, (byDay.get(date) ?? 0) + conv);
    }

    const kpis: AdsKpis = {
      conversions: round(conversions),
      spend: round(spend),
      roas: spend > 0 ? round(convValue / spend, 2) : 0,
      ctr: impressions > 0 ? round((clicks / impressions) * 100, 2) : 0,
      cpa: conversions > 0 ? round(spend / conversions) : 0,
      budget: null,
    };

    const campaigns: AdsCampaign[] = [...byCampaign.entries()].map(([name, c]) => ({
      name,
      platform: "google",
      conversions: round(c.conv),
      roas: c.spend > 0 ? round(c.value / c.spend, 2) : 0,
      best: false,
    }));

    const series = dayKeys.map((k) => round(byDay.get(k) ?? 0));

    return { kpis, campaigns, series };
  } catch (err) {
    console.error("fetchGooglePerformance failed:", err);
    return null;
  }
}

// ======================= META =============================================

// Conversion action types in priority order — take the first present per row
// to avoid double-counting (purchases first, then leads).
const META_CONV_PRIORITY = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_web_purchase",
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
];

function pickAction(
  actions: Array<{ action_type?: string; value?: string }> | undefined,
): number {
  if (!Array.isArray(actions)) return 0;
  for (const type of META_CONV_PRIORITY) {
    const hit = actions.find((a) => a.action_type === type);
    if (hit) return Number(hit.value ?? 0);
  }
  return 0;
}

type MetaRow = {
  spend?: string;
  ctr?: string;
  clicks?: string;
  impressions?: string;
  date_start?: string;
  campaign_name?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
  action_values?: Array<{ action_type?: string; value?: string }>;
  purchase_roas?: Array<{ action_type?: string; value?: string }>;
};

async function metaGet(
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<MetaRow[]> {
  const url = new URL(`https://graph.facebook.com/${META_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`Meta API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: MetaRow[] };
  return json.data ?? [];
}

export async function fetchMetaPerformance(
  adAccountId: string,
  w: AdsWindow,
  accessToken: string,
): Promise<PlatformFetch> {
  try {
    const { since, until, dayKeys } = windowRange(w);
    const timeRange = JSON.stringify({ since, until });

    // Daily account rows → KPIs + series.
    const daily = await metaGet(
      `${adAccountId}/insights`,
      {
        level: "account",
        time_increment: "1",
        time_range: timeRange,
        fields: "spend,ctr,clicks,impressions,actions,action_values,purchase_roas",
      },
      accessToken,
    );

    let spend = 0;
    let conversions = 0;
    let convValue = 0;
    let clicks = 0;
    let impressions = 0;
    const byDay = new Map<string, number>();

    for (const r of daily) {
      const conv = pickAction(r.actions);
      spend += Number(r.spend ?? 0);
      clicks += Number(r.clicks ?? 0);
      impressions += Number(r.impressions ?? 0);
      conversions += conv;
      convValue += pickActionValues(r.action_values);
      if (r.date_start) byDay.set(r.date_start, (byDay.get(r.date_start) ?? 0) + conv);
    }

    const kpis: AdsKpis = {
      conversions: round(conversions),
      spend: round(spend),
      roas: spend > 0 ? round(convValue / spend, 2) : 0,
      ctr: impressions > 0 ? round((clicks / impressions) * 100, 2) : 0,
      cpa: conversions > 0 ? round(spend / conversions) : 0,
      budget: null,
    };

    // Campaign breakdown → top campaigns.
    const campRows = await metaGet(
      `${adAccountId}/insights`,
      {
        level: "campaign",
        time_range: timeRange,
        fields: "campaign_name,spend,actions,action_values",
      },
      accessToken,
    ).catch(() => [] as MetaRow[]);

    const campaigns: AdsCampaign[] = campRows.map((r) => {
      const cSpend = Number(r.spend ?? 0);
      const cVal = pickActionValues(r.action_values);
      return {
        name: r.campaign_name ?? "—",
        platform: "meta",
        conversions: round(pickAction(r.actions)),
        roas: cSpend > 0 ? round(cVal / cSpend, 2) : 0,
        best: false,
      };
    });

    const series = dayKeys.map((k) => round(byDay.get(k) ?? 0));

    return { kpis, campaigns, series };
  } catch (err) {
    console.error("fetchMetaPerformance failed:", err);
    return null;
  }
}

function pickActionValues(
  values: Array<{ action_type?: string; value?: string }> | undefined,
): number {
  if (!Array.isArray(values)) return 0;
  for (const type of META_CONV_PRIORITY) {
    const hit = values.find((a) => a.action_type === type);
    if (hit) return Number(hit.value ?? 0);
  }
  return 0;
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
