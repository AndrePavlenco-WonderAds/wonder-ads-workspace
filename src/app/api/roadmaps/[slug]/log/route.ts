// GET the roadmap changelog (newest-first, decoded) for a client. Used by
// the RoadmapChangelog panel to refresh after the board auto-saves.

import { NextResponse } from "next/server";
import { getRoadmapLog } from "@/lib/roadmap-changelog-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const entries = await getRoadmapLog(slug);
  return NextResponse.json({ entries });
}
