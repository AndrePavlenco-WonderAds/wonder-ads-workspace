// A direção marca um relatório como revisto (os «sem erros», ou para fechar
// com uma nota).
//   POST { reportId, note }

import { NextResponse } from "next/server";
import { fail, guardAdmin, NO_STORE } from "@/lib/ineficacias/api-guard";
import { note, readBody, text } from "@/lib/ineficacias/admin-input";
import { loadConsultant, markReviewed } from "@/lib/ineficacias/store";
import { todayLisbonISO } from "@/lib/probation/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.res;
  const { actor } = guard;
  const body = await readBody(req);
  const reportId = text(body.reportId, 64);
  if (!reportId) return fail("Relatório em falta.", 400);
  try {
    const r = await markReviewed(reportId, { username: actor.username, name: actor.name }, note(body.note));
    if (!r.ok) {
      return r.reason === "unscored"
        ? fail("Ainda há ocorrências por pontuar — a revisão fecha-se sozinha quando todas tiverem pontuação.", 409)
        : fail("Relatório não encontrado.", 404);
    }
    const bundle = await loadConsultant(r.report.username, todayLisbonISO());
    return NextResponse.json({ ok: true, report: r.report, bundle }, { headers: NO_STORE });
  } catch (err) {
    console.error("Ineficácias: revisão falhou:", err instanceof Error ? err.message : "erro");
    return fail("Não foi possível gravar a revisão.", 500);
  }
}
