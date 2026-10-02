// Extensão aos 30 dias (só SuperAdmin).
//   POST { rev } → o período avaliado vai para o histórico e abre-se um novo
//                  período de 30 dias, com os KPIs anteriores como rascunho.
// Só funciona quando as duas avaliações do período decidiram «extensão» —
// a regra vive no store, não no botão.

import { NextResponse } from "next/server";
import { guardProbation, NO_STORE } from "@/lib/probation/api-guard";
import { openNextPeriod } from "@/lib/probation/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardProbation();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;

  let rev = -1;
  try {
    const b = (await req.json()) as Record<string, unknown>;
    if (typeof b?.rev === "number") rev = b.rev;
  } catch {
    /* sem body → rev -1 → conflito, que é a resposta certa */
  }

  try {
    const result = await openNextPeriod(id, rev, g.actor.name);
    if (result.ok) return NextResponse.json({ ok: true, plan: result.plan }, { headers: NO_STORE });
    if (result.reason === "not-found") {
      return NextResponse.json({ error: "Plano não encontrado." }, { status: 404, headers: NO_STORE });
    }
    if (result.reason === "not-extended") {
      return NextResponse.json(
        { error: "Só se abre um novo período quando a avaliação dos 30 dias decide extensão." },
        { status: 400, headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { error: "Este plano foi alterado noutro sítio. Recarrega a página e tenta de novo." },
      { status: 409, headers: NO_STORE },
    );
  } catch (err) {
    console.error("Probation: novo período falhou:", err instanceof Error ? err.message : "erro");
    return NextResponse.json(
      { error: "Não foi possível abrir o novo período." },
      { status: 500, headers: NO_STORE },
    );
  }
}
