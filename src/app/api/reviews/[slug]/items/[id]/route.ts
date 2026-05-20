// Per-item edit + delete endpoint. Both the public review page and
// the internal review page hit this for inline edits (status pill
// flip, date change, doc link paste, etc.). No auth — same trust
// model as the read endpoint.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  deleteReviewItem,
  listReviewItems,
  sanitiseReviewItemPatch,
  updateReviewItem,
} from "@/lib/review-store";

export const runtime = "nodejs";

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
  // Auto-fill approvalDate when the status flips TO "Approved" and
  // the current item doesn't already have a manual approval date set.
  // The client never sees an approval-date input — flipping the
  // status pill is the only interaction they have, and the date
  // appears automatically. Internal staff can still override it.
  if (patch.status === "Approved" && !("approvalDate" in patch)) {
    const existing = (await listReviewItems(slug)).find((r) => r.id === id);
    if (existing && !existing.approvalDate) {
      patch.approvalDate = new Date().toISOString().slice(0, 10);
    }
  }
  const updated = await updateReviewItem(slug, id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  revalidatePath(`/${slug}/pendingreview`);
  revalidatePath(`/seo/${slug}/review`);
  revalidatePath(`/seo/${slug}`);
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  const ok = await deleteReviewItem(slug, id);
  if (!ok) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  revalidatePath(`/${slug}/pendingreview`);
  revalidatePath(`/seo/${slug}/review`);
  revalidatePath(`/seo/${slug}`);
  return NextResponse.json({ ok: true });
}
