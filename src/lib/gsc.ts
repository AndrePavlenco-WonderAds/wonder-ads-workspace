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

/** Cliques + impressões por mês, para o gráfico de evolução do relatório.
 *
 *  A API não tem dimensão «mês», por isso pede-se por dia e soma-se cá. Um ano
 *  são ~365 linhas — uma chamada, dentro do rowLimit, contra doze chamadas se
 *  se pedisse mês a mês. */
async function queryMonthlyTotals(
  token: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<Map<string, { clicks: number; impressions: number }>> {
  const out = new Map<string, { clicks: number; impressions: number }>();
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
      dimensions: ["date"],
      rowLimit: 500,
    }),
  });
  if (!res.ok) return out;
  const json = (await res.json()) as { rows?: GscApiRow[] };
  for (const row of json.rows ?? []) {
    const day = row.keys?.[0] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const key = day.slice(0, 7);
    const acc = out.get(key) ?? { clicks: 0, impressions: 0 };
    acc.clicks += row.clicks;
    acc.impressions += row.impressions;
    out.set(key, acc);
  }
  return out;
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
/** Query-level performance rows for backtesting — pulls up to `rowLimit`
 *  queries with clicks/impressions/ctr/position so a past keyword research
 *  can be checked against what the site actually earned. Window ends ~3
 *  days back (GSC lag). */
export type QueryPerfRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};
export type QueryPerformance =
  | { status: "ok"; siteUrl: string; days: number; rows: QueryPerfRow[] }
  | { status: "not-configured" }
  | { status: "no-property" }
  | { status: "error"; message: string };

export async function getQueryPerformance(
  slug: string,
  days = 90,
  rowLimit = 1000,
): Promise<QueryPerformance> {
  if (!googleAuthConfigured) return { status: "not-configured" };
  const override = GSC_PROPERTY_OVERRIDES[slug];
  const site = CLIENT_WEBSITES[slug];
  const domain = site ? domainFromUrl(site) : null;
  if (!override && !domain) return { status: "no-property" };
  try {
    const token = await getGoogleAccessToken(SCOPES);
    let siteUrl: string | null = override ?? null;
    if (!siteUrl && domain) {
      siteUrl = matchProperty(domain, await listSites(token));
    }
    if (!siteUrl) return { status: "no-property" };
    const end = isoDaysAgo(3);
    const start = isoDaysAgo(3 + days - 1);
    const raw = await queryRange(token, siteUrl, start, end, rowLimit);
    const rows: QueryPerfRow[] = raw.map((r) => ({
      query: r.keys[0] ?? "",
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: round1(r.position),
    }));
    return { status: "ok", siteUrl, days, rows };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "GSC query failed",
    };
  }
}

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

// ---- Monthly Report (calendar-month windows) ---------------------------

/** Position footprint across the site's queries — for the report's month-end
 *  keyword overview. */
export type GscKeywordStats = {
  /** Queries with impressions this month. */
  total: number;
  top3: number;
  top10: number;
  top20: number;
  /** Impression-weighted average position. */
  avgPosition: number;
  /** Queries ranking this month that weren't ranking last month. */
  newKeywords: number;
  /** Queries whose position improved vs. last month. */
  improved: number;
  /** Queries now in the Top 10 that weren't in the Top 10 last month. */
  enteredTop10: number;
  /** Queries now in the Top 3 that weren't in the Top 3 last month. */
  enteredTop3: number;
};

/** A query whose ranking improved vs. the prior month (positive change). */
export type GscMover = {
  query: string;
  position: number;
  clicks: number;
  change: number;
};

/** A keyword the consultant committed to targeting, matched against this
 *  month's Search Console data. Unlike `topQueries` (top-N by clicks),
 *  EVERY target is reported — including the ones that don't rank yet, which
 *  are exactly the ones the client wants to see progress on. */
export type GscTargetRank = {
  keyword: string;
  /** Average position this month, or null when the keyword returned no
   *  impressions at all (i.e. it isn't ranking in a way GSC can see). */
  position: number | null;
  previousPosition: number | null;
  /** Positions gained vs. the prior month (positive = moved up the page).
   *  null when there's nothing to compare against. */
  change: number | null;
  clicks: number;
  impressions: number;
  /** True when the keyword had no impressions in the prior month but does
   *  now — its first month on the board. */
  isNew: boolean;
};

export type GscMonthlyReport =
  | { status: "not-configured" }
  | { status: "no-property" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      siteUrl: string;
      totals: GscTotals;
      prevTotals: GscTotals | null;
      topQueries: KeywordRow[];
      topPages: GscPageRow[];
      keywordStats: GscKeywordStats;
      topMovers: GscMover[];
      targetRanks: GscTargetRank[];
      /** Série mensal para o gráfico de evolução, na ordem de
       *  `opts.trendMonths`. null = mês anterior ao primeiro com dados. */
      trend?: { clicks: (number | null)[]; impressions: (number | null)[] };
    };

