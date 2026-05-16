import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { findAction, type ActionToolName } from "@/lib/seo-pillars";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientWebsite } from "@/lib/client-meta";
import { getClientBySlug } from "@/lib/notion";
import { buildSeoClaudeSystemPrompt } from "@/lib/seo-claude-prompt";
import { appendHistory } from "@/lib/action-history";
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
    if (typeof body.resultId === "string" && body.resultId.length > 0) {
      resultId = body.resultId;
    }
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));

      let factPack = "";

      // ---------- Tool phase ----------
      if (tools.length > 0) {
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
            "sitemap-discovery" | "crawl-sample" | "gsc-site-data"
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

      const result = streamText({
        model: anthropic(MODEL_ID),
        system,
        prompt: userPrompt,
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

      let modelText = "";
      try {
        for await (const chunk of result.textStream) {
          modelText += chunk;
          send(chunk);
        }
      } catch (err) {
        console.error("stream consume failed:", err);
      }

      // ---------- Persist ----------
      if (modelText.trim()) {
        try {
          await appendHistory({
            id: resultId,
            clientSlug,
            actionSlug,
            inputs,
            output: modelText,
            model: MODEL_ID,
          });
        } catch (err) {
          console.error("history append failed:", err);
        }
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
    "sitemap-discovery" | "crawl-sample" | "gsc-site-data"
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
