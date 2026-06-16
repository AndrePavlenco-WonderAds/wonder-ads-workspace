// Follow-up refinement of an existing action result — a SURGICAL edit.
//
// The problem this solves: when a generated deliverable is 95% right and
// only one part needs a tweak (a paragraph, a CTA link, a meta
// description), the consultant shouldn't have to regenerate the whole
// thing (and risk losing the good parts) or hand-edit Markdown. This
// endpoint takes the EXISTING saved output + a plain-language instruction
// and streams back the full document with ONLY the requested change
// applied — everything else preserved verbatim.
//
// Streams plain text like /run; the client persists the result via /save
// with `refine: true` once the stream ends (decoupled from the function
// budget, same as every other action).

import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { findAction } from "@/lib/seo-pillars";
import { getHistoryEntry } from "@/lib/action-history";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL_ID = "claude-sonnet-4-6";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;

  const entry = findAction(actionSlug);
  if (!entry) {
    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }

  let body: { resultId?: string; instruction?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const resultId = body.resultId;
  const instruction = (body.instruction ?? "").trim();
  if (!resultId) {
    return NextResponse.json({ error: "resultId required" }, { status: 400 });
  }
  if (!instruction) {
    return NextResponse.json(
      { error: "instruction required" },
      { status: 400 },
    );
  }
  if (instruction.length > 4000) {
    return NextResponse.json(
      { error: "instruction too long (max 4000 chars)" },
      { status: 400 },
    );
  }

  const existing = await getHistoryEntry(clientSlug, actionSlug, resultId);
  if (!existing || !existing.output?.trim()) {
    return NextResponse.json(
      { error: "No saved result to refine yet." },
      { status: 404 },
    );
  }

  const label = entry.action.label;

  const system = `You are a senior SEO editor making a SURGICAL, targeted edit to an existing deliverable ("${label}").

Follow these rules EXACTLY:
- Apply ONLY the change the user asks for — nothing more.
- Return the COMPLETE document with every other part kept byte-for-byte identical: same headings, same wording, same order, same Markdown formatting, same links, same lists. Do NOT rewrite, rephrase, re-order, "improve", tighten, or re-format anything the user did not explicitly ask you to change.
- If the instruction is ambiguous about scope, change as little as possible to satisfy it.
- Keep the document in its original language (do not translate).
- Output ONLY the document itself — no preamble, no trailing notes, no "here is the updated version", and do not wrap the whole document in a code fence.`;

  const userMsg = `Here is the current "${label}" deliverable, between the markers:

<<<DOCUMENT
${existing.output}
DOCUMENT>>>

Apply this change and return the FULL updated document (everything else unchanged):

${instruction}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      const result = streamText({
        model: anthropic(MODEL_ID),
        system,
        prompt: userMsg,
        onError: ({ error }) => {
          console.error("refine stream failed:", error);
          try {
            send(
              `\n\n> ❌ Refine stream errored: ${
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
        console.error("refine consume failed:", err);
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
