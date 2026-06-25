// ADS performance data boundary.
//
// HARD RULE: this module only ever returns data pulled from the real ad
// platforms. It NEVER invents numbers. Until the Google Ads / Meta Ads
// API credentials are wired (via env), `connected` is false and every
// metric is null/empty — the dashboard then shows the "Conectar API"
// prompt instead of fabricated figures.
//
// When the integrations are added later, implement fetchGooglePerformance
// / fetchMetaPerformance below to call the real APIs; the whole dashboard
// lights up with zero UI changes.

import "server-only";
import { getAdsClient } from "@/lib/ads-clients";

export type AdsPlatform = "google" | "meta";
export type PlatformFilter = "all" | AdsPlatform;

/** Time window for the dashboard. `days` carries the custom day count
 *  when mode === "days". */
export type AdsWindow =
  | { mode: "week" }
  | { mode: "month" }
  | { mode: "quarter" }
  | { mode: "days"; days: number };

export function windowLabel(w: AdsWindow): string {
  switch (w.mode) {
    case "week":
      return "Esta semana";
    case "month":
      return "Este mês";
    case "quarter":
      return "Este trimestre";
    case "days":
      return `Últimos ${w.days} dias`;
  }
}

export function parseWindow(
  mode: string | null,
  days: string | null,
): AdsWindow {
  if (mode === "month") return { mode: "month" };
  if (mode === "quarter") return { mode: "quarter" };
  if (mode === "days") {
    const n = Number(days);
    const clamped = Number.isFinite(n) ? Math.min(365, Math.max(1, Math.round(n))) : 30;
    return { mode: "days", days: clamped };
  }
  return { mode: "week" };
}

export type AdsKpis = {
  conversions: number;
  roas: number;
  ctr: number; // percent
  cpa: number;
  spend: number;
  budget: number | null;
};

export type AdsCampaign = {
  name: string;
  platform: AdsPlatform;
  conversions: number;
  roas: number;
  best: boolean;
};

export type AdsSeriesPoint = {
  label: string;
  google: number | null;
  meta: number | null;
};

export type AdsConnection = { google: boolean; meta: boolean };

export type AdsPerformance = {
  /** Which platforms this client RUNS (from the roster). */
  channels: AdsPlatform[];
  /** Which platforms are actually connected to the app right now. */
  connected: AdsConnection;
  /** True when at least one of the client's channels is connected. */
  anyConnected: boolean;
  window: AdsWindow;
  platform: PlatformFilter;
  /** Null until the relevant platform API returns real numbers. */
  kpis: AdsKpis | null;
  topCampaigns: AdsCampaign[];
  conversions: AdsSeriesPoint[];
};

// --- Connection checks (env-driven; no creds yet → false) ------------------

export function googleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID,
  );
}

export function metaAdsConfigured(): boolean {
  return Boolean(process.env.META_ADS_ACCESS_TOKEN);
}

export function getAdsConnection(): AdsConnection {
  return { google: googleAdsConfigured(), meta: metaAdsConfigured() };
}

// --- Real fetchers (to implement when credentials exist) -------------------
// Each returns null when its platform isn't connected. NEVER returns made-up
// data — a null here surfaces the "Conectar API" state in the UI.

type PlatformFetch = {
  kpis: AdsKpis;
  campaigns: AdsCampaign[];
  series: number[];
} | null;

async function fetchGooglePerformance(
  slug: string,
  window: AdsWindow,
): Promise<PlatformFetch> {
  if (!googleAdsConfigured()) return null;
  // TODO: call the Google Ads API with the client's customer id, map the
  // GAQL report rows for `slug`/`window` into KPIs/campaigns/series. Until
  // then, treat as no-data rather than inventing figures.
  void slug;
  void window;
  return null;
}

async function fetchMetaPerformance(
  slug: string,
  window: AdsWindow,
): Promise<PlatformFetch> {
  if (!metaAdsConfigured()) return null;
  // TODO: call the Meta Marketing API (insights edge) for the client's ad
  // account using `slug`/`window`. Until then, no-data.
  void slug;
  void window;
  return null;
}

export async function getAdsPerformance(
  slug: string,
  opts: { platform: PlatformFilter; window: AdsWindow },
): Promise<AdsPerformance> {
  const client = getAdsClient(slug);
  const channels: AdsPlatform[] = (client?.channels as AdsPlatform[]) ?? [];
  const connected = getAdsConnection();
  const anyConnected = channels.some((c) => connected[c]);

  const [google, meta] = await Promise.all([
    channels.includes("google")
      ? fetchGooglePerformance(slug, opts.window)
      : Promise.resolve(null),
    channels.includes("meta")
      ? fetchMetaPerformance(slug, opts.window)
      : Promise.resolve(null),
  ]);

  // Merge whatever real data came back, honouring the platform filter.
  const useG = opts.platform !== "meta" ? google : null;
  const useM = opts.platform !== "google" ? meta : null;

  let kpis: AdsKpis | null = null;
  const topCampaigns: AdsCampaign[] = [];
  const conversions: AdsSeriesPoint[] = [];

  if (useG || useM) {
    // (Wiring point) combine real KPIs from the connected platforms.
    // Left null while neither fetcher returns data.
    kpis = mergeKpis(useG?.kpis ?? null, useM?.kpis ?? null);
    if (useG) topCampaigns.push(...useG.campaigns);
    if (useM) topCampaigns.push(...useM.campaigns);
    topCampaigns.sort((a, b) => b.conversions - a.conversions);
  }

  return {
    channels,
    connected,
    anyConnected,
    window: opts.window,
    platform: opts.platform,
    kpis,
    topCampaigns,
    conversions,
  };
}

function mergeKpis(g: AdsKpis | null, m: AdsKpis | null): AdsKpis | null {
  if (!g && !m) return null;
  const a = g ?? zeroKpis();
  const b = m ?? zeroKpis();
  const spend = a.spend + b.spend;
  const conversions = a.conversions + b.conversions;
  return {
    conversions,
    spend,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: spend > 0 ? (a.roas * a.spend + b.roas * b.spend) / spend : 0,
    ctr: (a.ctr + b.ctr) / ((g ? 1 : 0) + (m ? 1 : 0) || 1),
    budget:
      a.budget != null || b.budget != null
        ? (a.budget ?? 0) + (b.budget ?? 0)
        : null,
  };
}

function zeroKpis(): AdsKpis {
  return { conversions: 0, roas: 0, ctr: 0, cpa: 0, spend: 0, budget: null };
}
