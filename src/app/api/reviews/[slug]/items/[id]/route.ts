// Per-item edit + delete endpoint. Both the public review page and
// the internal review page hit this for inline edits (status pill
// flip, date change, doc link paste, etc.). PATCH has no auth — same
// trust model as the read endpoint: sem sessão é o cliente.
//
// v77.79 — com sessão, o pedido é de alguém da equipa e passa a contar:
//   • quem põe a linha em «For Approval» fica carimbado (review-store);
//   • um web designer (acesso "contributor") só mexe nas linhas que ele
//     próprio adicionou, e não arquiva;
//   • «Ver como» não escreve, tal como no resto da app;
//   • APAGAR deixou de ser público — o cliente nunca teve o botão, e agora a
//     rota também não aceita o pedido sem sessão.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  deleteReviewItem,
  isArchivable,
  isReviewItemAddedBy,
  listReviewItems,
  sanitiseReviewItemPatch,
  toPublicReviewItem,
  updateReviewItem,
} from "@/lib/review-store";
import {
  IMPERSONATION_WRITE_ERROR,
  getReviewRequester,
} from "@/lib/review-requester";

export const runtime = "nodejs";

const NOT_YOUR_ROW_ERROR =
  "Só podes alterar as linhas que tu adicionaste — as restantes são da equipa de SEO.";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch = sanitiseReviewItemPatch(raw);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No editable fields in patch" },
      { status: 400 },
    );
  }
  const requester = await getReviewRequester();
  if (requester.impersonating) {
    return NextResponse.json({ error: IMPERSONATION_WRITE_ERROR }, { status: 403 });
  }
  const existing = (await listReviewItems(slug)).find((r) => r.id === id);
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (requester.access === "contributor") {
    if (!isReviewItemAddedBy(existing, requester.actor?.username)) {
      return NextResponse.json({ error: NOT_YOUR_ROW_ERROR }, { status: 403 });
    }
    if ("archived" in patch) {
      return NextResponse.json(
        { error: "Arquivar linhas é com a equipa de SEO." },
        { status: 403 },
      );
    }
  }
  // Auto-fill approvalDate when the status flips TO "Approved" and
  // the current item doesn't already have a manual approval date set.
  // The client never sees an approval-date input — flipping the
  // status pill is the only interaction they have, and the date
  // appears automatically. Internal staff can still override it.
  if (patch.status === "Approved" && !("approvalDate" in patch)) {
    if (!existing.approvalDate) {
      patch.approvalDate = new Date().toISOString().slice(0, 10);
    }
  }
  // Server-side guard for the Archive flow. Only `Approved` or
  // `Rejected` rows may be archived. The client-side button enforces
  // this for UX, but a hand-rolled PATCH could bypass it — so we
  // verify against the row's current OR patched status. Returns 422
  // so the UI can surface the message; the body carries the reason.
  if (patch.archived === true) {
    const effectiveStatus = patch.status ?? existing.status;
    if (!isArchivable(effectiveStatus)) {
      return NextResponse.json(
        {
          error:
            "Can't archive — row must be Approved or Rejected first.",
        },
        { status: 422 },
      );
    }
  }
  const updated = await updateReviewItem(slug, id, patch, requester.actor);
  if (!updated) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  revalidatePath(`/${slug}/pendingreview`);
  revalidatePath(`/seo/${slug}/review`);
  revalidatePath(`/seo/${slug}`);
  return NextResponse.json({
    item: requester.access ? updated : toPublicReviewItem(updated),
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  const requester = await getReviewRequester();
  if (!requester.access) {
    return NextResponse.json(
      { error: "Só a equipa pode apagar linhas desta tabela." },
      { status: requester.actor ? 403 : 401 },
    );
  }
  if (requester.impersonating) {
    return NextResponse.json({ error: IMPERSONATION_WRITE_ERROR }, { status: 403 });
  }
  if (requester.access === "contributor") {
    const existing = (await listReviewItems(slug)).find((r) => r.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (!isReviewItemAddedBy(existing, requester.actor?.username)) {
      return NextResponse.json({ error: NOT_YOUR_ROW_ERROR }, { status: 403 });
    }
  }
  const ok = await deleteReviewItem(slug, id);
  if (!ok) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  revalidatePath(`/${slug}/pendingreview`);
  revalidatePath(`/seo/${slug}/review`);
  revalidatePath(`/seo/${slug}`);
  return NextResponse.json({ ok: true });
}
