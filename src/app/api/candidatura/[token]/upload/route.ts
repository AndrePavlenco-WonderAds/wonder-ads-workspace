// Recrutamento (v80.16) — o upload do PDF das prioridades (ponto 2.1) pelo
// candidato. O browser envia o ficheiro direto para o Blob; esta rota só
// passa o token de upload, e só a um link válido com a prova por entregar.
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { MAX_PDF_BYTES } from "@/lib/recrutamento/practical";
import { getPracticalSubmission, practicalLinkClosed, resolvePracticalToken } from "@/lib/recrutamento/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const r = await resolvePracticalToken(token);
        if (!r || practicalLinkClosed(r.candidate)) throw new Error("Este link já não está ativo.");
        const sub = await getPracticalSubmission(r.practical.id);
        if (sub.submittedAt) throw new Error("A prova já foi entregue.");
        if (!pathname.startsWith(`recrutamento/${r.practical.id}/`)) throw new Error("Caminho inválido.");
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // O browser grava o ficheiro nas respostas quando o upload acaba.
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload falhou." }, { status: 400 });
  }
}
