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
import { getCountryFallback, type LocationTarget } from "../location-targets";

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
  /** When the original (city) target returned no data and we retried with
   *  the parent country, this records the original attempt so the prompt
   *  can flag it to Claude. */
  fallbackInfo?: {
    triedLabel: string;
    triedCode: number;
    fellBackTo: string;
    reason: string;
  };
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
  /** Per-run override for the geo target. When omitted, falls back to
   *  getClientGeo(clientSlug). Use this to sharpen a research run to a
   *  specific city (e.g. "Lisbon" for a Lisbon-focused dental clinic
   *  campaign) without rewriting the client's default. */
  locationOverride?: LocationTarget;
  /** Human-readable client name. Used to identify brand tokens when
   *  picking non-branded expansion seeds from the domain's ranked
   *  keywords. Falls back to clientSlug when omitted. */
  clientName?: string;
  /** Extra text (typically the onboarding form's extracted text) used by
   *  the Stage 3 fallback to mine topical nouns when the domain footprint
   *  is too thin. Cap to a few KB before passing. */
  extraSeedText?: string;
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
  locationCode: number,
  languageCode: string,
  limit: number,
): Promise<KwIdea[]> {
  // Pull the domain's full ranked-keyword footprint sorted by ETV. We DON'T
  // filter by seed words here — that was the v69.3 bug that returned only 3
  // keywords for Clínica Mimus, because the auto-derived seed "Clínica
  // Mimus services" gated everything not containing those tokens. The
  // domain's full footprint is the most reliable foundation for any
  // research run; Claude does the topical filtering downstream.
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
  return items
    .map((it) => {
      if (!it.keyword_data) return null;
      return mapItem(it.keyword_data, "ranked");
    })
    .filter((x): x is KwIdea => x !== null);
}

/** Extract single topical nouns from a text blob. Used by the Stage 3
 *  emergency fallback to find usable seeds when the domain footprint is
 *  too thin to expand from. Strips brand tokens, common stopwords, and
 *  short tokens. Returns up to `count` nouns ordered by frequency. */
