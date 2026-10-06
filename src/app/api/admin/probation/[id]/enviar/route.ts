// «Enviar ao consultor» (só SuperAdmin).
//   POST { rev, item } → fotografa o item («plan», «week:N», «eval:15»,
//                        «eval:30») a partir do plano gravado e publica-o
//                        para o consultor ver em /probation.
// A `rev` é a que o editor pré-visualizou: se o plano mudou entretanto, 409
// — envia-se sempre exatamente o que se viu.

import { NextResponse } from "next/server";
import { guardProbation, NO_STORE } from "@/lib/probation/api-guard";
import { sendToConsultant } from "@/lib/probation/store";
import { parseSendItem } from "@/lib/probation/published";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardProbation();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;

  let rev = -1;
  let item = null as ReturnType<typeof parseSendItem>;
  try {
    const b = (await req.json()) as Record<string, unknown>;
    if (typeof b?.rev === "number") rev = b.rev;
    item = parseSendItem(b?.item);
  } catch {
    /* sem body → item null → 400 */
  }
  if (!item) {
    return NextResponse.json({ error: "Item de envio inválido." }, { status: 400, headers: NO_STORE });
  }

  try {
    const r = await sendToConsultant(id, rev, item, g.actor.name);
    if (r.ok) return NextResponse.json({ ok: true, plan: r.plan, pub: r.pub }, { headers: NO_STORE });
    const status = r.reason === "not-found" ? 404 : r.reason === "conflict" ? 409 : 400;
    return NextResponse.json({ error: r.message }, { status, headers: NO_STORE });
  } catch (err) {
    console.error("Probation: envio falhou:", err instanceof Error ? err.message : "erro");
    return NextResponse.json({ error: "Não foi possível enviar." }, { status: 500, headers: NO_STORE });
  }
}
