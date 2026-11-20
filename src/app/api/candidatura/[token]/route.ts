// Recrutamento (v80.16) — a API PÚBLICA da prova prática. Quem tem o link
// (/candidatura/<token>) abre, começa, grava o rascunho e entrega. Nunca
// devolve a avaliação: só o que o próprio candidato escreveu.
//
// Fora do login de propósito (o candidato não tem conta): o middleware só
// passa aqui o portão dos viewers, e o token de 24 caracteres é a chave.
import { NextResponse } from "next/server";
import {
  candidatePracticalAction,
  RecruitError,
  type CandidatePracticalAction,
} from "@/lib/recrutamento/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["open", "start", "save", "submit"]);

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = (await req.json().catch(() => null)) as CandidatePracticalAction | null;
  if (!body || typeof body !== "object" || !ACTIONS.has((body as { action?: string }).action ?? "")) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const sub = await candidatePracticalAction(token, body);
    return NextResponse.json({
      submission: { openedAt: sub.openedAt, startedAt: sub.startedAt, submittedAt: sub.submittedAt, updatedAt: sub.updatedAt },
      serverNow: Date.now(),
    });
  } catch (err) {
    const status = err instanceof RecruitError ? err.status : 500;
    if (status === 500) console.error("[candidatura]", err);
    return NextResponse.json(
      { error: err instanceof RecruitError ? err.message : "Não foi possível guardar. Tenta outra vez." },
      { status },
    );
  }
}
