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

/** Two-part public suffixes we actually have clients on. Needed so
 *  `insyncdesign.com.au` reduces to itself and not to `com.au`. */
const TWO_PART_SUFFIXES = new Set([
  "com.au",
  "co.uk",
  "com.br",
  "com.pt",
  "org.uk",
  "co.nz",
  "com.es",
]);

/** Registrable domain for a host — `shop.clinicaemcasa.pt` → `clinicaemcasa.pt`.
 *  Used as the fallback match key when a GA4 web stream is registered on a
 *  subdomain (or a different subdomain) of the client's site. */
function apexOf(host: string): string {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join(".");
  return TWO_PART_SUFFIXES.has(lastTwo)
    ? parts.slice(-3).join(".")
    : lastTwo;
}

/** The brand label of a domain — `clinicaemcasa.pt` → `clinicaemcasa`. */
function brandOf(host: string): string {
  return apexOf(host).split(".")[0] ?? host;
}

/** Lowercase, de-accented, alphanumerics only. `"Clínica em Casa"` and
 *  `"clinicaemcasa.pt"` both collapse to `clinicaemcasa`, which is what
 *  makes name matching work across the agency's naming habits. */
function normaliseName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Shortest brand label we'll name-match on. Below this, containment
 *  matches get noisy ("cdt" would hit half the account list). */
const MIN_BRAND_LEN = 6;

/** Resolve by GA4 property NAME rather than by the stream's website URL.
 *  The stream `defaultUri` is a cosmetic field consultants rarely update —
 *  it goes stale after a site migration or is left on a builder's staging
 *  URL — while the property name almost always still reads as the client.
 *  Exact normalised equality wins; otherwise a containment match is only
 *  accepted when exactly ONE property matches, so we never guess between
 *  two plausible candidates. */
