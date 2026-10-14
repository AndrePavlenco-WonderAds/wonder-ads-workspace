// A direção regista uma ineficácia de um consultor diretamente (algo que
// ele não reportou, ou que a direção viu primeiro). Nasce já pontuada e
// entra nas contas como as outras; o consultor vê-a no seu histórico,
// marcada «registada pela direção», e recebe o aviso no sino.
//   POST { username, what, client, reason, reasonOther, shouldHave,
//          firstTime, lastTime, occurredOn, noticed, errorType, impacts,
//          points, note }
// A sugestão da calculadora volta a ser calculada aqui (não se confia na do
// browser) e fica gravada ao lado da pontuação dada.

import { NextResponse } from "next/server";
import { fail, guardAdmin, NO_STORE } from "@/lib/ineficacias/api-guard";
import { consultantUsername, note, points, readBody, text } from "@/lib/ineficacias/admin-input";
import { addDirectOccurrence, loadConsultant } from "@/lib/ineficacias/store";
import {
  addDaysISO,
  DIRECT_LOOKBACK_DAYS,
  ERROR_TYPES,
  IMPACTS,
  isISODate,
  LIMITS,
  NOTICED_OPTIONS,
  REASONS,
  suggestScore,
  type IneficaciaErrorType,
  type IneficaciaImpact,
  type IneficaciaNoticed,
  type IneficaciaReason,
} from "@/lib/ineficacias/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASON_IDS = new Set<string>(REASONS.map((r) => r.id));
const NOTICED_IDS = new Set<string>(NOTICED_OPTIONS.map((n) => n.id));
const ERROR_TYPE_IDS = new Set<string>(ERROR_TYPES.map((t) => t.id));
const IMPACT_IDS = new Set<string>(IMPACTS.map((i) => i.id));

export async function POST(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.res;
  const { actor } = guard;
  const body = await readBody(req);
  const today = todayLisbonISO();

  const username = consultantUsername(body.username);
  if (!username) return fail("Escolhe o consultor.", 400);
  const what = text(body.what, LIMITS.what.max);
  if (what.length < 10) return fail("Descreve o erro cometido (pelo menos 10 caracteres).", 400);
  const client = text(body.client, LIMITS.client.max) || "Interno";
  const reason = REASON_IDS.has(String(body.reason)) ? (body.reason as IneficaciaReason) : "outro";
  const reasonOther = reason === "outro" ? text(body.reasonOther, LIMITS.reasonOther.max) : "";
  if (reason === "outro" && reasonOther.length < LIMITS.reasonOther.min) return fail("Especifica o motivo «Outro».", 400);
  const shouldHave = text(body.shouldHave, LIMITS.shouldHave.max);
  if (typeof body.firstTime !== "boolean") return fail("Indica se foi a primeira vez que cometeu este erro.", 400);
  const firstTime = body.firstTime;
  const lastTime = firstTime ? "" : text(body.lastTime, LIMITS.lastTime.max);
  if (!firstTime && lastTime.length < LIMITS.lastTime.min) return fail("Indica quando foi a última vez.", 400);
  const occurredOn = text(body.occurredOn, 10);
  if (!isISODate(occurredOn)) return fail("Indica a data em que ocorreu.", 400);
  if (occurredOn > today) return fail("A data não pode ser no futuro.", 400);
  if (occurredOn < addDaysISO(today, -DIRECT_LOOKBACK_DAYS)) return fail("A data é demasiado antiga (máximo um ano).", 400);
  const noticed = NOTICED_IDS.has(String(body.noticed)) ? (body.noticed as IneficaciaNoticed) : "equipa";
  if (!ERROR_TYPE_IDS.has(String(body.errorType))) return fail("Indica se foi um erro de aprendizagem ou de recorrência.", 400);
  const errorType = body.errorType as IneficaciaErrorType;
  const impacts = Array.isArray(body.impacts)
    ? [...new Set(body.impacts.filter((i): i is IneficaciaImpact => IMPACT_IDS.has(String(i))))]
    : [];
  const suggestedPoints = suggestScore({ impacts, reason, firstTime, errorType, noticed }).points;
  const pts = points(body.points);
  if (pts === null) return fail("Escolhe a gravidade e a pontuação (0 a 10).", 400);

  try {
    await addDirectOccurrence(username, {
      what,
      client,
      reason,
      reasonOther,
      shouldHave,
      firstTime,
      lastTime,
      occurredOn,
      noticed,
      errorType,
      impacts,
      suggestedPoints,
      score: { points: pts, by: actor.username, byName: actor.name, at: Date.now(), note: note(body.note) },
    });
    const bundle = await loadConsultant(username, today);
    return NextResponse.json({ ok: true, bundle }, { headers: NO_STORE });
  } catch (err) {
    console.error("Ineficácias: ocorrência direta falhou:", err instanceof Error ? err.message : "erro");
    return fail("Não foi possível registar a ocorrência.", 500);
  }
}
