// Public submit endpoint for the SEO satisfaction survey (NPS quiz).
// No auth — the client reaches it from the public /[slug]/survey page.
// The slug is the share secret, mirroring /api/reviews.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addNpsSubmission } from "@/lib/nps-store";
import {
  NPS_SCALE_NAMES,
  NPS_SINGLE_NAMES,
  NPS_MULTI_NAMES,
  NPS_OPEN_NAMES,
  getMultiQuestion,
  getSingleQuestion,
  getQuestion,
  isOpen,
} from "@/lib/nps-questions";
import { getConsultantForSlug } from "@/lib/client-overrides";

export const runtime = "nodejs";

const TEXT_MAX = 4000;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // --- 0–10 scale answers (all required) ---
  const rawAnswers = (body.answers ?? {}) as Record<string, unknown>;
  const answers: Record<string, number> = {};
  for (const name of NPS_SCALE_NAMES) {
    const v = Number(rawAnswers[name]);
    if (!Number.isFinite(v)) {
      return NextResponse.json(
        { error: `Missing or invalid answer: ${name}` },
        { status: 400 },
      );
    }
    if (v < 0 || v > 10) {
      return NextResponse.json(
        { error: `Answer out of range: ${name}` },
        { status: 400 },
      );
    }
    answers[name] = Math.round(v);
  }

  // --- choices: multi-select + single-choice (both stored as arrays) ---
  const rawChoices = (body.choices ?? {}) as Record<string, unknown>;
  const choices: Record<string, string[]> = {};

  // Single-choice — required by default, exactly one valid option.
  for (const name of NPS_SINGLE_NAMES) {
    const def = getSingleQuestion(name);
    if (!def) continue;
    const picked = rawChoices[name];
    const first = Array.isArray(picked) ? picked[0] : picked;
    const value = typeof first === "string" ? first : "";
    const allowed = new Set(def.options.map((o) => o.value));
    if (!allowed.has(value)) {
      if (def.required ?? true) {
        return NextResponse.json(
          { error: `Missing or invalid choice: ${name}` },
          { status: 400 },
        );
      }
      continue;
    }
    choices[name] = [value];
  }

  // Multi-select — optional. Keep only valid values, respect max.
  for (const name of NPS_MULTI_NAMES) {
    const picked = rawChoices[name];
    if (!Array.isArray(picked)) continue;
    const def = getMultiQuestion(name);
    if (!def) continue;
    const allowed = new Set(def.options.map((o) => o.value));
    const clean = picked
      .filter((v): v is string => typeof v === "string" && allowed.has(v))
      .slice(0, def.max ?? def.options.length);
    if (clean.length) choices[name] = clean;
  }

  // --- open text answers ---
  const rawTexts = (body.texts ?? {}) as Record<string, unknown>;
  const texts: Record<string, string> = {};
  for (const name of NPS_OPEN_NAMES) {
    const q = getQuestion(name);
    const raw = rawTexts[name];
    const value = typeof raw === "string" ? raw.trim().slice(0, TEXT_MAX) : "";
    if (!value) {
      if (q && isOpen(q) && q.required) {
        return NextResponse.json(
          { error: `Missing required answer: ${name}` },
          { status: 400 },
        );
      }
      continue;
    }
    texts[name] = value;
  }

  const identification =
    typeof body.identification === "string"
      ? body.identification.trim() || null
      : null;

  const consultant = getConsultantForSlug(slug);
  const submission = await addNpsSubmission(
    slug,
    {
      answers,
      choices,
      texts,
      identification,
      consultant: consultant === "Unassigned" ? null : consultant,
    },
    Date.now(),
  );

  // Refresh the internal management page + client page badge.
  revalidatePath(`/seo/${slug}/nps`);
  revalidatePath(`/seo/${slug}`);

  return NextResponse.json({
    ok: true,
    overall: submission.scores.overall,
    nps: submission.scores.nps,
  });
}
