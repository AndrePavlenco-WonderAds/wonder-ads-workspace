// A direção regista a MEDIDA de um nível atingido: o 1:1 (nível 1 ou 2) ou
// o arranque do probation (nível 3). A partir do dia seguinte os contadores
// (PA e NO) recomeçam — a regra da Beatriz — e o nível fica, cumulativo.
//   POST { username, level, at, conductedBy, actions[], note }

import { NextResponse } from "next/server";
import { fail, guardAdmin, NO_STORE } from "@/lib/ineficacias/api-guard";
import { consultantUsername, note, readBody, text } from "@/lib/ineficacias/admin-input";
import { addLedgerEvent, loadConsultant } from "@/lib/ineficacias/store";
import { isISODate, LIMITS } from "@/lib/ineficacias/shared";
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
  if (![1, 2, 3].includes(level)) return fail("O nível da medida tem de ser 1, 2 ou 3.", 400);
  const at = text(body.at, 10);
  if (!isISODate(at)) return fail("Indica a data da reunião.", 400);
  if (at > today) return fail("A data da medida não pode ser no futuro.", 400);
  const conductedBy = text(body.conductedBy, 120);
  if (!conductedBy) return fail("Indica quem conduziu a reunião.", 400);
  const actions = Array.isArray(body.actions)
    ? body.actions.map((a) => text(a, LIMITS.action.max)).filter(Boolean).slice(0, 6)
    : [];
  if (level < 3 && actions.length === 0) return fail("Regista pelo menos uma ação combinada (1 a 3).", 400);

  // Só se regista a medida de um nível que está de facto por aplicar — o
  // estado derivado é a fonte de verdade.
  const before = await loadConsultant(username, today);
  // O nível deriva do ÚLTIMO evento por data: uma reunião datada antes da
  // anterior baralhava a escala.
  const lastAt = before.ledger.events.reduce((m, e) => (e.at > m ? e.at : m), "");
  if (lastAt && at <= lastAt) {
    return fail(`A data tem de ser posterior ao último evento da escala (${lastAt.split("-").reverse().join("/")}).`, 400);
  }
  const pending = before.state.pendingMeasure;
  if (!pending || pending.level !== level) {
    return fail(
      pending
        ? `A medida por aplicar é a do nível ${pending.level}, não a do ${level}.`
        : "Não há nenhuma medida por aplicar — o limiar não foi atingido nesta fase.",
      409,
    );
  }
  // A reunião não pode ser anterior à ocorrência que fez passar o limiar:
  // datada antes, essas ocorrências voltavam a contar na fase nova e
  // escalavam logo o nível seguinte.
  if (at < pending.since) {
    return fail(
      `A reunião não pode ser anterior a ${pending.since.split("-").reverse().join("/")}, a data em que o nível ${level} foi atingido.`,
      400,
    );
  }

  try {
    await addLedgerEvent(username, {
      kind: "measure",
      level: level as 1 | 2 | 3,
      at,
      by: actor.username,
      byName: actor.name,
      conductedBy,
      actions,
      note: note(body.note),
    });
    const bundle = await loadConsultant(username, today);
    return NextResponse.json({ ok: true, bundle }, { headers: NO_STORE });
  } catch (err) {
    console.error("Ineficácias: medida falhou:", err instanceof Error ? err.message : "erro");
    return fail("Não foi possível registar a medida.", 500);
  }
}
