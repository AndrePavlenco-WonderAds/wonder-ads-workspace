// GET /api/probation/pdf?plano=<id>&periodo=<n> — o PDF do plano que FOI
// ENVIADO ao consultor (a fotografia, não o rascunho da direção), com a
// confirmação de leitura dele por baixo da assinatura. Só o próprio: o
// username vem da sessão e um plano alheio responde 404.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getPublished } from "@/lib/probation/store";
import { docForDisplay } from "@/lib/probation/published";
import { pdfFileName } from "@/lib/probation/document";
import { pdfResponse } from "@/lib/probation/pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: NO_STORE });
  const url = new URL(req.url);
  const id = (url.searchParams.get("plano") ?? "").slice(0, 64);
  const pub = id ? await getPublished(id) : null;
  if (!pub || pub.consultantUsername !== me.username) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404, headers: NO_STORE });
  }
  const n = Number(url.searchParams.get("periodo") ?? "");
  const period = Number.isInteger(n)
    ? pub.periods.find((p) => p.index === n - 1)
    : pub.periods.filter((p) => p.doc).at(-1);
  if (!period?.doc) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404, headers: NO_STORE });
  }
  return pdfResponse(docForDisplay(period.doc), pdfFileName(pub.consultantName, period.doc.model.periodLabel));
}
