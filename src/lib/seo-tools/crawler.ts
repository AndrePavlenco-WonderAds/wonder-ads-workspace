// Fetch a single page and extract on-page SEO facts. Server-side only.
// Intentionally narrow — we trust Google PSI for performance/a11y; this
// is the layer that surfaces what's actually in the HTML.

import * as cheerio from "cheerio";

export type SchemaTypeSummary = {
  type: string;
  count: number;
};

export type CrawlResult = {
  finalUrl: string;
  status: number;
  fetchMs: number;
  bytes: number;
  contentType: string | null;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  metaRobots: string | null;
  canonical: string | null;
  charset: string | null;
  viewport: string | null;
  lang: string | null;
  h1: string[];
  h2: string[];
  h3Count: number;
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinkCount: number;
  externalLinkCount: number;
  noFollowLinkCount: number;
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  hreflang: { hreflang: string; href: string }[];
  jsonLdTypes: SchemaTypeSummary[];
  jsonLdRaw: unknown[];
  hasFavicon: boolean;
  hasRobotsLink: boolean;
};

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function trimWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function countWords(s: string): number {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export async function crawlPage(
  url: string,
  opts: { signal?: AbortSignal } = {},
): Promise<CrawlResult> {
  const started = Date.now();
  const res = await fetch(url, {
    signal: opts.signal,
    redirect: "follow",
    headers: {
      // Identify ourselves as a real browser to avoid bot walls, but be honest.
      "user-agent":
        "Mozilla/5.0 (compatible; WonderAdsSEOBot/1.0; +https://wonder-ads.com)",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });
  const html = await res.text();
  const fetchMs = Date.now() - started;
  const bytes = new TextEncoder().encode(html).byteLength;
  const $ = cheerio.load(html);
  const finalUrl = res.url || url;
  let pageOrigin: string | null = null;
  try {
    pageOrigin = new URL(finalUrl).origin;
  } catch {
    pageOrigin = null;
  }

  const title = trimWhitespace($("head > title").first().text()) || null;

  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;

  const metaRobots = $('meta[name="robots"]').attr("content")?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr("href") || null;
  const charset =
    $("meta[charset]").attr("charset") ||
    $('meta[http-equiv="Content-Type"]')
      .attr("content")
      ?.match(/charset=([^;]+)/i)?.[1] ||
    null;
  const viewport = $('meta[name="viewport"]').attr("content") || null;
  const lang = $("html").attr("lang") || null;

  const h1: string[] = [];
  $("h1").each((_i, el) => {
    const text = trimWhitespace($(el).text());
    if (text) h1.push(text);
  });
  const h2: string[] = [];
  $("h2").each((_i, el) => {
    const text = trimWhitespace($(el).text());
    if (text) h2.push(text);
  });
  const h3Count = $("h3").length;

  // Strip script/style for word count
  const bodyClone = $("body").clone();
  bodyClone.find("script, style, noscript, template").remove();
  const wordCount = countWords(bodyClone.text());

  const images = $("img");
  let imagesMissingAlt = 0;
  images.each((_i, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined || alt.trim() === "") imagesMissingAlt++;
  });

  let internalLinkCount = 0;
  let externalLinkCount = 0;
  let noFollowLinkCount = 0;
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    const rel = ($(el).attr("rel") || "").toLowerCase();
    if (rel.includes("nofollow")) noFollowLinkCount++;
    try {
      const target = new URL(href, finalUrl);
      if (pageOrigin && target.origin === pageOrigin) internalLinkCount++;
      else externalLinkCount++;
    } catch {
      /* skip malformed */
    }
  });

  const ogTags: Record<string, string> = {};
  $('meta[property^="og:"]').each((_i, el) => {
    const key = $(el).attr("property")?.toLowerCase();
    const value = $(el).attr("content");
    if (key && value) ogTags[key] = value;
  });
  const twitterTags: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_i, el) => {
    const key = $(el).attr("name")?.toLowerCase();
    const value = $(el).attr("content");
    if (key && value) twitterTags[key] = value;
  });
  const hreflang: { hreflang: string; href: string }[] = [];
  $('link[rel="alternate"][hreflang]').each((_i, el) => {
    const hl = $(el).attr("hreflang");
    const href = $(el).attr("href");
    if (hl && href) hreflang.push({ hreflang: hl, href });
  });

  const jsonLdRaw: unknown[] = [];
  const typeCounts = new Map<string, number>();
  $('script[type="application/ld+json"]').each((_i, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of list) {
        jsonLdRaw.push(node);
        collectTypes(node, typeCounts);
      }
    } catch {
      /* invalid JSON-LD — skip silently */
    }
  });
  const jsonLdTypes: SchemaTypeSummary[] = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const hasFavicon =
    $('link[rel~="icon"], link[rel="shortcut icon"]').length > 0;
  const hasRobotsLink = $('link[rel="alternate"][type="application/rss+xml"]').length > 0; // proxy: well-formed metadata

  return {
    finalUrl,
    status: res.status,
    fetchMs,
    bytes,
    contentType: res.headers.get("content-type"),
    title,
    titleLength: title ? title.length : 0,
    metaDescription,
    metaDescriptionLength: metaDescription ? metaDescription.length : 0,
    metaRobots,
    canonical,
    charset,
    viewport,
    lang,
    h1: unique(h1),
    h2: unique(h2).slice(0, 25),
    h3Count,
    wordCount,
    imageCount: images.length,
    imagesMissingAlt,
    internalLinkCount,
    externalLinkCount,
    noFollowLinkCount,
    ogTags,
    twitterTags,
    hreflang,
    jsonLdTypes,
    jsonLdRaw,
    hasFavicon,
    hasRobotsLink,
  };
}

