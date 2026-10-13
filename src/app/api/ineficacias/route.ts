// O relatório semanal de ineficácias do PRÓPRIO consultor.
//   GET  → os relatórios dele + o estado (PA, NO, nível) — para a página se
//          atualizar sem recarregar.
//   POST { weekKey, noErrors, items[], declaration, signatureName }
//        → valida, assina (hash SHA-256 + IP + user-agent + hora UTC) e grava.
//
// A identidade vem SEMPRE da sessão, nunca do body. Um relatório é da pessoa
// que o assina — com o «Ver como» ativo a rota recusa, e o nome escrito tem
// de ser exatamente o nome completo registado na conta.

import { NextResponse } from "next/server";
import { getCurrentEmployee, isRealUserAdmin } from "@/lib/auth/server";
import { INEFICACIAS_SINCE, ineficaciasAvailable } from "@/lib/ineficacias/access";
import { fail, guardConsultantWrite, NO_STORE, requestFingerprint } from "@/lib/ineficacias/api-guard";
import { loadConsultant, submitReport } from "@/lib/ineficacias/store";
import {
  cleanItems,
  normalizeName,
  reportableWeeks,
  validateReport,
  type IneficaciaItemDraft,
  type IneficaciaNoticed,
  type IneficaciaReason,
  type ReportDraft,
} from "@/lib/ineficacias/shared";
import { todayLisbonISO } from "@/lib/probation/progress";
import { announceReportSubmitted } from "@/lib/ineficacias/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getCurrentEmployee();
  if (!me) return fail("Sessão inválida.", 401);
  if (me.viewerOf) return fail("Este perfil não tem acesso a esta área.", 403);
  if (!ineficaciasAvailable(await isRealUserAdmin())) return fail("Em construção.", 403);
  const bundle = await loadConsultant(me.username, todayLisbonISO());
  return NextResponse.json(
    { reports: bundle.reports, state: bundle.state, occurrences: bundle.occurrences },
    { headers: NO_STORE },
  );
}

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

const REASONS = new Set(["atencao", "protocolo", "tempo", "outro"]);
const NOTICED = new Set(["proprio", "equipa", "cliente"]);

function parseItem(raw: unknown): IneficaciaItemDraft {
  const it = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    what: text(it.what, 4000),
    client: text(it.client, 300),
    reason: REASONS.has(String(it.reason)) ? (it.reason as IneficaciaReason) : null,
    reasonOther: text(it.reasonOther, 400),
    shouldHave: text(it.shouldHave, 4000),
    firstTime: typeof it.firstTime === "boolean" ? it.firstTime : null,
    lastTime: text(it.lastTime, 400),
    occurredOn: text(it.occurredOn, 10),
    noticed: NOTICED.has(String(it.noticed)) ? (it.noticed as IneficaciaNoticed) : null,
  };
}

export async function POST(req: Request) {
  const guard = await guardConsultantWrite();
  if (!guard.ok) return guard.res;
  const { actor, fullName } = guard;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("Pedido inválido.", 400);
  }
  const draft: ReportDraft = {
    weekKey: text(body.weekKey, 8),
    noErrors: body.noErrors === true,
    items: Array.isArray(body.items) ? body.items.slice(0, 50).map(parseItem) : [],
    declaration: body.declaration === true,
    signatureName: text(body.signatureName, 200),
  };

  const today = todayLisbonISO();
  // As semanas que ainda pode reportar: a corrente e a anterior, menos as
  // que já assinou. O servidor é a fonte de verdade — o browser só espelha.
  const already = new Set((await loadConsultant(actor.username, today)).reports.map((r) => r.weekKey));
  const allowedWeeks = reportableWeeks(today, INEFICACIAS_SINCE).filter((w) => !already.has(w));
  const problem = validateReport(draft, { todayISO: today, expectedName: fullName, allowedWeeks });
  if (problem) return fail(problem, 400);

  const { ip, userAgent } = await requestFingerprint();
  try {
    const result = await submitReport({
      username: actor.username,
      name: actor.name,
      role: actor.role,
      dept: actor.dept,
      weekKey: draft.weekKey,
      noErrors: draft.noErrors,
      items: cleanItems(draft.items, () => crypto.randomUUID()),
      signature: {
        fullName: normalizeName(draft.signatureName),
        signedAt: new Date().toISOString(),
        userId: actor.username,
        ip,
        userAgent,
      },
    });
    if (!result.ok) return fail("O relatório dessa semana já foi submetido.", 409);
    // O aviso à direção: o sino deriva do registo (nada a enviar); o Slack é
    // um extra que nunca falha o pedido.
    void announceReportSubmitted(result.report).catch(() => {});
    return NextResponse.json({ ok: true, report: result.report }, { headers: NO_STORE });
  } catch (err) {
    console.error("Ineficácias: submissão falhou:", err instanceof Error ? err.message : "erro");
    return fail("Não foi possível submeter — tenta outra vez.", 500);
  }
}
