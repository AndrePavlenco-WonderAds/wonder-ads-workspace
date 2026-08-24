// Academic-literature grounding for the Blog Article Writer.
//
// WHY THIS EXISTS
// Until now the writer could only cite sources it had memorised during
// training, so `BLOG_WRITER_LINK_VERIFICATION` forced it to emit
// `[link to be added by consultant]` for anything off the domain
// whitelist. That is safe but it pushes the work onto the consultant and
// leaves most articles citing nothing but WHO/DGS landing pages. This
// module fetches REAL, peer-reviewed papers for the article's topic
// before drafting, verifies each one resolves, and hands the writer a
// closed list it is allowed to cite — the same discipline
// `internal-linking.ts` applies to internal URLs.
//
// WHY NOT GOOGLE SCHOLAR ITSELF
// Google Scholar publishes no API and its terms forbid automated access;
// requests from datacenter IPs (i.e. every Vercel function) get a CAPTCHA
// rather than results, so a scraper here would fail in production even if
// it passed locally. What Scholar actually indexes, though, is available
// through APIs that are free, permissive and richer in metadata:
//
//   • OpenAlex   — 250M+ works, successor to Microsoft Academic Graph.
//                  Citation counts, venue, open-access links, DOIs, and
//                  author IDs we can resolve to an h-index.
//   • Europe PMC — life sciences + medicine, i.e. most of our clients
//                  (dental, physio, optics, clinics). Adds PubMed IDs.
//   • SerpApi    — literal Google Scholar results. Only used when
//                  `SERPAPI_KEY` is set; nothing here depends on it.
//
// Everything is best-effort: any provider failing degrades to the others,
// and all providers failing degrades to today's behaviour (no academic
// block in the prompt, writer falls back to the whitelist).

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

const OPENALEX = "https://api.openalex.org";
const EUROPE_PMC = "https://www.ebi.ac.uk/europepmc/webservices/rest";
const SERPAPI = "https://serpapi.com/search";

/** OpenAlex serves a faster "polite pool" to callers who identify
 *  themselves with a contact address. Opt-in via env so no address is sent
 *  to a third party unless someone deliberately configures one. Unset just
 *  means the common pool, which still works. */
const MAILTO = process.env.OPENALEX_MAILTO?.trim() || null;

const QUERY_MODEL = "claude-haiku-4-5-20251001";

export type ScholarProvider = "openalex" | "europepmc" | "google-scholar";

export type ScholarAuthor = {
  name: string;
  /** Author-level h-index from OpenAlex. Null when not resolved. */
  hIndex: number | null;
  institution: string | null;
  /** OpenAlex author key (`A…`), when the paper came from OpenAlex. Used to
   *  match the enrichment response back by ID — display names differ in
   *  accents and initials between the work record and the author record,
   *  so name matching silently drops authors. */
  openAlexId?: string | null;
};

export type ScholarPaper = {
  /** Stable key for dedupe — lowercased DOI when present, else title. */
  key: string;
  title: string;
  authors: ScholarAuthor[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  /** Always a resolvable link — doi.org when we have a DOI. */
  url: string;
  /** Free full text, when the paper is open access. */
  openAccessUrl: string | null;
  citationCount: number;
  isOpenAccess: boolean;
  /** Highest h-index among the paper's resolved authors. */
  topAuthorHIndex: number | null;
  /** 0–100. See `scoreAuthority`. */
  authorityScore: number;
  provider: ScholarProvider;
  abstract: string | null;
};

export type ScholarResult = {
  /** True when at least one verified paper came back. */
  ok: boolean;
  papers: ScholarPaper[];
  /** The academic queries actually run, for the consultant's audit trail. */
  queries: string[];
  /** True when the queries came from the keyword-stripping fallback rather
   *  than the translation model. Portuguese search terms against an
   *  English-dominant corpus return much weaker matches, so the runner
   *  warns the consultant instead of passing off the result as normal. */
  usedFallbackQuery: boolean;
  providers: ScholarProvider[];
  /** Candidates seen before verification + ranking. */
  found: number;
  /** Dropped because the DOI would not resolve. */
  unverified: number;
  reason?: string;
};

export const EMPTY_SCHOLAR_RESULT: ScholarResult = {
  ok: false,
  papers: [],
  queries: [],
  usedFallbackQuery: false,
  providers: [],
  found: 0,
  unverified: 0,
  reason: "Academic search did not run.",
};

// ---------------------------------------------------------------- queries

/** Health/medical topics get the Europe PMC pass as well — that corpus is
 *  where clinical evidence for our clinic clients actually lives. */
const MEDICAL_HINT =
  /\b(saúde|saude|clinic|clínic|dent|denta|implant|ortodont|fisio|physio|escoliose|scolios|coluna|spine|dor|pain|terapia|therap|médic|medic|doente|patient|diagnóst|diagnos|tratament|treatment|cirurg|surg|nutri|psicolog|psycholog|ocular|oftalm|optic|ótic|visão|vision|osteopat|reabilit|rehabilit|vacina|vaccin|cancro|cancer|diabet|cardio|derma|pele|skin)/i;

export function looksMedical(text: string): boolean {
  return MEDICAL_HINT.test(text);
}

/** Strip the geo/commercial modifiers that make a marketing keyword and
 *  keep the clinical noun phrase. Fallback when the model call fails. */
function heuristicQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(
      /\b(em|no|na|nos|nas|de|do|da|dos|das|para|com|the|in|at|for|of|best|melhor|melhores|preço|precos|preços|custo|barato|perto|near me|lisboa|porto|cascais|algarve|portugal|braga|coimbra|clinica|clínica|consultório|consultorio)\b/g,
      " ",
    )
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 8)
    .join(" ");
}