function collectTypes(node: unknown, sink: Map<string, number>) {
  if (!node || typeof node !== "object") return;
  const rec = node as Record<string, unknown>;
  const t = rec["@type"];
  if (typeof t === "string") sink.set(t, (sink.get(t) ?? 0) + 1);
  else if (Array.isArray(t)) {
    for (const x of t) {
      if (typeof x === "string") sink.set(x, (sink.get(x) ?? 0) + 1);
    }
  }
  // Recurse into @graph for nested entities
  const graph = rec["@graph"];
  if (Array.isArray(graph)) {
    for (const g of graph) collectTypes(g, sink);
  }
}

export function formatCrawlForPrompt(r: CrawlResult): string {
  const lines: string[] = [];
  lines.push(`## Page HTML facts`);
  lines.push(`URL fetched: ${r.finalUrl}`);
  lines.push(
    `HTTP ${r.status} · ${(r.bytes / 1024).toFixed(1)} KB · ${r.fetchMs} ms · ${r.contentType ?? "no content-type"}`,
  );
  lines.push("");
  lines.push("**Head**");
  lines.push(`- Title: ${quote(r.title)} (${r.titleLength} chars)`);
  lines.push(
    `- Meta description: ${quote(r.metaDescription)} (${r.metaDescriptionLength} chars)`,
  );
  lines.push(`- Meta robots: ${r.metaRobots ?? "(absent)"}`);
  lines.push(`- Canonical: ${r.canonical ?? "(absent)"}`);
  lines.push(`- Charset: ${r.charset ?? "(absent)"}`);
  lines.push(`- Viewport: ${r.viewport ?? "(absent)"}`);
  lines.push(`- HTML lang: ${r.lang ?? "(absent)"}`);
  lines.push(`- Favicon link: ${r.hasFavicon ? "yes" : "no"}`);
  lines.push("");
  lines.push("**Headings**");
  lines.push(`- H1 (${r.h1.length}): ${r.h1.map(quote).join(" | ") || "(none)"}`);
  lines.push(`- H2 (${r.h2.length} unique): ${r.h2.map(quote).join(" | ") || "(none)"}`);
  lines.push(`- H3 count: ${r.h3Count}`);
  lines.push("");
  lines.push("**Body**");
  lines.push(`- Word count: ${r.wordCount}`);
  lines.push(`- Images: ${r.imageCount} (${r.imagesMissingAlt} missing alt)`);
  lines.push(
    `- Links: ${r.internalLinkCount} internal, ${r.externalLinkCount} external, ${r.noFollowLinkCount} nofollow`,
  );
  lines.push("");
  lines.push("**Open Graph**");
  if (Object.keys(r.ogTags).length === 0) lines.push("- (none present)");
  else
    for (const [k, v] of Object.entries(r.ogTags))
      lines.push(`- ${k}: ${quote(v)}`);
  lines.push("");
  lines.push("**Twitter card**");
  if (Object.keys(r.twitterTags).length === 0) lines.push("- (none present)");
  else
    for (const [k, v] of Object.entries(r.twitterTags))
      lines.push(`- ${k}: ${quote(v)}`);
  if (r.hreflang.length > 0) {
    lines.push("");
    lines.push("**Hreflang**");
    for (const h of r.hreflang) lines.push(`- ${h.hreflang} → ${h.href}`);
  }
  lines.push("");
  lines.push("**Schema (JSON-LD)**");
  if (r.jsonLdTypes.length === 0) lines.push("- (no JSON-LD detected)");
  else
    for (const t of r.jsonLdTypes)
      lines.push(`- ${t.type} × ${t.count}`);

  return lines.join("\n");
}

