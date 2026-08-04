// SE Ranking integration — TRUE SERP positions for the keywords we committed
// to work, alongside the GSC average-position view already in the report.
//
// Why both: GSC "position" is an average over the impressions Google chose to
// serve, so a keyword with no impressions simply vanishes and a keyword shown
// once at #3 reads better than one shown 400 times at #6. SE Ranking checks a
// fixed SERP on a schedule, so it answers the question a client actually asks
// — "where am I for this keyword, today".
//
// Auth: one account key (SERANKING_API_KEY) sent as `Authorization: Token …`.
// The same key authorises the Project API and the Data API; the trial banner's
// "Data API only" refers to the credit-metered research endpoints — project
// management is plan-gated (tracked-keyword quota), not credit-gated.
//
// Rate limit is a documented 5 req/s, so every call goes through a small
// serialising throttle rather than Promise.all.

import { getClientGeo } from "./client-geo";
import { getClientWebsite } from "./client-meta";
import type {
  SeRankingBlock,
  SeRankingRank,
} from "./report/report-types";

const BASE = "https://api.seranking.com/v1/project-management";

/** Read env at call time — a late env injection or missed redeploy must not
 *  bake a stale "false" into the bundle (same rule as dataforseo.ts). */
export function isSeRankingConfigured(): boolean {
  return Boolean(process.env.SERANKING_API_KEY);
}

// --- Rate limiting -------------------------------------------------------
// 5 req/s is the documented ceiling; 220ms between calls keeps us under it
// even when several syncs overlap in the same lambda.
const MIN_GAP_MS = 220;
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  // Keep the chain alive even when a call rejects, else one failure wedges
  // every later request behind a permanently rejected promise.
  chain = run.catch(() => undefined);
  return run;
}

export class SeRankingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SeRankingError";
  }
}

async function srFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const key = process.env.SERANKING_API_KEY;
  if (!key) throw new SeRankingError("SERANKING_API_KEY is not set.", 0);

  return throttle(async () => {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Token ${key}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new SeRankingError(
        `SE Ranking ${init.method ?? "GET"} ${path} → ${res.status}. ${text.slice(0, 200)}`,
        res.status,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  });
}

// --- Search engines ------------------------------------------------------
// We track the MOBILE Google SERP per country: the roster is local health &
// wellness businesses whose clients search on a phone, and it's the engine
// the two hand-built projects (B-Life, Mimus) already use — so auto-provisioned
// projects stay comparable with them.
const MOBILE_ENGINE_BY_COUNTRY: Record<string, number> = {
  Portugal: 1675,
  "United Kingdom": 1708,
  Canada: 1568,
  Brazil: 1563,
  Australia: 1551,
  Spain: 1591,
  France: 1596,
  Germany: 1582,
  Belgium: 1555,
  "United States": 1540,
};

/** The engine a client's keywords are checked on. No region: the engine is
 *  already country-scoped, and SE Ranking rejects the country as a location
 *  name ("Invalid location name and search engine pair") — a region has to be
 *  a place INSIDE it, like "Cascais, Lisbon, Portugal". National tracking is
 *  the honest default; a consultant who wants city-level rankings sets the
 *  region on the project in SE Ranking, and the next sync leaves it alone. */
export function engineForSlug(slug: string): {
  engineId: number;
  langCode: string;
} {
  const geo = getClientGeo(slug);
  return {
    engineId: MOBILE_ENGINE_BY_COUNTRY[geo.countryLabel] ?? 1675,
    langCode: geo.languageCode,
  };
}

// --- Types ---------------------------------------------------------------

export type SeRankingSite = {
  id: number;
  title: string;
  name: string;
  is_active: number;
};

export type SeRankingEngine = {
  site_engine_id: number;
  search_engine_id: number;
  region_name: string | null;
  lang_code: string | null;
  keyword_count: number;
};

export type SeRankingKeyword = {
  id: string;
  name: string;
  site_engine_ids: number[];
};

type PositionEntry = { date: string; pos: number; is_map?: number };
type PositionKeyword = {
  id: string;
  name: string;
  volume: number | null;
  positions: PositionEntry[];
};
type PositionEngine = { site_engine_id: number; keywords: PositionKeyword[] };

// --- Reads ---------------------------------------------------------------

export function listSites(): Promise<SeRankingSite[]> {
  return srFetch<SeRankingSite[]>("/sites");
}

export function listSiteEngines(siteId: number): Promise<SeRankingEngine[]> {
  return srFetch<SeRankingEngine[]>(`/sites/search-engines?site_id=${siteId}`);
}

export function listSiteKeywords(siteId: number): Promise<SeRankingKeyword[]> {
  return srFetch<SeRankingKeyword[]>(`/keywords?site_id=${siteId}`);
}

/** Strip scheme/www/trailing slash so "https://www.mimus.pt/" and
 *  "mimus.pt" compare equal. */
export function normaliseDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  }
}

/** Find an existing SE Ranking project for a client's domain. Lets us adopt
 *  the projects the team already built by hand instead of duplicating them. */
