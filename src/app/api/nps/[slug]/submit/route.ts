// Public submit endpoint for the SEO satisfaction survey (NPS quiz).
// No auth — the client reaches it from the public /[slug]/survey page.
// The slug is the share secret, mirroring /api/reviews.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addNpsSubmission } from "@/lib/nps-store";
import {
  NPS_QUESTION_NAMES,
  NPS_MULTI_NAMES,
  getMultiQuestion,
} from "@/lib/nps-questions";
import { getConsultantForSlug } from "@/lib/client-overrides";

export const runtime = "nodejs";

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

  const rawAnswers = (body.answers ?? {}) as Record<string, unknown>;
  const answers: Record<string, number> = {};
  for (const name of NPS_QUESTION_NAMES) {
    const v = Number(rawAnswers[name]);
    if (!Number.isFinite(v)) {
      return NextResponse.json(
        { error: `Missing or invalid answer: ${name}` },
        { status: 400 },
      );
    }
    // Every question — including the final "recommend" one — is a 1–5 mark.
    if (v < 1 || v > 5) {
      return NextResponse.json(
        { error: `Answer out of range: ${name}` },
        { status: 400 },
      );
    }
    answers[name] = v;
  }

  // Multi-select answers — optional. Keep only valid option values for each
  // known multi question; drop anything unrecognised.
  const rawChoices = (body.choices ?? {}) as Record<string, unknown>;
  const choices: Record<string, string[]> = {};
  for (const name of NPS_MULTI_NAMES) {
    const picked = rawChoices[name];
    if (!Array.isArray(picked)) continue;
    const def = getMultiQuestion(name);
    if (!def) continue;
    const allowed = new Set(def.options.map((o) => o.value));
    const clean = picked
      .filter((v): v is string => typeof v === "string" && allowed.has(v))
      .slice(0, def.options.length);
    if (clean.length) choices[name] = clean;
  }

  const comment =
    typeof body.comment === "string" ? body.comment.trim() || null : null;
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
      comment,
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
