// GET /api/admin/probation/template/pdf — o Plano de Probation em branco,
// para imprimir e preencher à mão (só SuperAdmin). Os campos ficam com o
// marcador do protótipo ou com uma linha para escrever.

import { guardProbation } from "@/lib/probation/api-guard";
import { blankDocModel, pdfFileName } from "@/lib/probation/document";
import { pdfResponse } from "@/lib/probation/pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardProbation();
  if (!g.ok) return g.res;
  return pdfResponse(blankDocModel(), pdfFileName(null));
}
