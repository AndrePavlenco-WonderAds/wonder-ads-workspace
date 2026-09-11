// Medalhas novas → #team-wins (v77.27).
//
// Depois de cada alteração às propostas (upload, tipo, decisão, valor,
// apagar) recalcula-se o leaderboard de sempre e, por consultor, compara-se
// o que tem AGORA com o que tinha da última vez (`medals:held:<username>`
// em KV). O que entrou de novo vai para o Slack — uma mensagem por pessoa,
// com todas as medalhas novas dela, a mais prestigiada em imagem. As «Top»
// podem sair e voltar a entrar: cada regresso avisa outra vez; perder não
// avisa ninguém.
//
// Corre em `after()` nas rotas — nunca atrasa a resposta, nunca lança.

import { kv } from "@vercel/kv";
import { APP_URL } from "@/lib/app-url";
import { resolveProposalConsultant } from "@/lib/proposals/consultant";
import { buildLeaderboard } from "@/lib/proposals/leaderboard";
import { listAllProposals } from "@/lib/proposals/store";
import { postTeamWinToSlack, teamWinsSlackConfigured } from "@/lib/slack";
import {
  MEDAL_FAMILIES,
  computeEarned,
  tierLabel,
  type EarnedMedal,
  type Medal,
} from "./catalog";

const HELD_PREFIX = "medals:held:";

const TIER_EMOJI: Record<number, string> = { 1: "🥉", 2: "🥈", 3: "🥇", 4: "💎", 5: "🔮" };

function emojiFor(medal: Medal): string {
  return medal.boss ? "👑" : TIER_EMOJI[medal.tier] ?? "🎖️";
}

function familyName(medal: Medal): string {
  return MEDAL_FAMILIES.find((f) => f.id === medal.family)?.name ?? medal.family;
}

/** URL pública da imagem da medalha (PNG gerado em /api/og/medal/<id>). */
export function medalImageUrl(medal: Medal): string {
  return `${APP_URL}/api/og/medal/${medal.id}.png`;
}

async function getHeld(username: string): Promise<string[] | null> {
  try {
    const raw = await kv.get<unknown>(`${HELD_PREFIX}${username}`);
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : null;
  } catch (err) {
    console.error("medalhas: leitura do estado falhou:", err);
    return null;
  }
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/** A mensagem do Slack para as medalhas novas de uma pessoa. Exportada
 *  para se poder pré-visualizar sem enviar. */
export function buildTeamWinMessage(input: {
  name: string;
  fresh: EarnedMedal[];
  totalEarned: number;
}): { text: string; blocks: unknown[] } {
  const fresh = [...input.fresh].sort((a, b) => b.medal.prestige - a.medal.prestige);
  const hero = fresh[0].medal;
  const many = fresh.length > 1;
  const headline = many
    ? `🎖️ ${fresh.length} medalhas novas para ${input.name}!`
    : `🎖️ Nova medalha para ${input.name}!`;
  const list = fresh
    .map(({ medal }) => `${emojiFor(medal)} *${medal.name}* · ${tierLabel(medal)} — ${medal.requirement}`)
    .join("\n");
  const text = `<!channel> ${headline} ${fresh.map(({ medal }) => medal.name).join(", ")}.`;
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: headline, emoji: true } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<!channel> ${emojiFor(hero)} *${hero.name}* — ${tierLabel(hero)} · ${familyName(hero)}\n_${hero.blurb}_`,
      },
    },
    { type: "image", image_url: medalImageUrl(hero), alt_text: `${hero.name} — ${hero.requirement}` },
  ];
  if (many) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Todas as novas:*\n${list}` } });
  }
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `🏆 ${input.name} tem agora ${input.totalEarned} ${input.totalEarned === 1 ? "medalha" : "medalhas"} · <${APP_URL}/medalhas|Ver a galeria> · <${APP_URL}/commercial|Pódio comercial>`,
      },
    ],
  });
  return { text, blocks };
}

/** Recalcula as medalhas de toda a gente, avisa o #team-wins das novas e
 *  guarda o estado. Nunca lança. */
export async function syncMedalsAndNotify(trigger: string): Promise<void> {
  try {
    const proposals = await listAllProposals();
    const items = proposals.map((record) => ({
      record,
      consultant: resolveProposalConsultant({
        clientSlug: record.clientSlug,
        consultant: record.consultant,
        consultantUsername: record.consultantUsername,
      }),
    }));
    const board = buildLeaderboard(items, null);
    for (const row of board.rows) {
      if (!row.username) continue;
      const earned = computeEarned(row, board);
      const earnedIds = earned.map((e) => e.medal.id);
      const held = (await getHeld(row.username)) ?? [];
      const heldSet = new Set(held);
      const fresh = earned.filter((e) => !heldSet.has(e.medal.id));
      if (fresh.length > 0) {
        if (teamWinsSlackConfigured()) {
          const ok = await postTeamWinToSlack(
            buildTeamWinMessage({ name: row.name, fresh, totalEarned: earned.length }),
          );
          if (!ok) console.error(`medalhas: post no #team-wins falhou (${row.username}, ${trigger})`);
        } else {
          console.warn(`medalhas: SLACK_TEAM_WINS_WEBHOOK_URL em falta — ${row.name} ganhou ${fresh.map((e) => e.medal.id).join(", ")}`);
        }
      }
      if (!sameSet(held, earnedIds)) {
        await kv.set(`${HELD_PREFIX}${row.username}`, earnedIds);
      }
    }
  } catch (err) {
    console.error(`medalhas: sincronização falhou (${trigger}):`, err);
  }
}
