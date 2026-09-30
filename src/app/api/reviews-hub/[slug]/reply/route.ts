// POST /api/reviews-hub/<slug>/reply — publica a resposta no Google.
// Corpo: { reviewId, loc, text }. Substitui a resposta que lá estiver (é
// assim que a API da Google funciona: uma resposta por review).

import { NextResponse } from "next/server";
import { cleanReply } from "@/lib/reviews-hub/ai";
import { GbpError, gbpToken, putReply } from "@/lib/reviews-hub/google";
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
export const maxDuration = 60;

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
  // O limite da Google é em bytes (4096), não em caracteres — os acentos
  // contam a dobrar.
  if (new TextEncoder().encode(text).length > 4096) {
    return NextResponse.json({ error: "A resposta é demasiado longa para a Google." }, { status: 400 });
  }

  const loc = (await getLocations(slug)).find((l) => l.id === body.loc);
  if (!loc) return NextResponse.json({ error: "Salão não encontrado." }, { status: 404 });

  try {
    const token = await gbpToken();
    const published = await putReply(token, loc, body.reviewId, text);
    const review = await applyReplyToStoredReview(slug, loc.id, body.reviewId, {
      text: published.text,
      updated: published.updated,
      via: "hub",
      by: gate.actor,
    });
    const drafts = await updateDrafts(slug, (d) => {
      const next = { ...d };
      delete next[body.reviewId!];
      return next;
    });
    await logActivity(slug, {
      at: Date.now(),
      kind: "reply",
      text: `Resposta publicada a ${review?.author ?? "uma review"} (${review?.stars ?? "?"}★ · ${loc.short})`,
      by: gate.actor,
      reviewId: body.reviewId,
      loc: loc.id,
    });
    await refreshSummary(slug, { drafts });
    return NextResponse.json({ ok: true, review });
  } catch (err) {
    const message =
      err instanceof GbpError ? err.message : "Não foi possível publicar no Google.";
    console.error("[reviews-hub] publish failed:", err);
    return NextResponse.json(
      { error: message, kind: err instanceof GbpError ? err.kind : "other" },
      { status: 502 },
    );
  }
}
