// GET /api/commercial/templates/[renovacao|cross-sell] — descarrega o
// template em PDF da proposta. Gerado a pedido com pdf-lib (não há ficheiro
// estático a manter); sessão obrigatória (middleware, /api/commercial/*).

import { NextResponse } from "next/server";
import { buildRenovacaoTemplatePdf } from "@/lib/proposals/templates/renovacao";
import { buildCrossSellTemplatePdf } from "@/lib/proposals/templates/cross-sell";

export const runtime = "nodejs";

const FILES: Record<string, { build: () => Promise<Uint8Array>; name: string }> = {
  renovacao: { build: buildRenovacaoTemplatePdf, name: "WonderAds_Template_Proposta_Renovacao.pdf" },
  "cross-sell": { build: buildCrossSellTemplatePdf, name: "WonderAds_Template_Proposta_Cross-sell.pdf" },
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ kind: string }> },
) {
  const { kind } = await ctx.params;
  const entry = FILES[kind];
  if (!entry) {
    return NextResponse.json({ error: "Template desconhecido." }, { status: 404 });
  }
  try {
    const bytes = await entry.build();
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${entry.name}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[templates] geração falhou:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
