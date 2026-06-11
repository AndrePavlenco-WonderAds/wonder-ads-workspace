// Meta Tags optimization — streams NDJSON progress events:
//   {event:"progress", phase:"context"|"kw"|"crawl"|"generate"|"saving", message, ...}
//   {event:"result", resultId, rowsCount}
//   {event:"error", message}
//
// Pipeline:
//   1. Validate KW research exists for this client (BLOCK if not).
//   2. Discover sitemap + sample URLs (depth-driven cap).
//   3. Crawl each URL in parallel — extract title + meta description.
//   4. Claude Haiku reads the KW cluster map + crawl results + brief +
//      onboarding, returns per-URL optimized title/meta/keywords/
//      reasoning/issues via generateObject + Zod.
//   5. Save MetaTagsResult to KV.

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { findAction } from "@/lib/seo-pillars";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientBySlug } from "@/lib/notion";
import { getClientWebsite } from "@/lib/client-meta";
import { getOnboardingForSlug } from "@/lib/onboarding-store";
import { getClientGeo } from "@/lib/client-geo";
import { listHistory } from "@/lib/action-history";
import type { KwCluster } from "@/lib/kw-cluster-parser";
import {
  listTargetKeywords,
  type TargetKeyword,
} from "@/lib/target-keywords-store";
import { discoverSitemap } from "@/lib/seo-tools/sitemap";
import { crawlMany } from "@/lib/seo-tools/crawler";
import {
  newMetaTagsResultId,
  newMetaTagsRowId,
  saveMetaTagsResult,
  type MetaTagsResult,
  type MetaTagsRow,
} from "@/lib/meta-tags-store";

export const runtime = "nodejs";
// Vercel Pro — 300s. Bulk meta-tag generation runs one structured-
// output call per sampled page; 30+ pages × ~3-5s used to brush
// against the 60s cap.
export const maxDuration = 300;

const CAPTION_MODEL = "claude-haiku-4-5-20251001";

// Schema deliberately LENIENT on lengths. The system prompt + per-prompt
// rules push Claude toward 50-60 char titles and 120-160 char metas — but
// if Claude returns a 32-char title for a thin page like /privacy, we
// want the row to land (flagged as a length issue) instead of failing
// the entire 10-page chunk's generateObject call. We post-process below
// to auto-add length issues to `issues[]` so the consultant sees them
// in the UI.
const RowSchema = z.object({
  url: z.string().describe("The page URL — copy verbatim from the input."),
  optimizedTitle: z
    .string()
    .min(5)
    .max(120)
    .describe(
      "Optimised <title> tag. TARGET 50–60 chars (Google truncates at ~580px). Primary keyword in the first 60%. Brand at the end with ` | ` separator. Aim for 40+ chars by adding geo modifier / specialty / brand if the natural title would be shorter.",
    ),
  optimizedMeta: z
    .string()
    .min(20)
    .max(300)
    .describe(
      "Optimised <meta name='description'> tag. TARGET 120–160 chars. Lead with value prop, weave primary keyword once, end with a soft CTA verb (Marca consulta / Saiba mais / Descubra / Book a consultation / Learn more depending on language). Don't repeat the title verbatim.",
    ),
  primaryKeyword: z
    .string()
    .nullable()
    .describe(
      "Primary target keyword for this page. Pick from the KW Cluster map by best topical fit with URL + current title. null if the page has no commercial intent (e.g. /privacy).",
    ),
  secondaryKeywords: z
    .array(z.string())
    .max(5)
    .default([])
    .describe("0–3 supporting keywords from related clusters."),
  reasoning: z
    .string()
    .max(300)
    .default("")
    .describe(
      "ONE sentence on WHY this rewrite — what the current tag missed, what the new one captures.",
    ),
  issues: z
    .array(z.string())
    .max(8)
    .default([])
    .describe(
      "Issues spotted on the CURRENT tag. Examples: 'missing meta', 'title too long', 'title too short', 'meta too short', 'no primary keyword', 'duplicate title', 'brand-only title'. Skip if none apply.",
    ),
});

const BatchSchema = z.object({
  rows: z.array(RowSchema).min(1),
});

type Row = z.infer<typeof RowSchema>;

const TITLE_FLOOR = 40;
const TITLE_CEILING = 60;
const META_FLOOR = 120;
const META_CEILING = 160;

/** Post-process a row: auto-add issues for length violations on the
 *  OPTIMIZED output so consultants see them in the UI without us having
 *  to reject the whole chunk. */
