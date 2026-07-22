// Build + post the "client win" Slack announcement for a freshly generated
// monthly report. Fires once per client+period (the first generation) into the
// dedicated #client-wins channel, @channel-tagged, carrying the report's
// Executive Summary (positive-only highlights = the month's main wins).
// Everything is a no-op when SLACK_CLIENT_WINS_WEBHOOK_URL isn't set, so the
// feature stays inert until the webhook is wired on Vercel.

import {
  clientWinsSlackConfigured,
  postClientWinToSlack,
} from "@/lib/slack";
import type { MonthlyReportSnapshot } from "./report-types";

/** Markdown → Slack mrkdwn: `**bold**` → `*bold*`. The exec-summary bullets
 *  use `**…**`; backticks + emoji already render natively in Slack. */
function toSlackMrkdwn(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "*$1*");
}

/** Block Kit payload announcing a client win. `origin` is the request origin
 *  (e.g. https://wonder-ads-workspace.vercel.app) used to link the report. */
export function buildClientWinMessage(
  snap: MonthlyReportSnapshot,
  origin: string,
) {
  const pt = snap.lang !== "en";
  const t = (p: string, e: string) => (pt ? p : e);

  const header = `:trophy: ${t("Vitória de cliente", "Client win")} — *${snap.clientTitle}* · ${snap.periodLabel}`;

  // Exec summary = the month's main wins. Fall back to a neutral line in the
  // rare case the report has no positive highlights (e.g. both GA4 + GSC
  // fetches failed) so the channel still gets a consistent one-post-per-report.
  const wins =
    snap.execSummary.length > 0
      ? snap.execSummary.map((h) => `• ${toSlackMrkdwn(h)}`).join("\n")
      : t(
          "• Relatório do mês gerado — destaques no link abaixo.",
          "• Monthly report generated — highlights in the link below.",
        );

  const reportUrl = `${origin}/seo/${snap.slug}/report/${snap.period}`;
  const footer = [
    `<${reportUrl}|${t("Abrir relatório", "Open report")}>`,
    snap.consultant?.name
      ? t(`Consultor: ${snap.consultant.name}`, `Consultant: ${snap.consultant.name}`)
      : "",
    t("Relatório mensal SEO", "SEO monthly report"),
  ]
    .filter(Boolean)
    .join("  ·  ");

  // `<!channel>` in both the notification text and the header block pings the
  // whole channel (Andre's "identifique o channel todo").
  return {
    text: `<!channel> ${header}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `<!channel>\n${header}` },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${t("Destaques do mês", "Highlights of the month")}*\n${wins}`,
        },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: footer }],
      },
    ],
  };
}

/** Post the win to #client-wins. Never throws; no-op (returns false) when the
 *  webhook isn't configured or Slack rejects the message. */
export async function notifyClientWin(
  snap: MonthlyReportSnapshot,
  origin: string,
): Promise<boolean> {
  if (!clientWinsSlackConfigured()) return false;
  try {
    return await postClientWinToSlack(buildClientWinMessage(snap, origin));
  } catch (err) {
    console.error("[client-wins] slack notify failed:", err);
    return false;
  }
}
