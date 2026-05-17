// Site-wide SEO Audit orchestrator.
//
// Flow:
//   1. Discover sitemap → URL sample (homepage + ~10 representative pages)
//   2. In parallel: homepage crawl + sample crawl + PSI mobile + PSI desktop +
//      GSC site data (queries, pages, totals, sitemaps)
//   3. Compose one big Markdown fact pack for SEO Claude.
//
// Emits ToolProgressEvent throughout so the action UI can stream a
// per-step status to the user.

import {
  discoverSitemap,
  formatSitemapForPrompt,
  type SitemapDiscovery,
} from "./sitemap";
import {
  crawlMany,
  crawlPage,
  formatCrawlForPrompt,
  formatMultiCrawlForPrompt,
  type CrawlResult,
  type MultiCrawlEntry,
} from "./crawler";
import {
  runPageSpeed,
  formatPsiForPrompt,
  type PsiResult,
} from "./pagespeed";
import {
  getSiteAuditData,
  formatGscSiteAuditForPrompt,
  type SiteAuditGscData,
} from "../gsc";
import {
  fetchDomainMetrics,
  formatDomainMetricsForPrompt,
  isDataforSeoConfigured,
  type DomainMetrics,
} from "./dataforseo";
import { getClientGeo } from "../client-geo";

export type ToolProgressEvent =
  | { type: "info"; message: string }
  | { type: "start"; tool: string; label: string }
  | { type: "done"; tool: string; label: string; ms: number; summary: string }
  | { type: "error"; tool: string; label: string; ms: number; message: string };

export type SiteAuditFactPack = {
  markdown: string;
  events: ToolProgressEvent[];
  metrics: DomainMetrics | null;
  meta: {
    siteUrl: string;
    pagesCrawled: number;
    psiMobileOk: boolean;
    psiDesktopOk: boolean;
    gscStatus: SiteAuditGscData["status"];
    domainIntelOk: boolean;
  };
};

type StepResult<T> = {
  ok: boolean;
  value?: T;
  error?: string;
  ms: number;
};

async function timed<T>(fn: () => Promise<T>): Promise<StepResult<T>> {
  const started = Date.now();
  try {
    const value = await fn();
    return { ok: true, value, ms: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    };
  }
}

export type SiteAuditDepth = "Quick" | "Standard" | "Deep" | "All";

const DEPTH_SETTINGS: Record<
  SiteAuditDepth,
  { maxPages: number; concurrency: number }
> = {
  Quick: { maxPages: 10, concurrency: 6 },
  Standard: { maxPages: 25, concurrency: 8 },
  Deep: { maxPages: 50, concurrency: 10 },
  All: { maxPages: 100, concurrency: 12 },
};

