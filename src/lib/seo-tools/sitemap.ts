// Sitemap + robots.txt discovery for the site-wide audit.
//
// Strategy: check robots.txt for `Sitemap:` directives, then fall back to
// /sitemap.xml. Follows sitemap-index files one level deep. Caps the total
// URLs collected so we never explode the audit budget.

import * as cheerio from "cheerio";

export type SitemapDiscovery = {
  origin: string;
  robotsTxtUrl: string;
  robotsStatus: number | null;
  robotsExcerpt: string | null;
  sitemapSources: string[]; // sitemaps actually fetched (after robots.txt + fallback)
  totalUrls: number; // total URLs seen across all sitemaps (pre-cap)
  sampledUrls: string[]; // URLs we'll feed into crawlMany
  errors: string[];
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; WonderAdsSEOBot/1.0; +https://wonder-ads.com)";

async function fetchText(
  url: string,
  signal: AbortSignal | undefined,
): Promise<{ status: number; text: string } | null> {
  try {
    const res = await fetch(url, {
      signal,
      redirect: "follow",
      headers: { "user-agent": USER_AGENT },
      cache: "no-store",
    });
    const text = await res.text();
    return { status: res.status, text };
  } catch {
    return null;
  }
}

function extractSitemapDirectives(robotsTxt: string): string[] {
  const out: string[] = [];
  for (const line of robotsTxt.split(/\r?\n/)) {
    const m = line.match(/^\s*Sitemap:\s*(\S+)\s*$/i);
    if (m) out.push(m[1]);
  }
  return out;
}

function parseSitemap(xml: string): {
  urls: string[];
  nestedSitemaps: string[];
  isIndex: boolean;
} {
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls: string[] = [];
  $("urlset > url > loc").each((_i, el) => {
    const loc = $(el).text().trim();
    if (loc) urls.push(loc);
  });
  const nestedSitemaps: string[] = [];
  $("sitemapindex > sitemap > loc").each((_i, el) => {
    const loc = $(el).text().trim();
    if (loc) nestedSitemaps.push(loc);
  });
  return { urls, nestedSitemaps, isIndex: nestedSitemaps.length > 0 };
}

/** Pick a diverse sample of URLs — homepage first, then prefer short-path
 *  pages (typically pillar / top-level) over deep paginated junk. */
function sampleUrls(
  origin: string,
  all: string[],
  max: number,
): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const u of all) {
    if (seen.has(u)) continue;
    seen.add(u);
    candidates.push(u);
  }
  candidates.sort((a, b) => {
    // Homepage always first
    if (a.replace(/\/$/, "") === origin.replace(/\/$/, "")) return -1;
    if (b.replace(/\/$/, "") === origin.replace(/\/$/, "")) return 1;
    // Then prefer shallower paths
    const pa = (a.match(/\//g)?.length ?? 0);
    const pb = (b.match(/\//g)?.length ?? 0);
    if (pa !== pb) return pa - pb;
    return a.length - b.length;
  });
  return candidates.slice(0, max);
}

export async function discoverSitemap(
  siteUrl: string,
  opts: { maxUrls?: number; signal?: AbortSignal } = {},
): Promise<SitemapDiscovery> {
  const maxUrls = opts.maxUrls ?? 12;
  const signal = opts.signal;

  const origin = new URL(siteUrl).origin;
  const robotsTxtUrl = `${origin}/robots.txt`;
  const errors: string[] = [];

  // 1. robots.txt
  const robots = await fetchText(robotsTxtUrl, signal);
  let sitemapCandidates: string[] = [];
  let robotsExcerpt: string | null = null;
  let robotsStatus: number | null = null;
  if (robots) {
    robotsStatus = robots.status;
    if (robots.status === 200) {
      sitemapCandidates = extractSitemapDirectives(robots.text);
      robotsExcerpt = robots.text.slice(0, 600);
    }
  } else {
    errors.push(`robots.txt fetch failed`);
  }

  // 2. Fallback to /sitemap.xml + /sitemap_index.xml if none declared
  if (sitemapCandidates.length === 0) {
    sitemapCandidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  }

  // 3. Fetch each candidate, follow index files one level deep
  const sitemapSources: string[] = [];
  const allUrls: string[] = [];
  const fetched = new Set<string>();

  async function fetchSitemap(url: string, depth: number): Promise<void> {
    if (fetched.has(url)) return;
    fetched.add(url);
    const res = await fetchText(url, signal);
    if (!res) {
      errors.push(`Sitemap fetch failed: ${url}`);
      return;
    }
    if (res.status !== 200) {
      errors.push(`Sitemap ${url} HTTP ${res.status}`);
      return;
    }
    sitemapSources.push(url);
    let parsed;
    try {
      parsed = parseSitemap(res.text);
    } catch {
      errors.push(`Sitemap ${url} parse failed`);
      return;
    }
    allUrls.push(...parsed.urls);
    if (parsed.isIndex && depth < 1) {
      // Only walk one level of index → child sitemaps. Cap the fan-out so a
      // 200-sitemap index doesn't blow the budget; we just need a sample.
      for (const nested of parsed.nestedSitemaps.slice(0, 5)) {
        await fetchSitemap(nested, depth + 1);
      }
    }
  }

  for (const candidate of sitemapCandidates) {
    if (sitemapSources.length >= 6) break; // hard cap on sitemaps fetched
    await fetchSitemap(candidate, 0);
  }

  const sampledUrls = sampleUrls(origin, allUrls, maxUrls);

  return {
    origin,
    robotsTxtUrl,
    robotsStatus,
    robotsExcerpt,
    sitemapSources,
    totalUrls: allUrls.length,
    sampledUrls,
    errors,
  };
}

export function formatSitemapForPrompt(s: SitemapDiscovery): string {
  const lines: string[] = [];
  lines.push(`## Sitemap & robots`);
  lines.push(`Origin: ${s.origin}`);
  lines.push(
    `robots.txt: ${s.robotsStatus === null ? "fetch failed" : `HTTP ${s.robotsStatus}`}`,
  );
  if (s.sitemapSources.length === 0) {
    lines.push(`Sitemaps: none discovered`);
  } else {
    lines.push(`Sitemaps fetched (${s.sitemapSources.length}):`);
    for (const src of s.sitemapSources) lines.push(`- ${src}`);
  }
  lines.push(`Total URLs in sitemap(s): ${s.totalUrls}`);
  lines.push(
    `Sampled for crawl (${s.sampledUrls.length}, prioritising homepage + shallow paths):`,
  );
  for (const u of s.sampledUrls) lines.push(`- ${u}`);
  if (s.errors.length > 0) {
    lines.push(`Errors:`);
    for (const e of s.errors) lines.push(`- ${e}`);
  }
  return lines.join("\n");
}
