// Ligar o aviso de NPS ao grupo de WhatsApp do DPT de SEO (via Whapi.cloud).
//
// GET            → { tokenConfigured, groupConfigured } — estão as env vars?
// GET ?groups=1  → lista os grupos em que o número ligado está (id + nome),
//                  para copiar o id do grupo de SEO para WHATSAPP_SEO_GROUP_ID.
//                  Gasta 1 pedido da quota mensal da Whapi — não é para polling.
// GET ?send=1    → envia uma mensagem de TESTE para o grupo configurado. Os
//                  avisos reais saem sozinhos quando um cliente submete o NPS.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import {
  listWhatsAppGroups,
  postToSeoWhatsAppGroup,
  seoGroupConfigured,
  seoGroupId,
  whatsappConfigured,
} from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const tokenConfigured = whatsappConfigured();
  const groupConfigured = seoGroupConfigured();
  const status = { tokenConfigured, groupConfigured, groupId: seoGroupId() ?? null };

  if (params.get("groups") === "1") {
    if (!tokenConfigured) {
      return NextResponse.json(
        { ...status, error: "WHAPI_TOKEN não definido na Vercel." },
        { status: 503 },
      );
    }
    const groups = await listWhatsAppGroups();
    if (!groups) {
      return NextResponse.json(
        { ...status, error: "A Whapi recusou o pedido — confirma o token e se o número está ligado (QR)." },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ...status,
      groups,
      hint: "Copia o `id` do grupo de SEO (acaba em @g.us) para WHATSAPP_SEO_GROUP_ID na Vercel e faz redeploy.",
    });
  }

  if (params.get("send") === "1") {
    if (!groupConfigured) {
      return NextResponse.json(
        { ...status, sent: false, error: "Falta WHAPI_TOKEN e/ou WHATSAPP_SEO_GROUP_ID na Vercel." },
        { status: 503 },
      );
    }
    const sent = await postToSeoWhatsAppGroup(
      "🔌 *Teste de ligação do Workspace* — funciona ✓\n_A partir de agora, cada NPS respondido por um cliente de SEO aparece aqui._",
    );
    return NextResponse.json({ ...status, sent });
  }

  return NextResponse.json({
    ...status,
    hint: !tokenConfigured
      ? "Falta WHAPI_TOKEN na Vercel (ou o deploy ainda não o apanhou)."
      : !groupConfigured
        ? "Token OK. Abre com ?groups=1 para veres o id do grupo de SEO."
        : "Tudo configurado. Abre com ?send=1 para enviar uma mensagem de teste ao grupo.",
  });
}
