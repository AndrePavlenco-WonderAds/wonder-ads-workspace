// Fetch a saved Meta Tags result by id. Used by MetaTagsRunner
// client-side the instant the streaming generator emits its `result`
// event — avoids requiring a full page reload to see the new table.

import { NextResponse } from "next/server";
import { getMetaTagsResult } from "@/lib/meta-tags-store";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug } = await ctx.params;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const result = await getMetaTagsResult(clientSlug, id);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ result });
}