function matchByName(
  brand: string,
  props: PropertySummary[],
): { propertyId: string; displayName: string } | null {
  if (brand.length < MIN_BRAND_LEN) return null;
  const exact = props.filter((p) => normaliseName(p.displayName) === brand);
  if (exact.length === 1) return exact[0];
  const contains = props.filter((p) => {
    const n = normaliseName(p.displayName);
    return n.includes(brand) || brand.includes(n);
  });
  return contains.length === 1 ? contains[0] : null;
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
export type DomainIndex = {
  /** Exact stream host (www-stripped) → property id. */
  byHost: Map<string, string>;
  /** Registrable domain → property id. Fallback for streams registered on
   *  a subdomain (`book.safeaway.pt`) or on the www host of a site we
   *  store bare (and vice-versa). */
  byApex: Map<string, string>;
  /** Property ids whose dataStreams call never succeeded. When this is
   *  non-empty the index is INCOMPLETE — a client whose property is in
   *  here would wrongly look "Not connected". */
  failedProperties: string[];
  /** Measurement ID do stream web ("G-ABC123", em maiúsculas) → property id.
   *  É o código que um consultor encontra no GA4 ou no GTM do site — mais
   *  fácil de copiar do que o número da propriedade (v77.9). */
  byMeasurementId: Map<string, string>;
};

let cachedDomainIndex: { index: DomainIndex; expires: number } | null = null;
// Same in-flight guard for the (expensive, fan-out) domain index build —
// without it, 21 concurrent client lookups each fan out across every
// property's dataStreams, a request storm that can time out and make the
// whole rollup come back empty.
let domainIndexInFlight: Promise<DomainIndex> | null = null;

/** Full TTL — only used when every property resolved cleanly. */
const INDEX_TTL_OK = 30 * 60_000;
/** Short TTL for a partial index, so a transient 429 self-heals in
 *  minutes instead of pinning "Not connected" for half an hour. */
const INDEX_TTL_PARTIAL = 60_000;
/** Max concurrent dataStreams calls. The previous unbounded Promise.all
 *  over every property is what tripped Google's per-minute quota. */
const STREAM_CONCURRENCY = 6;

async function getDomainIndex(token: string): Promise<DomainIndex> {
  if (cachedDomainIndex && cachedDomainIndex.expires > Date.now()) {
    return cachedDomainIndex.index;
  }
  if (domainIndexInFlight) return domainIndexInFlight;
  domainIndexInFlight = buildDomainIndex(token).finally(() => {
    domainIndexInFlight = null;
  });
  return domainIndexInFlight;
}

/** Moeda em que a propriedade contabiliza a receita ("GBP", "EUR"…).
 *  O runReport devolve números sem moeda: sem isto, a receita de uma loja
 *  britânica saía com o símbolo € do default do cliente (v77.10). null = a
 *  Admin API não respondeu; o caller cai na moeda configurada. */
export async function getGa4PropertyCurrency(
  token: string,
  propertyId: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { currencyCode?: string };
    const code = (json.currencyCode ?? "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** One dataStreams call with retry on the transient failures Google
 *  actually returns under fan-out: 429 (quota) and 5xx. Returns null
 *  only when every attempt failed — the caller records that as a gap
 *  rather than silently pretending the property has no web stream. */
async function fetchDataStreams(
  propertyId: string,
  token: string,
): Promise<
  { webStreamData?: { defaultUri?: string; measurementId?: string } }[] | null
> {
  const backoff = [250, 750, 2000];
  for (let attempt = 0; attempt <= backoff.length; attempt++) {
    try {
      const res = await fetch(
        `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/dataStreams`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      if (res.ok) {
        const json = (await res.json()) as {
          dataStreams?: {
            webStreamData?: { defaultUri?: string; measurementId?: string };
          }[];
        };
        return json.dataStreams ?? [];
      }
      // 403/404 are permanent for this property (no access / deleted) —
      // not a gap we should retry or flag.
      if (res.status === 403 || res.status === 404) return [];
      if (res.status !== 429 && res.status < 500) return [];
    } catch {
      /* network blip — fall through to retry */
    }
    const wait = backoff[attempt];
    if (wait !== undefined) {
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return null;
}

async function buildDomainIndex(token: string): Promise<DomainIndex> {
  const props = await listProperties(token);
  const byHost = new Map<string, string>();
  const byApex = new Map<string, string>();
  const byMeasurementId = new Map<string, string>();
  const failedProperties: string[] = [];

  // Bounded worker pool over the property list.
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= props.length) return;
      const { propertyId } = props[i];
      const streams = await fetchDataStreams(propertyId, token);
      if (streams === null) {
        failedProperties.push(propertyId);
        continue;
      }
      for (const ds of streams) {
        const mid = ds.webStreamData?.measurementId?.trim().toUpperCase();
        if (mid && !byMeasurementId.has(mid)) byMeasurementId.set(mid, propertyId);
        const host = ds.webStreamData?.defaultUri
          ? hostFromUrl(ds.webStreamData.defaultUri)
          : null;
        if (!host) continue;
        if (!byHost.has(host)) byHost.set(host, propertyId);
        const apex = apexOf(host);
        if (!byApex.has(apex)) byApex.set(apex, propertyId);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(STREAM_CONCURRENCY, props.length) }, worker),
  );

  const index: DomainIndex = { byHost, byApex, failedProperties, byMeasurementId };
  cachedDomainIndex = {
    index,
    expires:
      Date.now() +
      (failedProperties.length ? INDEX_TTL_PARTIAL : INDEX_TTL_OK),
  };
  return index;
}

/** Per-client GA4 property id saved in the Monthly Report config. The
 *  report already honours this; the panel used to ignore it, so a client
 *  could show live numbers in the report and "Not connected" on its file.
 *  Never throws — a KV blip must not break resolution. */
async function storedPropertyId(slug: string): Promise<string | null> {
  try {
    const { getReportConfig } = await import("./report/report-config-store");
    const config = await getReportConfig(slug);
    const id = config.ga4PropertyId?.trim();
    return id ? id : null;
  } catch {
    return null;
  }
}

async function resolvePropertyId(
  slug: string,
  token: string,
): Promise<string | null> {
  const override = GA4_PROPERTY_OVERRIDES[slug];
  if (override) return override;
  const stored = await storedPropertyId(slug);
  if (stored) return stored;

  const site = CLIENT_WEBSITES[slug];
  const host = site ? hostFromUrl(site) : null;
  if (!host) return null;

  // Exact host first, then registrable domain — so a stream registered on
  // `www.`/a subdomain of the client's site still matches.
  const index = await getDomainIndex(token);
  const byDomain =
    index.byHost.get(host) ?? index.byApex.get(apexOf(host)) ?? null;
  if (byDomain) return byDomain;

  // Last resort: match the property NAME. Catches clients whose stream
  // website URL is stale or was never set to the live domain.
  return matchByName(brandOf(host), await listProperties(token))?.propertyId
    ?? null;
}

/** Why did resolution succeed or fail for this client? Powers
 *  /api/diagnostics/ga4-test — never called on the render path. */
export async function explainGa4Resolution(slug: string): Promise<{
  slug: string;
  website: string | null;
  host: string | null;
  apex: string | null;
  brand: string | null;
  override: string | null;
  stored: string | null;
  matchedBy: "override" | "stored" | "host" | "apex" | "name" | null;
  propertyId: string | null;
  matchedName: string | null;
  indexedHosts: number;
  failedProperties: string[];
  apexCandidates: string[];
  /** Property names whose normalised form shares any prefix with the
   *  client's brand — the shortlist to eyeball when nothing matched. */
  nameCandidates: string[];
}> {
  const site = CLIENT_WEBSITES[slug] || null;
  const host = site ? hostFromUrl(site) : null;
  const override = GA4_PROPERTY_OVERRIDES[slug] ?? null;
  const stored = await storedPropertyId(slug);
  const base = {
    slug,
    website: site,
    host,
    apex: host ? apexOf(host) : null,
    brand: host ? brandOf(host) : null,
    override,
    stored,
    matchedName: null as string | null,
    indexedHosts: 0,
    failedProperties: [] as string[],
    apexCandidates: [] as string[],
    nameCandidates: [] as string[],
  };
  if (override) {
    return { ...base, matchedBy: "override" as const, propertyId: override };
  }
  if (stored) {
    return { ...base, matchedBy: "stored" as const, propertyId: stored };
  }
  if (!host) return { ...base, matchedBy: null, propertyId: null };

  const token = await getGoogleAccessToken(SCOPES);
  const index = await getDomainIndex(token);
  const props = await listProperties(token);
  const apex = apexOf(host);
  const brand = brandOf(host);
  const byHost = index.byHost.get(host) ?? null;
  const byApex = index.byApex.get(apex) ?? null;
  const byName = byHost || byApex ? null : matchByName(brand, props);

  return {
    ...base,
    indexedHosts: index.byHost.size,
    failedProperties: index.failedProperties,
    // Stream hosts sharing this client's registrable domain — shows when a
    // property exists but sits on an unexpected subdomain.
    apexCandidates: [...index.byHost.keys()].filter((h) => apexOf(h) === apex),
    // Loose shortlist (first 4 chars of the brand) so a human can spot the
    // right property even when our matcher deliberately refused to guess.
    nameCandidates: props
      .filter((p) => normaliseName(p.displayName).includes(brand.slice(0, 4)))
      .map((p) => `${p.displayName} (${p.propertyId})`),
    matchedName: byName?.displayName ?? null,
    matchedBy: byHost
      ? ("host" as const)
      : byApex
        ? ("apex" as const)
        : byName
          ? ("name" as const)
          : null,
    propertyId: byHost ?? byApex ?? byName?.propertyId ?? null,
  };
}

/** Um Measurement ID ("G-ABC123") → o property id numérico a que pertence,
 *  ou null se nenhum stream visível o tiver. É o que permite ao consultor
 *  colar o código do GA4/GTM em vez de procurar o número da propriedade. */
export async function resolveGa4MeasurementId(
  measurementId: string,
): Promise<string | null> {
  if (!googleAuthConfigured) return null;
  const token = await getGoogleAccessToken(SCOPES);
  const index = await getDomainIndex(token);
  return index.byMeasurementId.get(measurementId.trim().toUpperCase()) ?? null;
}

/** Every GA4 property the connected account can see. When a client is
 *  unresolved AND its property isn't in here, the service account simply
 *  hasn't been granted access — no code change can fix that. */
export async function listVisibleGa4Properties(): Promise<PropertySummary[]> {
  const token = await getGoogleAccessToken(SCOPES);
  return listProperties(token);
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
