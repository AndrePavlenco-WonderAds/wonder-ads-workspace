// A direção pontua uma ocorrência (0–10).
//   POST { reportId, itemId, points, note }            → ocorrência de um relatório
//   POST { username, occurrenceId, points, note }      → ocorrência registada pela direção
// Com a calculadora (v77.94) vêm também { errorType, impacts }: ficam
// gravados na ocorrência e a sugestão é recalculada no store.
// Devolve o bundle fresco do consultor (relatórios + estado) para a página
// se atualizar sem recarregar.

import { NextResponse } from "next/server";
import { fail, guardAdmin, NO_STORE } from "@/lib/ineficacias/api-guard";
import { consultantUsername, note, points, readBody, text } from "@/lib/ineficacias/admin-input";
import { getReport, loadConsultant, rescoreDirect, scoreItem, type AssessmentInput } from "@/lib/ineficacias/store";
import { ERROR_TYPES, IMPACTS, type IneficaciaErrorType, type IneficaciaImpact } from "@/lib/ineficacias/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR_TYPE_IDS = new Set<string>(ERROR_TYPES.map((t) => t.id));
const IMPACT_IDS = new Set<string>(IMPACTS.map((i) => i.id));

/** A avaliação só se grava quando a direção escolheu o tipo de erro — sem
 *  ele a sugestão é provisória e o que lá estava fica como estava. */
function assessmentOf(body: Record<string, unknown>): AssessmentInput | null {
  if (!ERROR_TYPE_IDS.has(String(body.errorType))) return null;
  const impacts = Array.isArray(body.impacts)
    ? [...new Set(body.impacts.filter((i): i is IneficaciaImpact => IMPACT_IDS.has(String(i))))]
    : [];
  return { errorType: body.errorType as IneficaciaErrorType, impacts };
}

export async function POST(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.res;
  const { actor } = guard;
  const body = await readBody(req);
  const pts = points(body.points);
  if (pts === null) return fail("A pontuação tem de ser um inteiro de 0 a 10.", 400);
  const score = { points: pts, by: actor.username, byName: actor.name, note: note(body.note) };
  const assessment = assessmentOf(body);
  const today = todayLisbonISO();

  try {
    const reportId = text(body.reportId, 64);
    if (reportId) {
      const itemId = text(body.itemId, 64);
      if (!itemId) return fail("Ocorrência em falta.", 400);
      const existing = await getReport(reportId);
      if (!existing) return fail("Relatório não encontrado.", 404);
      const r = await scoreItem(reportId, itemId, score, assessment);
      if (!r.ok) return fail(r.reason === "no-item" ? "Ocorrência não encontrada." : "Relatório não encontrado.", 404);
      const bundle = await loadConsultant(r.report.username, today);
      return NextResponse.json({ ok: true, report: r.report, bundle }, { headers: NO_STORE });
    }
    const username = consultantUsername(body.username);
    const occurrenceId = text(body.occurrenceId, 64);
    if (!username || !occurrenceId) return fail("Pedido inválido.", 400);
    const ledger = await rescoreDirect(username, occurrenceId, score, assessment);
    if (!ledger) return fail("Ocorrência não encontrada.", 404);
    const bundle = await loadConsultant(username, today);
    return NextResponse.json({ ok: true, bundle }, { headers: NO_STORE });
  } catch (err) {
    console.error("Ineficácias: pontuação falhou:", err instanceof Error ? err.message : "erro");
    return fail("Não foi possível gravar a pontuação.", 500);
  }
}