/** Turn the consultant's brief (often Portuguese, often local-SEO shaped)
 *  into 1–3 English academic search queries. Scholarly corpora are
 *  English-dominant, so "tratamento de escoliose em Lisboa" finds nothing
 *  useful until it becomes "scoliosis conservative treatment outcomes". */
export async function buildAcademicQueries(seed: {
  topic?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string;
  referenceFocus?: string;
  signal?: AbortSignal;
}): Promise<{ queries: string[]; fallback: boolean }> {
  const raw = [seed.topic, seed.primaryKeyword, seed.referenceFocus]
    .filter((v) => (v ?? "").trim().length > 0)
    .join(" · ")
    .slice(0, 600);
  if (!raw) return { queries: [], fallback: false };

  const degraded = {
    queries: [heuristicQuery(seed.primaryKeyword || seed.topic || "")].filter(
      Boolean,
    ),
    fallback: true,
  };

  if (!process.env.ANTHROPIC_API_KEY) return degraded;

  try {
    const { text } = await generateText({
      model: anthropic(QUERY_MODEL),
      abortSignal: seed.signal,
      maxOutputTokens: 300,
      system:
        "You convert marketing article briefs into search queries for academic literature databases (OpenAlex, Europe PMC). " +
        "Return ONLY a JSON array of 1-3 strings, no prose, no code fences.\n" +
        "Rules: queries MUST be in English (scholarly corpora are English-dominant). " +
        "Strip city names, country names, brand names, prices and commercial modifiers — they never appear in paper titles. " +
        "Keep the clinical/technical concept and the outcome being studied. " +
        "Prefer 3-6 words per query. Do not add quotes or boolean operators.",
      prompt:
        `Article brief:\n${raw}\n\n` +
        `Return the JSON array of academic search queries.`,
    });
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return degraded;
    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return degraded;
    const queries = parsed
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim())
      .filter((q) => q.length > 2)
      .slice(0, 3);
    return queries.length > 0 ? { queries, fallback: false } : degraded;
  } catch {
    return degraded;
  }
}

// -------------------------------------------------------------- providers

function openAlexUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${OPENALEX}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (MAILTO) url.searchParams.set("mailto", MAILTO);
  return url.toString();
}

/** OpenAlex stores abstracts as an inverted index (word → positions).
 *  Rebuild enough of it for the writer to know what the paper claims. */
function rebuildAbstract(
  inverted: Record<string, number[]> | null | undefined,
  max = 420,
): string | null {
  if (!inverted) return null;
  const positions: Array<[number, string]> = [];
  for (const [word, idxs] of Object.entries(inverted)) {
    for (const i of idxs) positions.push([i, word]);
  }
  if (positions.length === 0) return null;
  positions.sort((a, b) => a[0] - b[0]);
  const text = positions.map(([, w]) => w).join(" ");
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

type OpenAlexWork = {
  id?: string;
  doi?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  cited_by_count?: number | null;
  is_retracted?: boolean;
  abstract_inverted_index?: Record<string, number[]> | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null } | null;
  primary_location?: {
    source?: { display_name?: string | null } | null;
  } | null;
  authorships?: Array<{
    author?: { id?: string | null; display_name?: string | null } | null;
    institutions?: Array<{ display_name?: string | null }> | null;
  }> | null;
};

