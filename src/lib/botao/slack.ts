// «Acionar o Botão» → Slack (v80.37). Cada pedido novo vai para o canal do
// botão com tudo: quem, de que cliente (ou problema interno), o problema, as
// sugestões, se vai marcar reunião, quando e o link para o analisar na app.
// Never-throws: o Slack nunca impede o pedido de ficar gravado.

import "server-only";
import { APP_URL } from "@/lib/app-url";
import { getSlackUserId } from "@/lib/auth/credentials";
import { postBotaoToSlack } from "@/lib/slack";
import { botaoClientLabel, type BotaoRequest } from "./shared";

const ANDRE_SLACK_ID = process.env.SLACK_ANDRE_USER_ID || getSlackUserId("andre");

/** «24/11/2026 às 11:42», na hora de Lisboa (o servidor corre em UTC). */
function lisbonDateTime(ms: number): string {
  const parts = new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}:${get("minute")}`;
}

/** O texto do utilizador entra tal e qual, só sem os caracteres que o Slack
 *  lê como formatação de links e menções. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function botaoSlackPayload(r: BotaoRequest): { text: string; blocks: unknown[] } {
  const who = getSlackUserId(r.username);
  const whoLabel = who ? `<@${who}>` : esc(r.name);
  const client = botaoClientLabel(r);
  const link = `${APP_URL}/botao#${r.id}`;
  const next = r.meeting ? "📅 Vai marcar reunião (escolheu «Enviar e marcar reunião»)" : "📝 Só análise por escrito";
  const text = `🔴 ${esc(r.name)} acionou o botão — ${esc(client)}: ${esc(r.problem)}`;
  return {
    text,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "🔴 Botão acionado", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Quem*\n${whoLabel} · ${esc(r.dept || "—")}` },
          { type: "mrkdwn", text: `*Cliente*\n${esc(client)}` },
          { type: "mrkdwn", text: `*Quando*\n${lisbonDateTime(r.createdAt)}` },
          { type: "mrkdwn", text: `*Próximo passo*\n${next}` },
        ],
      },
      { type: "section", text: { type: "mrkdwn", text: `*O problema*\n>${esc(r.problem)}` } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${r.solutions.length === 1 ? "A sugestão de solução" : "As sugestões de solução"}*\n` +
            r.solutions.map((s, i) => `${i + 1}. ${esc(s)}`).join("\n"),
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Analisar e responder na app", emoji: true },
            url: link,
            style: "primary",
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `${ANDRE_SLACK_ID ? `<@${ANDRE_SLACK_ID}> · ` : ""}A resposta dada na app chega ao consultor na página do botão e no sino.`,
          },
        ],
      },
    ],
  };
}

export async function announceBotaoRequest(r: BotaoRequest): Promise<boolean> {
  try {
    return await postBotaoToSlack(botaoSlackPayload(r));
  } catch (err) {
    console.error("[botao] Slack falhou:", err instanceof Error ? err.message : err);
    return false;
  }
}
