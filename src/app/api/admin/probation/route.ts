// Planos de Probation (só SuperAdmin).
//   GET  → resumo de todos os planos (consultor, início, próxima avaliação,
//          estado)
//   POST { …rascunho do editor } → cria o plano e devolve-o

import { NextResponse } from "next/server";
import { guardProbation, NO_STORE } from "@/lib/probation/api-guard";
import { createPlan, listPlans } from "@/lib/probation/store";
import { sanitizeDraft, summarize, validateDraft } from "@/lib/probation/shared";
import { getEmployeeDisplay } from "@/lib/auth/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardProbation();
  if (!g.ok) return g.res;
  const plans = await listPlans();
  return NextResponse.json({ plans: plans.map(summarize) }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const g = await guardProbation();
  if (!g.ok) return g.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400, headers: NO_STORE });
  }
  const draft = sanitizeDraft(body, () => crypto.randomUUID());
  // Um username que não está no roster passa a nome escrito à mão.
  if (draft.consultantUsername && !getEmployeeDisplay(draft.consultantUsername)) {
    draft.consultantUsername = null;
  }
  const problem = validateDraft(draft);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400, headers: NO_STORE });
  }

  try {
    const plan = await createPlan(draft, g.actor.name);
    return NextResponse.json({ ok: true, plan }, { headers: NO_STORE });
  } catch (err) {
    console.error("Probation: criação falhou:", err instanceof Error ? err.message : "erro");
    return NextResponse.json(
      { error: "Não foi possível criar o plano — tenta outra vez." },
      { status: 500, headers: NO_STORE },
    );
  }
}