/** OpenAlex author id → the raw `A…` key the /authors filter expects. */
function authorKey(id: string | null | undefined): string | null {
  if (!id) return null;
  const tail = id.split("/").pop();
  return tail && /^A\d+$/.test(tail) ? tail : null;
}

async function searchOpenAlex(
  query: string,
  opts: { minYear: number; perQuery: number; signal?: AbortSignal },
): Promise<ScholarPaper[]> {
  const url = openAlexUrl("/works", {
    search: query,
    filter: [
      `from_publication_date:${opts.minYear}-01-01`,
      "type:article",
      "has_doi:true",
      "is_retracted:false",
    ].join(","),
    "per-page": String(opts.perQuery),
    select:
      "id,doi,display_name,publication_year,cited_by_count,authorships,primary_location,open_access,is_retracted,abstract_inverted_index",
  });
  const res = await fetch(url, { signal: opts.signal, cache: "no-store" });
  if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);
  const json = (await res.json()) as { results?: OpenAlexWork[] };
  const papers: ScholarPaper[] = [];

  for (const w of json.results ?? []) {
    const title = (w.display_name ?? "").trim();
    if (!title) continue;
    // `is_retracted:false` is already in the filter; re-check the field so a
    // silent filter change upstream can't put a retracted paper in a
    // client's article.
    if (w.is_retracted) continue;
    const doi = w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, "") : null;
    if (!doi) continue;
    const key = doi.toLowerCase();
    const authors: ScholarAuthor[] = (w.authorships ?? [])
      .slice(0, 4)
      .map((a) => ({
        name: (a.author?.display_name ?? "").trim(),
        hIndex: null,
        institution: a.institutions?.[0]?.display_name ?? null,
        openAlexId: authorKey(a.author?.id),
      }))
      .filter((a) => a.name.length > 0);

    papers.push({
      key,
      title,
      authors,
      year: w.publication_year ?? null,
      venue: w.primary_location?.source?.display_name ?? null,
      doi,
      url: `https://doi.org/${doi}`,
      openAccessUrl: w.open_access?.is_oa ? (w.open_access.oa_url ?? null) : null,
      citationCount: w.cited_by_count ?? 0,
      isOpenAccess: Boolean(w.open_access?.is_oa),
      topAuthorHIndex: null,
      authorityScore: 0,
      provider: "openalex",
      abstract: rebuildAbstract(w.abstract_inverted_index),
    });
  }
  return papers;
}

type EuropePmcHit = {
  title?: string;
  authorString?: string;
  pubYear?: string;
  /** Present on the light response shape. */
  journalTitle?: string;
  /** `resultType=core` nests it here instead — read both. */
  journalInfo?: { journal?: { title?: string | null } | null } | null;
  doi?: string;
  pmid?: string;
  citedByCount?: number;
  isOpenAccess?: string;
  abstractText?: string;
};

