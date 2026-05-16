// Google Search Console integration for the Tracked Keywords panel.
//
// Auth model: a single Google Cloud *service account* with domain-wide
// delegation. Its JSON key lives in GOOGLE_SERVICE_ACCOUNT_JSON; it
// impersonates GOOGLE_IMPERSONATE_SUBJECT — a Workspace user who already
// has access to every client's Search Console property.
//
// Property resolution is automatic: we list the properties that user can
// see and match each client by domain, so it works whether the client's
// property is a domain property ("sc-domain:…") or a URL-prefix one.

import { CLIENT_WEBSITES } from "./client-meta";
import { getGoogleAccessToken, googleAuthConfigured } from "./google-auth";
import type { KeywordData, KeywordRow } from "./keywords";

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

/** Per-client Search Console property override. Rarely needed — only when a
 *  client's property domain differs from their marketing site, or domain
 *  matching otherwise picks the wrong property. Value is the exact property
 *  string, e.g. "sc-domain:example.com" or "https://www.example.com/". */
const GSC_PROPERTY_OVERRIDES: Record<string, string> = {};

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export const gscConfigured = googleAuthConfigured;

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

type SiteEntry = { siteUrl: string; permissionLevel: string };

let cachedSites: { sites: SiteEntry[]; expires: number } | null = null;

/** All Search Console properties the impersonated user can access. */
async function listSites(token: string): Promise<SiteEntry[]> {
  if (cachedSites && cachedSites.expires > Date.now()) return cachedSites.sites;
  const res = await fetch(
    "https://searchconsole.googleapis.com/webmasters/v3/sites",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Search Console site list responded ${res.status}. ${text.slice(0, 180)}`,
    );
  }
  const json = (await res.json()) as { siteEntry?: SiteEntry[] };
  const sites = json.siteEntry ?? [];
  cachedSites = { sites, expires: Date.now() + 10 * 60_000 };
  return sites;
}

/** Find the Search Console property for a domain. Prefers a domain property,
 *  then a URL-prefix property on the same host (www or bare). */
function matchProperty(domain: string, sites: SiteEntry[]): string | null {
  const usable = sites.filter(
    (s) => s.permissionLevel && s.permissionLevel !== "siteUnverifiedUser",
  );
  const domainProp = usable.find((s) => s.siteUrl === `sc-domain:${domain}`);
  if (domainProp) return domainProp.siteUrl;
  const urlProp = usable.find((s) => {
    if (!s.siteUrl.startsWith("http")) return false;
    try {
      return new URL(s.siteUrl).hostname.replace(/^www\./, "") === domain;
    } catch {
      return false;
    }
  });
  return urlProp?.siteUrl ?? null;
}

type GscApiRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

async function queryRange(
  token: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number,
): Promise<GscApiRow[]> {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    siteUrl,
  )}/searchAnalytics/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Search Console responded ${res.status}. ${text.slice(0, 180)}`,
    );
  }
  const json = (await res.json()) as { rows?: GscApiRow[] };
  return json.rows ?? [];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Top search queries for a client's site, with position change vs the
 *  previous window of equal length. Search Console data lags ~2–3 days, so
 *  the window ends 3 days back. `days` is the window length. */
export async function getKeywordData(
  slug: string,
  days = 28,
): Promise<KeywordData> {
  if (!googleAuthConfigured) return { status: "not-configured" };

  const override = GSC_PROPERTY_OVERRIDES[slug];
  const site = CLIENT_WEBSITES[slug];
  const domain = site ? domainFromUrl(site) : null;
  if (!override && !domain) return { status: "no-property" };

  try {
    const token = await getGoogleAccessToken(SCOPES);

    let siteUrl: string | null = override ?? null;
    if (!siteUrl && domain) {
      const sites = await listSites(token);
      siteUrl = matchProperty(domain, sites);
    }
    if (!siteUrl) return { status: "no-property" };

    const end = isoDaysAgo(3);
    const start = isoDaysAgo(3 + days - 1);
    const prevEnd = isoDaysAgo(3 + days);
    const prevStart = isoDaysAgo(3 + days + days - 1);

    const [current, previous] = await Promise.all([
      queryRange(token, siteUrl, start, end, 50),
      queryRange(token, siteUrl, prevStart, prevEnd, 1000).catch(
        () => [] as GscApiRow[],
      ),
    ]);

    const prevByQuery = new Map(
      previous.map((r) => [r.keys[0], r.position] as const),
    );

    const rows: KeywordRow[] = current.map((r) => {
      const query = r.keys[0] ?? "";
      const prevPos = prevByQuery.get(query);
      return {
        query,
        position: round1(r.position),
        clicks: r.clicks,
        impressions: r.impressions,
        change: prevPos === undefined ? null : round1(prevPos - r.position),
      };
    });

    return { status: "ok", siteUrl, rows, start, end };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Search Console request failed",
    };
  }
}

