// Phase 2 of the split SEO Audit: load the fact pack saved by /prep,
// stream the SEO Claude analysis, persist the final HistoryEntry. Sends
// the `---` separator before the analysis so the result UI keeps using
// it to detect the tool→analysis boundary.

import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { findAction } from "@/lib/seo-pillars";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientWebsite } from "@/lib/client-meta";
import { getClientBySlug } from "@/lib/notion";
import { buildSeoClaudeSystemPrompt } from "@/lib/seo-claude-prompt";
import { appendHistory } from "@/lib/action-history";
import {
  loadAuditPrep,
  clearAuditPrep,
} from "@/lib/audit-prep-store";

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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set." },
      { status: 503 },
    );
  }

  const entry = findAction(actionSlug);
  if (!entry || entry.action.slug !== "seo-audit") {
    return NextResponse.json(
      { error: "Phase split is only available for seo-audit." },
      { status: 400 },
    );
  }

  let inputs: Record<string, string> = {};
  let resultId: string | undefined;
  try {
    const body = (await req.json()) as {
      inputs?: Record<string, string>;
      resultId?: string;
    };
    if (body.inputs && typeof body.inputs === "object") inputs = body.inputs;
    if (typeof body.resultId === "string") resultId = body.resultId;
  } catch {
    /* empty body is fine */
  }
  if (!resultId) {
    return NextResponse.json(
      { error: "resultId required for split run." },
      { status: 400 },
    );
  }

  const prep = await loadAuditPrep(clientSlug, actionSlug, resultId);
  if (!prep) {
    return NextResponse.json(
      {
        error:
          "No prep data found for this resultId. Phase 1 may have failed or expired. Run a fresh generation.",
      },
      { status: 404 },
    );
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

  const userPrompt = [
    `# Live tool measurements (use these as primary evidence)\n${prep.factPack}`,
    `# Inputs from the consultant\n${formatInputs(inputs)}`,
    `Run the action now. When live measurements are present, cite the exact numbers, name the failing audits by their title, and prioritise findings by real impact rather than abstract best practice.`,
  ].join("\n\n");

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));

      // Separator marks the tool→analysis boundary for the client's parser.
      send("\n---\n\n");

      const result = streamText({
        model: anthropic(MODEL_ID),
        system,
        prompt: userPrompt,
        onError: ({ error }) => {
          console.error("SEO audit /run stream failed:", error);
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

      if (modelText.trim()) {
        try {
          await appendHistory({
            id: resultId,
            clientSlug,
            actionSlug,
            inputs,
            output: modelText,
            model: MODEL_ID,
            ...(prep.metrics ? { metrics: prep.metrics } : {}),
          });
          // Prep done its job — free the KV slot.
          await clearAuditPrep(clientSlug, actionSlug, resultId);
        } catch (err) {
          console.error("history append failed:", err);
        }
      }

      controller.close();
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
