// Um Plano de Probation (só SuperAdmin).
//   GET    → o plano inteiro
//   PUT    { rev, draft } → grava o que o editor tem; 409 se o plano mudou
//                           noutro sítio desde a versão `rev`
//   DELETE → apaga o plano

import { NextResponse } from "next/server";
import { guardProbation, NO_STORE } from "@/lib/probation/api-guard";
import { deletePlan, getPlan, savePlan } from "@/lib/probation/store";
import { sanitizeDraft, validateDraft } from "@/lib/probation/shared";
import { getEmployeeDisplay } from "@/lib/auth/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guardProbation();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const plan = await getPlan(id);
  if (!plan) {
    return NextResponse.json({ error: "Plano não encontrado." }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json({ plan }, { headers: NO_STORE });
}

export async function PUT(req: Request, ctx: Ctx) {
  const g = await guardProbation();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400, headers: NO_STORE });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const rev = typeof b.rev === "number" ? b.rev : -1;
  const draft = sanitizeDraft(b.draft, () => crypto.randomUUID());
  if (draft.consultantUsername && !getEmployeeDisplay(draft.consultantUsername)) {
    draft.consultantUsername = null;
  }
  const problem = validateDraft(draft);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400, headers: NO_STORE });
  }

  try {
    const result = await savePlan(id, draft, rev, g.actor.name);
    if (!result.ok && result.reason === "not-found") {
      return NextResponse.json({ error: "Plano não encontrado." }, { status: 404, headers: NO_STORE });
    }
    if (!result.ok) {
      return NextResponse.json(
        {
          error: `Este plano foi alterado noutro sítio (por ${result.plan.updatedBy || "outra pessoa"}). Recarrega a página para veres a versão atual.`,
        },
        { status: 409, headers: NO_STORE },
      );
    }
    return NextResponse.json({ ok: true, plan: result.plan }, { headers: NO_STORE });
  } catch (err) {
    console.error("Probation: gravação falhou:", err instanceof Error ? err.message : "erro");
    return NextResponse.json(
      { error: "Não foi possível gravar — tenta outra vez." },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guardProbation();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  try {
    const existed = await deletePlan(id);
    if (!existed) {
      return NextResponse.json({ error: "Plano não encontrado." }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    console.error("Probation: apagar falhou:", err instanceof Error ? err.message : "erro");
    return NextResponse.json(
      { error: "Não foi possível apagar o plano." },
      { status: 500, headers: NO_STORE },
    );
  }
}
