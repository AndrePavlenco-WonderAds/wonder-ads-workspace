// Keyword Research tool — pulls DataforSEO keyword data for a seed topic
// scoped to the client's actual geo. Output is a markdown fact pack that
// SEO Claude can cluster + prioritise.
//
// Phase strategy (v1): single-call. We pull three things in parallel:
//   1. keyword_suggestions/live  — same-stem expansions of the seed
//   2. keyword_ideas/live        — related ideas (broader semantic net)
//   3. ranked_keywords/live      — what the domain already ranks for
//
// If we exceed Vercel's 60s budget, split into /prep-kw + /run-kw like
// the SEO Audit.

import { getClientGeo } from "../client-geo";

const API_BASE = "https://api.dataforseo.com/v3";

export type KwIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational"
  | null;

export type KwIdea = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  competitionLevel: string | null;
  /** Keyword Difficulty 0-100 (when DataforSEO returns it). */
  difficulty: number | null;
  intent: KwIntent;
  monthlyTrend: number[] | null; // last 12 months of search volume
  /** Source endpoint label, for the fact pack. */
  source: "suggestions" | "ideas" | "ranked";
};

export type CompetitorKeywords = {
  domain: string;
  keywords: KwIdea[];
};

export type KwResearchPack = {
  seedTopic: string;
  geo: { locationCode: number; languageCode: string; countryLabel: string };
  /** Direct expansions of the seed. */
  suggestions: KwIdea[];
  /** Broader semantic ideas. */
  ideas: KwIdea[];
  /** Keywords the domain already ranks for that match the seed theme. */
  domainExisting: KwIdea[];
  /** Keywords each competitor (from onboarding form) ranks for, filtered to
   *  the seed theme. Empty when no competitors are provided. */
  competitors: CompetitorKeywords[];
  errors: { source: string; message: string }[];
  fetchedAt: number;
};

export type KwResearchOptions = {
  /** Filter the final list to this intent. "all" disables filtering. */
  intent?: "all" | "informational" | "commercial" | "transactional" | "navigational";
  /** Max ideas per endpoint (DataforSEO supports up to 700 for ideas). */
  perEndpointLimit?: number;
  /** Optional domain target for ranked_keywords pull. */
  target?: string;
  /** Competitor domains (from the onboarding form). For each, we pull
   *  ranked_keywords filtered to the seed theme. Capped to 5 to keep the
   *  call within Vercel's 60s budget. */
  competitorDomains?: string[];
};

function isConfigured(): boolean {
  return Boolean(
    process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD,
  );
}

async function dfsPost<TBody, TResp>(
  path: string,
  body: TBody,
): Promise<TResp> {
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
  const json = (await res.json()) as TResp & {
    tasks?: { status_code?: number; status_message?: string }[];
  };
  const task = json.tasks?.[0];
  if (task?.status_code && task.status_code >= 40000) {
    throw new Error(
      `DataforSEO ${path} task error ${task.status_code}: ${task.status_message ?? "unknown"}`,
    );
  }
  return json as TResp;
}

type KeywordInfoBlob = {
  keyword?: string;
  keyword_info?: {
    search_volume?: number | null;
    cpc?: number | null;
    competition?: number | null;
    competition_level?: string | null;
    search_intent_info?: { main_intent?: string };
    monthly_searches?: { year?: number; month?: number; search_volume?: number }[];
  };
  keyword_properties?: { keyword_difficulty?: number | null };
};

function mapItem(
  raw: KeywordInfoBlob,
  source: KwIdea["source"],
): KwIdea | null {
  const keyword = raw.keyword?.trim();
  if (!keyword) return null;
  const info = raw.keyword_info ?? {};
  const intent =
    (info.search_intent_info?.main_intent as KwIntent) ?? null;
  const monthly = info.monthly_searches ?? [];
  return {
    keyword,
    searchVolume: info.search_volume ?? null,
    cpc: info.cpc ?? null,
    competition: info.competition ?? null,
    competitionLevel: info.competition_level ?? null,
    difficulty: raw.keyword_properties?.keyword_difficulty ?? null,
    intent,
    monthlyTrend:
      monthly.length > 0
        ? monthly.slice(0, 12).map((m) => m.search_volume ?? 0)
        : null,
    source,
  };
}

async function fetchKeywordSuggestions(
  seed: string,
  locationCode: number,
  languageCode: string,
  limit: number,
): Promise<KwIdea[]> {
  const body = [
    {
      keyword: seed,
      location_code: locationCode,
      language_code: languageCode,
      include_serp_info: false,
      include_seed_keyword: true,
      limit,
    },
  ];
  type Resp = {
    tasks?: { result?: { items?: KeywordInfoBlob[] }[] }[];
  };
  const res = await dfsPost<typeof body, Resp>(
    "/dataforseo_labs/google/keyword_suggestions/live",
    body,
  );
  const items = res.tasks?.[0]?.result?.[0]?.items ?? [];
  return items
    .map((it) => mapItem(it, "suggestions"))
    .filter((x): x is KwIdea => x !== null);
}

