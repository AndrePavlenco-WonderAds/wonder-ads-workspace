// POST /api/proposals/[slug]/confirm — o cliente clicou em «Confirmar a
// renovação» na proposta pública. Público de propósito (fora do matcher do
// middleware): quem confirma não tem sessão no workspace. Só aceita slugs de
// propostas que existem; regista e o sino do SuperAdmin trata do resto.

import { NextResponse } from "next/server";
import { getProposal } from "@/lib/proposals";
import { recordProposalConfirmation } from "@/lib/proposal-events-store";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ proposalSlug: string }> },
) {
  const { proposalSlug } = await ctx.params;
  const meta = getProposal(proposalSlug);
  if (!meta) {
    return NextResponse.json({ error: "Proposta desconhecida." }, { status: 404 });
  }
  try {
    const entry = await recordProposalConfirmation({
      proposalSlug: meta.slug,
      clientSlug: meta.clientSlug,
      clientName: meta.clientName,
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true, id: entry?.id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