export async function findSiteForSlug(
  slug: string,
): Promise<SeRankingSite | null> {
  const website = getClientWebsite(slug);
  if (!website) return null;
  const domain = normaliseDomain(website);
  const sites = await listSites();
  return sites.find((s) => normaliseDomain(s.name) === domain) ?? null;
}

// --- Writes --------------------------------------------------------------

export async function createSite(
  url: string,
  title: string,
): Promise<number> {
  const res = await srFetch<{ site_id: number }>("/sites", {
    method: "POST",
    body: { url, title },
  });
  return res.site_id;
}

export async function addSearchEngine(
  siteId: number,
  engine: { engineId: number; langCode: string },
): Promise<number> {
  const res = await srFetch<{ site_engine_id: number }>(
    `/sites/search-engines?site_id=${siteId}`,
    {
      method: "POST",
      body: {
        search_engine_id: engine.engineId,
        lang_code: engine.langCode,
      },
    },
  );
  return res.site_engine_id;
}

/** Add keywords to a project. The endpoint takes a BARE ARRAY (not an object)
 *  and the field is `keyword`, not `name` — both differ from the read shape. */
export async function addKeywords(
  siteId: number,
  keywords: string[],
  siteEngineIds: number[],
): Promise<number> {
  if (keywords.length === 0) return 0;
  let added = 0;
  // Chunked so one oversized client can't blow the request limit.
  for (let i = 0; i < keywords.length; i += 100) {
    const chunk = keywords.slice(i, i + 100);
    const res = await srFetch<{ added: number }>(
      `/keywords?site_id=${siteId}`,
      {
        method: "POST",
        body: chunk.map((keyword) => ({
          keyword,
          site_engine_ids: siteEngineIds,
        })),
      },
    );
    added += res.added ?? 0;
  }
  return added;
}

// --- Positions -----------------------------------------------------------

const toPos = (p: number): number | null => (p > 0 ? p : null);

/** Latest entry on or before `end` (entries come oldest-first). */
function lastUpTo(entries: PositionEntry[], end: string): PositionEntry | null {
  let best: PositionEntry | null = null;
  for (const e of entries) {
    if (e.date <= end && (!best || e.date > best.date)) best = e;
  }
  return best;
}

function lastWithin(
  entries: PositionEntry[],
  start: string,
  end: string,
): PositionEntry | null {
  let best: PositionEntry | null = null;
  for (const e of entries) {
    if (e.date >= start && e.date <= end && (!best || e.date > best.date)) {
      best = e;
    }
  }
  return best;
}

/** True SERP positions for a client's tracked keywords, resolved against a
 *  report period.
 *
 *  Inside the period we show the last check of that month and the month-over-
 *  month move. When the period predates tracking there is nothing to show from
 *  that month, so we fall back to the most recent check and flag it via
 *  `outsidePeriod` — the report then labels the date instead of pretending the
 *  number belongs to the reported month. */
export async function getSeRankingRanks(
  siteId: number,
  window: {
    start: string;
    end: string;
    prevStart: string;
    prevEnd: string;
  },
): Promise<SeRankingBlock | null> {
  // One pull covering the comparison month through today, so we can resolve
  // both the in-period value and the MoM baseline without a second request.
  const today = new Date().toISOString().slice(0, 10);
  const to = window.end > today ? today : window.end;
  const engines = await srFetch<PositionEngine[]>(
    `/sites/positions?site_id=${siteId}&date_from=${window.prevStart}&date_to=${today}`,
  );

  const rows: PositionKeyword[] = engines.flatMap((e) => e.keywords ?? []);
  if (rows.length === 0) return null;

  // Does any keyword have a check inside the reported month?
  const anyInPeriod = rows.some((k) =>
    lastWithin(k.positions ?? [], window.start, to),
  );

  let checkedOn = "";
  const ranks: SeRankingRank[] = rows.map((k) => {
    const entries = k.positions ?? [];
    const current = anyInPeriod
      ? lastWithin(entries, window.start, to)
      : lastUpTo(entries, today);
    const previous = anyInPeriod
      ? lastWithin(entries, window.prevStart, window.prevEnd)
      : null;
    if (current && current.date > checkedOn) checkedOn = current.date;

    const pos = current ? toPos(current.pos) : null;
    const prev = previous ? toPos(previous.pos) : null;
    return {
      keyword: k.name,
      position: pos,
      previousPosition: prev,
      // Only a move between two ranked checks is meaningful: entering or
      // leaving the top 100 isn't a "+12 places" story.
      change: pos !== null && prev !== null ? prev - pos : null,
      volume: k.volume ?? null,
      inLocalPack: Boolean(current?.is_map),
    };
  });

  if (!checkedOn) return null;

  // Best rank first, unranked last — the client reads the wins at the top.
  ranks.sort((a, b) => {
    if (a.position === null && b.position === null)
      return a.keyword.localeCompare(b.keyword);
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  });

  return { siteId, checkedOn, outsidePeriod: !anyInPeriod, ranks };
}
