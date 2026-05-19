// CRUD endpoints for a single client's current roadmap.
//
// - GET  → returns the current roadmap (or null) + computed warnings.
// - PUT  → replaces the current roadmap with the supplied state. Used by
//          the board UI when the consultant edits tasks. The payload is
//          run through `normaliseRoadmap` so the KV blob can't be
//          corrupted by a bad client.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  computeWarnings,
  getCurrentRoadmap,
  normaliseRoadmap,
  saveCurrentRoadmap,
} from "@/lib/roadmap-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const roadmap = await getCurrentRoadmap(slug);
  if (!roadmap) {
    return NextResponse.json({ roadmap: null, warnings: [] });
  }
  const dismissed = new Set(
    roadmap.dismissedWarnings.map((d) => d.id),
  );
  const warnings = computeWarnings(roadmap).filter(
    (w) => !dismissed.has(w.id),
  );
  return NextResponse.json({ roadmap, warnings });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const next = normaliseRoadmap(body, slug);
  await saveCurrentRoadmap(next);
  // Bust the cached `/seo/[slug]` page so the CurrentRoadmapStrip
  // refreshes immediately after a save. Otherwise the client page sits
  // on its 60s revalidate window and keeps showing the stale "No
  // roadmap yet" badge after a generation finishes.
  revalidatePath(`/seo/${slug}`);
  const dismissed = new Set(next.dismissedWarnings.map((d) => d.id));
  const warnings = computeWarnings(next).filter((w) => !dismissed.has(w.id));
  return NextResponse.json({ roadmap: next, warnings });
}
