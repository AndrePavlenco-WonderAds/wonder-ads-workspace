// Fetch a saved GMB Posts result by id. Used by GmbPostsRunner on the
// client to load the freshly-saved batch the instant the streaming
// generator emits its `result` event — server-side fetch would require
// a full page reload otherwise.

import { NextResponse } from "next/server";
import { getGmbResult } from "@/lib/gmb-posts-store";

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
  const result = await getGmbResult(clientSlug, id);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ result });
}
