// Per-item edit + delete endpoint. Both the public review page and
// the internal review page hit this for inline edits (status pill
// flip, date change, doc link paste, etc.). No auth — same trust
// model as the read endpoint.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  deleteReviewItem,
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
