// Phase 2 of the split Keyword Research flow: load the KwResearchPack
// saved by /prep-kw-research, fetch the onboarding PDF natively for
// Claude, and stream SEO Claude's analysis. The client calls /save after
// the stream ends, which then attaches the pack to the HistoryEntry.

import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { findAction } from "@/lib/seo-pillars";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientWebsite } from "@/lib/client-meta";
import { getClientBySlug } from "@/lib/notion";
import { buildSeoClaudeSystemPrompt } from "@/lib/seo-claude-prompt";
import { loadKwResearchPrep } from "@/lib/kw-research-prep-store";
import { getOnboardingForSlug } from "@/lib/onboarding-store";
import { formatKwPackForPrompt } from "@/lib/seo-tools/keyword-research";

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
  if (!entry || entry.action.slug !== "keyword-research") {
    return NextResponse.json(
      { error: "Phase split is only available for keyword-research." },
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

  const pack = await loadKwResearchPrep(clientSlug, actionSlug, resultId);
  if (!pack) {
    return NextResponse.json(
      {
        error:
          "No prep data found for this resultId. Phase 1 may have been killed by Vercel's 60s timeout before it could save — run a fresh generation.",
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

  // Fetch onboarding for native PDF attachment + extracted text snippet.
  const useOnboardingFlag =
    (inputs.useOnboarding ?? "true").toLowerCase() !== "false";
  const onboarding = useOnboardingFlag
    ? await getOnboardingForSlug(clientSlug)
    : null;
  let onboardingPdfBuffer: Uint8Array | null = null;
  let onboardingPdfName: string | null = null;
  if (
    onboarding &&
    (onboarding.contentType === "application/pdf" ||
      onboarding.url.toLowerCase().endsWith(".pdf"))
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

  const parts: string[] = [formatKwPackForPrompt(pack)];
  if (onboarding) {
    const extractedSnippet = onboarding.extractedText
      ? `\n\n### Extracted text from the onboarding form (for citation)\n\`\`\`\n${onboarding.extractedText.slice(0, 8000)}${onboarding.extractedText.length > 8000 ? "\n…[truncated — see attached PDF for full content]" : ""}\n\`\`\``
      : "";
    const compNote =
      onboarding.competitors && onboarding.competitors.length > 0
        ? `\n- **Competitors named in the form:** ${onboarding.competitors.join(", ")}`
        : "";
    parts.push(
      `## Onboarding form (uploaded by the consultant)\n- **File:** ${onboarding.name} (${onboarding.contentType})${compNote}\n\nThe client filled this out during onboarding. You MUST cite this form for: top services, objectives, target audience, competitors, brand voice.${extractedSnippet}${onboardingPdfBuffer ? "\n\n> The full PDF is also attached to this message — read it as your primary source." : ""}`,
    );
  }
  const factPack = parts.join("\n\n");

  const userPrompt = [
    `# Live tool measurements (use these as primary evidence)\n${factPack}`,
    `# Inputs from the consultant\n${formatInputs(inputs)}`,
    `Run the action now. Cite real numbers, honour the brief Do's/Don'ts/Notes, and end with the mandatory Pre-flight checklist section in Portuguese.`,
  ].join("\n\n");

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));

      // Separator marks the tool→analysis boundary for the client's parser.
      send("\n---\n\n");

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
          console.error("KR /run-kw-research stream failed:", error);
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

      try {
        for await (const chunk of result.textStream) {
          send(chunk);
        }
      } catch (err) {
        console.error("KR stream consume failed:", err);
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
