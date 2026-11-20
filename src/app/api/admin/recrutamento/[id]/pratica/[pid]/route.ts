// Recrutamento (v80.16) — GET o que o candidato já escreveu na prática, para
// a ficha acompanhar ao vivo enquanto a prova decorre. SuperAdmins.
import { NextResponse } from "next/server";
import { recruitmentUser } from "@/lib/recrutamento/guard";
import { getCandidate, getPracticalSubmission } from "@/lib/recrutamento/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; pid: string }> }) {
  const me = await recruitmentUser();
  if (!me) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const { id, pid } = await ctx.params;
  const c = await getCandidate(id).catch(() => null);
  if (!c || !c.practicals.some((p) => p.id === pid)) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
  const submission = await getPracticalSubmission(pid);
  return NextResponse.json({ submission, serverNow: Date.now() });
}
