// GET /api/reviews-hub/<slug>/reviews?loc=<id> — as reviews de um salão.
// A página pede todos os salões em paralelo e junta-os.

import { NextResponse } from "next/server";
import { hubGate } from "@/lib/reviews-hub/route-helpers";
import { getLocations, getReviewsForLocation } from "@/lib/reviews-hub/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const gate = await hubGate(slug);
  if (gate instanceof NextResponse) return gate;
  const loc = new URL(req.url).searchParams.get("loc");
  if (!loc || !(await getLocations(slug)).some((l) => l.id === loc)) {
    return NextResponse.json({ error: "Salão não encontrado." }, { status: 404 });
  }
  const reviews = await getReviewsForLocation(slug, loc);
  return NextResponse.json({ reviews }, { headers: { "Cache-Control": "no-store" } });
}
