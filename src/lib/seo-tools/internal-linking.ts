// Sitemap-grounded internal-linking candidate discovery for the Blog
// Writer.
//
// Goal: BEFORE the article is drafted, pull the client's real sitemap,
// crawl the most promising pages, and score each one's topical relevance
// to the article being written. Only pages that clear a topical-familiarity
// threshold (default 75%, per Google's topical-authority guidance) are
// handed to the writer as link targets — so the model links to real,
// genuinely-related pages instead of inventing URLs.
//
// The score is a *weighted coverage*: of the article's topical vocabulary
// (primary keyword weighted highest, then secondaries, topic, LSI), how
// much (by weight) appears in the candidate page's own content (title, H1,
// H2s, meta description, slug). 75 means "this page covers ≥75% of the
// article's topic terms" — an interpretable, defensible stand-in for
// "≥75% topical familiarity between the two pages".

import { discoverSitemap } from "./sitemap";
import { crawlMany } from "./crawler";
import { displayDomain } from "../client-meta";

export type ArticleSeed = {
  primaryKeyword?: string;
  topic?: string;
  secondaryKeywords?: string;
  lsiKeywords?: string;
  audience?: string;
};

export type InternalLinkCandidate = {
  url: string;
  title: string;
  summary: string;
  /** 0–100 weighted topical-coverage score vs the article seed. */
  score: number;
};

export type InternalLinkResult = {
  /** True when the sitemap was usable (fetched, real URLs found). */
  ok: boolean;
  origin: string;
  domain: string;
  totalUrls: number;
  crawled: number;
  /** Pages clearing the threshold, ranked best-first. */
  candidates: InternalLinkCandidate[];
  /** How many crawled pages scored below the threshold (excluded). */
  belowThreshold: number;
  minScore: number;
  /** Set when ok=false, or ok=true but no candidate reached the bar. */
  reason?: string;
};

// How many sitemap URLs to sample, and how many of those to actually crawl.
const SAMPLE_URLS = 60;
const CRAWL_CAP = 24;
const CRAWL_CONCURRENCY = 5;
const MIN_PAGE_WORDS = 80;

// Compact stop-word set (PT + EN) so generic glue words don't inflate the
// overlap. Deliberately small — we only need to drop the highest-frequency
// noise.
const STOPWORDS = new Set([
  // PT
  "para", "com", "como", "uma", "uns", "umas", "dos", "das", "nos", "nas",
  "por", "que", "mais", "mas", "sua", "seu", "seus", "suas", "este", "esta",
  "isto", "aos", "pela", "pelo", "sem", "sobre", "entre", "todos", "todas",
  "qual", "quais", "onde", "quando", "porque", "também", "ser", "ter", "the",
  // EN
  "and", "for", "with", "from", "this", "that", "your", "you", "are", "was",
  "were", "have", "has", "will", "what", "when", "where", "which", "their",
  "they", "our", "about", "into", "over", "than", "then", "them", "can",
  "how", "why", "who", "all", "any", "not", "but", "out", "use",
]);

/** Strip accents → lowercase → split into meaningful tokens, with a light
 *  singularisation so PT/EN plurals collapse onto their singular. */
function tokenize(text: string): string[] {
  const cleaned = (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const raw = cleaned.split(/[^a-z0-9]+/).filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    if (t.length < 3) continue;
    if (STOPWORDS.has(t)) continue;
    // crude singular: drop a trailing "s" on longer words (lojas→loja,
    // clinics→clinic) but keep "ss" words (process) intact.
    const singular =
      t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t;
    out.push(singular);
  }
  return out;
}

/** Build the article's weighted topical vocabulary from the consultant's
 *  inputs. Primary keyword counts most; audience least. */
function seedWeights(seed: ArticleSeed): Map<string, number> {
  const weights = new Map<string, number>();
  const add = (text: string | undefined, weight: number) => {
    for (const tok of tokenize(text ?? "")) {
      weights.set(tok, Math.max(weights.get(tok) ?? 0, weight));
    }
  };
  add(seed.primaryKeyword, 3);
  add(seed.secondaryKeywords, 2);
  add(seed.topic, 1.5);
  add(seed.lsiKeywords, 1);
  add(seed.audience, 0.5);
  return weights;
}

/** Tokens from a URL's path (slug words) — used to pre-rank which pages to
 *  spend the crawl budget on before we've seen their content. */
function urlTokens(url: string): Set<string> {
  try {
    const u = new URL(url);
    return new Set(tokenize(u.pathname.replace(/[-_/]+/g, " ")));
  } catch {
    return new Set();
  }
}

/** Weighted coverage of the seed vocabulary by a page's token set → 0..100. */
function coverageScore(
  seed: Map<string, number>,
  pageTokens: Set<string>,
): number {
  let total = 0;
  let hit = 0;
  for (const [term, weight] of seed) {
    total += weight;
    if (pageTokens.has(term)) hit += weight;
  }
  if (total === 0) return 0;
  return Math.round((hit / total) * 100);
}

function looksNonContent(url: string): boolean {
  return (
    /\.(jpe?g|png|gif|webp|svg|pdf|zip|mp4|mp3|css|js|xml|json|ico|woff2?)(\?|#|$)/i.test(
      url,
    ) ||
    /\/(tag|tags|categoria|categorias|category|author|autor|page)\//i.test(url) ||
    /\/(feed|wp-json|wp-admin|cart|checkout|carrinho)\b/i.test(url) ||
    /[?&](replytocom|add-to-cart)=/i.test(url)
  );
}

/**
 * Discover topically-relevant internal-link targets for an article.
 *
 * @param siteUrl  the client's website (any URL on the origin)
 * @param seed     the article's keywords/topic/audience
 * @param max      max candidates to return (default 12)
 * @param minScore topical-familiarity threshold, 0..100 (default 75)
 */