// ---- Site audit data ----------------------------------------------------

export type GscTotals = {
  clicks: number;
  impressions: number;
  ctr: number; // 0–1
  position: number;
};

export type GscPageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscSitemap = {
  path: string;
  type: string;
  isPending: boolean;
  isSitemapsIndex: boolean;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  warnings: number;
  errors: number;
  contents?: { type: string; submitted: number; indexed: number }[];
};

export type SiteAuditGscData =
  | { status: "not-configured" }
  | { status: "no-property" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      siteUrl: string;
      windowDays: number;
      start: string;
      end: string;
      totals: GscTotals;
      prevTotals: GscTotals | null;
      topQueries: KeywordRow[];
      topPages: GscPageRow[];
      sitemaps: GscSitemap[];
    };

async function queryTotals(
  token: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GscTotals | null> {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    siteUrl,
  )}/searchAnalytics/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ startDate, endDate, dimensions: [], rowLimit: 1 }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { rows?: GscApiRow[] };
  const row = json.rows?.[0];
  if (!row) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  };
}

async function queryPages(
  token: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number,
): Promise<GscPageRow[]> {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    siteUrl,
  )}/searchAnalytics/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit,
    }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { rows?: GscApiRow[] };
  return (json.rows ?? []).map((r) => ({
    page: r.keys[0] ?? "",
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

async function listSitemaps(
  token: string,
  siteUrl: string,
): Promise<GscSitemap[]> {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    siteUrl,
  )}/sitemaps`;
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  type ApiSitemap = {
    path?: string;
    type?: string;
    isPending?: boolean;
    isSitemapsIndex?: boolean;
    lastSubmitted?: string;
    lastDownloaded?: string;
    warnings?: string;
    errors?: string;
    contents?: { type?: string; submitted?: string; indexed?: string }[];
  };
  const json = (await res.json()) as { sitemap?: ApiSitemap[] };
  return (json.sitemap ?? []).map((s) => ({
    path: s.path ?? "",
    type: s.type ?? "",
    isPending: Boolean(s.isPending),
    isSitemapsIndex: Boolean(s.isSitemapsIndex),
    lastSubmitted: s.lastSubmitted ?? null,
    lastDownloaded: s.lastDownloaded ?? null,
    warnings: Number(s.warnings ?? 0),
    errors: Number(s.errors ?? 0),
    contents: (s.contents ?? []).map((c) => ({
      type: c.type ?? "",
      submitted: Number(c.submitted ?? 0),
      indexed: Number(c.indexed ?? 0),
    })),
  }));
}

/** All the Search Console signals the site-wide audit needs in one call. */
export async function getSiteAuditData(
  slug: string,
  days = 28,
): Promise<SiteAuditGscData> {
  if (!googleAuthConfigured) return { status: "not-configured" };

  const override = GSC_PROPERTY_OVERRIDES[slug];
  const site = CLIENT_WEBSITES[slug];
  const domain = site ? domainFromUrl(site) : null;
  if (!override && !domain) return { status: "no-property" };

  try {
    const token = await getGoogleAccessToken(SCOPES);

    let siteUrl: string | null = override ?? null;
    if (!siteUrl && domain) {
      const sites = await listSites(token);
      siteUrl = matchProperty(domain, sites);
    }
    if (!siteUrl) return { status: "no-property" };

    const end = isoDaysAgo(3);
    const start = isoDaysAgo(3 + days - 1);
    const prevEnd = isoDaysAgo(3 + days);
    const prevStart = isoDaysAgo(3 + days + days - 1);

    const [totals, prevTotals, queryRows, prevQueryRows, pages, sitemaps] =
      await Promise.all([
        queryTotals(token, siteUrl, start, end),
        queryTotals(token, siteUrl, prevStart, prevEnd).catch(() => null),
        queryRange(token, siteUrl, start, end, 25),
        queryRange(token, siteUrl, prevStart, prevEnd, 1000).catch(
          () => [] as GscApiRow[],
        ),
        queryPages(token, siteUrl, start, end, 25),
        listSitemaps(token, siteUrl).catch(() => [] as GscSitemap[]),
      ]);

    const prevByQuery = new Map(
      prevQueryRows.map((r) => [r.keys[0], r.position] as const),
    );
    const topQueries: KeywordRow[] = queryRows.map((r) => {
      const query = r.keys[0] ?? "";
      const prevPos = prevByQuery.get(query);
      return {
        query,
        position: round1(r.position),
        clicks: r.clicks,
        impressions: r.impressions,
        change: prevPos === undefined ? null : round1(prevPos - r.position),
      };
    });

    return {
      status: "ok",
      siteUrl,
      windowDays: days,
      start,
      end,
      totals: totals ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      prevTotals,
      topQueries,
      topPages: pages,
      sitemaps,
    };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Search Console request failed",
    };
  }
}

export function formatGscSiteAuditForPrompt(d: SiteAuditGscData): string {
  if (d.status === "not-configured") {
    return `## Google Search Console\n_Not configured (GOOGLE_SERVICE_ACCOUNT_JSON missing). Skipping GSC signals._`;
  }
  if (d.status === "no-property") {
    return `## Google Search Console\n_No Search Console property matched this client's domain. Either the property isn't verified or the service account isn't impersonating a user with access._`;
  }
  if (d.status === "error") {
    return `## Google Search Console\n_Error: ${d.message}_`;
  }

  const lines: string[] = [];
  lines.push(`## Google Search Console (${d.windowDays}-day window)`);
  lines.push(`Property: ${d.siteUrl}`);
  lines.push(`Window: ${d.start} → ${d.end} (data lags ~3 days)`);
  lines.push("");
  lines.push("**Site totals:**");
  lines.push(`- Clicks: ${d.totals.clicks}${deltaStr(d.totals.clicks, d.prevTotals?.clicks)}`);
  lines.push(
    `- Impressions: ${d.totals.impressions}${deltaStr(d.totals.impressions, d.prevTotals?.impressions)}`,
  );
  lines.push(
    `- CTR: ${pct(d.totals.ctr)}${deltaPctStr(d.totals.ctr, d.prevTotals?.ctr)}`,
  );
  lines.push(
    `- Avg position: ${d.totals.position.toFixed(1)}${deltaPosStr(d.totals.position, d.prevTotals?.position)}`,
  );

  if (d.sitemaps.length > 0) {
    lines.push("");
    lines.push("**Registered sitemaps:**");
    for (const s of d.sitemaps) {
      lines.push(
        `- ${s.path} (${s.type || "unknown"}, ${s.isSitemapsIndex ? "index" : "single"}) — errors: ${s.errors}, warnings: ${s.warnings}, last downloaded: ${s.lastDownloaded ?? "never"}`,
      );
      if (s.contents) {
        for (const c of s.contents) {
          lines.push(`  - ${c.type}: ${c.submitted} submitted, ${c.indexed} indexed`);
        }
      }
    }
  } else {
    lines.push("");
    lines.push("**Registered sitemaps:** none registered in Search Console");
  }

  if (d.topPages.length > 0) {
    lines.push("");
    lines.push("**Top pages by clicks:**");
    lines.push("| Page | Clicks | Impressions | CTR | Avg pos |");
    lines.push("|---|---:|---:|---:|---:|");
    for (const p of d.topPages.slice(0, 15)) {
      lines.push(
        `| ${p.page} | ${p.clicks} | ${p.impressions} | ${pct(p.ctr)} | ${p.position.toFixed(1)} |`,
      );
    }
  }

  if (d.topQueries.length > 0) {
    lines.push("");
    lines.push("**Top queries by clicks:**");
    lines.push("| Query | Clicks | Impressions | Avg pos | Δ pos (vs prev) |");
    lines.push("|---|---:|---:|---:|---:|");
    for (const q of d.topQueries.slice(0, 20)) {
      lines.push(
        `| ${q.query} | ${q.clicks} | ${q.impressions} | ${q.position.toFixed(1)} | ${q.change === null ? "—" : q.change > 0 ? `▲ ${q.change.toFixed(1)}` : `▼ ${Math.abs(q.change).toFixed(1)}`} |`,
      );
    }
  }

  return lines.join("\n");
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function deltaStr(curr: number, prev: number | null | undefined): string {
  if (prev === null || prev === undefined) return "";
  const diff = curr - prev;
  const sign = diff > 0 ? "▲" : diff < 0 ? "▼" : "·";
  return ` (${sign} ${Math.abs(diff)} vs prev ${prev})`;
}

function deltaPctStr(curr: number, prev: number | null | undefined): string {
  if (prev === null || prev === undefined) return "";
  const diff = (curr - prev) * 100;
  const sign = diff > 0 ? "▲" : diff < 0 ? "▼" : "·";
  return ` (${sign} ${Math.abs(diff).toFixed(2)}pp)`;
}

function deltaPosStr(curr: number, prev: number | null | undefined): string {
  if (prev === null || prev === undefined) return "";
  const diff = prev - curr; // lower position is better
  const sign = diff > 0 ? "▲" : diff < 0 ? "▼" : "·";
  return ` (${sign} ${Math.abs(diff).toFixed(1)} positions)`;
}
