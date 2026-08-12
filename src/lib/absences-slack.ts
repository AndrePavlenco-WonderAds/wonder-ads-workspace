// A folha de ausência em Block Kit — o que aterra no #ausencias.
//
// A mensagem leva TUDO o que o colaborador preencheu (é um requisito do
// C-Level: decidir do Slack sem abrir a app) + dois botões de decisão. Os
// botões só funcionam quando a Slack app tiver Interactivity ligada a
// apontar para /api/slack/absences — sem isso a mensagem continua a chegar
// inteira, apenas com botões inertes.
//
// Quem decide NA APP não consegue editar a mensagem original (webhooks não
// dão update fora do response_url dos 30 minutos) — por isso publica-se uma
// segunda mensagem curta com o desfecho, para o canal contar a história
// completa. Quem decide NO SLACK vê a original reescrita na hora, via
// response_url.

import { formatDateTime } from "./dates";
import {
  absenceDurationLine,
  absencePeriodLine,
  type AbsenceRequest,
} from "./absences-shared";
import { postAusenciasToSlack } from "./slack";

const periodLine = absencePeriodLine;
const durationLine = absenceDurationLine;

/** Blocos com a folha completa. `withActions` = com botões de decisão. */
export function absenceBlocks(
  a: AbsenceRequest,
  opts: { withActions: boolean; outcomeLine?: string },
): unknown[] {
  const fields: { title: string; value: string }[] = [
    { title: "Colaborador", value: `*${a.name}*\n${a.role || "—"} · ${a.dept || "—"}` },
    { title: "Motivo", value: a.reasonLabel },
    { title: "Período", value: periodLine(a) },
    { title: "Duração", value: durationLine(a) },
  ];
  if (a.contact) fields.push({ title: "Contacto na ausência", value: a.contact });
  if (a.handover) fields.push({ title: "Passagem de trabalho", value: a.handover });

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📋 Pedido de ausência · ${a.ref}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: fields.map((f) => ({
        type: "mrkdwn",
        text: `*${f.title}*\n${f.value}`,
      })),
    },
  ];

  if (a.details) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Detalhe do motivo*\n>${a.details.replace(/\n/g, "\n>")}` },
    });
  }
  if (a.attachment) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Comprovativo*\n<${a.attachment.url}|${a.attachment.name}>`,
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `✍️ Assinado por *${a.signatureName}* · submetido ${formatDateTime(a.createdAt)}`,
      },
    ],
  });

  if (opts.outcomeLine) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: opts.outcomeLine },
    });
  }

  if (opts.withActions) {
    blocks.push({
      type: "actions",
      block_id: `absence-decision:${a.id}`,
      elements: [
        {
          type: "button",
          style: "primary",
          action_id: "absence-approve",
          value: a.id,
          text: { type: "plain_text", text: "✅ Aprovar", emoji: true },
          confirm: {
            title: { type: "plain_text", text: "Aprovar ausência" },
            text: {
              type: "mrkdwn",
              text: `Aprovar o pedido ${a.ref} de ${a.name} (${periodLine(a)})?`,
            },
            confirm: { type: "plain_text", text: "Aprovar" },
            deny: { type: "plain_text", text: "Cancelar" },
          },
        },
        {
          type: "button",
          style: "danger",
          action_id: "absence-reject",
          value: a.id,
          text: { type: "plain_text", text: "❌ Recusar", emoji: true },
          confirm: {
            title: { type: "plain_text", text: "Recusar ausência" },
            text: {
              type: "mrkdwn",
              text: `Recusar o pedido ${a.ref} de ${a.name}? Para recusar com justificação escrita, usa o Control Suite.`,
            },
            confirm: { type: "plain_text", text: "Recusar" },
            deny: { type: "plain_text", text: "Cancelar" },
          },
        },
      ],
    });
  }

  return blocks;
}

/** A linha de desfecho que substitui os botões depois da decisão. */
export function outcomeLine(a: AbsenceRequest): string {
  const verb = a.status === "approved" ? "✅ *Aprovada*" : "❌ *Recusada*";
  const via = a.decidedVia === "slack" ? "no Slack" : "no Control Suite";
  const note = a.decisionNote ? `\n>_${a.decisionNote}_` : "";
  return `${verb} por *${a.decidedByName ?? a.decidedBy ?? "—"}* ${via} · ${formatDateTime(a.decidedAt ?? Date.now())}${note}`;
}

/** Mensagem nova no #ausencias quando um pedido é criado. */
export async function announceAbsenceRequest(a: AbsenceRequest): Promise<void> {
  await postAusenciasToSlack({
    text: `Pedido de ausência ${a.ref}: ${a.name} — ${a.reasonLabel}, ${periodLine(a)} (${durationLine(a)})`,
    blocks: absenceBlocks(a, { withActions: true }),
  });
}

/** Mensagem curta com o desfecho — usada quando a decisão acontece NA APP
 *  (a mensagem original do Slack já não é editável a essa hora). */
export async function announceAbsenceDecision(a: AbsenceRequest): Promise<void> {
  const verb = a.status === "approved" ? "✅ aprovada" : "❌ recusada";
  await postAusenciasToSlack({
    text: `A ausência ${a.ref} de ${a.name} foi ${verb} por ${a.decidedByName ?? "—"}.`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `A ausência *${a.ref}* de *${a.name}* (${periodLine(a)}) foi ${verb} por *${a.decidedByName ?? "—"}* no Control Suite.${a.decisionNote ? `\n>_${a.decisionNote}_` : ""}`,
        },
      },
    ],
  });
}
