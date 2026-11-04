// POST /api/admin/acessos (v78.72) — as ações da consola de acessos, só para
// o André (lib/access/guard.ts). Tudo por POST, incluindo o «revelar»: a
// password nunca vai num GET nem fica em cache nenhuma.
//
//   { action: "revelar",          username }  → { password | null }
//   { action: "regenerar",        username, endSessions? } → { row, event, password }
//   { action: "cancelar",         username }  → { row, event }
//   { action: "reativar",         username }  → { row, event }
//   { action: "terminar-sessoes", username }  → { row, event }

import { NextResponse } from "next/server";
import { accessConsoleUser } from "@/lib/access/guard";
import { AccessError, applyAccessAction, revealPassword } from "@/lib/access/store";
import type { AccessAction } from "@/lib/access/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: AccessAction[] = ["regenerar", "cancelar", "reativar", "terminar-sessoes"];
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const me = await accessConsoleUser();
  if (!me) return NextResponse.json({ error: "Só o COO abre os acessos." }, { status: 403, headers: NO_STORE });

  let body: { action?: unknown; username?: unknown; endSessions?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers: NO_STORE });
  }
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!username) return NextResponse.json({ error: "Falta a pessoa." }, { status: 400, headers: NO_STORE });

  try {
    if (action === "revelar") {
      const password = await revealPassword(username);
      return NextResponse.json({ password }, { headers: NO_STORE });
    }
    if (!ACTIONS.includes(action as AccessAction)) {
      return NextResponse.json({ error: "Ação desconhecida." }, { status: 400, headers: NO_STORE });
    }
    const result = await applyAccessAction(action as AccessAction, username, me, {
      endSessions: body.endSessions === true,
    });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    console.error("[acessos] falhou", err);
    return NextResponse.json({ error: "Não foi possível guardar. Tenta outra vez." }, { status: 500, headers: NO_STORE });
  }
}
