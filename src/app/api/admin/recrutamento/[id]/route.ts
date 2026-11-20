// Recrutamento (v80.13) — PATCH aplica uma operação ao candidato (pontuar,
// passo, fecho, recusar…); DELETE apaga (nunca um candidato aceite).
import { NextResponse } from "next/server";
import { recruitmentUser } from "@/lib/recrutamento/guard";
import {
  applyCandidateOp,
  deleteCandidate,
  RecruitError,
  type CandidateOp,
} from "@/lib/recrutamento/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(err: unknown, fallback: string) {
  const status = err instanceof RecruitError ? err.status : 500;
  if (status === 500) console.error("[recrutamento]", err);
  return NextResponse.json({ error: err instanceof RecruitError ? err.message : fallback }, { status });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await recruitmentUser();
  if (!me) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const { id } = await ctx.params;
  const op = (await req.json().catch(() => null)) as CandidateOp | null;
  if (!op || typeof op !== "object" || typeof (op as { op?: unknown }).op !== "string") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const candidate = await applyCandidateOp(id, op, me.username);
    return NextResponse.json({ candidate });
  } catch (err) {
    return fail(err, "Não foi possível guardar.");
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await recruitmentUser();
  if (!me) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const { id } = await ctx.params;
  try {
    await deleteCandidate(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Não foi possível apagar.");
  }
}