async function fetchKeywordIdeas(
  seeds: string[],
  locationCode: number,
  languageCode: string,
  limit: number,
): Promise<KwIdea[]> {
  const body = [
    {
      keywords: seeds.slice(0, 20),
      location_code: locationCode,
      language_code: languageCode,
      limit,
      order_by: ["keyword_info.search_volume,desc"],
    },
  ];
  type Resp = {
    tasks?: { result?: { items?: KeywordInfoBlob[] }[] }[];
  };
  const res = await dfsPost<typeof body, Resp>(
    "/dataforseo_labs/google/keyword_ideas/live",
    body,
  );
  const items = res.tasks?.[0]?.result?.[0]?.items ?? [];
  return items
    .map((it) => mapItem(it, "ideas"))
    .filter((x): x is KwIdea => x !== null);
}

async function fetchDomainExistingKeywords(
  target: string,
  seedTopic: string,
  locationCode: number,
  languageCode: string,
  limit: number,
): Promise<KwIdea[]> {
  // Pull the domain's ranked keywords, then filter to those that semantically
  // match the seed theme so we surface the existing footprint relevant to
  // this research run. (Cheap filter — Claude does the real clustering.)
  const body = [
    {
      target,
      location_code: locationCode,
      language_code: languageCode,
      limit,
      order_by: ["ranked_serp_element.serp_item.etv,desc"],
      historical_serp_mode: "live",
    },
  ];
  type Resp = {
    tasks?: {
      result?: {
        items?: {
          keyword_data?: KeywordInfoBlob;
          ranked_serp_element?: {
            serp_item?: { rank_group?: number; etv?: number };
          };
        }[];
      }[];
    }[];
  };
  const res = await dfsPost<typeof body, Resp>(
    "/dataforseo_labs/google/ranked_keywords/live",
    body,
  );
  const items = res.tasks?.[0]?.result?.[0]?.items ?? [];
  const seedWords = seedTopic
    .toLowerCase()
    .split(/[\s,/]+/)
    .filter((w) => w.length > 3);
  return items
    .map((it) => {
      if (!it.keyword_data) return null;
      const mapped = mapItem(it.keyword_data, "ranked");
      return mapped;
    })
    .filter((x): x is KwIdea => x !== null)
    .filter((k) => {
      if (seedWords.length === 0) return true;
      const kw = k.keyword.toLowerCase();
      return seedWords.some((w) => kw.includes(w));
    });
}

export async function runKeywordResearch(
  seedTopic: string,
  clientSlug: string,
  opts: KwResearchOptions = {},
): Promise<KwResearchPack | null> {
  if (!isConfigured()) return null;
  const geo = getClientGeo(clientSlug);
  const limit = opts.perEndpointLimit ?? 300;
  const competitorDomains = (opts.competitorDomains ?? [])
    .map((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0])
    .filter(Boolean)
    .slice(0, 5);

  const errors: { source: string; message: string }[] = [];
  const [sugRes, ideasRes, domainRes, ...compResults] = await Promise.allSettled([
    fetchKeywordSuggestions(seedTopic, geo.locationCode, geo.languageCode, limit),
    fetchKeywordIdeas([seedTopic], geo.locationCode, geo.languageCode, limit),
    opts.target
      ? fetchDomainExistingKeywords(
          opts.target,
          seedTopic,
          geo.locationCode,
          geo.languageCode,
          500,
        )
      : Promise.resolve<KwIdea[]>([]),
    ...competitorDomains.map((d) =>
      fetchDomainExistingKeywords(d, seedTopic, geo.locationCode, geo.languageCode, 300),
    ),
  ]);

  const suggestions =
    sugRes.status === "fulfilled" ? sugRes.value : [];
  if (sugRes.status === "rejected") {
    errors.push({
      source: "keyword_suggestions",
      message:
        sugRes.reason instanceof Error
          ? sugRes.reason.message
          : String(sugRes.reason),
    });
  }
  const ideas = ideasRes.status === "fulfilled" ? ideasRes.value : [];
  if (ideasRes.status === "rejected") {
    errors.push({
      source: "keyword_ideas",
      message:
        ideasRes.reason instanceof Error
          ? ideasRes.reason.message
          : String(ideasRes.reason),
    });
  }
  const domainExisting =
    domainRes.status === "fulfilled" ? domainRes.value : [];
  if (domainRes.status === "rejected") {
    errors.push({
      source: "ranked_keywords",
      message:
        domainRes.reason instanceof Error
          ? domainRes.reason.message
          : String(domainRes.reason),
    });
  }

  const competitors: CompetitorKeywords[] = [];
  competitorDomains.forEach((domain, i) => {
    const res = compResults[i];
    if (res?.status === "fulfilled") {
      competitors.push({ domain, keywords: res.value });
    } else if (res?.status === "rejected") {
      errors.push({
        source: `competitor:${domain}`,
        message:
          res.reason instanceof Error ? res.reason.message : String(res.reason),
      });
    }
  });

  let combined = { suggestions, ideas, domainExisting };
  if (opts.intent && opts.intent !== "all") {
    const filterByIntent = (list: KwIdea[]) =>
      list.filter((k) => k.intent === opts.intent);
    combined = {
      suggestions: filterByIntent(combined.suggestions),
      ideas: filterByIntent(combined.ideas),
      domainExisting: combined.domainExisting, // never filter ranked — context
    };
  }

  return {
    seedTopic,
    geo,
    suggestions: combined.suggestions,
    ideas: combined.ideas,
    domainExisting: combined.domainExisting,
    competitors,
    errors,
    fetchedAt: Date.now(),
  };
}