export async function buildInternalLinkCandidates({
  siteUrl,
  seed,
  max = 12,
  minScore = 75,
  signal,
}: {
  siteUrl: string;
  seed: ArticleSeed;
  max?: number;
  minScore?: number;
  signal?: AbortSignal;
}): Promise<InternalLinkResult> {
  const origin = new URL(siteUrl).origin;
  const domain = displayDomain(origin);
  const base: Omit<InternalLinkResult, "ok" | "reason"> = {
    origin,
    domain,
    totalUrls: 0,
    crawled: 0,
    candidates: [],
    belowThreshold: 0,
    minScore,
  };

  const weights = seedWeights(seed);
  if (weights.size === 0) {
    return {
      ...base,
      ok: false,
      reason: "Sem keyword principal / tópico suficiente para avaliar relevância.",
    };
  }

  // 1. Sitemap.
  const sm = await discoverSitemap(origin, { maxUrls: SAMPLE_URLS, signal });
  base.totalUrls = sm.totalUrls;
  if (sm.sitemapSources.length === 0 || sm.sampledUrls.length === 0) {
    return {
      ...base,
      ok: false,
      reason:
        sm.errors[0] ??
        "Sitemap não encontrado ou vazio — sem inventário fiável de páginas.",
    };
  }

  // 2. URL-level filter + pre-rank by slug overlap, so the crawl budget
  //    goes to the most promising pages first.
  const filtered = sm.sampledUrls.filter((u) => !looksNonContent(u));
  const ranked = filtered
    .map((url) => {
      const toks = urlTokens(url);
      let slugScore = 0;
      for (const term of weights.keys()) if (toks.has(term)) slugScore += 1;
      return { url, slugScore };
    })
    .sort((a, b) => b.slugScore - a.slugScore)
    .slice(0, CRAWL_CAP)
    .map((r) => r.url);

  if (ranked.length === 0) {
    return {
      ...base,
      ok: false,
      reason: "O sitemap só tinha páginas não-conteúdo (assets, tags, feeds).",
    };
  }

  // 3. Crawl + score.
  const crawled = await crawlMany(ranked, {
    concurrency: CRAWL_CONCURRENCY,
    signal,
  });

  const scored: InternalLinkCandidate[] = [];
  let crawledOk = 0;
  let below = 0;
  for (const entry of crawled) {
    if (!entry.ok) continue;
    const r = entry.result;
    if (r.status !== 200 || !r.title || r.wordCount < MIN_PAGE_WORDS) continue;
    crawledOk += 1;
    const pageTokens = new Set<string>([
      ...tokenize(r.title),
      ...r.h1.flatMap(tokenize),
      ...r.h2.flatMap(tokenize),
      ...tokenize(r.metaDescription ?? ""),
      ...urlTokens(r.finalUrl),
    ]);
    const score = coverageScore(weights, pageTokens);
    if (score < minScore) {
      below += 1;
      continue;
    }
    const summaryBits = [r.metaDescription, r.h2.slice(0, 3).join(" · ")]
      .map((s) => (s ?? "").trim())
      .filter(Boolean);
    scored.push({
      url: r.finalUrl,
      title: r.title,
      summary: summaryBits.join(" — ").slice(0, 220),
      score,
    });
  }

  base.crawled = crawledOk;
  base.belowThreshold = below;
  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, max);

  if (candidates.length === 0) {
    return {
      ...base,
      ok: true,
      reason: `Li ${crawledOk} página(s) do sitemap mas nenhuma atingiu ${minScore}% de familiaridade topical com este artigo.`,
    };
  }

  return { ...base, ok: true, candidates };
}

/** Render the candidate set as a fact-pack block for the writer's prompt.
 *  Always returns a block — when nothing qualifies it tells the writer to
 *  NOT fabricate internal links. */
export function formatInternalLinkCandidatesForPrompt(
  res: InternalLinkResult,
): string {
  const lines: string[] = [];
  lines.push(
    `## Verified internal-link candidates (real pages on ${res.domain})`,
  );

  if (res.ok && res.candidates.length > 0) {
    lines.push(
      `These URLs were pulled LIVE from the client's sitemap and crawled. Each shown % is its topical-familiarity score vs THIS article; all listed pages already clear the ${res.minScore}% bar (Google topical-authority / relevance guidance). ${res.belowThreshold} other crawled page(s) scored below ${res.minScore}% and were excluded.`,
    );
    lines.push("");
    lines.push(
      `**Internal links MUST come ONLY from this list (or a URL the consultant pasted in "internalLinkInventory"). Do NOT invent, guess, or infer any other internal URL.** Pick the most contextually relevant targets, use natural anchor text, never link the same target twice, and in Working Notes record each link as \`anchor → URL (NN% match)\`.`,
    );
    lines.push("");
    for (const c of res.candidates) {
      lines.push(`- **${c.score}%** — ${c.url}`);
      lines.push(`  - Title: ${c.title}`);
      if (c.summary) lines.push(`  - Topic: ${c.summary}`);
    }
    return lines.join("\n");
  }

  // No usable candidates — explicit instruction not to hallucinate links.
  lines.push(
    res.reason ??
      "No internal-link candidates could be verified from the sitemap.",
  );
  lines.push("");
  lines.push(
    `**Because no internal pages were verified at ≥${res.minScore}% topical relevance, do NOT fabricate internal links.** Use ONLY URLs the consultant pasted in "internalLinkInventory" if any are present; otherwise SKIP internal linking entirely and add a single Working Note: "Internal linking skipped — no verified site pages met the ${res.minScore}% topical-relevance bar." Do not output "[suggested — consultant to verify]" internal URLs.`,
  );
  return lines.join("\n");
}
