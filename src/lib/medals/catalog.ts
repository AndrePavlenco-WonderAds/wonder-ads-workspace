// Medalhas — o catálogo (v77.25).
//
// O que se pode ganhar no Comercial e como. Oito famílias: cinco por
// patamar (Fechador, Apresentador, Faturação, Renovador, Cross-seller),
// duas por mérito (Sniper — taxa de fecho; Grande Caça — o maior negócio
// fechado) e as três de chefe («Top»): quem lidera AGORA em fechos, em
// propostas e em faturado. As de patamar ficam para sempre; as «Top» mudam
// de mãos quando a classificação muda — são as mais vistosas de propósito.
//
// Cada medalha tem um TIER visual (1–5): o desenho escala com ele — um
// chevron, depois estrelas, escudo, asas, coroa, brilho — para a medalha
// seguinte parecer sempre mais «pro» do que a anterior. O `level` é o
// numeral dentro da família (I–V). `prestige` ordena: é o que decide quais
// as três que vão para o header quando a pessoa ainda não escolheu.
//
// Módulo puro: sem servidor, para a galeria no browser o poder importar.

import { closedCount, presentedCount, type Leaderboard, type LeaderboardRow } from "@/lib/proposals/leaderboard";

export type MedalFamilyId =
  | "fechador"
  | "apresentador"
  | "faturacao"
  | "renovador"
  | "crossseller"
  | "sniper"
  | "grande-caca"
  | "top";

export type MedalTier = 1 | 2 | 3 | 4 | 5;

export type MedalGlyph = "check" | "plane" | "euro" | "cycle" | "sparkle" | "crosshair" | "diamond" | "star";

export type Medal = {
  id: string;
  family: MedalFamilyId;
  /** Tier visual 1–5 — decide o desenho. */
  tier: MedalTier;
  /** Numeral dentro da família («III»). */
  level: string;
  /** «Fechador III». */
  name: string;
  /** «5 propostas fechadas». */
  requirement: string;
  /** Medalha de chefe («Top …») — muda de mãos, desenho mais carregado. */
  boss: boolean;
  glyph: MedalGlyph;
  /** Ordena a galeria e escolhe as três do header por defeito. */
  prestige: number;
};

export type MedalFamily = {
  id: MedalFamilyId;
  name: string;
  description: string;
  /** Unidade da barra de progresso: «propostas», «€»… */
  unit: "count" | "eur" | "rate";
};

export const MEDAL_FAMILIES: MedalFamily[] = [
  { id: "top", name: "Top", description: "Quem lidera agora. Muda de mãos quando a classificação muda.", unit: "count" },
  { id: "fechador", name: "Fechador", description: "Propostas fechadas — o cliente aceitou.", unit: "count" },
  { id: "faturacao", name: "Faturação", description: "Valor total fechado, sem IVA.", unit: "eur" },
  { id: "grande-caca", name: "Grande Caça", description: "O maior negócio fechado numa só proposta.", unit: "eur" },
  { id: "apresentador", name: "Apresentador", description: "Propostas apresentadas — enviadas, aceites ou recusadas.", unit: "count" },
  { id: "renovador", name: "Renovador", description: "Renovações fechadas.", unit: "count" },
  { id: "crossseller", name: "Cross-seller", description: "Cross-sells fechados.", unit: "count" },
  { id: "sniper", name: "Sniper", description: "Taxa de fecho — fechadas ÷ apresentadas, com um mínimo de propostas.", unit: "rate" },
];

const ROMAN = ["I", "II", "III", "IV", "V"];

function ladder(
  family: MedalFamilyId,
  name: string,
  glyph: MedalGlyph,
  steps: Array<{ threshold: number; tier: MedalTier; requirement: string }>,
  base: number,
): Medal[] {
  return steps.map((s, i) => ({
    id: `${family}-${i + 1}`,
    family,
    tier: s.tier,
    level: ROMAN[i],
    name: `${name} ${ROMAN[i]}`,
    requirement: s.requirement,
    boss: false,
    glyph,
    prestige: base + s.tier * 100 + i,
  }));
}

function eur(n: number): string {
  return `${n.toLocaleString("de-DE")} €`;
}

/** Limiares por medalha — vivem aqui ao lado das medalhas para a galeria
 *  desenhar a barra de progresso sem recalcular nada. */
export const THRESHOLDS: Record<string, number> = {};

function withThresholds(medals: Medal[], values: number[]): Medal[] {
  medals.forEach((m, i) => {
    THRESHOLDS[m.id] = values[i];
  });
  return medals;
}

