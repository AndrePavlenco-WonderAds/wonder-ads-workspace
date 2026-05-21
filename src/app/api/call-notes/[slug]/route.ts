// Call Notes analyzer.
//
// POST /api/call-notes/[slug]
//   body: { transcript: string, fathomUrl?: string }
//   returns: { suggestions: [{ bucket: "dos"|"donts"|"notes", text, reasoning, source? }] }
//
// The transcript can be a Fathom AI summary, a raw transcript, or a
// paste of personal call notes. Claude filters out chit-chat /
// scheduling / pleasantries and surfaces only items that actually
// belong in the Client Brief.
//
// Suggestions are EPHEMERAL — not stored. The UI shows them as cards;
// each Accept click triggers a PUT to /api/briefs/[slug] with the
// item appended to the right bucket.

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientBySlug } from "@/lib/notion";
import { getClientGeo } from "@/lib/client-geo";
import {
  composeAnalyzerInput,
  fathomConfigured,
  FathomApiError,
  isFathomShareUrl,
  resolveFathomCallByShareUrl,
} from "@/lib/fathom-api";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";

// Schema deliberately LENIENT — system prompt sets the real targets,
// but we let Claude's natural output land without nuking the whole
// response over a single short reasoning line.
const SuggestionSchema = z.object({
  bucket: z
    .enum(["dos", "donts", "notes"])
    .describe(
      "Where this item belongs. dos = positive behaviours / preferences. donts = explicit prohibitions. notes = neutral context (audience, business model, stakeholders, technical constraints).",
    ),
  text: z
    .string()
    .min(3)
    .max(400)
    .describe(
      "The item as it would read on the brief. TARGET: one concrete sentence ~80-150 chars. NEVER prefix with 'Do:' / 'Don't:' — implied by the bucket. Write in European Portuguese for PT clients, English otherwise.",
    ),
  reasoning: z
    .string()
    .max(400)
    .default("")
    .describe(
      "ONE short sentence saying WHY this matters. Helps the consultant decide accept/decline.",
    ),
  source: z
    .string()
    .max(400)
    .nullable()
    .default(null)
    .describe(
      "Optional verbatim quote from the call so the consultant can verify. null if paraphrased.",
    ),
});

type Suggestion = z.infer<typeof SuggestionSchema>;

const BatchSchema = z.object({
  suggestions: z.array(SuggestionSchema).max(30),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 },
    );
  }

  let body: { transcript?: string; fathomUrl?: string };
  try {
    body = (await req.json()) as { transcript?: string; fathomUrl?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  let transcript = (body.transcript ?? "").trim();
  const fathomUrl = (body.fathomUrl ?? "").trim();

  // Two ingestion modes:
  //   1. URL-only — fetch via Fathom REST API (requires FATHOM_API_KEY)
  //   2. Pasted text — fallback, no API key needed
  // If both are provided, paste wins (consultant can override the
  // auto-fetched transcript with their own edited notes).
  let sourceTitle: string | null = null;
  if (!transcript && fathomUrl) {
    if (!fathomConfigured) {
      return NextResponse.json(
        {
          error:
            "Link-only mode needs FATHOM_API_KEY in Vercel env. Generate one at https://fathom.video/customize#api-access-header, add it to the wonder-ads-workspace project, redeploy. Until then, paste the AI summary text in the box below.",
          code: "no_fathom_key",
        },
        { status: 503 },
      );
    }
    if (!isFathomShareUrl(fathomUrl)) {
      return NextResponse.json(
        {
          error:
            "That doesn't look like a Fathom share URL — expected https://fathom.video/share/...",
        },
        { status: 400 },
      );
    }
    try {
      const call = await resolveFathomCallByShareUrl(fathomUrl);
      transcript = composeAnalyzerInput(call);
      sourceTitle = call.title;
    } catch (err) {
      if (err instanceof FathomApiError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.status },
        );
      }
      throw err;
    }
  }

  if (transcript.length < 50) {
    return NextResponse.json(
      {
        error:
          "Paste the AI summary or transcript first (or a Fathom share URL with FATHOM_API_KEY configured) — needs at least 50 chars to be useful.",
      },
      { status: 400 },
    );
  }
  if (transcript.length > 60000) {
    return NextResponse.json(
      {
        error:
          "Transcript is over 60k chars — that's beyond what fits in one analysis pass. Paste the AI Summary instead (or chunk the transcript).",
      },
      { status: 400 },
    );
  }

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) {
    return NextResponse.json({ error: "Unknown client." }, { status: 404 });
  }
  const existing = await getBriefForSlug(slug);
  const geo = getClientGeo(slug);

  const language =
    geo.languageCode === "pt"
      ? "European Portuguese (pt-PT — never Brazilian)"
      : geo.languageCode === "es"
        ? "European Spanish"
        : geo.languageCode === "fr"
          ? "French (France)"
          : "English";

  const system = `You are a senior SEO consultant at Wonder Ads reviewing a client call transcript to extract items that belong in the Client Brief.

The Client Brief has THREE buckets:
- **dos** — things the client wants done / preferences / positive behaviours / strategies they like
- **donts** — things to NEVER do / past mistakes / explicit prohibitions / brand-voice violations
- **notes** — neutral context worth remembering (audience, business model, stakeholders, technical constraints, deadlines, market specifics)

# CRITICAL RULES

1. **Filter aggressively.** A 30-minute call has maybe 5-12 brief-worthy items. The rest is scheduling, small talk, status updates, project chitchat, and recap of things already known. Skip ALL of that.
2. **Each suggestion must be ACTIONABLE in future work.** "Will send logo on Tuesday" is NOT a brief item (it's a task). "Brand color is #FF8A8B" IS a brief item (constraint that applies forever).
3. **Don't duplicate existing brief items.** The current brief is shown below — skip anything already covered (semantically, not just lexically).
4. **Pick the right bucket.** If it's a preference → dos. If it's a prohibition → donts. If it's neutral context → notes. When in doubt → notes.
5. **One concrete sentence per item.** No bullets within an item. No "and also". If two ideas, return two suggestions.
6. **Language: write each item in ${language}.** ALL items in the same language unless the client explicitly mixes (rare).
7. **Cap at ~10 suggestions max.** Quality over quantity. If you have 15 candidates, pick the 10 most valuable and skip the rest.
8. **For donts, lead with the prohibited action.** ("Não usar imagens de stock com pessoas obviamente americanas." — not "Imagens de stock com pessoas obviamente americanas devem ser evitadas.")
9. **Health/Wellness YMYL safety:** if the client mentions a medical-claim sensitivity ("don't say cure / guarantee / sem dor"), capture it as a don't.
10. **Returns zero suggestions** if the transcript is purely scheduling / catch-up with no brief-worthy content. That's a valid output.`;

  const briefDigest = formatExistingBrief(existing);
  const prompt = `# Client: ${client.title}${fathomUrl ? `\n## Source: ${fathomUrl}` : ""}