function annotateRowLengths(row: Row): Row {
  const extraIssues: string[] = [];
  if (row.optimizedTitle.length < TITLE_FLOOR) {
    extraIssues.push(
      `optimized title under ${TITLE_FLOOR} chars (${row.optimizedTitle.length}) — manually lengthen`,
    );
  } else if (row.optimizedTitle.length > TITLE_CEILING + 5) {
    extraIssues.push(
      `optimized title over ${TITLE_CEILING} chars (${row.optimizedTitle.length}) — risk of SERP truncation`,
    );
  }
  if (row.optimizedMeta.length < META_FLOOR) {
    extraIssues.push(
      `optimized meta under ${META_FLOOR} chars (${row.optimizedMeta.length}) — add more value props`,
    );
  } else if (row.optimizedMeta.length > META_CEILING + 10) {
    extraIssues.push(
      `optimized meta over ${META_CEILING} chars (${row.optimizedMeta.length}) — risk of SERP truncation`,
    );
  }
  if (extraIssues.length === 0) return row;
  return { ...row, issues: [...row.issues, ...extraIssues] };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;
  const entry = findAction(actionSlug);
  if (!entry || entry.action.slug !== "meta-title-description") {
    return NextResponse.json(
      { error: "Action not supported" },
      { status: 400 },
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 },
    );
  }

  let body: { inputs?: Record<string, string>; resultId?: string } = {};
  try {
    body = (await req.json()) as {
      inputs?: Record<string, string>;
      resultId?: string;
    };
  } catch {
    /* empty body is fine */
  }
  const inputs = body.inputs ?? {};
  // Honour the resultId from the URL so the result we save matches the
  // ID the page is rendering at. Without this, the page-level
  // getMetaTagsResult(slug, urlResultId) lookup returns null and the
  // Send-for-Approval + Download buttons stay disabled.
  const incomingResultId =
    typeof body.resultId === "string" && body.resultId.trim()
      ? body.resultId.trim()
      : null;
  const websiteInput = (inputs.pageUrl ?? "").trim();
  const depth = parseDepth(inputs.depth);
  const focusKeywords = (inputs.focusKeywords ?? "").trim();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        // ---- Context phase ----
        send({
          event: "progress",
          phase: "context",
          message: "Loading client context (brief, onboarding, geo)…",
        });
        const client = await getClientBySlug(clientSlug).catch(() => null);
        if (!client) {
          send({ event: "error", message: "Unknown client." });
          controller.close();
          return;
        }
        const websiteFromMeta = getClientWebsite(clientSlug);
        const websiteUrl = normaliseUrl(websiteInput || websiteFromMeta || "");
        if (!websiteUrl) {
          send({
            event: "error",
            message:
              "No website URL on file or in the form. Set the client website in /seo-clients.ts metadata or enter it in the form.",
          });
          controller.close();
          return;
        }

        const [brief, onboarding, kwHistory, targetKeywords] = await Promise.all([
          getBriefForSlug(clientSlug),
          getOnboardingForSlug(clientSlug),
          listHistory(clientSlug, "keyword-research"),
          listTargetKeywords(clientSlug),
        ]);
        const geo = getClientGeo(clientSlug);

        // ---- Keyword source resolution ----
        // The Target Keywords table is the canonical live source — what
        // the consultant has committed to ranking for RIGHT NOW. The
        // Keyword Research history is a frozen snapshot from the last
        // run. We prefer the live list; fall back to history clusters
        // if Target Keywords is empty; error only when BOTH are empty.
        const latestKw = kwHistory[0];
        const historyClusters: KwCluster[] = latestKw?.kwClusters ?? [];
        let kwClusters: KwCluster[];
        let kwSourceLabel: string;
        if (targetKeywords.length > 0) {
          kwClusters = clustersFromTargetKeywords(targetKeywords);
          const enrichedCount = targetKeywords.filter(
            (k) =>
              (k.searchVolume !== null && k.searchVolume !== undefined) ||
              (k.difficulty !== null && k.difficulty !== undefined),
          ).length;
          kwSourceLabel = `Target Keywords table (${targetKeywords.length} live keyword${targetKeywords.length === 1 ? "" : "s"}, ${enrichedCount} enriched)`;
        } else if (historyClusters.length > 0) {
          kwClusters = historyClusters;
          kwSourceLabel = `Keyword Research from ${new Date(latestKw!.createdAt).toISOString().slice(0, 10)} (${historyClusters.length} cluster${historyClusters.length === 1 ? "" : "s"}, ${historyClusters.reduce((s, c) => s + c.rows.length, 0)} keywords)`;
        } else {
          send({
            event: "error",
            message:
              "No keywords found for this client. Add target keywords to the Target Keywords table on the client page, or run Keyword Research — then come back. Meta-tag optimisation needs a keyword universe to assign primary keywords per URL.",
          });
          controller.close();
          return;
        }
        send({
          event: "progress",
          phase: "kw",
          message: `✓ Keyword source: ${kwSourceLabel}.`,
        });

        // ---- Crawl phase ----
        send({
          event: "progress",
          phase: "crawl",
          message: `Discovering sitemap for ${new URL(websiteUrl).hostname}…`,
        });
        // CRITICAL: pass maxUrls = depth.maxPages so discoverSitemap
        // returns ALL the URLs we need, not its 12-default. v73.0 was
        // capping at 12 regardless of the consultant's depth pick.
        const sitemap = await discoverSitemap(websiteUrl, {
          maxUrls: depth.maxPages,
        });
        // Build the URL pool. Always include the homepage; dedupe.
        const urlPool = new Set<string>([websiteUrl, ...sitemap.sampledUrls]);
        send({
          event: "progress",
          phase: "crawl",
          message: `✓ Sitemap returned ${sitemap.sampledUrls.length} URL${sitemap.sampledUrls.length === 1 ? "" : "s"} (of ${sitemap.totalUrls} total).`,
        });
        // Fallback: if the sitemap returned fewer URLs than the requested
        // depth, walk the homepage's internal links to discover more
        // pages. Common case for clinics on Webflow / WordPress with
        // shallow sitemaps that don't list every doctor / service page.
        if (urlPool.size < depth.maxPages) {
          send({
            event: "progress",
            phase: "crawl",
            message: `Sitemap returned fewer URLs than requested (${urlPool.size} < ${depth.maxPages}) — discovering additional internal links from the homepage…`,
          });
          try {
            const extra = await discoverInternalLinksFromHomepage(
              websiteUrl,
              depth.maxPages - urlPool.size,
            );
            for (const u of extra) urlPool.add(u);
            send({
              event: "progress",
              phase: "crawl",
              message: `✓ Homepage crawl added ${extra.length} more URL${extra.length === 1 ? "" : "s"} (pool: ${urlPool.size}).`,
            });
          } catch (err) {
            send({
              event: "progress",
              phase: "crawl",
              message: `⚠️ Homepage-link fallback failed (${err instanceof Error ? err.message.slice(0, 100) : String(err)}) — continuing with sitemap URLs only.`,
            });
          }
        }
        const allUrls = Array.from(urlPool).slice(0, depth.maxPages);
        send({
          event: "progress",
          phase: "crawl",
          message: `Crawling ${allUrls.length} page${allUrls.length === 1 ? "" : "s"} (depth: ${depth.label})…`,
        });
        const crawled = await crawlMany(allUrls, {
          concurrency: depth.concurrency,
        });
        const okCrawls = crawled.filter(
          (c): c is Extract<typeof c, { ok: true }> => c.ok,
        );
        if (okCrawls.length === 0) {
          send({
            event: "error",
            message: `Couldn't crawl any pages from ${websiteUrl}. Check the site is up and publicly accessible.`,
          });
          controller.close();
          return;
        }
        send({
          event: "progress",
          phase: "crawl",
          message: `✓ Crawled ${okCrawls.length} page${okCrawls.length === 1 ? "" : "s"} (${crawled.length - okCrawls.length} failed).`,
        });

        // ---- Generate phase ----
        // Chunked generation: split the crawled pages into batches of
        // CHUNK_SIZE and call generateObject per chunk IN PARALLEL.
        // Three wins:
        //   1. Each batch fits comfortably under the maxOutputTokens
        //      ceiling — no more "response did not match schema"
        //      truncation errors on 25+ page sites.
        //   2. Per-chunk retry: a transient API blip / one bad row no
        //      longer kills the entire batch.
        //   3. Partial success: 4/5 chunks landing means consultant
        //      gets 40 rows instead of 0.
        const CHUNK_SIZE = 10;
        const allPages = okCrawls.map((c) => ({
          url: c.result.finalUrl,
          currentTitle: c.result.title,
          currentMeta: c.result.metaDescription,
          h1: c.result.h1[0] ?? null,
        }));
        const chunks: typeof allPages[] = [];
        for (let i = 0; i < allPages.length; i += CHUNK_SIZE) {
          chunks.push(allPages.slice(i, i + CHUNK_SIZE));
        }
        send({
          event: "progress",
          phase: "generate",
          message: `Drafting optimised meta tags with Claude (Haiku 4.5) — ${chunks.length} chunk${chunks.length === 1 ? "" : "s"} of up to ${CHUNK_SIZE} pages in parallel…`,
        });
        const system = buildSystemPrompt(geo.languageCode);
        // Stream the chunk-level diagnostics back as progress events so
        // the consultant sees exactly which layer failed and why (HTTP
        // status, Anthropic error type, Zod issue, raw model output
        // excerpt) without having to read Vercel logs.
        const emitDiagnostic = (line: string) => {
          send({ event: "progress", phase: "generate", message: `🔍 ${line}` });
        };
        const chunkResults = await Promise.all(
          chunks.map(async (chunk, idx) =>
            generateChunkWithRetry({
              chunkIdx: idx,
              chunk,
              clientName: client.title,
              websiteUrl,
              languageCode: geo.languageCode,
              brief,
              onboardingText: onboarding?.extractedText ?? null,
              kwClusters,
              focusKeywords,
              system,
              onDiagnostic: emitDiagnostic,
            }),
          ),
        );
        const drafts = chunkResults.flat();
        const failedChunks = chunkResults.filter((r) => r.length === 0).length;
        if (drafts.length === 0) {
          send({
            event: "error",
            message:
              `Generation produced no rows after three retry layers across ALL ${chunks.length} chunk${chunks.length === 1 ? "" : "s"}. The 🔍 diagnostic lines above name the underlying error for each layer (HTTP status, Anthropic error type, Zod issue, raw model excerpt). Most common cause is Anthropic API overload (HTTP 529 overloaded_error) — retry in a minute. If the diagnostics show schema/Zod issues instead, the prompt may need tightening; ping Claude.`,
          });
          controller.close();
          return;
        }
        if (failedChunks > 0) {
          send({
            event: "progress",
            phase: "generate",
            message: `⚠️ ${failedChunks} of ${chunks.length} chunk${chunks.length === 1 ? "" : "s"} failed — ${drafts.length}/${allPages.length} pages still optimised. Open the result to see partial output.`,
          });
        } else {
          send({
            event: "progress",
            phase: "generate",
            message: `✓ All ${chunks.length} chunk${chunks.length === 1 ? "" : "s"} succeeded — ${drafts.length} rows ready.`,
          });
        }

        // ---- Stitch + save ----
        send({
          event: "progress",
          phase: "saving",
          message: "Saving optimised tags to your workspace…",
        });
        const now = Date.now();
        const resultId = incomingResultId ?? newMetaTagsResultId();
        // Build a lookup from URL → crawl data so we can stitch
        // current + optimised side-by-side.
        const byUrl = new Map(
          okCrawls.map((c) => [c.result.finalUrl, c.result]),
        );
        const rows: MetaTagsRow[] = [];
        for (const raw of drafts) {
          const crawl = byUrl.get(raw.url);
          if (!crawl) continue; // skip rows for URLs Claude hallucinated
          const d = annotateRowLengths(raw);
          rows.push({
            id: newMetaTagsRowId(),
            url: d.url,
            currentTitle: crawl.title || null,
            currentTitleLength: crawl.titleLength,
            currentMeta: crawl.metaDescription || null,
            currentMetaLength: crawl.metaDescriptionLength,
            optimizedTitle: d.optimizedTitle,
            optimizedTitleLength: d.optimizedTitle.length,
            optimizedMeta: d.optimizedMeta,
            optimizedMetaLength: d.optimizedMeta.length,
            primaryKeyword: d.primaryKeyword,
            secondaryKeywords: d.secondaryKeywords,
            reasoning: d.reasoning,
            issues: d.issues,
            createdAt: now,
            updatedAt: now,
          });
        }

        if (rows.length === 0) {
          send({
            event: "error",
            message:
              "Claude returned no rows that matched the crawled URLs. Try regenerating with the same depth.",
          });
          controller.close();
          return;
        }

        const stats = {
          pagesCrawled: rows.length,
          pagesWithMissingMeta: rows.filter((r) => !r.currentMeta).length,
          pagesWithLongTitle: rows.filter((r) => r.currentTitleLength > 60)
            .length,
          pagesWithShortMeta: rows.filter(
            (r) => r.currentMeta !== null && r.currentMetaLength < 70,
          ).length,
        };

        const result: MetaTagsResult = {
          id: resultId,
          clientSlug,
          createdAt: now,
          inputs: {
            websiteUrl,
            depth: depth.label,
            focusKeywords: focusKeywords || undefined,
          },
          // Keep this field for backwards compat with existing results.
          // When the keyword source was the live Target Keywords table
          // (not a historical KW research), we store the marker string
          // "target-keywords:<count>" so the result page can disambiguate.
          kwResearchSourceId:
            targetKeywords.length > 0
              ? `target-keywords:${targetKeywords.length}`
              : (latestKw?.id ?? ""),
          stats,
          rows,
        };
        await saveMetaTagsResult(result);
        revalidatePath(`/seo/${clientSlug}/actions/meta-title-description`);
        send({ event: "result", resultId, rowsCount: rows.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[meta-generate] failed:", err);
        send({ event: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

// ===== Helpers =====

function parseDepth(
  raw: string | undefined,
): { label: "Quick" | "Standard" | "Deep"; maxPages: number; concurrency: number } {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("quick")) return { label: "Quick", maxPages: 10, concurrency: 6 };
  if (v.includes("deep")) return { label: "Deep", maxPages: 50, concurrency: 10 };
  return { label: "Standard", maxPages: 25, concurrency: 8 };
}

function normaliseUrl(raw: string): string | null {
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

function buildSystemPrompt(languageCode: string): string {
  const lang =
    languageCode === "pt"
      ? "European Portuguese (Portugal, pt-PT — NOT Brazilian; use 'tu' / 'telemóvel' / 'casa de banho' etc.)"
      : languageCode === "es"
        ? "European Spanish (Spain)"
        : languageCode === "fr"
          ? "French (France)"
          : "English";
  return `You are a senior SEO copywriter at Wonder Ads (Health & Wellness growth agency, Portugal). You write <title> and <meta description> tags that follow the standards top US/UK SEO agencies (Backlinko, Ahrefs, Moz, Search Engine Journal) treat as table stakes for ranking in Google in 2026.

Your output goes straight into the live HTML <head>. It will be measured against:

# Title tag best practices (HARD RULES — every title must satisfy ALL)

1. **Length: 50–60 characters.** Google truncates at ~580px in desktop SERPs, which lands around 60 chars for Latin scripts. Aim 55. **MINIMUM 40 chars** — anything shorter wastes SERP real estate and signals low effort. NEVER below 40. If the natural title would be shorter, lengthen it by adding:
   - a geographic modifier (city / region — most local-SEO winning move)
   - the specialty / role / service type
   - the brand with a clean separator ( | preferred over – or :)
   - a value descriptor (e.g. "premium", "boutique", "personalized") ONLY when it's truthful
2. **Primary keyword in the first 60% of the title.** Ideally in the first 3-4 words. Don't bury it after the brand.
3. **Brand at the END, separated by " | "** (with spaces). Format: "Primary Keyword Modifier | Brand". Skip the brand only when it would push the title past 60 chars.
4. **One focus per page.** Don't try to rank every page for everything — match what the URL is actually about (look at the H1 + current title).
5. **Every page's title MUST be unique.** Never duplicate. If two pages serve the same intent, the URL with the better commercial intent gets the keyword; the other gets a clear differentiator.
6. **Natural human language.** No keyword stuffing ("dentista lisboa | clínica dentária lisboa | dentistas lisboa"). No ALL CAPS. No clickbait that mis-sets intent.
7. **Title Case in English** ("Best Dental Clinic in Lisbon"). **Sentence case in Portuguese / Spanish / French** ("Melhor clínica dentária em Lisboa") — capital only on the first word and proper nouns.
8. **No date-stamped years unless the page is genuinely year-specific** (avoid "Dentista Lisboa 2025" unless the content updates yearly).

# Meta description best practices (HARD RULES)

1. **Length: 120–160 characters.** Google truncates at ~155 on desktop, ~120 on mobile. **MINIMUM 120 chars.** Don't pad; if you'd need to pad to hit 120, the page doesn't have enough to say and you should write more concrete value props.
2. **Lead with the value prop, not "Welcome to" / "We are X".** First 90 chars are what shows on mobile — pack the benefit there.
3. **Primary keyword exactly once, naturally.** Google bolds it in SERPs (still a CTR win). Don't stuff it.
4. **Soft CTA verb at the end** in the page language: "Marca consulta" / "Saiba mais" / "Agende já" / "Descubra" (PT) · "Reservar" / "Más información" (ES) · "Book now" / "Learn more" / "Get a quote" (EN).
5. **NEVER repeat the title verbatim.** The meta is the second pitch — answer "what's in it for me if I click?".
6. **No truncation traps.** Don't put the most important info after char 155; assume mobile users only see the first 120.
7. **Match search intent.** Service page → describe the service + outcome. Article → tease the answer. Contact → location + hours + CTA.

# Cross-cutting rules

- **Language:** Write in ${lang}. ALL titles + metas in the same language unless explicitly told otherwise.
- **YMYL safety (Health/Wellness clients):** NEVER make medical claims (cure, eliminates, guarantees), NEVER promise outcomes ("sem dor", "100% garantido"), NEVER use "milagre / milagroso". Soft language: "ajudamos", "apoiamos", "acompanhamos".
- **Brief Do's / Don'ts / Notes are HARD RULES.** A Don't ALWAYS overrides best practice. Read the Client Brief block before writing any tag.
- **Use the Keyword Cluster map.** Pick the primary keyword from the supplied clusters. DON'T invent new keywords. If a URL has no commercial intent (/privacy, /terms, /cookies, /404), set primaryKeyword: null and write a basic non-keyword-stuffed meta.
- **Real-business voice.** No "Welcome to", no "Best X in Y", no "Number one provider of", no AI-stocky framing. Write like a senior agency copywriter who's been doing this for 15 years.

Output STRICT JSON matching the schema. One row per crawled URL — keep the URL field verbatim from the input.`;
}

function buildPrompt(opts: {
  clientName: string;
  websiteUrl: string;
  languageCode: string;
  brief: { dos: string[]; donts: string[]; notes: string[] };
  onboardingText: string | null;
  kwClusters: KwCluster[];
  focusKeywords: string;
  pages: {
    url: string;
    currentTitle: string | null;
    currentMeta: string | null;
    h1: string | null;
  }[];
}): string {
  const briefBlock = formatBrief(opts.brief);
  const onboardingBlock = opts.onboardingText
    ? `## Onboarding form excerpt\n\`\`\`\n${opts.onboardingText.slice(0, 2000)}${opts.onboardingText.length > 2000 ? "\n…[truncated]" : ""}\n\`\`\``
    : "";
  const clusterBlock = formatClusters(opts.kwClusters);
  const focusBlock = opts.focusKeywords
    ? `\n## Extra focus keywords from the consultant\n${opts.focusKeywords}\n\n_These take priority over the KW cluster map when they conflict._`
    : "";
  const pagesBlock = opts.pages
    .map(
      (p, i) =>
        `### Page ${i + 1}\n- **URL:** ${p.url}\n- **Current title:** ${p.currentTitle ? `"${p.currentTitle}" (${p.currentTitle.length} chars)` : "_(missing)_"}\n- **Current meta:** ${p.currentMeta ? `"${p.currentMeta}" (${p.currentMeta.length} chars)` : "_(missing)_"}\n- **H1:** ${p.h1 ? `"${p.h1}"` : "_(none)_"}`,
    )
    .join("\n\n");
  return [
    `# Rewrite meta tags for **${opts.clientName}**`,
    `Website: ${opts.websiteUrl}.`,
    briefBlock,
    onboardingBlock,
    clusterBlock,
    focusBlock,
    `\n## Pages crawled (${opts.pages.length})`,
    `Below is every page we found. Return ONE row per page with the URL copied verbatim. Skip URLs ONLY if they're things like /privacy or /404 with no commercial intent — in those cases still return a row but mark \`primaryKeyword: null\` and write a basic non-keyword-stuffed meta.`,
    "",
    pagesBlock,
    `\n## Rules`,
    `- Return EXACTLY ${opts.pages.length} rows — one per crawled URL.`,
    `- The \`url\` field MUST match one of the URLs above verbatim. Do NOT invent URLs.`,
    `- Title: 50–60 chars target, **never below 40, never above 65**. If a natural title is shorter than 40, lengthen with geo / specialty / brand per the system rules — never submit a short title hoping the schema lets it through.`,
    `- Meta: 120–160 chars target, **never below 120, never above 170**. Fill with concrete value props, not filler.`,
    `- Pick the primary keyword from the cluster map by URL + H1 fit. Set null ONLY for /privacy, /terms, /cookies, /404 — every other URL gets a primary keyword.`,
    `- For \`reasoning\`: ONE sentence — what was broken about the current tag, what's fixed.`,
    `- For \`issues\`: only flag issues that actually exist on the CURRENT tag. Don't pad.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatBrief(brief: {
  dos: string[];
  donts: string[];
  notes: string[];
}): string {
  const parts: string[] = [];
  if (brief.dos.length > 0)
    parts.push(`### Do's\n${brief.dos.map((d) => `- ${d}`).join("\n")}`);
  if (brief.donts.length > 0)
    parts.push(
      `### Don'ts (HARD RULES — never violate)\n${brief.donts.map((d) => `- ${d}`).join("\n")}`,
    );
  if (brief.notes.length > 0)
    parts.push(`### Notes\n${brief.notes.map((n) => `- ${n}`).join("\n")}`);
  if (parts.length === 0) return "";
  return `## Client brief\n${parts.join("\n\n")}`;
}

type ChunkPage = {
  url: string;
  currentTitle: string | null;
  currentMeta: string | null;
  h1: string | null;
};

/** Generate a single chunk of pages. Three-layer resilience:
 *    1. generateObject + lenient schema (default).
 *    2. On schema/validation failure: retry once with the same call.
 *    3. On second failure: salvage via generateText + manual JSON parse +
 *       Zod re-validation per row (skip bad rows, keep good ones).
 *
 *  This guarantees that as long as Claude returns SOMETHING parseable,
 *  consultants get rows — they don't lose the entire chunk to one bad
 *  field. Length issues are surfaced as `issues[]` entries by the
 *  caller via annotateRowLengths.
 *
 *  v74.26.1: every retry failure now streams a one-line diagnostic to
 *  the consultant via `onDiagnostic` (NDJSON progress event) so the next
 *  failed run tells us exactly which layer is choking — Anthropic
 *  overload, schema validation, salvage JSON parse, etc. Console logs
 *  are kept for the Vercel side. */
type DiagnosticEmitter = (line: string) => void;

async function generateChunkWithRetry(opts: {
  chunkIdx: number;
  chunk: ChunkPage[];
  clientName: string;
  websiteUrl: string;
  languageCode: string;
  brief: { dos: string[]; donts: string[]; notes: string[] };
  onboardingText: string | null;
  kwClusters: KwCluster[];
  focusKeywords: string;
  system: string;
  onDiagnostic?: DiagnosticEmitter;
}): Promise<Row[]> {
  const prompt = buildPrompt({
    clientName: opts.clientName,
    websiteUrl: opts.websiteUrl,
    languageCode: opts.languageCode,
    brief: opts.brief,
    onboardingText: opts.onboardingText,
    kwClusters: opts.kwClusters,
    focusKeywords: opts.focusKeywords,
    pages: opts.chunk,
  });
  // Layer 1+2: generateObject with one retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await generateObject({
        model: anthropic(CAPTION_MODEL),
        schema: BatchSchema,
        system: opts.system,
        prompt,
        maxOutputTokens: 4000,
      });
      return r.object.rows;
    } catch (err) {
      const diag = formatDiagnostic(err);
      logChunkError(opts.chunkIdx, attempt + 1, err, diag);
      opts.onDiagnostic?.(
        `chunk ${opts.chunkIdx} · generateObject attempt ${attempt + 1} → ${diag}`,
      );
      if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
    }
  }
  // Layer 3: salvage via generateText + manual JSON parse. Free-form
  // gives Claude max flexibility; we hand-validate per row so one bad
  // row doesn't kill the lot.
  try {
    const salvagePrompt =
      prompt +
      `\n\n## OUTPUT FORMAT (CRITICAL)\nReply with ONE valid JSON object and nothing else — no prose, no markdown fences. Shape:\n\`\`\`\n{ "rows": [ { "url": "...", "optimizedTitle": "...", "optimizedMeta": "...", "primaryKeyword": "..." or null, "secondaryKeywords": ["..."], "reasoning": "...", "issues": ["..."] } ] }\n\`\`\``;
    const r = await generateText({
      model: anthropic(CAPTION_MODEL),
      system: opts.system,
      prompt: salvagePrompt,
      maxOutputTokens: 4000,
    });
    const parsed = extractJsonObject(r.text);
    if (!parsed || typeof parsed !== "object") {
      const head = r.text.replace(/\s+/g, " ").slice(0, 200);
      opts.onDiagnostic?.(
        `chunk ${opts.chunkIdx} · generateText salvage → no valid JSON in ${r.text.length}-char response. Head: "${head}…"`,
      );
      return [];
    }
    const rawRows = (parsed as { rows?: unknown }).rows;
    if (!Array.isArray(rawRows)) {
      opts.onDiagnostic?.(
        `chunk ${opts.chunkIdx} · generateText salvage → JSON had no \`rows\` array. Got keys: [${Object.keys(parsed as object).join(", ")}]`,
      );
      return [];
    }
    const out: Row[] = [];
    const dropReasons: string[] = [];
    for (const raw of rawRows) {
      const v = RowSchema.safeParse(raw);
      if (v.success) {
        out.push(v.data);
      } else {
        const detail = v.error.issues
          .slice(0, 2)
          .map((i) => `${i.path.join(".")}=${i.message}`)
          .join("; ");
        dropReasons.push(detail);
        console.warn(
          `[meta-generate] chunk ${opts.chunkIdx} salvage: dropped one row — ${detail}`,
        );
      }
    }
    if (out.length > 0) {
      const dropped = rawRows.length - out.length;
      const droppedNote =
        dropped > 0
          ? ` (${dropped} row${dropped === 1 ? "" : "s"} dropped: ${dropReasons.slice(0, 2).join(" / ")})`
          : "";
      opts.onDiagnostic?.(
        `chunk ${opts.chunkIdx} · generateText salvage → recovered ${out.length}/${rawRows.length} rows${droppedNote}`,
      );
      console.info(
        `[meta-generate] chunk ${opts.chunkIdx} salvaged ${out.length}/${rawRows.length} rows via generateText fallback`,
      );
    } else {
      opts.onDiagnostic?.(
        `chunk ${opts.chunkIdx} · generateText salvage → ${rawRows.length} rows in JSON, ALL failed Zod (top reasons: ${dropReasons.slice(0, 3).join(" / ")})`,
      );
    }
    return out;
  } catch (err) {
    const diag = formatDiagnostic(err);
    logChunkError(opts.chunkIdx, 3, err, diag);
    opts.onDiagnostic?.(
      `chunk ${opts.chunkIdx} · generateText salvage → ${diag}`,
    );
    return [];
  }
}

/** Format any error from the AI SDK (or below) into a one-line diagnostic
 *  with the useful fields surfaced: name, HTTP status, response body
 *  excerpt, Zod issues. Designed for the streaming progress log so a
 *  consultant looking at the failed run can tell whether it was an
 *  Anthropic overload (HTTP 529), a rate limit (429), a schema mismatch
 *  (NoObjectGeneratedError + ZodIssue list), or something else. */
function formatDiagnostic(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as {
    name?: string;
    message?: string;
    statusCode?: number;
    responseBody?: string;
    url?: string;
    cause?: unknown;
    text?: string;
    response?: unknown;
  };
  const name = e.name ?? "Error";
  const parts: string[] = [name];

  if (typeof e.statusCode === "number") {
    parts.push(`HTTP ${e.statusCode}`);
  }
  // Anthropic provider errors carry the JSON body verbatim. The first
  // 240 chars contain the error type ("overloaded_error", "rate_limit_error",
  // "invalid_request_error", etc) and the human message.
  if (typeof e.responseBody === "string" && e.responseBody.length > 0) {
    parts.push(`body: ${e.responseBody.slice(0, 240).replace(/\s+/g, " ")}`);
  }
  if (typeof e.message === "string" && e.message.length > 0) {
    parts.push(`message: ${e.message.slice(0, 240).replace(/\s+/g, " ")}`);
  }
  // AI SDK NoObjectGeneratedError → cause is the schema-validation error
  // with a `.issues` array of Zod issues. Pull the first 2 so we see
  // which field tripped (e.g. `rows.0.optimizedTitle=String must contain
  // at least 5 character(s)`).
  if (e.cause && typeof e.cause === "object") {
    const cause = e.cause as {
      message?: string;
      issues?: { path?: (string | number)[]; message?: string }[];
    };
    if (Array.isArray(cause.issues) && cause.issues.length > 0) {
      const top = cause.issues
        .slice(0, 2)
        .map(
          (i) =>
            `${(i.path ?? []).join(".") || "(root)"}: ${i.message ?? "?"}`,
        )
        .join("; ");
      parts.push(`zod: ${top}`);
    } else if (typeof cause.message === "string" && cause.message.length > 0) {
      parts.push(`cause: ${cause.message.slice(0, 240).replace(/\s+/g, " ")}`);
    }
  }
  // For NoObjectGeneratedError, the `.text` field is the raw model output
  // that failed to parse. Useful when Claude returned prose instead of JSON
  // or wrapped the JSON in markdown.
  if (typeof e.text === "string" && e.text.length > 0) {
    const head = e.text.slice(0, 160).replace(/\s+/g, " ");
    parts.push(`raw head: "${head}${e.text.length > 160 ? "…" : ""}"`);
  }
  return parts.join(" | ");
}

function logChunkError(
  chunkIdx: number,
  attempt: number,
  err: unknown,
  diag?: string,
) {
  const e = err as { name?: string; message?: string; cause?: unknown };
  const name = e?.name ?? "Error";
  const message =
    typeof e?.message === "string" ? e.message.slice(0, 400) : String(err);
  console.warn(
    `[meta-generate] chunk ${chunkIdx} attempt ${attempt} failed: ${name}: ${message}${diag ? ` (diag: ${diag.slice(0, 400)})` : ""}`,
  );
  if (e?.cause) {
    const cause = e.cause as { message?: string };
    if (cause?.message) {
      console.warn(
        `[meta-generate] chunk ${chunkIdx} cause: ${cause.message.slice(0, 400)}`,
      );
    }
  }
}

/** Extract the first balanced top-level JSON object from arbitrary text.
 *  Handles markdown fence wrappers and leading/trailing prose. */
function extractJsonObject(text: string): unknown {
  // Strip ```json fences if Claude wrapped them.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  // Find first { and the matching closing }
  const start = body.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const slice = body.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Fallback URL discovery for sites with thin or missing sitemaps:
 *  fetch the homepage HTML, parse every `<a href>` that points at the
 *  same origin, dedupe, and return up to `max` unique paths. Common
 *  case for clinic Webflow / WordPress sites where the sitemap only
 *  lists top-level pages but the homepage links to every doctor /
 *  service / location page. */
async function discoverInternalLinksFromHomepage(
  homepageUrl: string,
  max: number,
): Promise<string[]> {
  if (max <= 0) return [];
  const origin = new URL(homepageUrl).origin;
  let html: string;
  try {
    const res = await fetch(homepageUrl, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WonderAdsWorkspace/1.0; +https://wonder-ads.com)",
      },
    });
    if (!res.ok) return [];
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return [];
    html = await res.text();
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  // Regex over <a href="..."> — cheaper than full cheerio parse here.
  const re = /<a\s+[^>]*?href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) {
      continue;
    }
    let abs: URL;
    try {
      abs = new URL(raw, homepageUrl);
    } catch {
      continue;
    }
    if (abs.origin !== origin) continue;
    // Strip fragments + most query strings (keep ?lang= etc.? for now drop all)
    abs.hash = "";
    // Skip non-page assets
    const ext = abs.pathname.split(".").pop()?.toLowerCase() ?? "";
    if (
      [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
        "svg",
        "pdf",
        "zip",
        "mp4",
        "css",
        "js",
        "xml",
        "ico",
        "woff",
        "woff2",
        "ttf",
      ].includes(ext)
    ) {
      continue;
    }
    const url = abs.toString();
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= max * 2) break; // collect a bit extra; caller slices
  }
  return out.slice(0, max);
}