async function searchEuropePmc(
  query: string,
  opts: { minYear: number; perQuery: number; signal?: AbortSignal },
): Promise<ScholarPaper[]> {
  const url = new URL(`${EUROPE_PMC}/search`);
  // Relevance order, but floored at the year cut so we don't surface
  // decade-old clinical guidance as current.
  url.searchParams.set(
    "query",
    `${query} AND (FIRST_PDATE:[${opts.minYear}-01-01 TO 3000-01-01])`,
  );
  url.searchParams.set("format", "json");
  url.searchParams.set("pageSize", String(opts.perQuery));
  url.searchParams.set("resultType", "core");

  const res = await fetch(url.toString(), {
    signal: opts.signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Europe PMC HTTP ${res.status}`);
  const json = (await res.json()) as {
    resultList?: { result?: EuropePmcHit[] };
  };
  const papers: ScholarPaper[] = [];
  for (const r of json.resultList?.result ?? []) {
    const title = (r.title ?? "").replace(/\.$/, "").trim();
    const doi = r.doi?.trim() || null;
    if (!title || !doi) continue;
    const authors: ScholarAuthor[] = (r.authorString ?? "")
      .split(",")
      .map((n) => n.trim().replace(/\.$/, ""))
      .filter(Boolean)
      .slice(0, 4)
      .map((name) => ({ name, hIndex: null, institution: null }));
    const abstract = (r.abstractText ?? "").replace(/<[^>]+>/g, "").trim();
    papers.push({
      key: doi.toLowerCase(),
      title,
      authors,
      year: r.pubYear ? Number(r.pubYear) : null,
      venue: r.journalTitle ?? r.journalInfo?.journal?.title ?? null,
      doi,
      url: `https://doi.org/${doi}`,
      openAccessUrl:
        r.isOpenAccess === "Y" && r.pmid
          ? `https://europepmc.org/article/MED/${r.pmid}`
          : null,
      citationCount: r.citedByCount ?? 0,
      isOpenAccess: r.isOpenAccess === "Y",
      topAuthorHIndex: null,
      authorityScore: 0,
      provider: "europepmc",
      abstract: abstract ? `${abstract.slice(0, 420)}…` : null,
    });
  }
  return papers;
}

type SerpApiScholarHit = {
  title?: string;
  link?: string;
  publication_info?: { summary?: string };
  inline_links?: { cited_by?: { total?: number } };
};

/** Literal Google Scholar, via SerpApi. Off unless SERPAPI_KEY is set —
 *  Scholar has no API of its own and blocks direct automated access. */
