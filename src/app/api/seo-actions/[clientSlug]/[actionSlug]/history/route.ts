import { NextResponse } from "next/server";
import { deleteHistoryEntry, listHistory } from "@/lib/action-history";
import { findAction } from "@/lib/seo-pillars";
import { deleteGmbResult, listGmbResults } from "@/lib/gmb-posts-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug, actionSlug } = await ctx.params;
  if (!findAction(actionSlug)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }
  // GMB Posts stores results in its own KV bucket (separate types,
  // image URLs, status), so it needs its own list. We shape the response
  // to match the HistoryEntry contract the action-runner history grid
  // already expects, so the rendering code doesn't need to branch.
  if (actionSlug === "gmb-posts") {
    const results = await listGmbResults(clientSlug);
    const entries = results.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      clientSlug,
      actionSlug,
      inputs: {},
      output: `${r.postCount} GMB post${r.postCount === 1 ? "" : "s"} generated.`,
      model: "claude-haiku-4-5 + gemini-2.5-flash-image",
    }));
    return NextResponse.json({ entries });
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
  if (actionSlug === "gmb-posts") {
    await deleteGmbResult(clientSlug, id);
  } else {
    await deleteHistoryEntry(clientSlug, actionSlug, id);
  }
  return NextResponse.json({ ok: true });
}
