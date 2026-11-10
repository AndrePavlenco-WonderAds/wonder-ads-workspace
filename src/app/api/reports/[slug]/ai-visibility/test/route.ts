// Testar o plugin «WonderAds — IA no site» de um cliente (v78.87).
//   POST /api/reports/<slug>/ai-visibility/test
//
// Usa o site e a chave gravados na config do cliente: confirma que o plugin
// responde e que um pedido de IA chega ao WordPress (não à cache de página).
// O pedido de teste é registado à parte pelo plugin — não entra nas contas.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getReportConfig } from "@/lib/report/report-config-store";
import { testAiPlugin } from "@/lib/report/wp-ai-visibility";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { slug } = await params;
  const config = await getReportConfig(slug);
  if (!config.aiVisibilitySite || !config.aiVisibilityKey) {
    return NextResponse.json(
      { error: "Grava primeiro o endereço do site e a chave do plugin." },
      { status: 400 },
    );
  }
  const result = await testAiPlugin(config.aiVisibilitySite, config.aiVisibilityKey);
  return NextResponse.json(result);
}
