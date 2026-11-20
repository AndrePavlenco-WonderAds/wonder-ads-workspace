// Recrutamento (v80.13) — «confirmar e aceitar»: cria a conta na app (com a
// password no cofre dos Acessos), põe a pessoa na equipa (roster do C-Suite)
// e numa coluna nova do SEO DPT. Devolve a password uma vez, para copiar.
import { NextResponse } from "next/server";
import { recruitmentUser } from "@/lib/recrutamento/guard";
import { acceptCandidate, RecruitError, type AcceptInput } from "@/lib/recrutamento/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await recruitmentUser();
  if (!me) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as AcceptInput | null;
  if (!body) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const result = await acceptCandidate(id, body, me.username);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const status = err instanceof RecruitError ? err.status : 500;
    if (status === 500) console.error("[recrutamento] aceitar", err);
    return NextResponse.json(
      { error: err instanceof RecruitError ? err.message : "Não foi possível aceitar." },
      { status },
    );
  }
}
