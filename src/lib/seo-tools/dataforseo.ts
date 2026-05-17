// DataforSEO integration: domain intelligence for the SEO Audit.
//
// Auth: HTTP Basic with DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD (set in
// Vercel env). Sign up at https://app.dataforseo.com/register — credentials
// come from the API Dashboard, not OAuth. Pay-per-use, no minimum.
//
// We pull three things in one call to keep cost low:
//   1. Domain rank overview (organic keywords, est. traffic value)
//   2. Backlinks summary (referring domains, backlinks, domain rank)
//   3. Top ranked keywords (positions, search volume, traffic estimate)
//
// All endpoints accept arrays so future expansion (multi-domain compare,
// competitor pull) is the same shape.

const API_BASE = "https://api.dataforseo.com/v3";

/** Read env at call time rather than module load so a missed redeploy or
 *  late env injection can't bake a stale "false" into the bundle. */
export function isDataforSeoConfigured(): boolean {
  return Boolean(
    process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD,
  );
}

export type DomainMetrics = {
  source: "dataforseo";
  fetchedAt: number;
  target: string;
  locationCode: number;
  languageCode: string;
  // Authority / rank
  rank?: number; // domain rank 0-1000 from backlinks API
  rankNormalised?: number | null; // 0-100 normalised score
  // Organic
  organicKeywords?: number;
  organicEtv?: number; // estimated traffic value (≈ monthly clicks proxy)
  organicCount?: { top3: number; top10: number; top100: number };
  paidKeywords?: number;
  // Backlinks
  referringDomains?: number;
  backlinks?: number;
  brokenBacklinks?: number;
  dofollow?: number;
  // Top keywords
  topKeywords?: DomainTopKeyword[];
  // Errors per sub-pull (so we can show partial data)
  errors: { source: string; message: string }[];
};

export type DomainTopKeyword = {
  keyword: string;
  position: number;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  intent: string | null;
  estTraffic: number | null;
  url: string | null;
};

type DfsResult<T> = {
  tasks?: {
    status_code?: number;
    status_message?: string;
    result?: T[];
  }[];
};

