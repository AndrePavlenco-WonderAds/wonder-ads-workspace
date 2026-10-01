// /api/minigames/[id] — a sala ao vivo (v77.71).
//
//   GET  → a vista da sala para quem pede (polling de ~1,5 s). Recortada no
//          servidor: a verdade de cada pessoa só sai na revelação da ronda.
//   POST → { action, … }: join · leave · save · unready · vote (qualquer
//          pessoa na sala, sobre os seus campos) e start · reveal · next ·
//          finish · cancel · kick (só SuperAdmin). Devolve a vista nova, para
//          o ecrã de quem clicou não esperar pelo próximo poll.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  GameError,
  castVote,
  getGameView,
  hostAction,
  joinGame,
  leaveGame,
  saveEntry,
  unreadyEntry,
} from "@/lib/minigames/one-truth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOST_ACTIONS = new Set(["start", "reveal", "next", "finish", "cancel", "kick"]);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const view = await getGameView(id, employee);
    if (!view) return NextResponse.json({ error: "Esta sala já não existe." }, { status: 404 });
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("minigames view failed:", err);
    return NextResponse.json({ error: "Falha a ler a sala." }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const action = body.action;
  try {
    if (typeof action === "string" && HOST_ACTIONS.has(action)) {
      if (!employee.isAdmin) {
        return NextResponse.json({ error: "Só o anfitrião controla o jogo." }, { status: 403 });
      }
      await hostAction(id, action, body.target);
    } else if (action === "join") {
      await joinGame(id, employee);
    } else if (action === "leave") {
      await leaveGame(id, employee.username);
    } else if (action === "save") {
      await saveEntry(id, employee.username, body.statements, body.truth);
    } else if (action === "unready") {
      await unreadyEntry(id, employee.username);
    } else if (action === "vote") {
      await castVote(id, employee.username, body.round, body.choice);
    } else {
      return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
    }
    const view = await getGameView(id, employee);
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof GameError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("minigames action failed:", err);
    return NextResponse.json({ error: "Algo correu mal — tenta outra vez." }, { status: 500 });
  }
}
