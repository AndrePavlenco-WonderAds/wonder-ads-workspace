import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { findAction, type ActionToolName } from "@/lib/seo-pillars";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientWebsite } from "@/lib/client-meta";
import { getClientBySlug } from "@/lib/notion";
import { buildSeoClaudeSystemPrompt } from "@/lib/seo-claude-prompt";
import {
  runPageSpeed,
  formatPsiForPrompt,
  type PsiResult,
  type PsiStrategy,
} from "@/lib/seo-tools/pagespeed";
import {
  crawlPage,
  formatCrawlForPrompt,
  type CrawlResult,
} from "@/lib/seo-tools/crawler";
import {
  runSiteAudit,
  type SiteAuditDepth,
} from "@/lib/seo-tools/site-audit";
import {
  runKeywordResearch,
  formatKwPackForPrompt,
} from "@/lib/seo-tools/keyword-research";
import { getClientWebsite as getClientWebsiteForKw } from "@/lib/client-meta";
import { getOnboardingForSlug } from "@/lib/onboarding-store";
import { saveKwResearchPrep } from "@/lib/kw-research-prep-store";
import { findLocationTarget } from "@/lib/location-targets";

// Vercel Hobby caps at 60s.
export const maxDuration = 60;
export const runtime = "nodejs";

const MODEL_ID = "claude-sonnet-4-6";

function formatInputs(inputs: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, raw] of Object.entries(inputs)) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    lines.push(`**${key}:**\n${value}`);
  }
  return lines.length === 0 ? "_(no inputs provided)_" : lines.join("\n\n");
}

