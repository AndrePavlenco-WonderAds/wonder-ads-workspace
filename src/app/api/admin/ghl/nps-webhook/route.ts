// Ligar o aviso de NPS ao workflow do GHL (WhatsApp privado).
//
// GET          → { configured } — está GHL_NPS_WEBHOOK_URL na Vercel?
// GET ?send=1  → envia UM pedido de exemplo, só para o André (nunca para os
//                consultores). Serve para duas coisas: o «pedido de exemplo»
//                que o gatilho Inbound Webhook do GHL precisa de receber para
//                mapear os campos, e — com o workflow já publicado — testar o
//                WhatsApp de ponta a ponta.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { ghlNpsWebhookConfigured, postToGhlNpsWebhook } from "@/lib/ghl";
import { buildNpsGhlPayloads, NPS_ALWAYS_NOTIFY } from "@/lib/nps-whatsapp";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const configured = ghlNpsWebhookConfigured();
  if (new URL(req.url).searchParams.get("send") !== "1") {
    return NextResponse.json({
      configured,
      hint: configured
        ? "Webhook configurado. Abre com ?send=1 para enviar um pedido de exemplo (só para o André)."
        : "Falta GHL_NPS_WEBHOOK_URL na Vercel (ou o deploy ainda não o apanhou).",
    });
  }

  if (!configured) {
    return NextResponse.json(
      { configured, sent: false, error: "GHL_NPS_WEBHOOK_URL não definido." },
      { status: 503 },
    );
  }

  const origin = new URL(req.url).origin;
  const [sample] = buildNpsGhlPayloads({
    slug: "cliente-de-teste",
    clientTitle: "Cliente de teste",
    scores: {
      overall: 6.25,
      nps: 4,
      category: "detractor",
      satisfaction: 6,
      consultant: 7,
      progress: 8,
    },
    // Sem consultor → o único destinatário é o André.
    consultant: null,
    identification: "Pedido de teste do Workspace",
    npsUrl: `${origin}/seo`,
    submittedAt: Date.now(),
    isTest: true,
  });
  const sent = await postToGhlNpsWebhook(sample);
  return NextResponse.json({
    configured,
    sent,
    recipient: NPS_ALWAYS_NOTIFY.email,
    payload: sample,
  });
}
