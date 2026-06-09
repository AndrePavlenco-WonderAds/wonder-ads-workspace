// Per-comment edit + delete endpoint. Resolve/unresolve flips the
// `resolvedAt` timestamp; DELETE removes the comment entirely.
// Same unauth trust model as the parent routes.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  deleteReviewComment,
  updateReviewComment,
} from "@/lib/review-store";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string; id: string; commentId: string }> },
) {
  const { slug, id, commentId } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = (raw ?? {}) as Record<string, unknown>;
  // The only patchable fields right now are resolve toggle + body edit
  // (the latter is a stretch; the UI currently doesn't expose editing
  // an existing comment, but the route supports it for future use).
  const patch: {
    body?: string;
    resolvedAt?: number | null;
    resolvedBy?: "client" | "consultant" | null;
  } = {};
  if (typeof o.body === "string") {
    patch.body = o.body.trim().slice(0, 4000);
  }
  if (o.resolve === true) {
    patch.resolvedAt = Date.now();
    patch.resolvedBy = o.resolvedBy === "consultant" ? "consultant" : "client";
  } else if (o.resolve === false) {
    patch.resolvedAt = null;
    patch.resolvedBy = null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No editable fields in patch" },
      { status: 400 },
    );
  }
  const result = await updateReviewComment(slug, id, commentId, patch);
  if (!result) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  revalidatePath(`/${slug}/pendingreview`);
  revalidatePath(`/seo/${slug}/review`);
  return NextResponse.json({ comment: result.comment });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string; id: string; commentId: string }> },
) {
  const { slug, id, commentId } = await ctx.params;
  const updated = await deleteReviewComment(slug, id, commentId);
  if (!updated) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  revalidatePath(`/${slug}/pendingreview`);
  revalidatePath(`/seo/${slug}/review`);
  return NextResponse.json({ ok: true });
}