function normaliseUrl(input: string | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env.local for local dev or to the Vercel project env for production.",
      },
      { status: 503 },
    );
  }

  const entry = findAction(actionSlug);
  if (!entry) {
    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }

  let inputs: Record<string, string> = {};
  let resultId: string | undefined;
  try {
    const body = (await req.json()) as {
      inputs?: Record<string, string>;
      resultId?: string;
    };
    if (body.inputs && typeof body.inputs === "object") {
      inputs = body.inputs;
    }
    if (typeof body.resultId === "string") resultId = body.resultId;
    // resultId is needed so the keyword-research pack saved here can be
    // picked up by /save into the HistoryEntry.
  } catch {
    /* empty body is fine */
  }

  let clientName = clientSlug;
  try {
    const c = await getClientBySlug(clientSlug);
    if (c?.title) clientName = c.title;
  } catch {
    /* fall back to slug */
  }

  const brief = await getBriefForSlug(clientSlug);

  const system = buildSeoClaudeSystemPrompt({
    client: {
      slug: clientSlug,
      name: clientName,
      website: getClientWebsite(clientSlug),
      brief,
    },
    action: entry.action,
    pillar: entry.pillar,
  });

  const tools = entry.action.tools ?? [];
  const toolUrlField = entry.action.toolUrlField ?? "pageUrl";
  const targetUrl = tools.length > 0 ? normaliseUrl(inputs[toolUrlField]) : null;

  const encoder = new TextEncoder();

  // Captured during the tool phase, consumed during the Claude call. The PDF
  // (when present) is attached natively to the user message so Claude reads
  // the form's actual layout/tables, not just our regex-extracted text.
  let onboardingPdfBuffer: Uint8Array | null = null;
  let onboardingPdfName: string | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));

      let factPack = "";

      // ---------- Tool phase ----------
      if (entry.action.slug === "keyword-research") {
        // Orchestrated flow for Keyword Research: pull DataforSEO Labs data
        // + read the onboarding form (if uploaded and the consultant opted
        // to use it). Then hand off to Claude.
        const useOnboardingFlag =
          (inputs.useOnboarding ?? "true").toLowerCase() !== "false";
        let seedTopic = (inputs.seedTopic ?? "").trim();
        // Load onboarding first — its content (top services, etc.) can
        // back-fill an empty seedTopic when the consultant opted to use it.
        const onboarding = useOnboardingFlag
          ? await getOnboardingForSlug(clientSlug)
          : null;
        if (!seedTopic && onboarding) {
          // Derive a sensible default seed when the consultant left the box
          // blank: client name + " services" anchors DataforSEO on the
          // brand's actual market footprint. Claude still reads the full
          // onboarding PDF natively for nuanced focus.
          seedTopic = `${clientName} services`;
          send(
            `> ℹ️ No seed topic provided — defaulting to \`${seedTopic}\` and letting the onboarding form drive focus.\n`,
          );
        }
        if (!seedTopic) {
          send(
            `> ⚠️ No **seedTopic** provided AND no onboarding form available — Claude can't anchor this research. Add a seed topic OR upload the onboarding form on the client page.\n\n`,
          );
        } else {
          const website = getClientWebsiteForKw(clientSlug);
          const target = website
            ? new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname.replace(/^www\./, "")
            : undefined;
          const locationOverride =
            findLocationTarget(inputs.geo) ?? null;
          if (locationOverride) {
            send(
              `> 🌍 Geo: **${locationOverride.label}** (${locationOverride.languageCode}, code ${locationOverride.locationCode})${locationOverride.localModifier ? ` — Claude will localise keywords with **${locationOverride.localModifier}**` : ""}\n`,
            );
          }
          send(`> 🔧 Pulling keyword data from DataforSEO (seed: \`${seedTopic}\`)\n`);
          if (onboarding) {
            const compNote =
              onboarding.competitors && onboarding.competitors.length > 0
                ? ` Found ${onboarding.competitors.length} competitor(s) named in the form — pulling their keyword footprints too.`
                : "";
            send(
              `> ✓ **Onboarding form** detected (${onboarding.name})${compNote}\n`,
            );
            // Fetch the PDF once so we can attach it to the Claude call later
            // (Anthropic native PDF support — Claude reads layout/tables).
            if (
              onboarding.contentType === "application/pdf" ||
              onboarding.url.toLowerCase().endsWith(".pdf")
            ) {
              try {
                const pdfRes = await fetch(onboarding.url, { cache: "no-store" });
                if (pdfRes.ok) {
                  onboardingPdfBuffer = new Uint8Array(await pdfRes.arrayBuffer());
                  onboardingPdfName = onboarding.name;
                }
              } catch (err) {
                console.error("PDF fetch for Claude attach failed:", err);
              }
            }
          } else if (useOnboardingFlag) {
            send(
              `> ⚠️ **No onboarding form on file** — relying on seed topic + brief only. Upload one on the client page so future runs cite what the client actually wants.\n`,
            );
          } else {
            send(
              `> ℹ️ Onboarding form excluded by request (\`useOnboarding=false\`) — running on pure DataforSEO + seed topic.\n`,
            );
          }
          const startedAt = Date.now();
          try {
            const pack = await runKeywordResearch(seedTopic, clientSlug, {
              intent: (inputs.intent?.toLowerCase().replace(/\s+/g, "") ?? "all") as
                | "all"
                | "informational"
                | "commercial"
                | "transactional"
                | "navigational",
              target,
              perEndpointLimit: 300,
              competitorDomains: onboarding?.competitors ?? [],
              locationOverride: locationOverride ?? undefined,
            });
            const ms = Date.now() - startedAt;
            if (!pack) {
              send(
                `> ❌ DataforSEO not configured — set DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD in Vercel env.\n`,
              );
            } else {
              send(
                `> ✓ **DataforSEO** — ${pack.suggestions.length} suggestions, ${pack.ideas.length} broader ideas${pack.domainExisting.length ? `, ${pack.domainExisting.length} already-ranking` : ""}${pack.competitors.length ? `, ${pack.competitors.length} competitor footprint(s)` : ""} (${ms} ms)\n`,
              );
              for (const e of pack.errors) {
                send(`> ⚠️ Partial: ${e.source} — ${e.message.slice(0, 200)}\n`);
              }
              // Persist the structured pack so /save can attach it to the
              // HistoryEntry — KeywordResearchDashboard reads from there.
              if (resultId) {
                try {
                  await saveKwResearchPrep(clientSlug, actionSlug, resultId, pack);
                } catch (err) {
                  console.error("kw-research prep save (non-fatal):", err);
                }
              }
              const parts: string[] = [formatKwPackForPrompt(pack)];
              if (locationOverride && locationOverride.scope !== "country") {
                parts.push(
                  `## Geo localisation rule (HARD CONSTRAINT)\nThis run is targeting **${locationOverride.label}** specifically. The local-language modifier for this market is **"${locationOverride.localModifier}"** (e.g. "${exampleLocalised(locationOverride)}").\n\n**MANDATORY:** every keyword you recommend that benefits from local intent MUST include either the local modifier OR a naturally-localised equivalent in the market language. Examples:\n- For Lisbon (PT): "dentista lisboa", "clínica dentária em lisboa", "all-on-4 lisboa"\n- For NYC (EN): "dentist NYC", "best dental clinic Manhattan", "Invisalign New York"\n- For São Paulo (PT-BR): "dentista são paulo", "clínica odontológica sp"\n\nDo NOT pad every keyword blindly — informational queries ("o que é all-on-4") often work without a city modifier. Use judgement: would a real searcher in **${locationOverride.label}** type the modifier? If yes, include it.`,
                );
              }
              if (onboarding) {
                const extractedSnippet = onboarding.extractedText
                  ? `\n\n### Extracted text from the onboarding form (for citation)\n\`\`\`\n${onboarding.extractedText.slice(0, 8000)}${onboarding.extractedText.length > 8000 ? "\n…[truncated — see attached PDF for full content]" : ""}\n\`\`\``
                  : "";
                const compNote =
                  onboarding.competitors && onboarding.competitors.length > 0
                    ? `\n- **Competitors named in the form:** ${onboarding.competitors.join(", ")}`
                    : "";
                parts.push(
                  `## Onboarding form (uploaded by the consultant)\n- **File:** ${onboarding.name} (${onboarding.contentType})${compNote}\n\nThe client filled this out during onboarding. It names the specific keywords/themes/services they want to be found for, plus competitors to watch. **You MUST cite this form** when you reference: top services, business objectives, target audience, competitors, brand voice. Quote short excerpts where useful. **Weight client-named keywords/competitors heavily.** If the keyword data contradicts the form, surface the gap explicitly.${extractedSnippet}${onboardingPdfBuffer ? "\n\n> The full PDF is also attached to this message — read it as your primary source." : ""}`,
                );
              }
              factPack = parts.join("\n\n");
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            send(`> ❌ Keyword research crashed: ${message.slice(0, 240)}\n`);
          }
          send("\n---\n\n");
        }
      } else if (tools.length > 0) {
        if (!targetUrl) {
          send(
            `> ⚠️ No URL provided in **${toolUrlField}** — running without live tools.\n\n`,
          );
        } else if (entry.action.slug === "seo-audit") {
          // Site-wide audit: orchestrated tool flow with progress events.
          send(`> 🔧 Running site-wide audit against \`${new URL(targetUrl).origin}\`\n`);
          const depth = parseDepth(inputs.depth);
          try {
            const pack = await runSiteAudit(
              targetUrl,
              clientSlug,
              (e) => {
                if (e.type === "start") {
                  send(`> ⏳ **${e.label}**…\n`);
                } else if (e.type === "done") {
                  send(`> ✓ **${e.label}** — ${e.summary} (${e.ms} ms)\n`);
                } else if (e.type === "error") {
                  send(
                    `> ❌ **${e.label}** failed: ${e.message.slice(0, 240)} (${e.ms} ms)\n`,
                  );
                } else {
                  send(`> ${e.message}\n`);
                }
              },
              { depth },
            );
            factPack = pack.markdown;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            send(`> ❌ Site audit orchestrator crashed: ${message.slice(0, 240)}\n`);
          }
          send("\n---\n\n");
        } else {
          // Generic per-tool parallel dispatch.
          send(`> 🔧 Running live tools against \`${targetUrl}\`\n`);
          const dispatchable = tools.filter((t) => t in TOOL_META) as Exclude<
            ActionToolName,
            "sitemap-discovery" | "crawl-sample" | "gsc-site-data" | "dataforseo-domain"
          >[];
          const toolResults = await Promise.allSettled(
            dispatchable.map((t) => runGenericTool(t, targetUrl)),
          );
          const pieces: string[] = [];
          dispatchable.forEach((toolName, i) => {
            const res = toolResults[i];
            const label = TOOL_META[toolName]?.label ?? toolName;
            if (res.status === "fulfilled") {
              send(
                `> ✓ **${label}** — ${res.value.summary} (${res.value.ms} ms)\n`,
              );
              pieces.push(res.value.markdown);
            } else {
              const message =
                res.reason instanceof Error
                  ? res.reason.message
                  : String(res.reason);
              send(`> ❌ **${label}** failed: ${message.slice(0, 240)}\n`);
            }
          });
          factPack = pieces.join("\n\n");
          send("\n---\n\n");
        }
      }

      // ---------- Generation phase ----------
      const userPrompt = [
        factPack
          ? `# Live tool measurements (use these as primary evidence)\n${factPack}`
          : "",
        `# Inputs from the consultant\n${formatInputs(inputs)}`,
        `Run the action now. When live measurements are present, cite the exact numbers, name the failing audits by their title, and prioritise findings by real impact rather than abstract best practice.`,
      ]
        .filter(Boolean)
        .join("\n\n");

      // If we have the onboarding PDF buffered, attach it natively so Claude
      // reads the form's actual layout/tables (Anthropic's document content
      // type). Falls back to text-only prompt when no PDF is attached.
      const userContent: (
        | { type: "text"; text: string }
        | {
            type: "file";
            data: Uint8Array;
            mediaType: string;
            filename?: string;
          }
      )[] = [{ type: "text", text: userPrompt }];
      if (onboardingPdfBuffer) {
        userContent.push({
          type: "file",
          data: onboardingPdfBuffer,
          mediaType: "application/pdf",
          filename: onboardingPdfName ?? "onboarding-form.pdf",
        });
      }

      const result = streamText({
        model: anthropic(MODEL_ID),
        system,
        messages: [{ role: "user", content: userContent }],
        onError: ({ error }) => {
          console.error("SEO action stream failed:", error);
          try {
            send(
              `\n\n> ❌ SEO Claude stream errored: ${
                error instanceof Error ? error.message : String(error)
              }\n`,
            );
          } catch {
            /* controller may already be closed */
          }
        },
      });

      // Stream Claude — the client calls /save with the accumulated output
      // once the stream ends. Keeping the KV write out of this function
      // means a long Claude run can't kill persistence by hitting Vercel's
      // 60s budget mid-stream.
      try {
        for await (const chunk of result.textStream) {
          send(chunk);
        }
      } catch (err) {
        console.error("stream consume failed:", err);
      }

      controller.close();
    },
    cancel() {
      // request was aborted by the client; nothing else to clean up
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

/** Build a short illustrative localised keyword for the prompt so Claude
 *  has a concrete pattern to mirror. We use a generic "dentist" stem
 *  because the agency's roster is heavily Health & Wellness (clinics),
 *  but the example translates the LANGUAGE rather than the noun, so the
 *  pattern works for any vertical. */
function exampleLocalised(loc: {
  languageCode: string;
  localModifier: string;
}): string {
  const lang = loc.languageCode;
  if (lang === "pt") return `dentista ${loc.localModifier.toLowerCase()}`;
  if (lang === "es") return `dentista ${loc.localModifier.toLowerCase()}`;
  if (lang === "fr") return `dentiste ${loc.localModifier.toLowerCase()}`;
  if (lang === "it") return `dentista ${loc.localModifier.toLowerCase()}`;
  if (lang === "de") return `zahnarzt ${loc.localModifier.toLowerCase()}`;
  return `dentist ${loc.localModifier}`;
}

function parseDepth(raw: string | undefined): SiteAuditDepth {
  switch ((raw ?? "").toLowerCase()) {
    case "quick":
      return "Quick";
    case "deep":
      return "Deep";
    case "all":
      return "All";
    case "standard":
    default:
      return "Standard";
  }
}

// ---------- Generic tool dispatch (used by non-orchestrated actions) ----------

type ToolRun = { markdown: string; summary: string; ms: number };

const TOOL_META: Partial<Record<ActionToolName, { label: string }>> = {
  "crawl-page": { label: "Fetch page HTML" },
  "pagespeed-mobile": { label: "PageSpeed Insights — mobile" },
  "pagespeed-desktop": { label: "PageSpeed Insights — desktop" },
};

async function runGenericTool(
  name: Exclude<
    ActionToolName,
    "sitemap-discovery" | "crawl-sample" | "gsc-site-data" | "dataforseo-domain"
  >,
  url: string,
): Promise<ToolRun> {
  const started = Date.now();
  switch (name) {
    case "crawl-page": {
      const r: CrawlResult = await crawlPage(url);
      return {
        markdown: formatCrawlForPrompt(r),
        summary: `HTTP ${r.status}, ${(r.bytes / 1024).toFixed(0)} KB, ${r.h1.length} H1, ${r.imageCount} images, ${r.jsonLdTypes.length} schema types`,
        ms: Date.now() - started,
      };
    }
    case "pagespeed-mobile":
    case "pagespeed-desktop": {
      const strategy: PsiStrategy = name === "pagespeed-mobile" ? "mobile" : "desktop";
      const r: PsiResult = await runPageSpeed(url, strategy);
      const scores = `Perf ${r.scores.performance ?? "—"} · SEO ${r.scores.seo ?? "—"} · A11y ${r.scores.accessibility ?? "—"} · BP ${r.scores.bestPractices ?? "—"}`;
      return {
        markdown: formatPsiForPrompt(r),
        summary: scores,
        ms: Date.now() - started,
      };
    }
  }
}
