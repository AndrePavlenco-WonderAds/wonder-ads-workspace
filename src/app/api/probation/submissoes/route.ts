// O consultor submete para revisão no probation (v77.84) — um documento, um
// link, uma nota — e pode tirar o que submeteu enquanto o check-in dessa
// semana não estiver feito.
//   POST   { planId, text, kpi, link, file } → { groups }
//   DELETE ?plano=<id>&id=<submissão>        → { groups }
//
// O consultor vem SEMPRE da sessão — nunca do body. Um plano que não é dele
// responde 404, como se não existisse. Com o «Ver como» ativo é só leitura.

import { NextResponse } from "next/server";
import { getCurrentEmployee, getImpersonation } from "@/lib/auth/server";
import { addSubmission, probationConfigured, removeSubmission } from "@/lib/probation/store";
import { groupSubmissions, parseSubmissionInput } from "@/lib/probation/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

async function guard(): Promise<{ ok: true; username: string } | { ok: false; res: NextResponse }> {
  const me = await getCurrentEmployee();
  if (!me) return { ok: false, res: fail("Sessão inválida.", 401) };
  if (await getImpersonation().catch(() => null)) {
    return { ok: false, res: fail("A ver como outra pessoa — só o próprio pode submeter.", 403) };
  }
  if (!probationConfigured) return { ok: false, res: fail("Armazenamento indisponível.", 503) };
  return { ok: true, username: me.username };
}

export async function POST(req: Request) {
  const g = await guard();
  if (!g.ok) return g.res;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* fica vazio → 400 abaixo */
  }
  const planId = typeof body.planId === "string" ? body.planId.slice(0, 64) : "";
  if (!planId) return fail("Pedido inválido.", 400);
  const input = parseSubmissionInput(body);
  if (typeof input === "string") return fail(input, 400);

  try {
    const r = await addSubmission(g.username, planId, input);
    if (!r.ok) return fail("Não encontrado.", 404);
    return NextResponse.json({ ok: true, groups: groupSubmissions(r.plan, r.subs) }, { headers: NO_STORE });
  } catch (err) {
    console.error("Probation: submissão falhou:", err instanceof Error ? err.message : "erro");
    return fail("Não foi possível submeter.", 500);
  }
}

export async function DELETE(req: Request) {
  const g = await guard();
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const planId = (sp.get("plano") ?? "").slice(0, 64);
  const subId = (sp.get("id") ?? "").slice(0, 64);
  if (!planId || !subId) return fail("Pedido inválido.", 400);

  try {
    const r = await removeSubmission(g.username, planId, subId);
    if (!r.ok) {
      return r.reason === "locked"
        ? fail("O check-in dessa semana já foi feito — o que lá está já foi revisto e fica.", 409)
        : fail("Não encontrado.", 404);
    }
    return NextResponse.json({ ok: true, groups: groupSubmissions(r.plan, r.subs) }, { headers: NO_STORE });
  } catch (err) {
    console.error("Probation: apagar submissão falhou:", err instanceof Error ? err.message : "erro");
    return fail("Não foi possível tirar a submissão.", 500);
  }
}
