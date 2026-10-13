// A direção regista uma ocorrência diretamente (algo que o consultor não
// reportou, ou que a direção viu primeiro). Nasce já pontuada e entra nas
// contas como as outras; o consultor vê-a no seu histórico, marcada
// «registada pela direção».
//   POST { username, what, client, reason, reasonOther, shouldHave,
//          occurredOn, noticed, points, note }

import { NextResponse } from "next/server";
import { fail, guardAdmin, NO_STORE } from "@/lib/ineficacias/api-guard";
import { consultantUsername, note, points, readBody, text } from "@/lib/ineficacias/admin-input";
import { addDirectOccurrence, loadConsultant } from "@/lib/ineficacias/store";
import {
  addDaysISO,
  isISODate,
  LIMITS,
  NOTICED_OPTIONS,
  REASONS,
  type IneficaciaNoticed,
  type IneficaciaReason,
} from "@/lib/ineficacias/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASON_IDS = new Set<string>(REASONS.map((r) => r.id));
const NOTICED_IDS = new Set<string>(NOTICED_OPTIONS.map((n) => n.id));

export async function POST(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.res;
  const { actor } = guard;
  const body = await readBody(req);
  const today = todayLisbonISO();

  const username = consultantUsername(body.username);
  if (!username) return fail("Consultor inválido.", 400);
  const what = text(body.what, LIMITS.what.max);
  if (what.length < 10) return fail("Descreve o que aconteceu (pelo menos 10 caracteres).", 400);
  const client = text(body.client, LIMITS.client.max) || "Interno";
  const reason = REASON_IDS.has(String(body.reason)) ? (body.reason as IneficaciaReason) : "outro";
  const reasonOther = reason === "outro" ? text(body.reasonOther, LIMITS.reasonOther.max) : "";
  const shouldHave = text(body.shouldHave, LIMITS.shouldHave.max);
  const occurredOn = text(body.occurredOn, 10);
  if (!isISODate(occurredOn)) return fail("Indica a data em que ocorreu.", 400);
  if (occurredOn > today) return fail("A data não pode ser no futuro.", 400);
  if (occurredOn < addDaysISO(today, -365)) return fail("A data é demasiado antiga.", 400);
  const noticed = NOTICED_IDS.has(String(body.noticed)) ? (body.noticed as IneficaciaNoticed) : "equipa";
  const pts = points(body.points);
  if (pts === null) return fail("A pontuação tem de ser um inteiro de 0 a 10.", 400);

  try {
    await addDirectOccurrence(username, {
      what,
      client,
      reason,
      reasonOther,
      shouldHave,
      occurredOn,
      noticed,
      score: { points: pts, by: actor.username, byName: actor.name, at: Date.now(), note: note(body.note) },
    });
    const bundle = await loadConsultant(username, today);
    return NextResponse.json({ ok: true, bundle }, { headers: NO_STORE });
  } catch (err) {
    console.error("Ineficácias: ocorrência direta falhou:", err instanceof Error ? err.message : "erro");
    return fail("Não foi possível registar a ocorrência.", 500);
  }
}
