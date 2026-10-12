// As submissões do consultor de um plano (só SuperAdmin) — o «Atualizar» do
// check-in semanal vai buscar aqui o que entrou desde que a página abriu.
//   GET → { submissions }

import { NextResponse } from "next/server";
import { guardProbation, NO_STORE } from "@/lib/probation/api-guard";
import { listSubmissions } from "@/lib/probation/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guardProbation();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  return NextResponse.json({ submissions: await listSubmissions(id) }, { headers: NO_STORE });
}
