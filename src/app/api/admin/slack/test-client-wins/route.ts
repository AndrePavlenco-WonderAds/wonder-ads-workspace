// Confirm the #client-wins webhook is wired without pinging the whole channel.
//
// GET            → { configured } — is SLACK_CLIENT_WINS_WEBHOOK_URL set?
// GET ?send=1    → also posts a small TEST message (no @channel) to the channel,
//                  so you can verify the URL is correct without a real @channel
//                  blast. The real win posts happen on Finalizar.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { clientWinsSlackConfigured, postClientWinToSlack } from "@/lib/slack";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const configured = clientWinsSlackConfigured();
  const send = new URL(req.url).searchParams.get("send") === "1";

  if (!send) {
    return NextResponse.json({
      configured,
      hint: configured
        ? "Webhook configurado. Abre com ?send=1 para enviar uma mensagem de teste (sem @channel)."
        : "Falta a env var SLACK_CLIENT_WINS_WEBHOOK_URL na Vercel (ou o deploy ainda não a apanhou).",
    });
  }

  if (!configured) {
    return NextResponse.json(
      { configured, sent: false, error: "SLACK_CLIENT_WINS_WEBHOOK_URL não definido." },
      { status: 503 },
    );
  }

  // Deliberately NO <!channel> — this is a plumbing test, not a win.
  const sent = await postClientWinToSlack({
    text: "🔌 Teste de ligação ao #client-wins — funciona ✓ (mensagem de teste, sem @channel).",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":electric_plug: *Teste de ligação ao #client-wins* — funciona ✓\n_Mensagem de teste. Os avisos reais (com @channel + resumo do mês) saem ao finalizar um relatório._",
        },
      },
    ],
  });

  return NextResponse.json({ configured, sent });
}
