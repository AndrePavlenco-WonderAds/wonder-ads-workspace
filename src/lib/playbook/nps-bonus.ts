// Bónus NPS dos consultores SEO (v78.5) — as regras e as contas.
//
// Módulo PURO: a página (servidor) junta a carteira e as respostas do mês e
// isto devolve, por consultor, o que ganha e porquê. As mesmas constantes
// desenham as tabelas da página — a regra escrita e a regra calculada são
// a mesma linha de código.
//
// Regras (André, 2026-10-26):
//   • Mensal. Em outubro apura-se setembro, e assim por diante.
//   • Nota de um projeto = o «Índice de satisfação» (overall, 0–10) da
//     resposta desse mês. Se o cliente respondeu duas vezes, conta a última.
//   • Projetos sem resposta no mês não entram na média.
//   • Taxa de preenchimento = projetos com resposta ÷ projetos da carteira.
//   • Individual: mais de 4 projetos E taxa ≥ 50%.
//   • Equipa: taxa ≥ 50%, seja qual for o n.º de projetos.
//   • A média conta com 2 casas, sem arredondar para cima: 8,49 não é 8,5.

export type BonusTier = { min: number; eur: number };

/** Do patamar mais alto para o mais baixo — o primeiro que passa ganha. */
export const INDIVIDUAL_TIERS: BonusTier[] = [
  { min: 10, eur: 300 },
  { min: 9, eur: 100 },
  { min: 8.5, eur: 50 },
  { min: 8, eur: 25 },
];

export const TEAM_TIERS: BonusTier[] = [
  { min: 10, eur: 150 },
  { min: 9.5, eur: 75 },
  { min: 9, eur: 50 },
  { min: 8.5, eur: 25 },
];

/** «Mais de 4 projetos» → 5 ou mais. */
export const INDIVIDUAL_MIN_PROJECTS = 5;
export const MIN_FILL_RATE = 0.5;

/** O primeiro mês medido — apurado em outubro de 2026. */
export const NPS_BONUS_FIRST_MONTH = "2026-09";

/** Média com 2 casas, cortada (nunca arredondada para cima). */
export function bonusAverage(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  // +1e-9 só para a vírgula flutuante não transformar 8,5 em 8,4999…
  return Math.floor(mean * 100 + 1e-9) / 100;
}

export function tierFor(avg: number | null, tiers: BonusTier[]): BonusTier | null {
  if (avg === null) return null;
  return tiers.find((t) => avg >= t.min) ?? null;
}

export type ProjectInput = {
  slug: string;
  name: string;
  /** Índice de satisfação da resposta do mês, ou null sem resposta. */
  score: number | null;
};

export type ConsultantInput = {
  username: string;
  name: string;
  projects: ProjectInput[];
};

export type BonusLine = {
  eligible: boolean;
  /** Porque não é elegível — vazio quando é. */
  reason: string | null;
  eur: number;
};

export type ConsultantMonth = {
  username: string;
  name: string;
  projects: ProjectInput[];
  filled: number;
  /** 0–1; null sem projetos. */
  fillRate: number | null;
  average: number | null;
  individual: BonusLine;
  team: BonusLine;
};

export type NpsBonusMonth = {
  month: string;
  /** Média de todas as respostas da equipa no mês. */
  teamAverage: number | null;
  teamResponses: number;
  teamProjects: number;
  teamTier: BonusTier | null;
  consultants: ConsultantMonth[];
  /** Soma do que a casa paga neste mês. */
  totalEur: number;
};

export function computeNpsBonusMonth(month: string, consultants: ConsultantInput[]): NpsBonusMonth {
  const allScores = consultants.flatMap((c) =>
    c.projects.map((p) => p.score).filter((s): s is number => s !== null),
  );
  const teamAverage = bonusAverage(allScores);
  const teamTier = tierFor(teamAverage, TEAM_TIERS);

  const rows: ConsultantMonth[] = consultants.map((c) => {
    const scores = c.projects.map((p) => p.score).filter((s): s is number => s !== null);
    const total = c.projects.length;
    const filled = scores.length;
    const fillRate = total ? filled / total : null;
    const average = bonusAverage(scores);
    const fillOk = fillRate !== null && fillRate >= MIN_FILL_RATE;

    let individual: BonusLine;
    if (total < INDIVIDUAL_MIN_PROJECTS) {
      individual = { eligible: false, reason: `${total} projeto${total === 1 ? "" : "s"} — precisa de 5+`, eur: 0 };
    } else if (!fillOk) {
      individual = { eligible: false, reason: "Preenchimento abaixo de 50%", eur: 0 };
    } else {
      const tier = tierFor(average, INDIVIDUAL_TIERS);
      individual = tier
        ? { eligible: true, reason: null, eur: tier.eur }
        : { eligible: true, reason: "Média abaixo de 8,0", eur: 0 };
    }

    let team: BonusLine;
    if (total === 0) {
      team = { eligible: false, reason: "Sem projetos", eur: 0 };
    } else if (!fillOk) {
      team = { eligible: false, reason: "Preenchimento abaixo de 50%", eur: 0 };
    } else {
      team = teamTier
        ? { eligible: true, reason: null, eur: teamTier.eur }
        : { eligible: true, reason: "Média da equipa abaixo de 8,5", eur: 0 };
    }

    return { username: c.username, name: c.name, projects: c.projects, filled, fillRate, average, individual, team };
  });

  rows.sort(
    (a, b) =>
      b.individual.eur + b.team.eur - (a.individual.eur + a.team.eur) ||
      (b.average ?? -1) - (a.average ?? -1) ||
      a.name.localeCompare(b.name, "pt"),
  );

  return {
    month,
    teamAverage,
    teamResponses: allScores.length,
    teamProjects: consultants.reduce((n, c) => n + c.projects.length, 0),
    teamTier,
    consultants: rows,
    totalEur: rows.reduce((n, r) => n + r.individual.eur + r.team.eur, 0),
  };
}

// ── Meses ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-09" do instante dado, no fuso de Lisboa. */
export function lisbonMonthKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
  }).format(ms);
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** «setembro 2026». */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** «8,50» — vírgula decimal, 2 casas. */
export function formatAvg(n: number | null): string {
  return n === null ? "—" : n.toFixed(2).replace(".", ",");
}