function formatClusters(clusters: KwCluster[]): string {
  if (clusters.length === 0) return "";
  const blocks = clusters.map((c) => {
    const top = c.rows.slice(0, 15);
    const lines = top.map(
      (r) =>
        `- ${r.keyword}${r.volume ? ` (${r.volume}/mo)` : ""}${r.intent ? ` [${r.intent}]` : ""}${r.suggestedPage ? ` → ${r.suggestedPage}` : ""}`,
    );
    return `### ${c.name}\n${lines.join("\n")}`;
  });
  return `## Keyword Research clusters (the ONLY source of truth for primary keywords)\n${blocks.join("\n\n")}`;
}

/** Synthesize a KwCluster[] from the live Target Keywords list so the
 *  meta-generate prompt builder can consume them without any branching.
 *  Keywords are grouped by intent (commercial / transactional /
 *  informational / navigational / unclassified) so Claude still sees a
 *  cluster shape with topical buckets — which is what the prompt asks it
 *  to pick a primary keyword from. */
function clustersFromTargetKeywords(items: TargetKeyword[]): KwCluster[] {
  type Bucket =
    | "commercial"
    | "transactional"
    | "informational"
    | "navigational"
    | "unclassified";
  const order: Bucket[] = [
    "commercial",
    "transactional",
    "informational",
    "navigational",
    "unclassified",
  ];
  const buckets = new Map<Bucket, TargetKeyword[]>();
  for (const k of items) {
    const bucket: Bucket = k.intent ?? "unclassified";
    const arr = buckets.get(bucket) ?? [];
    arr.push(k);
    buckets.set(bucket, arr);
  }
  const clusters: KwCluster[] = [];
  for (const bucket of order) {
    const arr = buckets.get(bucket);
    if (!arr || arr.length === 0) continue;
    // Sort by volume desc within the bucket so Claude sees the strongest
    // keywords first in the truncated 15-row preview.
    arr.sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1));
    const label =
      bucket === "unclassified"
        ? "Other target keywords"
        : `${bucket.charAt(0).toUpperCase()}${bucket.slice(1)} intent`;
    const rowIntent: string | null = bucket === "unclassified" ? null : bucket;
    clusters.push({
      name: label,
      thesis: `Live keywords from the Target Keywords table (${arr.length}).`,
      meta: {
        intent: bucket === "unclassified" ? undefined : bucket,
        combinedVolume: undefined,
      },
      rows: arr.map((k) => ({
        keyword: k.keyword,
        volumeText: k.searchVolume != null ? String(k.searchVolume) : "—",
        volume: k.searchVolume ?? null,
        difficultyText: k.difficulty != null ? String(k.difficulty) : "—",
        difficulty: k.difficulty ?? null,
        intent: rowIntent,
        priority: null,
        priorityRaw: "",
        suggestedPage: "",
        why: "",
      })),
    });
  }
  return clusters;
}
