// GET /api/minigames/active — a sala aberta, para o aviso do header.
// Um único GET de KV (o ponteiro), porque corre em todas as páginas abertas.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getActiveGame } from "@/lib/minigames/one-truth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ active: null }, { status: 401 });
  const active = await getActiveGame();
  return NextResponse.json(
    { active: active ? { id: active.id, hostName: active.hostName } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
