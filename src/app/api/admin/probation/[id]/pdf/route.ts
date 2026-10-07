// GET /api/admin/probation/<id>/pdf[?periodo=N] — o documento do plano em
// PDF (só SuperAdmin). Sem `periodo`, o período em curso; com ele, um dos
// períodos do histórico (1 = o primeiro).

import { NextResponse } from "next/server";
import { guardProbation, NO_STORE } from "@/lib/probation/api-guard";
import { getPlan } from "@/lib/probation/store";
import { buildDocModel, pdfFileName } from "@/lib/probation/document";
import { pdfResponse } from "@/lib/probation/pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardProbation();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const plan = await getPlan(id);
  if (!plan) {
    return NextResponse.json({ error: "Plano não encontrado." }, { status: 404, headers: NO_STORE });
  }

  const current = plan.history.length + 1;
  const raw = new URL(req.url).searchParams.get("periodo");
  const n = raw ? Number(raw) : current;
  if (!Number.isInteger(n) || n < 1 || n > current) {
    return NextResponse.json({ error: "Período inexistente." }, { status: 404, headers: NO_STORE });
  }
  const period = n === current ? plan.period : plan.history[n - 1];
  const model = buildDocModel(plan, period, n - 1);
  // O período em curso sai com o nome simples; os do histórico levam o
  // número, para não se confundirem na pasta de transferências.
  const name = pdfFileName(plan.consultantName, n === current ? null : `${n}.º período`);
  return pdfResponse(model, name);
}