// ---- Prompt formatting ----

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v < 1000) return v.toString();
  if (v < 1_000_000) return `${(v / 1000).toFixed(1)}k`;
  return `${(v / 1_000_000).toFixed(2)}M`;
}

function fmtIdeaRow(k: KwIdea): string {
  const vol = fmtNum(k.searchVolume);
  const kd = k.difficulty != null ? `${k.difficulty}` : "—";
  const intent = k.intent ?? "—";
  const cpc = k.cpc != null ? `$${k.cpc.toFixed(2)}` : "—";
  return `| ${k.keyword} | ${vol} | ${kd} | ${intent} | ${cpc} |`;
}

function dedupeByKeyword(list: KwIdea[]): KwIdea[] {
  const seen = new Set<string>();
  const out: KwIdea[] = [];
  for (const k of list) {
    const key = k.keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

export function formatKwPackForPrompt(pack: KwResearchPack): string {
  const lines: string[] = [];
  lines.push(`## Keyword research data — DataforSEO Labs`);
  lines.push(
    `- **Seed topic:** ${pack.seedTopic}\n- **Geo:** ${pack.geo.countryLabel} (location_code ${pack.geo.locationCode}, language ${pack.geo.languageCode})\n- **Pulled:** ${new Date(pack.fetchedAt).toISOString()}`,
  );
  if (pack.errors.length > 0) {
    lines.push(`- **Partial errors:**`);
    for (const e of pack.errors) lines.push(`  - ${e.source}: ${e.message}`);
  }

  const TBL_HEADER = `| Keyword | Vol/mo | KD | Intent | CPC |\n|---|---:|---:|---|---:|`;

  // Suggestions (top 100 by volume)
  const topSuggestions = dedupeByKeyword(pack.suggestions)
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
    .slice(0, 100);
  lines.push(`\n### Direct suggestions (${topSuggestions.length} shown / ${pack.suggestions.length} total)`);
  if (topSuggestions.length === 0) {
    lines.push(`_No suggestions returned._`);
  } else {
    lines.push(TBL_HEADER);
    for (const k of topSuggestions) lines.push(fmtIdeaRow(k));
  }

  // Ideas (top 100 by volume, deduped vs suggestions)
  const seedSet = new Set(topSuggestions.map((k) => k.keyword.toLowerCase()));
  const topIdeas = dedupeByKeyword(pack.ideas)
    .filter((k) => !seedSet.has(k.keyword.toLowerCase()))
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
    .slice(0, 100);
  lines.push(`\n### Broader related ideas (${topIdeas.length} shown / ${pack.ideas.length} total)`);
  if (topIdeas.length === 0) {
    lines.push(`_No related ideas returned._`);
  } else {
    lines.push(TBL_HEADER);
    for (const k of topIdeas) lines.push(fmtIdeaRow(k));
  }

  // Domain existing (top 60 by ETV-equivalent ordering — server already
  // returned them ETV-sorted)
  if (pack.domainExisting.length > 0) {
    const topDomain = dedupeByKeyword(pack.domainExisting).slice(0, 60);
    lines.push(
      `\n### Already-ranking keywords on the client's domain matching this theme (${topDomain.length} shown / ${pack.domainExisting.length} total)`,
    );
    lines.push(TBL_HEADER);
    for (const k of topDomain) lines.push(fmtIdeaRow(k));
    lines.push(
      `\n> The above are keywords the domain ALREADY ranks for. Treat these as **optimisation/expansion** targets (often quick wins) rather than greenfield.`,
    );
  }

  // Competitor keywords (per-competitor section)
  if (pack.competitors.length > 0) {
    lines.push(`\n### Competitor keyword footprints (from the onboarding form)`);
    lines.push(
      `> The client named the following competitors in their onboarding form. For each we pulled the keywords they ALREADY rank for in the client's geo, filtered to the seed theme. **Cross-reference these against the client's own footprint to find:** (a) high-value keywords competitors win that the client doesn't, (b) clusters worth attacking, (c) opportunities the onboarding form didn't name but the data clearly supports.`,
    );
    for (const c of pack.competitors) {
      const top = dedupeByKeyword(c.keywords).slice(0, 30);
      lines.push(`\n#### ${c.domain} (${top.length} shown / ${c.keywords.length} total)`);
      if (top.length === 0) {
        lines.push(`_No keywords matched the seed theme for this competitor._`);
        continue;
      }
      lines.push(TBL_HEADER);
      for (const k of top) lines.push(fmtIdeaRow(k));
    }
  }

  return lines.join("\n");
}
