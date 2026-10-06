// O consultor confirma que leu o que lhe foi enviado (plano, check-in ou
// avaliação), com um comentário opcional.
//   POST { planId, period, item, comment }
//
// O consultor vem SEMPRE da sessão — nunca do body. Um plano que não é dele
// responde 404, como se não existisse. Com o «Ver como» ativo é só leitura:
// confirmar em nome de outra pessoa não pode acontecer nem por engano.

import { NextResponse } from "next/server";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { acknowledge, probationConfigured } from "@/lib/probation/store";
import { parseSendItem } from "@/lib/probation/published";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: NO_STORE });
  if (await getImpersonation().catch(() => null)) {
    return NextResponse.json(
      { error: "A ver como outra pessoa — a confirmação é só do próprio." },
      { status: 403, headers: NO_STORE },
    );
  }
  if (!probationConfigured) {
    return NextResponse.json({ error: "Armazenamento indisponível." }, { status: 503, headers: NO_STORE });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* fica vazio → 400 abaixo */
  }
  const planId = typeof body.planId === "string" ? body.planId.slice(0, 64) : "";
  const period = typeof body.period === "number" && Number.isInteger(body.period) ? body.period : -1;
  const item = parseSendItem(body.item);
  const comment = typeof body.comment === "string" ? body.comment : "";
  if (!planId || period < 0 || !item) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers: NO_STORE });
  }

  try {
    const r = await acknowledge(me.username, planId, period, item, comment);
    if (!r.ok) return NextResponse.json({ error: "Não encontrado." }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ ok: true, pub: r.pub }, { headers: NO_STORE });
  } catch (err) {
    console.error("Probation: confirmação falhou:", err instanceof Error ? err.message : "erro");
    return NextResponse.json({ error: "Não foi possível confirmar." }, { status: 500, headers: NO_STORE });
  }
}
