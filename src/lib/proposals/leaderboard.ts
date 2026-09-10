// Leaderboard do Comercial — quem apresentou e fechou o quê, e por quanto.
//
// O PÓDIO ORDENA PELO VALOR FECHADO, não pelo número de fechos: um
// cross-sell de 5.000 € vale mais do que um de 700 €, e uma renovação de
// 36.000 € mais do que os dois juntos. «Fechado» = o cliente aceitou
// (decisão registada no Comercial). «Apresentado» = tudo o que saiu da
// gaveta: enviadas, aceites e recusadas — os rascunhos não contam.
// Desempate: n.º de fechos, depois n.º de apresentadas, depois o nome.
//
// Módulo puro: recebe as propostas já com o consultor resolvido (isso é
// do servidor, puxa as credenciais) e devolve linhas prontas a desenhar.

import type { ProposalConsultant } from "./consultant";
import type { ProposalRecord } from "./store";

export type LeaderboardRow = {
  /** username, ou o nome quando não há credencial (prospect assinado à mão). */
  key: string;
  username: string | null;
  name: string;
  role: string | null;
  avatar: string | null;
  /** Soma dos valores das propostas aceites (sem IVA). */
  closedValue: number;
  /** Soma dos valores de tudo o que foi apresentado. */
  presentedValue: number;
  closedRenovacoes: number;
  closedCrossSells: number;
  presentedRenovacoes: number;
  presentedCrossSells: number;
  declined: number;
  /** Fechadas ÷ apresentadas (0–1); null sem apresentadas. */
  closeRate: number | null;
  /** Fechadas sem valor — o pódio pode estar a subcontar esta pessoa. */
  closedWithoutValue: number;
};

export type Leaderboard = {
  /** Ano civil filtrado pela data da proposta, ou null = desde sempre. */
  year: number | null;
  rows: LeaderboardRow[];
  totals: {
    closedValue: number;
    presentedValue: number;
    closed: number;
    presented: number;
    closedWithoutValue: number;
  };
};

export type LeaderboardItem = {
  record: ProposalRecord;
  consultant: ProposalConsultant;
};

function blankRow(c: ProposalConsultant): LeaderboardRow {
  return {
    key: c.username ?? `name:${c.name.trim().toLowerCase()}`,
    username: c.username,
    name: c.name,
    role: c.role,
    avatar: c.avatar,
    closedValue: 0,
    presentedValue: 0,
    closedRenovacoes: 0,
    closedCrossSells: 0,
    presentedRenovacoes: 0,
    presentedCrossSells: 0,
    declined: 0,
    closeRate: null,
    closedWithoutValue: 0,
  };
}

export function closedCount(r: LeaderboardRow): number {
  return r.closedRenovacoes + r.closedCrossSells;
}

export function presentedCount(r: LeaderboardRow): number {
  return r.presentedRenovacoes + r.presentedCrossSells;
}

export function buildLeaderboard(items: LeaderboardItem[], year: number | null): Leaderboard {
  const rows = new Map<string, LeaderboardRow>();
  const totals = { closedValue: 0, presentedValue: 0, closed: 0, presented: 0, closedWithoutValue: 0 };

  for (const { record, consultant } of items) {
    if (record.status === "rascunho") continue;
    if (year !== null && !record.date.startsWith(`${year}-`)) continue;
    const key = consultant.username ?? `name:${consultant.name.trim().toLowerCase()}`;
    const row = rows.get(key) ?? blankRow(consultant);
    const value = record.valueEur ?? 0;
    const isRenovacao = record.kind === "renovacao";

    if (isRenovacao) row.presentedRenovacoes += 1;
    else row.presentedCrossSells += 1;
    row.presentedValue += value;
    totals.presented += 1;
    totals.presentedValue += value;

    if (record.status === "aceite") {
      if (isRenovacao) row.closedRenovacoes += 1;
      else row.closedCrossSells += 1;
      row.closedValue += value;
      totals.closed += 1;
      totals.closedValue += value;
      if (record.valueEur === null) {
        row.closedWithoutValue += 1;
        totals.closedWithoutValue += 1;
      }
    } else if (record.status === "recusada") {
      row.declined += 1;
    }
    rows.set(key, row);
  }

  const list = Array.from(rows.values()).map((r) => ({
    ...r,
    closeRate: presentedCount(r) ? closedCount(r) / presentedCount(r) : null,
  }));
  list.sort(
    (a, b) =>
      b.closedValue - a.closedValue ||
      closedCount(b) - closedCount(a) ||
      presentedCount(b) - presentedCount(a) ||
      a.name.localeCompare(b.name, "pt"),
  );
  return { year, rows: list, totals };
}