const FECHADOR = withThresholds(
  ladder(
    "fechador",
    "Fechador",
    "check",
    [
      { threshold: 1, tier: 1, requirement: "1 proposta fechada" },
      { threshold: 3, tier: 2, requirement: "3 propostas fechadas" },
      { threshold: 5, tier: 3, requirement: "5 propostas fechadas" },
      { threshold: 10, tier: 4, requirement: "10 propostas fechadas" },
      { threshold: 25, tier: 5, requirement: "25 propostas fechadas" },
    ],
    30,
  ),
  [1, 3, 5, 10, 25],
);

const APRESENTADOR = withThresholds(
  ladder(
    "apresentador",
    "Apresentador",
    "plane",
    [
      { threshold: 1, tier: 1, requirement: "1 proposta apresentada" },
      { threshold: 5, tier: 2, requirement: "5 propostas apresentadas" },
      { threshold: 10, tier: 3, requirement: "10 propostas apresentadas" },
      { threshold: 25, tier: 4, requirement: "25 propostas apresentadas" },
      { threshold: 50, tier: 5, requirement: "50 propostas apresentadas" },
    ],
    10,
  ),
  [1, 5, 10, 25, 50],
);

const FATURACAO = withThresholds(
  ladder(
    "faturacao",
    "Faturação",
    "euro",
    [
      { threshold: 5_000, tier: 1, requirement: `${eur(5_000)} fechados` },
      { threshold: 25_000, tier: 2, requirement: `${eur(25_000)} fechados` },
      { threshold: 50_000, tier: 3, requirement: `${eur(50_000)} fechados` },
      { threshold: 100_000, tier: 4, requirement: `${eur(100_000)} fechados` },
      { threshold: 250_000, tier: 5, requirement: `${eur(250_000)} fechados` },
    ],
    40,
  ),
  [5_000, 25_000, 50_000, 100_000, 250_000],
);

const RENOVADOR = withThresholds(
  ladder(
    "renovador",
    "Renovador",
    "cycle",
    [
      { threshold: 1, tier: 1, requirement: "1 renovação fechada" },
      { threshold: 3, tier: 2, requirement: "3 renovações fechadas" },
      { threshold: 5, tier: 3, requirement: "5 renovações fechadas" },
      { threshold: 10, tier: 4, requirement: "10 renovações fechadas" },
      { threshold: 20, tier: 5, requirement: "20 renovações fechadas" },
    ],
    20,
  ),
  [1, 3, 5, 10, 20],
);

const CROSSSELLER = withThresholds(
  ladder(
    "crossseller",
    "Cross-seller",
    "sparkle",
    [
      { threshold: 1, tier: 1, requirement: "1 cross-sell fechado" },
      { threshold: 3, tier: 2, requirement: "3 cross-sells fechados" },
      { threshold: 5, tier: 3, requirement: "5 cross-sells fechados" },
      { threshold: 10, tier: 4, requirement: "10 cross-sells fechados" },
      { threshold: 20, tier: 5, requirement: "20 cross-sells fechados" },
    ],
    20,
  ),
  [1, 3, 5, 10, 20],
);

/** Sniper: taxa de fecho com um mínimo de apresentadas, para uma proposta
 *  em uma não valer «100 %». */
export const SNIPER_RULES = [
  { rate: 0.5, minPresented: 3 },
  { rate: 0.75, minPresented: 5 },
  { rate: 0.9, minPresented: 10 },
];

const SNIPER = withThresholds(
  ladder(
    "sniper",
    "Sniper",
    "crosshair",
    [
      { threshold: 0.5, tier: 2, requirement: "50 % de fecho em 3+ propostas" },
      { threshold: 0.75, tier: 3, requirement: "75 % de fecho em 5+ propostas" },
      { threshold: 0.9, tier: 5, requirement: "90 % de fecho em 10+ propostas" },
    ],
    50,
  ),
  [0.5, 0.75, 0.9],
);

const GRANDE_CACA = withThresholds(
  ladder(
    "grande-caca",
    "Grande Caça",
    "diamond",
    [
      { threshold: 5_000, tier: 2, requirement: `Um negócio de ${eur(5_000)}+` },
      { threshold: 15_000, tier: 3, requirement: `Um negócio de ${eur(15_000)}+` },
      { threshold: 30_000, tier: 4, requirement: `Um negócio de ${eur(30_000)}+` },
      { threshold: 50_000, tier: 5, requirement: `Um negócio de ${eur(50_000)}+` },
    ],
    45,
  ),
  [5_000, 15_000, 30_000, 50_000],
);