## Current Client Brief
${briefDigest}

## Call transcript / AI summary
\`\`\`
${transcript}
\`\`\`

Return up to ~10 highest-value Do's / Don'ts / Notes additions. Skip anything already covered above. Skip anything that's a task (deadline-bound work) — those belong in a roadmap, not the brief.`;

  // Three-layer resilience (same pattern that fixed meta-tags v73.3):
  //   1. generateObject with lenient schema
  //   2. retry once
  //   3. generateText + manual JSON parse + per-suggestion Zod re-validation
  const suggestions = await analyzeWithFallback(system, prompt);
  if (suggestions === null) {
    return NextResponse.json(
      {
        error:
          "Call-notes analysis failed across all three retry layers. Check Vercel logs for the underlying Claude error.",
      },
      { status: 500 },
    );
  }
  return NextResponse.json({
    suggestions,
    clientLanguage: geo.languageCode,
    sourceTitle,
    fathomFetched: !body.transcript && Boolean(fathomUrl),
  });
}

async function analyzeWithFallback(
  system: string,
  prompt: string,
): Promise<Suggestion[] | null> {
  // Layer 1+2: generateObject with one retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await generateObject({
        model: anthropic(MODEL),
        schema: BatchSchema,
        system,
        prompt,
        maxOutputTokens: 6000,
      });
      return r.object.suggestions;
    } catch (err) {
      const e = err as { name?: string; message?: string };
      console.warn(
        `[call-notes] generateObject attempt ${attempt + 1} failed: ${e?.name ?? "Error"}: ${(e?.message ?? "").slice(0, 200)}`,
      );
      if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
    }
  }
  // Layer 3: salvage with generateText + manual JSON.
  try {
    const salvagePrompt =
      prompt +
      `\n\n## OUTPUT FORMAT (CRITICAL)\nReply with ONE valid JSON object and nothing else — no prose, no markdown fences. Shape:\n\`\`\`\n{ "suggestions": [ { "bucket": "dos"|"donts"|"notes", "text": "...", "reasoning": "...", "source": "..." or null } ] }\n\`\`\``;
    const r = await generateText({
      model: anthropic(MODEL),
      system,
      prompt: salvagePrompt,
      maxOutputTokens: 6000,
    });
    const parsed = extractJsonObject(r.text);
    if (!parsed || typeof parsed !== "object") return null;
    const rawList = (parsed as { suggestions?: unknown }).suggestions;
    if (!Array.isArray(rawList)) return null;
    const out: Suggestion[] = [];
    for (const raw of rawList) {
      const v = SuggestionSchema.safeParse(raw);
      if (v.success) {
        out.push(v.data);
      } else {
        console.warn(
          "[call-notes] salvage: dropped one suggestion",
          v.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}=${i.message}`),
        );
      }
    }
    if (out.length > 0) {
      console.info(
        `[call-notes] salvaged ${out.length}/${rawList.length} suggestions via generateText`,
      );
    }
    return out;
  } catch (err) {
    const e = err as { message?: string };
    console.error(
      `[call-notes] salvage failed: ${(e?.message ?? String(err)).slice(0, 300)}`,
    );
    return null;
  }
}

/** Extract the first balanced top-level JSON object from arbitrary text.
 *  Handles markdown fence wrappers and leading/trailing prose. */
function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
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
        try {
          return JSON.parse(body.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function formatExistingBrief(brief: {
  dos: string[];
  donts: string[];
  notes: string[];
}): string {
  const parts: string[] = [];
  if (brief.dos.length > 0)
    parts.push(`### Do's\n${brief.dos.map((d) => `- ${d}`).join("\n")}`);
  if (brief.donts.length > 0)
    parts.push(`### Don'ts\n${brief.donts.map((d) => `- ${d}`).join("\n")}`);
  if (brief.notes.length > 0)
    parts.push(`### Notes\n${brief.notes.map((n) => `- ${n}`).join("\n")}`);
  if (parts.length === 0) return "_(empty — anything reasonable is fair game)_";
  return parts.join("\n\n");
}
