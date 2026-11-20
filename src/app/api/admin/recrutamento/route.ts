// Recrutamento (v80.13) — POST cria um candidato (com a primeira entrevista).
import { NextResponse } from "next/server";
import { recruitmentUser } from "@/lib/recrutamento/guard";
import { createCandidate, RecruitError, type CandidateInput } from "@/lib/recrutamento/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await recruitmentUser();
  if (!me) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const body = (await req.json().catch(() => null)) as CandidateInput | null;
  if (!body) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const candidate = await createCandidate(body, me.username);
    return NextResponse.json({ candidate });
  } catch (err) {
    const status = err instanceof RecruitError ? err.status : 500;
    const message = err instanceof RecruitError ? err.message : "Não foi possível criar o candidato.";
    if (status === 500) console.error("[recrutamento] criar", err);
    return NextResponse.json({ error: message }, { status });
  }
}