async function searchGoogleScholar(
  query: string,
  opts: { minYear: number; perQuery: number; signal?: AbortSignal },
): Promise<ScholarPaper[]> {
  const key = process.env.SERPAPI_KEY?.trim();
  if (!key) return [];
  const url = new URL(SERPAPI);
  url.searchParams.set("engine", "google_scholar");
  url.searchParams.set("q", query);
  url.searchParams.set("as_ylo", String(opts.minYear));
  url.searchParams.set("num", String(opts.perQuery));
  url.searchParams.set("api_key", key);

  const res = await fetch(url.toString(), {
    signal: opts.signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);
  const json = (await res.json()) as { organic_results?: SerpApiScholarHit[] };
  const papers: ScholarPaper[] = [];
  for (const r of json.organic_results ?? []) {
    const title = (r.title ?? "").trim();
    const link = (r.link ?? "").trim();
    if (!title || !/^https?:\/\//i.test(link)) continue;
    const summary = r.publication_info?.summary ?? "";
    const yearMatch = summary.match(/\b(19|20)\d{2}\b/);
    // "Authors - Journal, Year - publisher" is SerpApi's summary shape.
    const authorPart = summary.split(" - ")[0] ?? "";
    papers.push({
      key: title.toLowerCase().slice(0, 120),
      title,
      authors: authorPart
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
        .slice(0, 4)
        .map((name) => ({ name, hIndex: null, institution: null })),
      year: yearMatch ? Number(yearMatch[0]) : null,
      venue: summary.split(" - ")[1]?.split(",")[0]?.trim() || null,
      doi: null,
      url: link,
      openAccessUrl: null,
      citationCount: r.inline_links?.cited_by?.total ?? 0,
      isOpenAccess: false,
      topAuthorHIndex: null,
      authorityScore: 0,
      provider: "google-scholar",
      abstract: null,
    });
  }
  return papers;
}

// ------------------------------------------------------------- enrichment

type OpenAlexAuthor = {
  id?: string;
  display_name?: string;
  summary_stats?: { h_index?: number | null } | null;
  last_known_institutions?: Array<{ display_name?: string | null }> | null;
};

/** OpenAlex 504s on an OR-filter of 5+ ids ("query took too long"), and it
 *  fails as a 200-shaped error rather than throwing — which is how a whole
 *  batch of h-indexes silently came back null. Keep every chunk at 4. */
const AUTHOR_CHUNK = 4;
/** Cap the fan-out. Two authors per paper is enough to answer "is the lead
 *  author senior?", which is the only thing the score uses. */
const MAX_AUTHOR_CHUNKS = 8;

/** Resolve author-level authority (h-index + institution) for the shortlist.
 *  This is what makes "high-authority writers" measurable rather than a
 *  claim — an h-index of 40 and an h-index of 2 are not the same citation. */
async function enrichAuthorAuthority(
  papers: ScholarPaper[],
  signal?: AbortSignal,
): Promise<void> {
  const wanted: string[] = [];
  const seen = new Set<string>();
  for (const p of papers) {
    for (const a of p.authors.slice(0, 2)) {
      if (a.openAlexId && !seen.has(a.openAlexId)) {
        seen.add(a.openAlexId);
        wanted.push(a.openAlexId);
      }
    }
  }
  if (wanted.length === 0) return;

  const chunks: string[][] = [];
  for (
    let i = 0;
    i < wanted.length && chunks.length < MAX_AUTHOR_CHUNKS;
    i += AUTHOR_CHUNK
  ) {
    chunks.push(wanted.slice(i, i + AUTHOR_CHUNK));
  }

  const byId = new Map<string, OpenAlexAuthor>();
  await Promise.all(
    chunks.map(async (ids) => {
      try {
        const url = openAlexUrl("/authors", {
          filter: `openalex:${ids.join("|")}`,
          "per-page": String(ids.length),
          select: "id,display_name,summary_stats,last_known_institutions",
        });
        const res = await fetch(url, { signal, cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { results?: OpenAlexAuthor[] };
        for (const a of json.results ?? []) {
          const key = authorKey(a.id);
          if (key) byId.set(key, a);
        }
      } catch {
        /* one chunk failing must not blank the others */
      }
    }),
  );
  if (byId.size === 0) return;

  for (const p of papers) {
    let top: number | null = null;
    for (const author of p.authors) {
      const hit = author.openAlexId ? byId.get(author.openAlexId) : undefined;
      if (!hit) continue;
      const h = hit.summary_stats?.h_index ?? null;
      if (typeof h === "number") {
        author.hIndex = h;
        top = top === null ? h : Math.max(top, h);
      }
      author.institution =
        author.institution ??
        hit.last_known_institutions?.[0]?.display_name ??
        null;
    }
    p.topAuthorHIndex = top;
  }
}

/** "Veridic" means the link has to actually open. A DOI that 404s is worse
 *  than no citation, because the client clicks it. */
async function verifyResolves(
  paper: ScholarPaper,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const res = await fetch(paper.url, {
      method: "HEAD",
      redirect: "follow",
      signal,
      cache: "no-store",
    });
    // Publishers commonly answer HEAD with 403 behind a bot wall while the
    // DOI itself is perfectly valid, so only a hard 404/410 disqualifies.
    return res.status !== 404 && res.status !== 410;
  } catch {
    // A timeout is not proof the paper is fake. DOIs come from OpenAlex /
    // Europe PMC, which only mint them for registered works.
    return true;
  }
}

// ----------------------------------------------------------------- rating

/** 0–100 blend of the four signals that separate a citable paper from a
 *  merely existing one: how much the field cites it (normalised per year so
 *  a 2024 paper isn't beaten purely by being younger), how senior its best
 *  author is, whether the reader can actually open it, and how recent it
 *  is. Deliberately boring maths — the consultant has to be able to argue
 *  with the ranking. */
function scoreAuthority(p: ScholarPaper, currentYear: number): number {
  const age = Math.max(1, currentYear - (p.year ?? currentYear) + 1);
  const perYear = p.citationCount / age;
  // 40 citations/year saturates the citation component.
  const citationPts = Math.min(40, (perYear / 40) * 40);
  // h-index 60 saturates the author component.
  const authorPts =
    p.topAuthorHIndex === null
      ? 12 // unknown ≠ zero: most Europe PMC hits never resolve an id
      : Math.min(30, (p.topAuthorHIndex / 60) * 30);
  const recencyPts = Math.max(0, 20 - (age - 1) * 2.5);
  const accessPts = p.isOpenAccess ? 10 : 4;
  return Math.round(
    Math.min(100, citationPts + authorPts + recencyPts + accessPts),
  );
}

// ----------------------------------------------------------- orchestrator

export type ScholarSearchOptions = {
  topic?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string;
  referenceFocus?: string;
  /** How many papers to hand the writer. */
  max?: number;
  /** Oldest publication year to accept. */
  minYear?: number;
  signal?: AbortSignal;
};

export async function searchScholarlySources(
  opts: ScholarSearchOptions,
): Promise<ScholarResult> {
  const max = opts.max ?? 6;
  const currentYear = new Date().getFullYear();
  const minYear = opts.minYear ?? currentYear - 8;
  // Over-fetch per query so dedupe + verification still leave `max` papers.
  const perQuery = Math.max(4, max);

  const { queries, fallback: usedFallbackQuery } = await buildAcademicQueries({
    topic: opts.topic,
    primaryKeyword: opts.primaryKeyword,
    secondaryKeywords: opts.secondaryKeywords,
    referenceFocus: opts.referenceFocus,
    signal: opts.signal,
  });
  if (queries.length === 0) {
    return {
      ...EMPTY_SCHOLAR_RESULT,
      reason: "No topic or primary keyword to search the literature with.",
    };
  }

  const medical = looksMedical(
    [opts.topic, opts.primaryKeyword, opts.referenceFocus].join(" "),
  );

  const tasks: Array<Promise<ScholarPaper[]>> = [];
  const providers = new Set<ScholarProvider>();

  for (const q of queries) {
    tasks.push(
      searchOpenAlex(q, { minYear, perQuery, signal: opts.signal })
        .then((p) => {
          if (p.length > 0) providers.add("openalex");
          return p;
        })
        .catch(() => []),
    );
    if (medical) {
      tasks.push(
        searchEuropePmc(q, { minYear, perQuery, signal: opts.signal })
          .then((p) => {
            if (p.length > 0) providers.add("europepmc");
            return p;
          })
          .catch(() => []),
      );
    }
    if (process.env.SERPAPI_KEY) {
      tasks.push(
        searchGoogleScholar(q, { minYear, perQuery, signal: opts.signal })
          .then((p) => {
            if (p.length > 0) providers.add("google-scholar");
            return p;
          })
          .catch(() => []),
      );
    }
  }

  const settled = await Promise.all(tasks);
  const flat = settled.flat();
  if (flat.length === 0) {
    return {
      ...EMPTY_SCHOLAR_RESULT,
      queries,
      usedFallbackQuery,
      reason:
        "No peer-reviewed papers came back for this topic in the academic databases.",
    };
  }

  // Dedupe by DOI (a paper indexed in both OpenAlex and Europe PMC is one
  // paper). Prefer the OpenAlex copy — it carries author ids, so it can be
  // enriched with h-index.
  const byKey = new Map<string, ScholarPaper>();
  for (const p of flat) {
    const existing = byKey.get(p.key);
    if (!existing) {
      byKey.set(p.key, p);
      continue;
    }
    if (existing.provider !== "openalex" && p.provider === "openalex") {
      byKey.set(p.key, { ...p, citationCount: Math.max(p.citationCount, existing.citationCount) });
    } else if (p.citationCount > existing.citationCount) {
      existing.citationCount = p.citationCount;
    }
  }
  const deduped = [...byKey.values()];

  // Rank on the cheap signals first so author enrichment + HEAD checks only
  // run on the shortlist we might actually cite.
  for (const p of deduped) p.authorityScore = scoreAuthority(p, currentYear);
  const shortlist = deduped
    .sort((a, b) => b.authorityScore - a.authorityScore)
    .slice(0, max * 2);

  try {
    await enrichAuthorAuthority(shortlist, opts.signal);
  } catch {
    /* h-index is a bonus signal, not a gate */
  }
  for (const p of shortlist) p.authorityScore = scoreAuthority(p, currentYear);
  shortlist.sort((a, b) => b.authorityScore - a.authorityScore);

  const verdicts = await Promise.all(
    shortlist.map((p) => verifyResolves(p, opts.signal)),
  );
  const verified = shortlist.filter((_, i) => verdicts[i]);
  const unverified = shortlist.length - verified.length;

  const papers = verified.slice(0, max);
  return {
    ok: papers.length > 0,
    papers,
    queries,
    usedFallbackQuery,
    providers: [...providers],
    found: deduped.length,
    unverified,
    reason: papers.length === 0 ? "No paper survived link verification." : undefined,
  };
}

// ------------------------------------------------------------- formatting

function authorLine(p: ScholarPaper): string {
  if (p.authors.length === 0) return "—";
  const shown = p.authors.slice(0, 3).map((a) => {
    const h = a.hIndex !== null ? ` (h-index ${a.hIndex})` : "";
    return `${a.name}${h}`;
  });
  const etAl = p.authors.length > 3 ? " et al." : "";
  return `${shown.join(", ")}${etAl}`;
}

/** The block appended to the Blog Writer's fact pack. Mirrors the closed-list
 *  discipline of `formatInternalLinkCandidatesForPrompt`: these papers, and
 *  only these papers, may be cited as academic sources. */
export function formatScholarSourcesForPrompt(res: ScholarResult): string {
  const lines: string[] = [];
  lines.push("## Verified academic sources (peer-reviewed, fetched live)");

  if (!res.ok || res.papers.length === 0) {
    lines.push(
      res.reason ??
        "No academic sources could be verified for this topic.",
    );
    lines.push("");
    lines.push(
      "**Do NOT invent a paper, author, journal or DOI to fill the gap.** Fall back to the domain whitelist in the \"External links — VERIFY before inserting\" rule, or use the `[link to be added by consultant]` marker.",
    );
    return lines.join("\n");
  }

  lines.push(
    `Fetched live from ${res.providers.join(" + ")} for the queries ${res.queries
      .map((q) => `\`${q}\``)
      .join(", ")}. Every entry is a real peer-reviewed paper: the DOI was resolved, retracted works were excluded at the source, and the authority score blends citations-per-year, the lead author's h-index, recency and open-access availability. ${res.found} candidate(s) were considered${res.unverified > 0 ? `, ${res.unverified} dropped because the link would not resolve` : ""}.`,
  );
  if (res.usedFallbackQuery) {
    lines.push("");
    lines.push(
      "> ⚠️ These queries were NOT translated into academic English (the translation step was unavailable), so topical relevance may be weaker than usual. Check each paper's title and abstract genuinely matches the article's claim before citing it, and drop any that does not.",
    );
  }
  lines.push("");
  lines.push(
    "**These are the ONLY academic sources you may cite. Do NOT invent a paper, author, journal, year or DOI — not even a plausible-looking one.** You may still use the pre-approved institutional domains from the \"External links\" rule (WHO, DGS, NHS, Cochrane, …) alongside these.",
  );
  lines.push("");
  lines.push("How to cite one in the body of the article:");
  lines.push("");
  lines.push(
    "> Um estudo publicado em **{venue}** ({year}) concluiu que … ([{first author} et al.]({url}))",
  );
  lines.push("");
  lines.push(
    "Rules: cite 2–4 of these across the article, each anchored to a specific claim (never decoratively). Name the journal and the year in the visible text — that is what makes the claim checkable by the reader. Prefer the open-access link when one is listed, so the client can open the full text. Never present a finding as more certain than the abstract states, and never attribute a claim to a paper that does not make it. List every paper you used in the **External references used** section of your output.",
  );
  lines.push("");

  for (const p of res.papers) {
    lines.push(`- **${p.title}**`);
    lines.push(`  - Authors: ${authorLine(p)}`);
    lines.push(
      `  - ${p.venue ?? "—"}${p.year ? ` · ${p.year}` : ""} · cited ${p.citationCount}× · authority ${p.authorityScore}/100`,
    );
    lines.push(`  - Link: ${p.url}`);
    if (p.openAccessUrl) lines.push(`  - Open access full text: ${p.openAccessUrl}`);
    if (p.abstract) lines.push(`  - Abstract: ${p.abstract}`);
  }
  return lines.join("\n");
}

/** Compact markdown the consultant sees streaming in the run log, so the
 *  sources are auditable before the article is even written. */
export function formatScholarSourcesForStream(res: ScholarResult): string {
  if (!res.ok || res.papers.length === 0) return "";
  const lines: string[] = [];
  lines.push("| # | Estudo | Revista | Ano | Citações | h-index | Autoridade |");
  lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: |");
  res.papers.forEach((p, i) => {
    const title = p.title.length > 70 ? `${p.title.slice(0, 70)}…` : p.title;
    lines.push(
      `| ${i + 1} | [${title.replace(/\|/g, "\\|")}](${p.url}) | ${(p.venue ?? "—").replace(/\|/g, "\\|")} | ${p.year ?? "—"} | ${p.citationCount} | ${p.topAuthorHIndex ?? "—"} | ${p.authorityScore}/100 |`,
    );
  });
  return lines.join("\n");
}
