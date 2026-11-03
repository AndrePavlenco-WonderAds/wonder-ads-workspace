// GET /api/origem/<slug>/data[?month=AAAA-MM] — as contagens de um mês
// (por omissão, o mês corrente). A página pede só o mês em curso de 30 em
// 30 segundos; os meses fechados vêm uma vez, no carregamento.

import { NextResponse } from "next/server";
import { getMonthStats } from "@/lib/origem/store";
import { lisbonParts } from "@/lib/origem/stats";
import { origemGate } from "@/lib/origem/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const gate = await origemGate(slug);
  if (gate instanceof NextResponse) return gate;
  const asked = new URL(req.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(asked) ? asked : lisbonParts(Date.now()).month;
  const stats = await getMonthStats(gate.cfg, month);
  return NextResponse.json({ stats, now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
