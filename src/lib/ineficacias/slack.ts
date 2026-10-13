// O aviso à direção no Slack quando um relatório de ineficácias é assinado.
// Sem conteúdo (são dados de RH): nome, data, quantas ocorrências, link.
// O sino da app é o canal principal e deriva do registo; isto é um extra
// que nunca falha o pedido.

import "server-only";
import { APP_URL } from "@/lib/app-url";
import { postIneficaciasToSlack } from "@/lib/slack";
import { formatLisbonDateTime, type IneficaciaReport } from "./shared";

export async function announceReportSubmitted(report: IneficaciaReport): Promise<boolean> {
  const n = report.items.length;
  const what = `${n} ${n === 1 ? "ocorrência" : "ocorrências"} por pontuar`;
  const url = `${APP_URL}/admin/ineficacias/${encodeURIComponent(report.username)}?relatorio=${report.id}`;
  const signed = formatLisbonDateTime(report.signature.signedAt);
  const text = `📝 Relatório de ineficácias · ${report.ref} · ${report.name} · ${what}`;
  return postIneficaciasToSlack({
    text,
    blocks: [
      { type: "header", text: { type: "plain_text", text: `📝 Relatório de ineficácias · ${report.ref}`, emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Consultor*\n${report.name}` },
          { type: "mrkdwn", text: `*Ocorrências*\n${what}` },
          { type: "mrkdwn", text: `*Assinado*\n${signed} (Lisboa)` },
        ],
      },
      {
        type: "actions",
        elements: [
          { type: "button", text: { type: "plain_text", text: "Rever e pontuar", emoji: true }, url, style: "primary" },
        ],
      },
    ],
  });
}
