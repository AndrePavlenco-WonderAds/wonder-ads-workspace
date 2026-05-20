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
import { generateObject } from "ai";
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
export const maxDuration = 60;

const CAPTION_MODEL = "claude-haiku-4-5-20251001";

const RowSchema = z.object({
  url: z.string().describe("The page URL — copy verbatim from the input."),
  optimizedTitle: z
    .string()
    .min(10)
    .max(75)
    .describe(
      "Optimised <title> tag. Aim 50–60 chars (Google truncates ~60). Primary keyword early; brand only if it fits.",
    ),
  optimizedMeta: z
    .string()
    .min(70)
    .max(180)
    .describe(
      "Optimised <meta name='description'> tag. Aim 140–160 chars. Lead with the value prop, weave the primary keyword once naturally, end with a soft CTA verb.",
    ),
  primaryKeyword: z
    .string()
    .nullable()
    .describe(
      "Primary target keyword for this page. Pick from the KW Cluster map by best topical fit with URL + current title. null if the page has no commercial intent (e.g. /privacy).",
    ),
  secondaryKeywords: z
    .array(z.string())
    .min(0)
    .max(3)
    .describe("1–3 supporting keywords from related clusters."),
  reasoning: z
    .string()
    .min(15)
    .max(200)
    .describe(
      "ONE sentence on WHY this rewrite — what the current tag missed, what the new one captures.",
    ),
  issues: z
    .array(z.string())
    .min(0)
    .max(5)
    .describe(
      "Issues spotted on the current tags. Pick from: 'missing meta', 'title too long', 'title too short', 'meta too short', 'no primary keyword', 'duplicate title', 'brand-only title'. Skip if none apply.",
    ),
});

const BatchSchema = z.object({
  rows: z.array(RowSchema).min(1),
});

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

  let body: { inputs?: Record<string, string> } = {};
  try {
    body = (await req.json()) as { inputs?: Record<string, string> };
  } catch {
    /* empty body is fine */
  }
  const inputs = body.inputs ?? {};
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

        const [brief, onboarding, kwHistory] = await Promise.all([
          getBriefForSlug(clientSlug),
          getOnboardingForSlug(clientSlug),
          listHistory(clientSlug, "keyword-research"),
        ]);
        const geo = getClientGeo(clientSlug);

        // ---- KW research dependency (BLOCK if missing) ----
        const latestKw = kwHistory[0];
        if (!latestKw || !latestKw.kwClusters || latestKw.kwClusters.length === 0) {
          send({
            event: "error",
            message:
              "No Keyword Research result found for this client. Run Keyword Research first, then come back — meta-tag optimisation depends on the keyword clusters to assign primary keywords per URL.",
          });
          controller.close();
          return;
        }
        send({
          event: "progress",
          phase: "kw",
          message: `✓ Found Keyword Research from ${new Date(latestKw.createdAt).toISOString().slice(0, 10)} — ${latestKw.kwClusters.length} cluster(s), ${latestKw.kwClusters.reduce((s, c) => s + c.rows.length, 0)} keywords total.`,
        });

        // ---- Crawl phase ----
        send({
          event: "progress",
          phase: "crawl",
          message: `Discovering sitemap for ${new URL(websiteUrl).hostname}…`,
        });
        const sitemap = await discoverSitemap(websiteUrl);
        // Take the homepage + sampled URLs from the sitemap. Cap to the
        // chosen depth. Always include the homepage even if not in the
        // sitemap (some sites exclude it).
        const allUrls = [
          websiteUrl,
          ...sitemap.sampledUrls.filter((u) => u !== websiteUrl),
        ].slice(0, depth.maxPages);
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
        send({
          event: "progress",
          phase: "generate",
          message: `Drafting optimised meta tags with Claude (Haiku 4.5 + KW clusters)…`,
        });
        const claudePrompt = buildPrompt({
          clientName: client.title,
          websiteUrl,
          languageCode: geo.languageCode,
          brief,
          onboardingText: onboarding?.extractedText ?? null,
          kwClusters: latestKw.kwClusters,
          focusKeywords,
          pages: okCrawls.map((c) => ({
            url: c.result.finalUrl,
            currentTitle: c.result.title,
            currentMeta: c.result.metaDescription,
            h1: c.result.h1[0] ?? null,
          })),
        });
        const system = buildSystemPrompt(geo.languageCode);
        const claudeResult = await generateObject({
          model: anthropic(CAPTION_MODEL),
          schema: BatchSchema,
          system,
          prompt: claudePrompt,
          // Per-row ~150 tokens × 50 rows ≈ 7500. Cap a bit higher for safety.
          maxOutputTokens: 8000,
        });
        const drafts = claudeResult.object.rows;

        // ---- Stitch + save ----
        send({
          event: "progress",
          phase: "saving",
          message: "Saving optimised tags to your workspace…",
        });
        const now = Date.now();
        const resultId = newMetaTagsResultId();
        // Build a lookup from URL → crawl data so we can stitch
        // current + optimised side-by-side.
        const byUrl = new Map(
          okCrawls.map((c) => [c.result.finalUrl, c.result]),
        );
        const rows: MetaTagsRow[] = [];
        for (const d of drafts) {
          const crawl = byUrl.get(d.url);
          if (!crawl) continue; // skip rows for URLs Claude hallucinated
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
          kwResearchSourceId: latestKw.id,
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
  return `You are an in-house SEO copywriter for Wonder Ads (Health & Wellness growth agency). You're rewriting <title> and <meta description> tags for every page on one client's website.

Your output is what will go into the live HTML <head> of each page, so it has to nail:
- **Length:** Title 50–60 chars (Google truncates ~60). Meta description 140–160 chars.
- **Primary keyword early in the title** — first ~3 words ideally. Brand at the end only if there's room.
- **Meta = value prop + soft CTA verb.** Lead with the benefit, weave the keyword once naturally, end with "Marca consulta" / "Descubra mais" / etc. NEVER repeat the title verbatim.
- **YMYL safe** for health clinics: no medical claims, no outcome promises, no "garantido / sem dor / 100%".
- **Language:** Write in ${lang}.
- **One H1 / one focus per page.** Don't try to rank every page for everything — match the URL's actual content.
- **Brief Do's / Don'ts / Notes are HARD RULES.** A Don't overrides best practice every time.
- **Use the Keyword Cluster map** to assign each URL its best-fit primary keyword. Pick from the clusters; don't invent new keywords.
- **Real-business voice.** No "Welcome to" / "Best X in Y" / generic clinic boilerplate.

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
    `- Title 50–60 chars, meta 140–160 chars (write SLIGHTLY longer when the brand voice needs it; never exceed 65 / 165).`,
    `- Pick the primary keyword from the cluster map by URL + H1 fit. Set null only for /privacy, /terms, /404 etc.`,
    `- For \`reasoning\`: ONE sentence — what was broken, what's fixed.`,
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