export async function runSiteAudit(
  inputUrl: string,
  clientSlug: string,
  emit: (event: ToolProgressEvent) => void,
  opts: { depth?: SiteAuditDepth } = {},
): Promise<SiteAuditFactPack> {
  const depth: SiteAuditDepth = opts.depth ?? "Standard";
  const { maxPages, concurrency } = DEPTH_SETTINGS[depth];
  const geo = getClientGeo(clientSlug);
  const events: ToolProgressEvent[] = [];
  function fire(event: ToolProgressEvent) {
    events.push(event);
    emit(event);
  }

  const siteOrigin = new URL(inputUrl).origin;

  // ---- Step 1: sitemap discovery (sequential — its output feeds the crawl) ----
  fire({
    type: "info",
    message: `Depth: ${depth} — sampling up to ${maxPages} pages`,
  });
  fire({ type: "start", tool: "sitemap", label: "Sitemap discovery" });
  const sitemapStep = await timed<SitemapDiscovery>(() =>
    discoverSitemap(siteOrigin, { maxUrls: maxPages }),
  );
  let sitemap: SitemapDiscovery;
  if (sitemapStep.ok && sitemapStep.value) {
    sitemap = sitemapStep.value;
    fire({
      type: "done",
      tool: "sitemap",
      label: "Sitemap discovery",
      ms: sitemapStep.ms,
      summary: `${sitemap.totalUrls} URLs found, ${sitemap.sampledUrls.length} sampled, ${sitemap.sitemapSources.length} sitemap(s)`,
    });
  } else {
    sitemap = {
      origin: siteOrigin,
      robotsTxtUrl: `${siteOrigin}/robots.txt`,
      robotsStatus: null,
      robotsExcerpt: null,
      sitemapSources: [],
      totalUrls: 0,
      sampledUrls: [siteOrigin],
      errors: [sitemapStep.error ?? "unknown sitemap discovery error"],
    };
    fire({
      type: "error",
      tool: "sitemap",
      label: "Sitemap discovery",
      ms: sitemapStep.ms,
      message: sitemapStep.error ?? "unknown",
    });
  }

  // Always crawl the explicit input URL (homepage), even if sitemap missed it.
  // Dedupe with normalised keys so /en/ and /en don't double up. The user often
  // types "https://site/" while the sitemap lists "https://site/en/" — both
  // typically resolve to the same finalUrl after a redirect.
  const samplePages = uniqueByNormalisedUrl([
    inputUrl,
    ...sitemap.sampledUrls,
  ]).slice(0, maxPages);

  const sampleLabel =
    sitemap.totalUrls > 0
      ? `Sample crawl — ${samplePages.length} of ${sitemap.totalUrls} pages`
      : `Sample crawl — ${samplePages.length} pages`;

  // ---- Step 2: parallel — homepage crawl, sample crawl, PSI x2, GSC ----
  fire({ type: "start", tool: "crawl-home", label: "Homepage HTML" });
  fire({
    type: "start",
    tool: "crawl-sample",
    label: sampleLabel,
  });
  fire({ type: "start", tool: "psi-mobile", label: "PageSpeed — mobile" });
  fire({ type: "start", tool: "psi-desktop", label: "PageSpeed — desktop" });
  fire({ type: "start", tool: "gsc", label: "Search Console" });
  fire({
    type: "start",
    tool: "dataforseo",
    label: isDataforSeoConfigured()
      ? `Domain intelligence (DataforSEO — ${geo.countryLabel})`
      : "Domain intelligence (DataforSEO — not configured)",
  });

  const [
    homepageStep,
    sampleStep,
    psiMobileStep,
    psiDesktopStep,
    gscStep,
    domainStep,
  ] = await Promise.all([
    timed<CrawlResult>(() => crawlPage(inputUrl)),
    timed<MultiCrawlEntry[]>(() =>
      crawlMany(samplePages, { concurrency }),
    ),
    timed<PsiResult>(() => runPageSpeed(inputUrl, "mobile")),
    timed<PsiResult>(() => runPageSpeed(inputUrl, "desktop")),
    timed<SiteAuditGscData>(() => getSiteAuditData(clientSlug, 28)),
    timed<DomainMetrics | null>(() =>
      fetchDomainMetrics(inputUrl, {
        locationCode: geo.locationCode,
        languageCode: geo.languageCode,
      }),
    ),
  ]);

  // Report each step
  emitStepDone(fire, "crawl-home", "Homepage HTML", homepageStep, (r) =>
    `HTTP ${r.status}, ${(r.bytes / 1024).toFixed(0)} KB, ${r.h1.length} H1, ${r.jsonLdTypes.length} schema types`,
  );
  emitStepDone(fire, "crawl-sample", sampleLabel, sampleStep, (entries) => {
    const ok = entries.filter((e) => e.ok).length;
    return `${ok}/${entries.length} pages successful`;
  });
  emitStepDone(fire, "psi-mobile", "PageSpeed — mobile", psiMobileStep, (r) =>
    `Perf ${r.scores.performance ?? "—"} · SEO ${r.scores.seo ?? "—"} · A11y ${r.scores.accessibility ?? "—"} · BP ${r.scores.bestPractices ?? "—"}`,
  );
  emitStepDone(
    fire,
    "psi-desktop",
    "PageSpeed — desktop",
    psiDesktopStep,
    (r) =>
      `Perf ${r.scores.performance ?? "—"} · SEO ${r.scores.seo ?? "—"} · A11y ${r.scores.accessibility ?? "—"} · BP ${r.scores.bestPractices ?? "—"}`,
  );
  emitStepDone(fire, "gsc", "Search Console", gscStep, (d) => {
    if (d.status !== "ok") return d.status;
    return `${d.totals.clicks} clicks / ${d.totals.impressions} impressions / pos ${d.totals.position.toFixed(1)}`;
  });
  emitStepDone(
    fire,
    "dataforseo",
    "Domain intelligence (DataforSEO)",
    domainStep,
    (d) => {
      if (!d) return "not configured (skipped)";
      const partial = d.errors.length > 0 ? ` · ${d.errors.length} sub-error(s)` : "";
      return `Rank ${d.rank ?? "—"} · ${d.organicKeywords ?? "—"} kw · ${d.referringDomains ?? "—"} ref domains${partial}`;
    },
  );

  // ---- Step 3: compose fact pack ----
  const factParts: string[] = [];

  factParts.push(`# Site-wide audit fact pack`);
  factParts.push(`Target: ${siteOrigin}`);
  factParts.push("");

  factParts.push(formatSitemapForPrompt(sitemap));

  if (homepageStep.ok && homepageStep.value) {
    factParts.push("");
    factParts.push(`# Homepage`);
    factParts.push(formatCrawlForPrompt(homepageStep.value));
  } else if (homepageStep.error) {
    factParts.push("");
    factParts.push(`## Homepage crawl failed: ${homepageStep.error}`);
  }

  if (sampleStep.ok && sampleStep.value) {
    factParts.push("");
    factParts.push(formatMultiCrawlForPrompt(sampleStep.value));
  } else if (sampleStep.error) {
    factParts.push("");
    factParts.push(`## Sample crawl failed: ${sampleStep.error}`);
  }

  if (psiMobileStep.ok && psiMobileStep.value) {
    factParts.push("");
    factParts.push(formatPsiForPrompt(psiMobileStep.value));
  } else if (psiMobileStep.error) {
    factParts.push("");
    factParts.push(
      `## PageSpeed mobile failed: ${psiMobileStep.error.slice(0, 280)}`,
    );
  }

  if (psiDesktopStep.ok && psiDesktopStep.value) {
    factParts.push("");
    factParts.push(formatPsiForPrompt(psiDesktopStep.value));
  } else if (psiDesktopStep.error) {
    factParts.push("");
    factParts.push(
      `## PageSpeed desktop failed: ${psiDesktopStep.error.slice(0, 280)}`,
    );
  }

  if (gscStep.ok && gscStep.value) {
    factParts.push("");
    factParts.push(formatGscSiteAuditForPrompt(gscStep.value));
  } else if (gscStep.error) {
    factParts.push("");
    factParts.push(`## Search Console pull failed: ${gscStep.error}`);
  }

  const metrics = domainStep.ok && domainStep.value ? domainStep.value : null;
  if (metrics) {
    factParts.push("");
    factParts.push(formatDomainMetricsForPrompt(metrics));
  } else if (!isDataforSeoConfigured()) {
    factParts.push("");
    factParts.push(
      `## Domain intelligence\n_Not configured (DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD missing). When connected, this section provides domain authority, organic keyword footprint, backlink profile, and top ranked keywords._`,
    );
  } else if (domainStep.error) {
    factParts.push("");
    factParts.push(`## Domain intelligence pull failed: ${domainStep.error}`);
  }

  return {
    markdown: factParts.join("\n"),
    events,
    metrics,
    meta: {
      siteUrl: siteOrigin,
      pagesCrawled: sampleStep.value?.filter((e) => e.ok).length ?? 0,
      psiMobileOk: psiMobileStep.ok,
      psiDesktopOk: psiDesktopStep.ok,
      gscStatus: gscStep.value?.status ?? "error",
      domainIntelOk: metrics !== null,
    },
  };
}

function emitStepDone<T>(
  fire: (e: ToolProgressEvent) => void,
  tool: string,
  label: string,
  step: StepResult<T>,
  summarise: (value: T) => string,
) {
  if (step.ok && step.value !== undefined) {
    fire({
      type: "done",
      tool,
      label,
      ms: step.ms,
      summary: summarise(step.value),
    });
  } else {
    fire({
      type: "error",
      tool,
      label,
      ms: step.ms,
      message: (step.error ?? "unknown").slice(0, 300),
    });
  }
}

function uniqueByNormalisedUrl(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = normaliseUrlKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function normaliseUrlKey(u: string): string {
  try {
    const url = new URL(u);
    // Strip trailing slash + hash, lowercase host.
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
  } catch {
    return u;
  }
}