const TOP: Medal[] = [
  {
    id: "top-fechos",
    family: "top",
    tier: 5,
    level: "★",
    name: "Top Fechos",
    requirement: "Lidera em propostas fechadas",
    boss: true,
    glyph: "star",
    prestige: 1100,
  },
  {
    id: "top-faturado",
    family: "top",
    tier: 5,
    level: "★",
    name: "Top Faturado",
    requirement: "Lidera em valor fechado",
    boss: true,
    glyph: "euro",
    prestige: 1200,
  },
  {
    id: "top-propostas",
    family: "top",
    tier: 5,
    level: "★",
    name: "Top Propostas",
    requirement: "Lidera em propostas apresentadas",
    boss: true,
    glyph: "plane",
    prestige: 1000,
  },
];

export const MEDALS: Medal[] = [
  ...TOP,
  ...FECHADOR,
  ...FATURACAO,
  ...GRANDE_CACA,
  ...APRESENTADOR,
  ...RENOVADOR,
  ...CROSSSELLER,
  ...SNIPER,
];

const BY_ID = new Map(MEDALS.map((m) => [m.id, m]));

export function medalById(id: string): Medal | null {
  return BY_ID.get(id) ?? null;
}

export function isMedalId(v: unknown): v is string {
  return typeof v === "string" && BY_ID.has(v);
}

export const MAX_DISPLAYED = 3;

// ---------------------------------------------------------------------------
// Quem ganhou o quê
// ---------------------------------------------------------------------------

export type MedalProgress = {
  /** O valor atual da pessoa na métrica da medalha. */
  value: number;
  /** O que a medalha pede. */
  threshold: number;
  earned: boolean;
};

/** O valor da pessoa na métrica de uma família. Para o Sniper devolve a
 *  taxa (0–1) — o mínimo de apresentadas verifica-se à parte. */
export function metricFor(family: MedalFamilyId, row: LeaderboardRow): number {
  switch (family) {
    case "fechador":
      return closedCount(row);
    case "apresentador":
      return presentedCount(row);
    case "faturacao":
      return row.closedValue;
    case "renovador":
      return row.closedRenovacoes;
    case "crossseller":
      return row.closedCrossSells;
    case "sniper":
      return row.closeRate ?? 0;
    case "grande-caca":
      return row.biggestClosedValue;
    case "top":
      return 0;
  }
}

function leads(board: Leaderboard, row: LeaderboardRow, metric: (r: LeaderboardRow) => number): boolean {
  const mine = metric(row);
  if (mine <= 0) return false;
  return board.rows.every((r) => metric(r) <= mine);
}

/** Progresso de uma pessoa numa medalha — para a galeria (barra) e para
 *  decidir se a ganhou. `row` null = pessoa sem propostas. */
export function progressFor(medal: Medal, row: LeaderboardRow | null, board: Leaderboard): MedalProgress {
  if (!row) return { value: 0, threshold: THRESHOLDS[medal.id] ?? 1, earned: false };
  if (medal.family === "top") {
    const earned =
      medal.id === "top-fechos"
        ? leads(board, row, closedCount)
        : medal.id === "top-faturado"
          ? leads(board, row, (r) => r.closedValue)
          : leads(board, row, presentedCount);
    return { value: earned ? 1 : 0, threshold: 1, earned };
  }
  const threshold = THRESHOLDS[medal.id];
  const value = metricFor(medal.family, row);
  if (medal.family === "sniper") {
    const rule = SNIPER_RULES[Number(medal.id.split("-")[1]) - 1];
    const earned = Boolean(rule) && presentedCount(row) >= rule.minPresented && value >= rule.rate;
    return { value, threshold, earned };
  }
  return { value, threshold, earned: value >= threshold };
}

export type EarnedMedal = { medal: Medal; progress: MedalProgress };

/** Todas as medalhas da pessoa, da mais prestigiada para a menos. */
export function computeEarned(row: LeaderboardRow | null, board: Leaderboard): EarnedMedal[] {
  return MEDALS.map((medal) => ({ medal, progress: progressFor(medal, row, board) }))
    .filter((e) => e.progress.earned)
    .sort((a, b) => b.medal.prestige - a.medal.prestige);
}

/** As medalhas que vão para o header: a escolha da pessoa (só as que
 *  continua a ter), ou, sem escolha, as três de maior prestígio. */
export function resolveDisplay(chosen: string[] | null, earned: EarnedMedal[]): Medal[] {
  const have = new Map(earned.map((e) => [e.medal.id, e.medal]));
  if (chosen) {
    return chosen
      .map((id) => have.get(id))
      .filter((m): m is Medal => Boolean(m))
      .slice(0, MAX_DISPLAYED);
  }
  return earned.slice(0, MAX_DISPLAYED).map((e) => e.medal);
}