/** How many query rows to scan when locating target keywords. Targets are
 *  often long-tail with few clicks, so the default 200-row stats pull would
 *  miss them — GSC sorts by clicks, not by relevance to us. */
const TARGET_MATCH_ROWS = 5000;

/** How many position-gain candidates to surface for the consultant to pick
 *  from. The report itself still shows at most 5. */
const MOVER_CANDIDATES = 20;

/** GSC lowercases and strips accents inconsistently across locales; compare
 *  on a normalised form so "fisioterapia lisboa" matches what we stored. */
function kwKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .replace(/\s+/g, " ");
}

/** Match every target keyword against the month's query rows. Keywords with
 *  no row are returned with `position: null` rather than dropped — "ainda não
 *  rankeia" is information the client asked for. */
function buildTargetRanks(
  targets: string[],
  currentRows: GscApiRow[],
  previousRows: GscApiRow[],
): GscTargetRank[] {
  const cur = new Map<string, GscApiRow>();
  for (const r of currentRows) {
    const k = kwKey(r.keys[0] ?? "");
    if (k && !cur.has(k)) cur.set(k, r);
  }
  const prev = new Map<string, number>();
  for (const r of previousRows) {
    const k = kwKey(r.keys[0] ?? "");
    if (k && !prev.has(k)) prev.set(k, r.position);
  }

  const seen = new Set<string>();
  const out: GscTargetRank[] = [];
  for (const raw of targets) {
    const k = kwKey(raw);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const row = cur.get(k);
    const prevPos = prev.get(k);
    const position = row && row.position > 0 ? round1(row.position) : null;
    out.push({
      keyword: raw.trim(),
      position,
      previousPosition: prevPos === undefined ? null : round1(prevPos),
      change:
        position === null || prevPos === undefined
          ? null
          : round1(prevPos - position),
      clicks: row?.clicks ?? 0,
      impressions: row?.impressions ?? 0,
      isNew: position !== null && prevPos === undefined,
    });
  }
  // Best rank first; everything that doesn't rank yet sinks to the bottom.
  return out.sort((a, b) => {
    if (a.position === null && b.position === null) {
      return a.keyword.localeCompare(b.keyword);
    }
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  });
}

/** Search Console totals + top-N queries/pages for an explicit calendar-month
 *  window (and the prior month for deltas). Unlike getSiteAuditData's rolling
 *  window, the report always covers a complete month — the caller passes the
 *  ranges from report-dates. Reuses the same query helpers + property match. */
