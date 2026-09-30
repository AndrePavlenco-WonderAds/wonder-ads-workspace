// POST /api/reviews-hub/<slug>/mark-replied — «Já publiquei no Google».
// No modo só de leitura a resposta é copiada daqui e colada no Google à mão;
// isto marca a review como respondida já, sem esperar pela próxima sync. A
// sync confirma depois com a resposta real do Google (e, se passadas 48 h a
// Google continuar sem resposta, a review volta a «Por responder»).

import { NextResponse } from "next/server";
import { cleanReply } from "@/lib/reviews-hub/ai";
import { hubGate, readJson } from "@/lib/reviews-hub/route-helpers";
import {
  applyReplyToStoredReview,
  getLocations,
  logActivity,
  refreshSummary,
  updateDrafts,
} from "@/lib/reviews-hub/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const gate = await hubGate(slug, { write: true });
  if (gate instanceof NextResponse) return gate;
  const body = await readJson<{ reviewId?: string; loc?: string; text?: string }>(req);
  const text = cleanReply(typeof body?.text === "string" ? body.text : "");
  if (!body?.reviewId || !body.loc || !text) {
    return NextResponse.json({ error: "Falta a resposta." }, { status: 400 });
  }
  const loc = (await getLocations(slug)).find((l) => l.id === body.loc);
  if (!loc) return NextResponse.json({ error: "Salão não encontrado." }, { status: 404 });

  const review = await applyReplyToStoredReview(slug, loc.id, body.reviewId, {
    text,
    updated: new Date().toISOString(),
    via: "manual",
    by: gate.actor,
  });
  if (!review) return NextResponse.json({ error: "Review não encontrada." }, { status: 404 });
  const drafts = await updateDrafts(slug, (d) => {
    const next = { ...d };
    delete next[body.reviewId!];
    return next;
  });
  await logActivity(slug, {
    at: Date.now(),
    kind: "reply",
    text: `Resposta publicada no Google a ${review.author} (${review.stars}★ · ${loc.short})`,
    by: gate.actor,
    reviewId: body.reviewId,
    loc: loc.id,
  });
  await refreshSummary(slug, { drafts });
  return NextResponse.json({ ok: true, review });
}
