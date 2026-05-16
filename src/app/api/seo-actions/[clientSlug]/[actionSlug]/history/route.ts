import { NextResponse } from "next/server";
import { deleteHistoryEntry, listHistory } from "@/lib/action-history";
import { findAction } from "@/lib/seo-pillars";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;
  if (!findAction(actionSlug)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }
  const entries = await listHistory(clientSlug, actionSlug);
  return NextResponse.json({ entries });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await deleteHistoryEntry(clientSlug, actionSlug, id);
  return NextResponse.json({ ok: true });
}