export async function getGscMonthlyReport(
  slug: string,
  opts: {
    current: { startDate: string; endDate: string };
    previous: { startDate: string; endDate: string };
    siteUrlOverride?: string | null;
    topLimit?: number;
    /** The client's committed target keywords. Every one is reported with
     *  its current position — see `targetRanks` on the result. */
    targetKeywords?: string[];
    /** Meses ("2025-09" … "2026-08", mais antigo primeiro) a puxar para o
     *  gráfico de evolução. Ausente = não se puxa série nenhuma. */
    trendMonths?: string[];
  },
): Promise<GscMonthlyReport> {
  if (!googleAuthConfigured) return { status: "not-configured" };

  const override = opts.siteUrlOverride?.trim() || GSC_PROPERTY_OVERRIDES[slug];
  const site = CLIENT_WEBSITES[slug];
  const domain = site ? domainFromUrl(site) : null;
  if (!override && !domain) return { status: "no-property" };

  try {
    const token = await getGoogleAccessToken(SCOPES);
    let siteUrl: string | null = override ?? null;
    if (!siteUrl && domain) siteUrl = matchProperty(domain, await listSites(token));
    if (!siteUrl) return { status: "no-property" };

    const { current, previous } = opts;
    const limit = opts.topLimit ?? 10;
    // Pull a broad query set (not just the top-N by clicks) so the keyword
    // footprint stats + movers reflect the whole site, not only the headliners.
    const statLimit = Math.max(limit, 200);

    // Target keywords need a much wider net than the stats pull: GSC sorts
    // by clicks, and a keyword we're working on may sit at position 40 with
    // a handful of impressions. Fetched separately so the existing
    // keywordStats figures keep their current basis and stay comparable
    // month to month.
    const targets = (opts.targetKeywords ?? []).filter((k) => k.trim());
    const wantTargets = targets.length > 0;

    const trendMonths = (opts.trendMonths ?? []).filter((m) =>
      /^\d{4}-\d{2}$/.test(m),
    );

    const [
      totals,
      prevTotals,
      queryRows,
      prevQueryRows,
      pages,
      targetCurRows,
      targetPrevRows,
      trendByMonth,
    ] = await Promise.all([
      queryTotals(token, siteUrl, current.startDate, current.endDate),
      queryTotals(token, siteUrl, previous.startDate, previous.endDate).catch(
        () => null,
      ),
      queryRange(token, siteUrl, current.startDate, current.endDate, statLimit),
      queryRange(token, siteUrl, previous.startDate, previous.endDate, 1000).catch(
        () => [] as GscApiRow[],
      ),
      queryPages(token, siteUrl, current.startDate, current.endDate, limit),
      wantTargets
        ? queryRange(
            token,
            siteUrl,
            current.startDate,
            current.endDate,
            TARGET_MATCH_ROWS,
          ).catch(() => [] as GscApiRow[])
        : Promise.resolve([] as GscApiRow[]),
      wantTargets
        ? queryRange(
            token,
            siteUrl,
            previous.startDate,
            previous.endDate,
            TARGET_MATCH_ROWS,
          ).catch(() => [] as GscApiRow[])
        : Promise.resolve([] as GscApiRow[]),
      // Evolução mensal. Best-effort: sem isto o relatório sai na mesma.
      trendMonths.length
        ? queryMonthlyTotals(
            token,
            siteUrl,
            `${trendMonths[0]}-01`,
            current.endDate,
          ).catch(
            () => new Map<string, { clicks: number; impressions: number }>(),
          )
        : Promise.resolve(
            new Map<string, { clicks: number; impressions: number }>(),
          ),
    ]);

    const prevByQuery = new Map(
      prevQueryRows.map((r) => [r.keys[0], r.position] as const),
    );

    // Top-N by clicks (GSC returns clicks-desc) for the headline table.
    const topQueries: KeywordRow[] = queryRows.slice(0, limit).map((r) => {
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

    // Position footprint over the broad set.
    const withPos = queryRows.filter((r) => r.position > 0);
    const imprSum = withPos.reduce((t, r) => t + r.impressions, 0);
    const avgPosition =
      imprSum > 0
        ? withPos.reduce((t, r) => t + r.position * r.impressions, 0) / imprSum
        : withPos.length
          ? withPos.reduce((t, r) => t + r.position, 0) / withPos.length
          : 0;
    const keywordStats: GscKeywordStats = {
      total: withPos.length,
      top3: withPos.filter((r) => r.position <= 3).length,
      top10: withPos.filter((r) => r.position <= 10).length,
      top20: withPos.filter((r) => r.position <= 20).length,
      avgPosition: round1(avgPosition),
      // Queries with impressions now that had none in the prior month.
      newKeywords: withPos.filter((r) => !prevByQuery.has(r.keys[0])).length,
      improved: withPos.filter((r) => {
        const p = prevByQuery.get(r.keys[0]);
        return p !== undefined && p - r.position > 0.1;
      }).length,
      enteredTop10: withPos.filter((r) => {
        const p = prevByQuery.get(r.keys[0]);
        return r.position <= 10 && (p === undefined || p > 10);
      }).length,
      enteredTop3: withPos.filter((r) => {
        const p = prevByQuery.get(r.keys[0]);
        return r.position <= 3 && (p === undefined || p > 3);
      }).length,
    };

    // Biggest ranking improvements vs. the prior month.
    const topMovers: GscMover[] = queryRows
      .map((r) => {
        const prevPos = prevByQuery.get(r.keys[0]);
        return {
          query: r.keys[0] ?? "",
          position: round1(r.position),
          clicks: r.clicks,
          change: prevPos === undefined ? 0 : round1(prevPos - r.position),
        };
      })
      .filter((m) => m.change > 0.1)
      .sort((a, b) => b.change - a.change)
      // 20 candidates, not 5: the consultant curates which ones reach the
      // client (a competitor's brand name or an off-strategy term can win on
      // raw movement and still be the wrong thing to show).
      .slice(0, MOVER_CANDIDATES);

    return {
      status: "ok",
      siteUrl,
      totals: totals ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      prevTotals,
      topQueries,
      topPages: pages,
      keywordStats,
      topMovers,
      targetRanks: wantTargets
        ? buildTargetRanks(targets, targetCurRows, targetPrevRows)
        : [],
      trend: trendMonths.length
        ? (() => {
            // Antes do primeiro mês com dados a propriedade não estava
            // verificada — é null, não zero.
            const first = trendMonths.findIndex((m) => trendByMonth.has(m));
            const pick = (f: (v: { clicks: number; impressions: number }) => number) =>
              trendMonths.map((m, i) =>
                first === -1 || i < first ? null : f(trendByMonth.get(m) ?? { clicks: 0, impressions: 0 }),
              );
            return { clicks: pick((v) => v.clicks), impressions: pick((v) => v.impressions) };
          })()
        : undefined,
    };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error ? err.message : "Search Console request failed",
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
