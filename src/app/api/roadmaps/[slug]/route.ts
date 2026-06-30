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
import { diffRoadmaps } from "@/lib/roadmap-changelog";
import { appendRoadmapLog } from "@/lib/roadmap-changelog-store";
import { getCurrentEmployee } from "@/lib/auth/server";

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
  const prev = await getCurrentRoadmap(slug);
  const next = normaliseRoadmap(body, slug);
  await saveCurrentRoadmap(next);
  // Record meaningful changes to the changelog (best-effort, never blocks
  // the save). Order-only saves diff to [] → zero extra KV ops.
  try {
    const events = diffRoadmaps(prev, next);
    if (events.length > 0) {
      const me = await getCurrentEmployee().catch(() => null);
      await appendRoadmapLog(slug, events, me?.username);
    }
  } catch (err) {
    console.error("roadmap changelog (non-fatal):", err);
  }
  // Bust the cached `/seo/[slug]` page so the CurrentRoadmapStrip
  // refreshes immediately after a save. Otherwise the client page sits
  // on its 60s revalidate window and keeps showing the stale "No
  // roadmap yet" badge after a generation finishes.
  revalidatePath(`/seo/${slug}`);
  const dismissed = new Set(next.dismissedWarnings.map((d) => d.id));
  const warnings = computeWarnings(next).filter((w) => !dismissed.has(w.id));
  return NextResponse.json({ roadmap: next, warnings });
}
