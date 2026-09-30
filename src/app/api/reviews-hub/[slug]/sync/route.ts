// POST /api/reviews-hub/<slug>/sync — «Sincronizar agora». { full: true }
// relê tudo (a sync normal só vai buscar o que mudou desde a última).
// { collect: true } só recolhe o que a DataForSEO já tiver pronto — é o que a
// página chama sozinha enquanto há salões a caminho (não pede nada novo).

import { NextResponse } from "next/server";
import { hubGate, readJson } from "@/lib/reviews-hub/route-helpers";
import { syncReviews } from "@/lib/reviews-hub/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const gate = await hubGate(slug, { write: true });
  if (gate instanceof NextResponse) return gate;
  const body = await readJson<{ full?: boolean; collect?: boolean }>(req);
  const collect = Boolean(body?.collect);

  const result = await syncReviews(slug, {
    full: Boolean(body?.full) && !collect,
    by: gate.actor,
    manual: !collect,
    collectOnly: collect,
  });
  if (result.status === "running") {
    return NextResponse.json({ status: "running" }, { status: 202 });
  }
  return NextResponse.json({
    status: result.status,
    sync: result.state,
    newReviews: result.status === "ok" ? result.newReviews.length : 0,
  });
}
