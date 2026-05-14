// Google Search Console integration for the Tracked Keywords panel.
//
// Auth model: a single Google Cloud *service account*. Its JSON key lives in
// the GOOGLE_SERVICE_ACCOUNT_JSON env var. Each client grants that service
// account read access to their Search Console property — no per-user OAuth.

import { JWT } from "google-auth-library";
import { CLIENT_WEBSITES } from "./client-meta";
import type { KeywordData, KeywordRow } from "./keywords";

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

// Domain-wide delegation: when set, the service account impersonates this
// Workspace user (e.g. seo@wonder-ads.com) instead of acting as itself. That
// user already owns every client's Search Console property, so no per-client
// access grant is needed. Leave unset to use the service account directly.
const IMPERSONATE_SUBJECT = process.env.GOOGLE_IMPERSONATE_SUBJECT || undefined;

/** Per-client Search Console property override. Only needed when the client's
 *  property isn't a domain property, or its domain differs from the marketing
 *  site in CLIENT_WEBSITES. Values are either:
 *    - "sc-domain:example.com"      → domain property (the modern default)
 *    - "https://www.example.com/"   → URL-prefix property (exact, with slash)
 *  Slugs not listed here default to "sc-domain:<site domain>". */
const GSC_PROPERTY_OVERRIDES: Record<string, string> = {
  // "white-clinic": "https://whiteclinic.pt/",
};

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The Search Console property string for a client, or null if we have no
 *  website on file and no override. */
export function getGscProperty(slug: string): string | null {
  const override = GSC_PROPERTY_OVERRIDES[slug];
  if (override) return override;
  const site = CLIENT_WEBSITES[slug];
  if (!site) return null;
  const domain = domainFromUrl(site);
  return domain ? `sc-domain:${domain}` : null;
}

export const gscConfigured = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

type ServiceAccount = { client_email: string; private_key: string };

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      // Vercel may store the key with literal "\n" — normalise to newlines.
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const jwt = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: SCOPES,
    subject: IMPERSONATE_SUBJECT,
  });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Failed to obtain a Google access token");
  cachedToken = { token, expires: Date.now() + 50 * 60_000 };
  return token;
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
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
 *  previous window. Search Console data lags ~2–3 days, so the window ends
 *  3 days back. */
export async function getKeywordData(slug: string): Promise<KeywordData> {
  const sa = loadServiceAccount();
  if (!sa) return { status: "not-configured" };

  const siteUrl = getGscProperty(slug);
  if (!siteUrl) return { status: "no-property" };

  try {
    const token = await getAccessToken(sa);

    const end = isoDaysAgo(3);
    const start = isoDaysAgo(3 + 27);
    const prevEnd = isoDaysAgo(3 + 28);
    const prevStart = isoDaysAgo(3 + 28 + 27);

    const [current, previous] = await Promise.all([
      queryRange(token, siteUrl, start, end, 10),
      queryRange(token, siteUrl, prevStart, prevEnd, 200).catch(
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
