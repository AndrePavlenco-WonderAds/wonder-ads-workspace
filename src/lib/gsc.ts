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
