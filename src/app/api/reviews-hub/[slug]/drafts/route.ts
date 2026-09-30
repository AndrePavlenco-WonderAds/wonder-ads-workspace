// PUT /api/reviews-hub/<slug>/drafts — guarda o rascunho de uma resposta
// (a página grava sozinha enquanto se escreve). DELETE ?reviewId= descarta.
// Os rascunhos são partilhados: o cliente e a equipa veem o mesmo.

import { NextResponse } from "next/server";
import { MAX_REPLY_CHARS } from "@/lib/reviews-hub/ai";
import { hubGate, readJson } from "@/lib/reviews-hub/route-helpers";
import { refreshSummary, updateDrafts } from "@/lib/reviews-hub/store";
import type { HubDraft } from "@/lib/reviews-hub/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const gate = await hubGate(slug, { write: true });
  if (gate instanceof NextResponse) return gate;
  const body = await readJson<{ reviewId?: string; loc?: string; text?: string }>(req);
  if (!body?.reviewId || !body.loc || typeof body.text !== "string") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const text = body.text.slice(0, MAX_REPLY_CHARS);
  const now = Date.now();
  let wasAwaiting = false;
  const drafts = await updateDrafts(slug, (d) => {
    const prev = d[body.reviewId!];
    wasAwaiting = prev?.status === "awaiting_approval";
    const next: HubDraft = {
      reviewId: body.reviewId!,
      loc: body.loc!,
      text,
      // Mexer num rascunho da automação mantém-no «à espera de aprovação»:
      // editar não é aprovar — aprovar é publicar.
      status: prev?.status === "awaiting_approval" ? "awaiting_approval" : "draft",
      source: prev?.source ?? "manual",
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    return { ...d, [body.reviewId!]: next };
  });
  if (wasAwaiting) await refreshSummary(slug, { drafts });
  return NextResponse.json({ ok: true, draft: drafts[body.reviewId] });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const gate = await hubGate(slug, { write: true });
  if (gate instanceof NextResponse) return gate;
  const reviewId = new URL(req.url).searchParams.get("reviewId");
  if (!reviewId) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const drafts = await updateDrafts(slug, (d) => {
    const next = { ...d };
    delete next[reviewId];
    return next;
  });
  await refreshSummary(slug, { drafts });
  return NextResponse.json({ ok: true });
}