function quote(s: string | null): string {
  if (!s) return "(empty)";
  return `"${s.length > 220 ? s.slice(0, 217) + "…" : s}"`;
}

// ---- Multi-page crawl ----

export type MultiCrawlEntry =
  | { url: string; ok: true; result: CrawlResult }
  | { url: string; ok: false; error: string };

/** Crawl many URLs with bounded concurrency. Per-URL failures are reported,
 *  not thrown, so a single 404 doesn't kill a site-wide audit. */
export async function crawlMany(
  urls: string[],
  opts: { concurrency?: number; signal?: AbortSignal } = {},
): Promise<MultiCrawlEntry[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  const out: MultiCrawlEntry[] = new Array(urls.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= urls.length) return;
      const url = urls[i];
      try {
        const result = await crawlPage(url, { signal: opts.signal });
        out[i] = { url, ok: true, result };
      } catch (err) {
        out[i] = {
          url,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()),
  );
  return out;
}

/** Compact per-page snapshot used in the site-wide audit fact pack — picks
 *  only the on-page signals worth comparing across pages. */
export function formatPageSummaryRow(entry: MultiCrawlEntry): string {
  if (!entry.ok) {
    return `- ❌ ${entry.url} → ${entry.error.slice(0, 140)}`;
  }
  const r = entry.result;
  const titleLen = r.titleLength;
  const metaLen = r.metaDescriptionLength;
  const altMissing = r.imagesMissingAlt;
  const schemas =
    r.jsonLdTypes.length === 0
      ? "no schema"
      : r.jsonLdTypes.map((s) => s.type).slice(0, 4).join("+");
  return `- HTTP ${r.status} · ${r.finalUrl}
  - Title (${titleLen}): ${quote(r.title)}
  - Meta (${metaLen}): ${quote(r.metaDescription)}
  - H1s: ${r.h1.length === 0 ? "none" : r.h1.map(quote).join(" | ")}
  - Words: ${r.wordCount} · Images: ${r.imageCount} (${altMissing} missing alt) · Links: ${r.internalLinkCount}/${r.externalLinkCount} (int/ext)
  - Schema: ${schemas}
  - Canonical: ${r.canonical ?? "(absent)"} · Robots: ${r.metaRobots ?? "(absent)"}`;
}

export function formatMultiCrawlForPrompt(
  entries: MultiCrawlEntry[],
): string {
  const lines: string[] = [];
  lines.push(`## Sample pages crawl (${entries.length} URLs)`);
  for (const e of entries) lines.push(formatPageSummaryRow(e));
  return lines.join("\n");
}
