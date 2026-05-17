// Continuation endpoint for Keyword Research — fires when the first
// /run-kw-research stream finishes WITHOUT the mandatory "Verificação
// final" section (i.e. Claude was cut off by Vercel's 60s ceiling).
// We feed Claude the partial output and ask it to continue from exactly
// where it stopped, ending with the checklist.
//
// Same fact pack + system prompt as /run-kw-research, just a different
// user message that includes the partial.

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
      { error: "Continuation is only available for keyword-research." },
      { status: 400 },
    );
  }

  let resultId: string | undefined;
  let partial = "";
  let inputs: Record<string, string> = {};
  try {
    const body = (await req.json()) as {
      resultId?: string;
      partial?: string;
      inputs?: Record<string, string>;
    };
    if (typeof body.resultId === "string") resultId = body.resultId;
    if (typeof body.partial === "string") partial = body.partial;
    if (body.inputs && typeof body.inputs === "object") inputs = body.inputs;
  } catch {
    /* empty body — invalid */
  }
  if (!resultId) {
    return NextResponse.json({ error: "resultId required" }, { status: 400 });
  }
  if (!partial.trim()) {
    return NextResponse.json(
      { error: "partial (the truncated output so far) required" },
      { status: 400 },
    );
  }

  const pack = await loadKwResearchPrep(clientSlug, actionSlug, resultId);
  if (!pack) {
    return NextResponse.json(
      {
        error:
          "No prep data found for this resultId — the Phase 1 prep slot may have expired (1h TTL). Run a fresh generation.",
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

  // Re-fetch the onboarding PDF so Claude can still cite from it during
  // the continuation.
  const useOnboardingFlag =
    (inputs.useOnboarding ?? "true").toLowerCase() !== "false";
  const onboarding = useOnboardingFlag
    ? await getOnboardingForSlug(clientSlug)
    : null;
  let pdfBuffer: Uint8Array | null = null;
  if (
    onboarding &&
    (onboarding.contentType === "application/pdf" ||
      onboarding.url.toLowerCase().endsWith(".pdf"))
  ) {
    try {
      const pdfRes = await fetch(onboarding.url, { cache: "no-store" });
      if (pdfRes.ok) {
        pdfBuffer = new Uint8Array(await pdfRes.arrayBuffer());
      }
    } catch (err) {
      console.error("PDF fetch for continuation failed:", err);
    }
  }

  // Take the last 800 chars of the partial so Claude can lock onto where
  // it was. Full partial is too long and burns the budget.
  const partialTail = partial.slice(-2000);
  const factPack = formatKwPackForPrompt(pack);

  const userPrompt = `You were generating a Keyword Research report for **${clientName}** and were cut off by a 60-second function timeout. Below is the partial report you produced.

**Your task:** Continue from exactly where you stopped. Do NOT repeat anything already written. Do NOT introduce "continuing from where I left off". Just resume mid-sentence if that's where you stopped.

You MUST finish ALL remaining sections, including the mandatory **Verificação final** checklist in Portuguese at the very end.

# Original fact pack (for context)

${factPack}

# Partial report so far (last 2000 chars — continue from after this)

\`\`\`
${partialTail}
\`\`\`

Continue now.`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));

      const userContent: (
        | { type: "text"; text: string }
        | {
            type: "file";
            data: Uint8Array;
            mediaType: string;
            filename?: string;
          }
      )[] = [{ type: "text", text: userPrompt }];
      if (pdfBuffer) {
        userContent.push({
          type: "file",
          data: pdfBuffer,
          mediaType: "application/pdf",
          filename: onboarding?.name ?? "onboarding-form.pdf",
        });
      }

      const result = streamText({
        model: anthropic(MODEL_ID),
        system,
        messages: [{ role: "user", content: userContent }],
        onError: ({ error }) => {
          console.error("KR continuation stream failed:", error);
          try {
            send(
              `\n\n> ❌ Continuation stream errored: ${
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
        console.error("KR continuation consume failed:", err);
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