function pickTopicNouns(
  blob: string,
  clientName: string,
  count: number,
): string[] {
  if (!blob) return [];
  const brandTokens = new Set(
    clientName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
  const STOP = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "are",
    "you",
    "your",
    "our",
    "what",
    "where",
    "when",
    "como",
    "para",
    "com",
    "dos",
    "das",
    "uma",
    "umas",
    "uns",
    "que",
    "qual",
    "quais",
    "este",
    "esta",
    "isso",
    "isto",
    "mais",
    "menos",
    "muito",
    "sobre",
    "entre",
    "por",
    "pelo",
    "pela",
    "sem",
    "sob",
    "ate",
    "até",
    "ser",
    "ter",
    "estar",
    "have",
    "has",
    "had",
    "los",
    "las",
    "que",
    "del",
    "una",
    "uno",
    "para",
  ]);
  const counts = new Map<string, number>();
  const tokens = blob
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);
  for (const t of tokens) {
    if (t.length < 4) continue;
    if (STOP.has(t)) continue;
    if (brandTokens.has(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([t]) => t);
}

/** Pick the best N non-branded, non-trivial keywords from the domain's
 *  ranked footprint to use as expansion seeds for keyword_ideas. Excludes
 *  the client's own brand tokens (e.g. "mimus", "clínica mimus") which
 *  would just return more branded variants. */
function pickExpansionSeeds(
  ranked: KwIdea[],
  clientName: string,
  count: number,
): string[] {
  const brandTokens = new Set(
    clientName
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
  const seen = new Set<string>();
  const picked: string[] = [];
  for (const k of ranked) {
    const kw = k.keyword.toLowerCase().trim();
    if (!kw || kw.length < 4) continue;
    if (seen.has(kw)) continue;
    // Skip pure-brand or branded-only keywords. "mimus" alone → skip.
    // "mimus clínica" → skip. "implantes dentários lisboa" → keep.
    const tokens = kw.split(/\s+/);
    const nonBrandTokens = tokens.filter((t) => !brandTokens.has(t));
    if (nonBrandTokens.length === 0) continue;
    // Single-word keywords are usually too generic to expand productively
    // ("psicologia" → low signal); prefer 2+ word phrases.
    if (tokens.length < 2) continue;
    seen.add(kw);
    picked.push(k.keyword);
    if (picked.length >= count) break;
  }
  return picked;
}

export async function runKeywordResearch(
  seedTopic: string,
  clientSlug: string,
  opts: KwResearchOptions = {},
): Promise<KwResearchPack | null> {
  if (!isConfigured()) return null;
  const firstPack = await runOnce(seedTopic, clientSlug, opts);
  if (!firstPack) return null;

  // Graceful fallback: when the consultant picked a city-level target but
  // DataforSEO returned no data (likely a bad city code OR a city too
  // small for Google Keyword Planner), retry with the parent country.
  // Some keyword data is more useful than none.
  const cityTarget = opts.locationOverride;
  const empty =
    firstPack.suggestions.length === 0 &&
    firstPack.ideas.length === 0 &&
    firstPack.domainExisting.length === 0;
  if (cityTarget && cityTarget.scope !== "country" && empty) {
    const fallback = getCountryFallback(cityTarget);
    if (fallback) {
      const retry = await runOnce(seedTopic, clientSlug, {
        ...opts,
        locationOverride: fallback,
      });
      if (retry) {
        retry.fallbackInfo = {
          triedLabel: cityTarget.label,
          triedCode: cityTarget.locationCode,
          fellBackTo: fallback.label,
          reason:
            firstPack.errors.length > 0
              ? firstPack.errors[0].message.slice(0, 200)
              : "Zero keywords returned at city resolution — likely a bad city code or city too small for Google Keyword Planner data.",
        };
        return retry;
      }
    }
  }
  return firstPack;
}

async function runOnce(
  seedTopic: string,
  clientSlug: string,
  opts: KwResearchOptions,
): Promise<KwResearchPack | null> {
  const defaultGeo = getClientGeo(clientSlug);
  const geo = opts.locationOverride
    ? {
        locationCode: opts.locationOverride.locationCode,
        languageCode: opts.locationOverride.languageCode,
        countryLabel: opts.locationOverride.label,
      }
    : defaultGeo;
  const limit = opts.perEndpointLimit ?? 300;
  const competitorDomains = (opts.competitorDomains ?? [])
    .map((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0])
    .filter(Boolean)
    .slice(0, 5);

  const errors: { source: string; message: string }[] = [];

  // --- STAGE 1: domain ranked (foundation) + competitors, in parallel ---
  // Domain ranked is unfiltered now (v69.4 fix — was returning 3 keywords
  // for Clínica Mimus because the seed-word filter gated everything). This
  // is the most reliable signal for any research run.
  const [domainRes, ...compResults] = await Promise.allSettled([
    opts.target
      ? fetchDomainExistingKeywords(
          opts.target,
          geo.locationCode,
          geo.languageCode,
          500,
        )
      : Promise.resolve<KwIdea[]>([]),
    ...competitorDomains.map((d) =>
      fetchDomainExistingKeywords(d, geo.locationCode, geo.languageCode, 300),
    ),
  ]);

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

  // --- STAGE 2: per-seed keyword_suggestions in parallel ---
  // v69.5 fix: keyword_ideas with multi-seed returns near-empty for narrow
  // domains (DataforSEO seems to take the intersection of related ideas
  // across seeds — when seeds are diverse, the intersection is tiny).
  // Per-seed keyword_suggestions returns 50-300 keywords per seed and is
  // the right tool for expansion. We call it for: the user's seed (if any)
  // + the top non-branded expansion seeds from the domain footprint +
  // each competitor's strongest keyword.
  const clientName = opts.clientName ?? clientSlug;
  const expansionSeeds = pickExpansionSeeds(domainExisting, clientName, 4);
  const competitorSeeds = competitors
    .flatMap((c) => c.keywords.slice(0, 2).map((k) => k.keyword))
    .filter((s) => s && s.trim().length > 2)
    .slice(0, 3);

  // Per-seed suggestions. Keep the total parallel calls bounded so we
  // don't blow the function budget — cap at 8 individual calls.
  const userSeedCalls = seedTopic
    ? [{ seed: seedTopic, source: "suggestions" as const }]
    : [];
  const expansionCalls = expansionSeeds.map((seed) => ({
    seed,
    source: "ideas" as const, // bucket non-user-seed expansions as "ideas"
  }));
  const competitorCalls = competitorSeeds.map((seed) => ({
    seed,
    source: "ideas" as const,
  }));
  const allSeedCalls = [
    ...userSeedCalls,
    ...expansionCalls,
    ...competitorCalls,
  ].slice(0, 8);

  const perSeedResults = await Promise.allSettled(
    allSeedCalls.map((c) =>
      fetchKeywordSuggestions(c.seed, geo.locationCode, geo.languageCode, limit),
    ),
  );

  // Bucket results into suggestions (only from the user's seed) vs ideas
  // (everything else). Dedupe within each bucket.
  const suggestionsRaw: KwIdea[] = [];
  const ideasRaw: KwIdea[] = [];
  perSeedResults.forEach((res, i) => {
    const call = allSeedCalls[i];
    if (res.status === "fulfilled") {
      const tagged = res.value.map((k) => ({ ...k, source: call.source }));
      if (call.source === "suggestions") suggestionsRaw.push(...tagged);
      else ideasRaw.push(...tagged);
    } else {
      errors.push({
        source: `keyword_suggestions:${call.seed.slice(0, 40)}`,
        message:
          res.reason instanceof Error ? res.reason.message : String(res.reason),
      });
    }
  });

  function dedupeByKw(list: KwIdea[]): KwIdea[] {
    const seen = new Set<string>();
    const out: KwIdea[] = [];
    for (const k of list) {
      const id = k.keyword.toLowerCase().trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(k);
    }
    return out;
  }
  const suggestions = dedupeByKw(suggestionsRaw);
  let ideas = dedupeByKw(ideasRaw);

  // --- STAGE 3 (emergency fallback): when total < 30 keywords ---
  // Pull single-word "topical noun" seeds from anywhere we have signal
  // (the domain footprint, the user seed, the onboarding extracted text)
  // and hit keyword_suggestions for each. Catches narrow domains like
  // brand-name-only clinics where the standard 2-stage pull is thin.
  const totalSoFar =
    suggestions.length + ideas.length + domainExisting.length;
  if (totalSoFar < 30) {
    const topicNouns = pickTopicNouns(
      [...domainExisting.map((k) => k.keyword), seedTopic, opts.extraSeedText ?? ""]
        .filter(Boolean)
        .join(" "),
      clientName,
      4,
    );
    if (topicNouns.length > 0) {
      const fallbackResults = await Promise.allSettled(
        topicNouns.map((seed) =>
          fetchKeywordSuggestions(seed, geo.locationCode, geo.languageCode, limit),
        ),
      );
      const extra: KwIdea[] = [];
      fallbackResults.forEach((res, i) => {
        if (res.status === "fulfilled") {
          const tagged = res.value.map((k) => ({
            ...k,
            source: "ideas" as const,
          }));
          extra.push(...tagged);
        } else {
          errors.push({
            source: `keyword_suggestions(fallback):${topicNouns[i]}`,
            message:
              res.reason instanceof Error
                ? res.reason.message
                : String(res.reason),
          });
        }
      });
      // Merge + dedupe (don't double-count ideas already present).
      const existingIdeaKeys = new Set(ideas.map((k) => k.keyword.toLowerCase()));
      const newOnes = extra.filter(
        (k) => !existingIdeaKeys.has(k.keyword.toLowerCase()),
      );
      ideas = dedupeByKw([...ideas, ...newOnes]);
    }
  }

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
  if (pack.fallbackInfo) {
    lines.push(
      `\n> ⚠️ **Geo fallback applied.** The original target **${pack.fallbackInfo.triedLabel}** (code ${pack.fallbackInfo.triedCode}) returned no data, so DataforSEO was re-queried with **${pack.fallbackInfo.fellBackTo}**. Reason: ${pack.fallbackInfo.reason}\n> Tell the consultant in the Overview that **city-level data is unavailable for this geo** and recommendations are at country resolution. Where local intent matters, still bake the original city's modifier into recommended keywords — the consultant chose that city for a reason.`,
    );
  }
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
