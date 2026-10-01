// POST /api/minigames — o SuperAdmin abre uma sala nova de «Uma verdade,
// duas mentiras» (v77.71). Só há uma sala aberta de cada vez: é a que o
// aviso do header mostra a toda a equipa.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { GameError, createGame } from "@/lib/minigames/one-truth-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  if (!employee.isAdmin) {
    return NextResponse.json({ error: "Só o SuperAdmin abre salas." }, { status: 403 });
  }
  let body: { roundSeconds?: unknown };
  try {
    body = (await req.json()) as { roundSeconds?: unknown };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const id = await createGame(employee, body.roundSeconds ?? null);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err instanceof GameError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("minigames create failed:", err);
    return NextResponse.json({ error: "Não foi possível abrir a sala." }, { status: 500 });
  }
}
