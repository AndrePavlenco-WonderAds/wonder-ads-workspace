// Os botões «Aprovar / Recusar» do #ausencias batem aqui.
//
// ROTA PÚBLICA DE PROPÓSITO — quem chama é o Slack, não um browser com
// sessão. A autenticação é a assinatura HMAC do próprio Slack
// (SLACK_SIGNING_SECRET): sem secret configurado, o endpoint recusa tudo;
// com secret, só payloads assinados nos últimos 5 minutos passam.
//
// QUEM CLICOU também não se aceita de cara: o Slack user id tem de estar
// mapeado em SLACK_USER_IDS para um username com isAdmin. Um estagiário no
// canal a carregar no botão recebe uma resposta efémera a dizer que a
// decisão é do C-Level — e o pedido fica exatamente como estava.
//
// Setup (uma vez, na Slack app do workspace):
//   Interactivity & Shortcuts → ON → Request URL:
//   https://wonder-ads-workspace.vercel.app/api/slack/absences

import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  getEmployeeDisplay,
  isAdminUsername,
  SLACK_USER_IDS,
} from "@/lib/auth/credentials";
import { decideAbsence } from "@/lib/absences-store";
import { absenceBlocks, outcomeLine } from "@/lib/absences-slack";

export const runtime = "nodejs";

/** Slack exige resposta em 3s; qualquer coisa acima de 2.5s de trabalho
 *  interno é pedir um retry duplicado. As operações aqui são 2–3 KVs. */

function verifySlackSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = `v0=${createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Slack user id → username do workspace (o mapa inverso de SLACK_USER_IDS). */
function usernameForSlackId(slackId: string): string | null {
  for (const [username, id] of Object.entries(SLACK_USER_IDS)) {
    if (id === slackId) return username;
  }
  return null;
}

/** Resposta pelo response_url — efémera (só quem clicou vê) ou substituição
 *  da mensagem original. Never-throws: um POST falhado ao Slack não pode
 *  derrubar o handler. */
async function respondViaUrl(url: string, payload: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
  } catch (err) {
    console.error("[slack] response_url post failed:", err);
  }
}

type SlackAction = { action_id?: string; value?: string };
type SlackInteractivePayload = {
  type?: string;
  user?: { id?: string; username?: string; name?: string };
  response_url?: string;
  actions?: SlackAction[];
};

export async function POST(req: Request) {
  const rawBody = await req.text();
  const ok = verifySlackSignature(
    rawBody,
    req.headers.get("x-slack-request-timestamp"),
    req.headers.get("x-slack-signature"),
  );
  if (!ok) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  let payload: SlackInteractivePayload;
  try {
    const params = new URLSearchParams(rawBody);
    payload = JSON.parse(params.get("payload") ?? "{}");
  } catch {
    return NextResponse.json({ error: "payload ilegível" }, { status: 400 });
  }

  if (payload.type !== "block_actions" || !payload.response_url) {
    // Outros tipos (view_submission etc.) não existem neste fluxo.
    return NextResponse.json({});
  }
  const responseUrl = payload.response_url;

  const action = (payload.actions ?? []).find(
    (a) => a.action_id === "absence-approve" || a.action_id === "absence-reject",
  );
  if (!action?.value) return NextResponse.json({});
  const absenceId = action.value;
  const approve = action.action_id === "absence-approve";

  // Quem é o dedo no botão?
  const slackId = payload.user?.id ?? "";
  const username = slackId ? usernameForSlackId(slackId) : null;
  if (!username || !isAdminUsername(username)) {
    await respondViaUrl(responseUrl, {
      response_type: "ephemeral",
      replace_original: false,
      text: username
        ? "🔒 Só o C-Level (André, Alex, Alice) pode decidir pedidos de ausência."
        : "🔒 A tua conta Slack não está associada a nenhum superadmin do workspace. Pede ao André para adicionar o teu Slack member ID em SLACK_USER_IDS.",
    });
    return NextResponse.json({});
  }
  const display = getEmployeeDisplay(username);

  let result;
  try {
    result = await decideAbsence(absenceId, {
      status: approve ? "approved" : "rejected",
      decidedBy: username,
      decidedByName: display?.name ?? username,
      note: null,
      via: "slack",
    });
  } catch (err) {
    console.error("Ausências (Slack): decisão falhou:", err);
    await respondViaUrl(responseUrl, {
      response_type: "ephemeral",
      replace_original: false,
      text: "⚠️ Não consegui gravar a decisão (KV indisponível). Tenta na app: /admin/ausencias.",
    });
    return NextResponse.json({});
  }

  if (!result.ok) {
    if (result.reason === "not-found") {
      await respondViaUrl(responseUrl, {
        response_type: "ephemeral",
        replace_original: false,
        text: "⚠️ Este pedido já não existe no workspace.",
      });
      return NextResponse.json({});
    }
    // Já decidido (pelo outro superadmin, ou na app) — conserta a mensagem
    // original, que ainda tinha botões, e conta quem foi.
    const r = result.record;
    await respondViaUrl(responseUrl, {
      replace_original: true,
      text: `Pedido de ausência ${r.ref} de ${r.name} — ${r.status === "approved" ? "aprovado" : "recusado"} por ${r.decidedByName ?? "—"}.`,
      blocks: absenceBlocks(r, { withActions: false, outcomeLine: outcomeLine(r) }),
    });
    return NextResponse.json({});
  }

  const decided = result.record;
  await respondViaUrl(responseUrl, {
    replace_original: true,
    text: `Pedido de ausência ${decided.ref} de ${decided.name} — ${decided.status === "approved" ? "aprovado" : "recusado"} por ${decided.decidedByName ?? "—"}.`,
    blocks: absenceBlocks(decided, {
      withActions: false,
      outcomeLine: outcomeLine(decided),
    }),
  });

  return NextResponse.json({});
}

/** Responde ao "ping" de quem cola o Request URL no painel da Slack app. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "absences-interactivity" });
}
