// Producer of the Month (v78.58) — o levantamento mensal do SEO DPT e a
// eleição da direção. Puro: tipos, a pontuação de referência e as datas.
//
// O levantamento de um mês fechado junta, por consultor SEO:
//   • NPS — a média do «Índice de satisfação» das respostas desse mês (a
//     mesma conta do Bónus NPS);
//   • blocos do roadmap — tarefas dos roadmaps dos clientes dele marcadas
//     como «implemented» nesse mês;
//   • cross-sells / upsells e renovações — propostas aceites nesse mês;
//   • ineficácias — as pontuadas pela direção com data nesse mês (tiram).
//
// A pontuação é só uma ajuda para ordenar a tabela. A APP NUNCA ESCOLHE:
// quem é o Producer of the Month (e o 2.º e o 3.º do pódio) é a direção que
// elege, na página do levantamento (pedido do André, 2026-10-30).

export const PRODUCER_FIRST_MONTH = "2026-09";

/** Os pesos da pontuação de referência. Mudar aqui muda a tabela e o texto
 *  «Como se calcula» da página. */
export const PRODUCER_WEIGHTS = {
  /** Pontos por cada ponto da média NPS (9,50 → 95). Sem respostas, 0. */
  npsPerPoint: 10,
  /** Por cada bloco do roadmap concluído no mês. */
  perBlock: 1,
  /** Por cada cross-sell / upsell fechado. */
  perCrossSell: 25,
  /** Por cada renovação fechada. */
  perRenewal: 25,
  /** Tirados por cada ponto de PA das ineficácias do mês. */
  perIneficaciaPoint: 3,
} as const;

export type ProducerRow = {
  username: string;
  name: string;
  avatar: string | null;
  nps: {
    /** Média do mês (2 casas, sem arredondar para cima); null sem respostas. */
    average: number | null;
    /** Projetos com resposta no mês. */
    answered: number;
    /** Projetos ativos da carteira. */
    projects: number;
  };
  /** Tarefas do roadmap marcadas como feitas no mês. */
  blocks: number;
  crossSells: { count: number; eur: number };
  renewals: { count: number; eur: number };
  /** Ineficácias pontuadas com data no mês. */
  ineficacias: { no: number; pa: number };
  /** A pontuação de referência e as suas parcelas. */
  score: number;
  parts: { nps: number; blocks: number; deals: number; ineficacias: number };
};

export type ProducerPlace = { username: string; name: string };

export type ProducerElection = {
  month: string;
  /** 1.º, 2.º e 3.º, por esta ordem. Só o 1.º é obrigatório. */
  podium: ProducerPlace[];
  /** Porque é que a direção escolheu assim (opcional). */
  note: string;
  electedBy: string;
  electedByName: string;
  electedAt: number;
  /** O levantamento como estava no dia da eleição. */
  snapshot: ProducerRow[];
};

export const MAX_PRODUCER_NOTE = 600;

type Counts = Omit<ProducerRow, "score" | "parts">;

export function scoreRow(r: Counts): ProducerRow {
  const w = PRODUCER_WEIGHTS;
  const parts = {
    nps: r.nps.average === null ? 0 : Math.round(r.nps.average * w.npsPerPoint * 10) / 10,
    blocks: r.blocks * w.perBlock,
    deals: r.crossSells.count * w.perCrossSell + r.renewals.count * w.perRenewal,
    ineficacias: -r.ineficacias.pa * w.perIneficaciaPoint,
  };
  const score = Math.round((parts.nps + parts.blocks + parts.deals + parts.ineficacias) * 10) / 10;
  return { ...r, score, parts };
}

/** Do maior para o menor; empate → mais blocos, depois o nome. */
export function sortRows(rows: ProducerRow[]): ProducerRow[] {
  return rows.slice().sort((a, b) => b.score - a.score || b.blocks - a.blocks || a.name.localeCompare(b.name, "pt"));
}

export function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

function shift(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Os meses que já fecharam e se podem eleger, do mais recente para o mais
 *  antigo. `currentMonth` = o mês de hoje em Lisboa. */
export function electableMonths(currentMonth: string): string[] {
  const out: string[] = [];
  for (let m = shift(currentMonth, -1); m >= PRODUCER_FIRST_MONTH; m = shift(m, -1)) out.push(m);
  return out;
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** «outubro 2026». */
export function producerMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** «Outubro» — para títulos curtos. */
export function producerMonthName(key: string): string {
  const name = MONTHS[Number(key.slice(5, 7)) - 1] ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}