async function dfsPost<TBody, TResult>(
  path: string,
  body: TBody,
): Promise<DfsResult<TResult>> {
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString("base64");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `DataforSEO ${path} HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }
  return (await res.json()) as DfsResult<TResult>;
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Defaults: Portugal (Lisbon). Override per-call if a client targets a
// different geo.
const DEFAULT_LOCATION = 2620; // Portugal
const DEFAULT_LANGUAGE = "pt"; // Portuguese; switch to "en" for ihn/insync-design

type RankOverviewResult = {
  items?: {
    metrics?: {
      organic?: {
        count?: number;
        etv?: number;
        pos_1?: number;
        pos_2_3?: number;
        pos_4_10?: number;
        pos_11_20?: number;
        pos_21_30?: number;
        pos_31_40?: number;
        pos_41_50?: number;
        pos_51_60?: number;
        pos_61_70?: number;
        pos_71_80?: number;
        pos_81_90?: number;
        pos_91_100?: number;
      };
      paid?: { count?: number };
    };
  }[];
};

type BacklinksSummaryResult = {
  backlinks?: number;
  referring_domains?: number;
  broken_backlinks?: number;
  rank?: number;
  dofollow?: number;
};

type RankedKeywordItem = {
  keyword_data?: {
    keyword?: string;
    keyword_info?: {
      search_volume?: number | null;
      cpc?: number | null;
      competition?: number | null;
      search_intent_info?: { main_intent?: string };
    };
  };
  ranked_serp_element?: {
    serp_item?: {
      rank_group?: number;
      url?: string;
      etv?: number;
    };
  };
};

type RankedKeywordsResult = {
  items?: RankedKeywordItem[];
};

async function fetchRankOverview(
  target: string,
  locationCode: number,
  languageCode: string,
): Promise<{
  organicKeywords?: number;
  organicEtv?: number;
  organicCount?: { top3: number; top10: number; top100: number };
  paidKeywords?: number;
}> {
  const body = [
    {
      target,
      location_code: locationCode,
      language_code: languageCode,
    },
  ];
  const res = await dfsPost<typeof body, RankOverviewResult>(
    "/dataforseo_labs/google/domain_rank_overview/live",
    body,
  );
  const item = res.tasks?.[0]?.result?.[0]?.items?.[0];
  const o = item?.metrics?.organic;
  const p = item?.metrics?.paid;
  if (!o && !p) return {};
  const top3 = (o?.pos_1 ?? 0) + (o?.pos_2_3 ?? 0);
  const top10 = top3 + (o?.pos_4_10 ?? 0);
  const top100 =
    top10 +
    (o?.pos_11_20 ?? 0) +
    (o?.pos_21_30 ?? 0) +
    (o?.pos_31_40 ?? 0) +
    (o?.pos_41_50 ?? 0) +
    (o?.pos_51_60 ?? 0) +
    (o?.pos_61_70 ?? 0) +
    (o?.pos_71_80 ?? 0) +
    (o?.pos_81_90 ?? 0) +
    (o?.pos_91_100 ?? 0);
  return {
    organicKeywords: o?.count,
    organicEtv: o?.etv,
    organicCount: { top3, top10, top100 },
    paidKeywords: p?.count,
  };
}

async function fetchBacklinksSummary(
  target: string,
): Promise<{
  rank?: number;
  rankNormalised?: number | null;
  referringDomains?: number;
  backlinks?: number;
  brokenBacklinks?: number;
  dofollow?: number;
}> {
  const body = [{ target, include_subdomains: true }];
  const res = await dfsPost<typeof body, BacklinksSummaryResult>(
    "/backlinks/summary/live",
    body,
  );
  const item = res.tasks?.[0]?.result?.[0];
  if (!item) return {};
  return {
    rank: item.rank,
    rankNormalised:
      typeof item.rank === "number" ? Math.round(item.rank / 10) : null,
    referringDomains: item.referring_domains,
    backlinks: item.backlinks,
    brokenBacklinks: item.broken_backlinks,
    dofollow: item.dofollow,
  };
}

async function fetchTopKeywords(
  target: string,
  locationCode: number,
  languageCode: string,
  limit = 15,
): Promise<DomainTopKeyword[]> {
  const body = [
    {
      target,
      location_code: locationCode,
      language_code: languageCode,
      limit,
      order_by: ["ranked_serp_element.serp_item.etv,desc"],
      filters: [
        ["ranked_serp_element.serp_item.rank_group", "<=", 50],
      ],
    },
  ];
  const res = await dfsPost<typeof body, RankedKeywordsResult>(
    "/dataforseo_labs/google/ranked_keywords/live",
    body,
  );
  const items = res.tasks?.[0]?.result?.[0]?.items ?? [];
  return items.map((it): DomainTopKeyword => {
    const kw = it.keyword_data;
    const serp = it.ranked_serp_element?.serp_item;
    return {
      keyword: kw?.keyword ?? "",
      position: serp?.rank_group ?? 0,
      searchVolume: kw?.keyword_info?.search_volume ?? null,
      cpc: kw?.keyword_info?.cpc ?? null,
      competition: kw?.keyword_info?.competition ?? null,
      intent: kw?.keyword_info?.search_intent_info?.main_intent ?? null,
      estTraffic: serp?.etv ?? null,
      url: serp?.url ?? null,
    };
  });
}

export async function fetchDomainMetrics(
  siteUrl: string,
  opts: { locationCode?: number; languageCode?: string } = {},
): Promise<DomainMetrics | null> {
  if (!isDataforSeoConfigured()) return null;
  const target = hostnameFromUrl(siteUrl);
  const locationCode = opts.locationCode ?? DEFAULT_LOCATION;
  const languageCode = opts.languageCode ?? DEFAULT_LANGUAGE;

  const errors: { source: string; message: string }[] = [];
  const [rankRes, backlinksRes, kwRes] = await Promise.allSettled([
    fetchRankOverview(target, locationCode, languageCode),
    fetchBacklinksSummary(target),
    fetchTopKeywords(target, locationCode, languageCode, 15),
  ]);

  const out: DomainMetrics = {
    source: "dataforseo",
    fetchedAt: Date.now(),
    target,
    locationCode,
    languageCode,
    errors,
  };

  if (rankRes.status === "fulfilled") {
    Object.assign(out, rankRes.value);
  } else {
    errors.push({
      source: "rank-overview",
      message:
        rankRes.reason instanceof Error
          ? rankRes.reason.message
          : String(rankRes.reason),
    });
  }
  if (backlinksRes.status === "fulfilled") {
    Object.assign(out, backlinksRes.value);
  } else {
    errors.push({
      source: "backlinks-summary",
      message:
        backlinksRes.reason instanceof Error
          ? backlinksRes.reason.message
          : String(backlinksRes.reason),
    });
  }
  if (kwRes.status === "fulfilled") {
    out.topKeywords = kwRes.value;
  } else {
    errors.push({
      source: "ranked-keywords",
      message:
        kwRes.reason instanceof Error
          ? kwRes.reason.message
          : String(kwRes.reason),
    });
  }

  return out;
}

export function formatDomainMetricsForPrompt(m: DomainMetrics): string {
  const lines: string[] = [];
  lines.push(`## Domain intelligence (DataforSEO)`);
  lines.push(`Target: ${m.target} · Geo: ${m.locationCode} · Lang: ${m.languageCode}`);
  lines.push("");
  lines.push("**Authority:**");
  lines.push(
    `- Domain Rank: ${m.rank ?? "—"} (raw 0-1000)${m.rankNormalised !== null && m.rankNormalised !== undefined ? ` · Normalised: ${m.rankNormalised}/100` : ""}`,
  );
  lines.push(
    `- Referring domains: ${m.referringDomains ?? "—"} · Backlinks: ${m.backlinks ?? "—"} · Dofollow: ${m.dofollow ?? "—"} · Broken: ${m.brokenBacklinks ?? "—"}`,
  );
  lines.push("");
  lines.push("**Organic footprint:**");
  lines.push(`- Organic keywords: ${m.organicKeywords ?? "—"}`);
  if (m.organicCount) {
    lines.push(
      `  - Top 3: ${m.organicCount.top3} · Top 10: ${m.organicCount.top10} · Top 100: ${m.organicCount.top100}`,
    );
  }
  lines.push(
    `- Estimated organic traffic value (ETV, proxy for monthly clicks): ${m.organicEtv ?? "—"}`,
  );
  lines.push(`- Paid keywords: ${m.paidKeywords ?? "—"}`);

  if (m.topKeywords && m.topKeywords.length > 0) {
    lines.push("");
    lines.push("**Top ranked keywords (by est. traffic):**");
    lines.push("| # | Keyword | Pos | Volume | Intent | ETV | URL |");
    lines.push("|---|---|---:|---:|---|---:|---|");
    m.topKeywords.slice(0, 15).forEach((k, i) => {
      lines.push(
        `| ${i + 1} | ${k.keyword} | ${k.position} | ${k.searchVolume ?? "—"} | ${k.intent ?? "—"} | ${k.estTraffic ?? "—"} | ${k.url ? k.url.replace(m.target, "") : "—"} |`,
      );
    });
  }

  if (m.errors.length > 0) {
    lines.push("");
    lines.push(`**Partial data — these sub-pulls failed:**`);
    for (const e of m.errors) lines.push(`- ${e.source}: ${e.message}`);
  }

  return lines.join("\n");
}
