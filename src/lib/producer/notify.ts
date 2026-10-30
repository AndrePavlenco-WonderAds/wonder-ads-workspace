// O anúncio do Producer of the Month no #team-wins (v78.58). Só corre
// quando a direção elege um 1.º lugar novo para o mês — a app nunca anuncia
// sozinha. Nunca lança.

import "server-only";
import { APP_URL } from "@/lib/app-url";
import { postTeamWinToSlack, teamWinsSlackConfigured } from "@/lib/slack";
import { producerMonthLabel, producerMonthName, type ProducerElection, type ProducerRow } from "./shared";

const PLACES = ["🥇", "🥈", "🥉"];

function avg(n: number | null): string {
  return n === null ? "sem respostas" : n.toFixed(2).replace(".", ",");
}

/** «NPS 9,50 · 42 blocos do roadmap · 1 cross-sell · 2 renovações». */
function numbers(row: ProducerRow | undefined): string {
  if (!row) return "";
  const parts = [`NPS ${avg(row.nps.average)}`, `${row.blocks} ${row.blocks === 1 ? "bloco" : "blocos"} do roadmap`];
  if (row.crossSells.count) parts.push(`${row.crossSells.count} ${row.crossSells.count === 1 ? "cross-sell/upsell" : "cross-sells/upsells"}`);
  if (row.renewals.count) parts.push(`${row.renewals.count} ${row.renewals.count === 1 ? "renovação" : "renovações"}`);
  return parts.join(" · ");
}

export function buildProducerMessage(e: ProducerElection, imageUrl: string | null): { text: string; blocks: unknown[] } {
  const winner = e.podium[0];
  const row = e.snapshot.find((r) => r.username === winner.username);
  const headline = `🏆 Producer of the Month — ${producerMonthName(e.month)}`;
  const text = `<!channel> ${winner.name} é o Producer of the Month de ${producerMonthLabel(e.month)}!`;
  const podium = e.podium.map((p, i) => `${PLACES[i]} *${p.name}*`).join("   ");
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: headline, emoji: true } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<!channel> A direção elegeu *${winner.name}* como Producer of the Month de ${producerMonthLabel(e.month)}.${row ? `\n${numbers(row)}` : ""}`,
      },
    },
  ];
  if (imageUrl) blocks.push({ type: "image", image_url: imageUrl, alt_text: "Medalha Producer of the Month" });
  if (e.podium.length > 1) blocks.push({ type: "section", text: { type: "mrkdwn", text: `*O pódio:* ${podium}` } });
  if (e.note) blocks.push({ type: "section", text: { type: "mrkdwn", text: `_${e.note}_` } });
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `Eleito por ${e.electedByName || e.electedBy} · <${APP_URL}/medalhas|Ver as medalhas>` }],
  });
  return { text, blocks };
}

export async function announceProducer(e: ProducerElection): Promise<void> {
  try {
    if (!teamWinsSlackConfigured()) {
      console.warn(`producer: SLACK_TEAM_WINS_WEBHOOK_URL em falta — ${e.podium[0]?.name} eleito para ${e.month}`);
      return;
    }
    const ok = await postTeamWinToSlack(buildProducerMessage(e, `${APP_URL}/api/og/medal/producer-top.png`));
    if (!ok) console.error(`producer: post no #team-wins falhou (${e.month})`);
  } catch (err) {
    console.error("producer: anúncio falhou:", err instanceof Error ? err.message : err);
  }
}
