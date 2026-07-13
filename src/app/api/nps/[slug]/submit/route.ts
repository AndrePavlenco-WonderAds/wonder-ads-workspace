// Public submit endpoint for the SEO satisfaction survey (NPS quiz).
// No auth — the client reaches it from the public /[slug]/survey page.
// The slug is the share secret, mirroring /api/reviews.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addNpsSubmission } from "@/lib/nps-store";
import { NPS_QUESTION_NAMES } from "@/lib/nps-questions";
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
    const max = name === "nps" ? 10 : 5;
    const min = name === "nps" ? 0 : 1;
    if (v < min || v > max) {
      return NextResponse.json(
        { error: `Answer out of range: ${name}` },
        { status: 400 },
      );
    }
    answers[name] = v;
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
