// GET /api/reviews-hub/<slug>/data — o que a página precisa para se
// refrescar, menos as reviews: perfis, rascunhos, estado da sync e atividade.
// As reviews vêm salão a salão de /reviews?loc= (em paralelo), para nenhuma
// resposta se aproximar do limite de 4,5 MB das funções da Vercel.

import { NextResponse } from "next/server";
import { hubGate } from "@/lib/reviews-hub/route-helpers";
import {
  getActivity,
  getDrafts,
  getLocations,
  getSyncState,
  isSyncRunning,
} from "@/lib/reviews-hub/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const gate = await hubGate(slug);
  if (gate instanceof NextResponse) return gate;

  const [locations, drafts, sync, activity, running] = await Promise.all([
    getLocations(slug),
    getDrafts(slug),
    getSyncState(slug),
    getActivity(slug),
    isSyncRunning(slug),
  ]);
  return NextResponse.json(
    { locations, drafts, sync, activity: activity.slice(0, 40), running },
    { headers: { "Cache-Control": "no-store" } },
  );
}
