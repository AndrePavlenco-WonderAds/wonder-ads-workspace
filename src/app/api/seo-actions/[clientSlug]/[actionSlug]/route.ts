import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { findAction } from "@/lib/seo-pillars";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientWebsite } from "@/lib/client-meta";
import { getClientBySlug } from "@/lib/notion";
import { buildSeoClaudeSystemPrompt } from "@/lib/seo-claude-prompt";
import { appendHistory } from "@/lib/action-history";

export const maxDuration = 120;
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
  try {
    const body = (await req.json()) as { inputs?: Record<string, string> };
    if (body.inputs && typeof body.inputs === "object") {
      inputs = body.inputs;
    }
  } catch {
    /* no body is fine */
  }

  let clientName = clientSlug;
  try {
    const c = await getClientBySlug(clientSlug);
    if (c?.title) clientName = c.title;
  } catch {
    /* fall back to slug */
  }

  const [brief] = await Promise.all([getBriefForSlug(clientSlug)]);

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

  const userPrompt = `Run the action now.

# Inputs from the consultant
${formatInputs(inputs)}`;

  const result = streamText({
    model: anthropic(MODEL_ID),
    system,
    prompt: userPrompt,
    onError: ({ error }) => {
      console.error("SEO action stream failed:", error);
    },
    onFinish: async ({ text }) => {
      if (!text) return;
      await appendHistory({
        clientSlug,
        actionSlug,
        inputs,
        output: text,
        model: MODEL_ID,
      });
    },
  });

  return result.toTextStreamResponse();
}
