// Comment thread endpoint for a single review row.
//
// GET   — list comments (the public table already inlines them in the
//         row payload, but the preview page reads them here so a
//         freshly-opened doc page has the latest thread without
//         waiting for the table's auto-poll).
// POST  — append a comment.
//
// Same unauth trust model as the rest of /api/reviews: the URL is the
// access control. The body is sanitised + length-clamped.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  appendReviewComment,
  listReviewItems,
  sanitiseNewCommentBody,
} from "@/lib/review-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  const items = await listReviewItems(slug);
  const item = items.find((r) => r.id === id);
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json({ comments: item.comments ?? [] });
}

export async function POST(
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
  const partial = sanitiseNewCommentBody(raw);
  if (!partial) {
    return NextResponse.json(
      { error: "Body is required" },
      { status: 400 },
    );
  }
  const created = await appendReviewComment(slug, id, partial);
  if (!created) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  // Bust both the public + internal page caches so the new comment
  // shows up on the next render. The preview pages don't have routes
  // listed individually (they're catch-alls per resultId), so the
  // pendingreview + internal review page revalidation is enough — the
  // CommentsThread component re-fetches on next focus regardless.
  revalidatePath(`/${slug}/pendingreview`);
  revalidatePath(`/seo/${slug}/review`);
  return NextResponse.json({ comment: created.comment });
}
