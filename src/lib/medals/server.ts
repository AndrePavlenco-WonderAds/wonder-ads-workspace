// As medalhas de uma pessoa, do lado do servidor: lê as propostas (código
// + KV), resolve os consultores, constrói o leaderboard de sempre e aplica
// o catálogo. É o que o header (Suspense) e a página /medalhas chamam.
//
// Custo: as duas leituras de KV das propostas + uma da escolha + os números
// do SEO DPT em cache (v78.59, `facts.ts`). O header chama isto em todas as
// páginas, por isso nunca lança — devolve vazio.

import { getCurrentEmployee } from "@/lib/auth/server";
import { resolveProposalConsultant } from "@/lib/proposals/consultant";
import { buildLeaderboard, type Leaderboard, type LeaderboardRow } from "@/lib/proposals/leaderboard";
import { listAllProposals } from "@/lib/proposals/store";
import { computeEarned, resolveDisplay, type EarnedMedal, type Medal, type MedalFacts } from "./catalog";
import { getMedalFacts } from "./facts";
import { getDisplayChoice } from "./store";

export type UserMedals = {
  username: string;
  row: LeaderboardRow | null;
  board: Leaderboard;
  earned: EarnedMedal[];
  /** As que vão para o header (já filtradas ao que a pessoa tem). */
  display: Medal[];
  /** A escolha gravada, ou null se nunca escolheu. */
  chosen: string[] | null;
  /** Os números do SEO DPT da pessoa (null fora do SEO DPT). */
  facts: MedalFacts | null;
  /** O Producer of the Month mais recente, para a galeria. */
  producerName: string | null;
};

export async function getMedalsForUser(username: string): Promise<UserMedals> {
  const [proposals, chosen, book] = await Promise.all([listAllProposals(), getDisplayChoice(username), getMedalFacts()]);
  const items = proposals.map((record) => ({
    record,
    consultant: resolveProposalConsultant({
      clientSlug: record.clientSlug,
      consultant: record.consultant,
      consultantUsername: record.consultantUsername,
    }),
  }));
  const board = buildLeaderboard(items, null);
  const row = board.rows.find((r) => r.username === username) ?? null;
  const facts = book?.byUser[username] ?? null;
  const earned = computeEarned(row, board, facts);
  return {
    username,
    row,
    board,
    earned,
    display: resolveDisplay(chosen, earned),
    chosen,
    facts,
    producerName: book?.producerName ?? null,
  };
}

/** As medalhas da pessoa com sessão (a vista, com lente ativa). null sem
 *  sessão ou se algo falhar — o header nunca pode travar uma página. */
export async function getCurrentUserMedals(): Promise<UserMedals | null> {
  try {
    const employee = await getCurrentEmployee();
    if (!employee) return null;
    return await getMedalsForUser(employee.username);
  } catch (err) {
    console.error("medalhas: cálculo falhou:", err);
    return null;
  }
}
