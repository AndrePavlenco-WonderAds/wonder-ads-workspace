// A resposta HTTP de um PDF de probation: descarga com o nome certo
// («Plano de Probation - <consultor>.pdf», com acentos via filename*) e sem
// cache em lado nenhum — é um documento de RH.

import "server-only";
import { NextResponse } from "next/server";
import { buildProbationPdf } from "./pdf";
import type { DocModel } from "./document";

function asciiFallback(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\]/g, "");
}

export async function pdfResponse(model: DocModel, fileName: string): Promise<NextResponse> {
  try {
    const bytes = await buildProbationPdf(model, fileName.replace(/\.pdf$/, ""));
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${asciiFallback(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Probation: PDF falhou:", err instanceof Error ? err.message : "erro");
    return NextResponse.json(
      { error: "Não foi possível gerar o PDF." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
