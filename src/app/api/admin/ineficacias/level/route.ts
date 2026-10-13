// A direção define o nível à mão, com justificação: uma falha grave que leva
// a probation direto, ou a reposição a 0 depois de uma reintegração. Como
// qualquer medida, abre uma fase nova — os contadores recomeçam no dia
// seguinte.
//   POST { username, level, at?, note }

import { NextResponse } from "next/server";
import { fail, guardAdmin, NO_STORE } from "@/lib/ineficacias/api-guard";
import { consultantUsername, note, readBody, text } from "@/lib/ineficacias/admin-input";
import { addLedgerEvent, loadConsultant } from "@/lib/ineficacias/store";
import { isISODate, type IneficaciaLevel } from "@/lib/ineficacias/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.res;
  const { actor } = guard;
  const body = await readBody(req);
  const today = todayLisbonISO();

  const username = consultantUsername(body.username);
  if (!username) return fail("Consultor inválido.", 400);
  const level = typeof body.level === "number" ? Math.round(body.level) : Number(body.level);
  if (![0, 1, 2, 3].includes(level)) return fail("O nível tem de ser 0, 1, 2 ou 3.", 400);
  const at = text(body.at, 10) || today;
  if (!isISODate(at) || at > today) return fail("Data inválida.", 400);
  const why = note(body.note);
  if (why.length < 5) return fail("Escreve a justificação — fica no histórico do consultor.", 400);
  // O nível deriva do ÚLTIMO evento por data — nunca se insere um evento
  // atrás do anterior.
  const before = await loadConsultant(username, today);
  const lastAt = before.ledger.events.reduce((m, e) => (e.at > m ? e.at : m), "");
  if (lastAt && at <= lastAt) {
    return fail(`A data tem de ser posterior ao último evento da escala (${lastAt.split("-").reverse().join("/")}).`, 400);
  }

  try {
    await addLedgerEvent(username, {
      kind: "set-level",
      level: level as IneficaciaLevel,
      at,
      by: actor.username,
      byName: actor.name,
      note: why,
    });
    const bundle = await loadConsultant(username, today);
    return NextResponse.json({ ok: true, bundle }, { headers: NO_STORE });
  } catch (err) {
    console.error("Ineficácias: definir nível falhou:", err instanceof Error ? err.message : "erro");
    return fail("Não foi possível definir o nível.", 500);
  }
}
