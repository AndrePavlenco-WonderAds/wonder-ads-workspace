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
  /** Uma frase sobre o que a medalha é — para a estante. */
  blurb: string;
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

/** Nome de cada tier — o «material» do emblema. */
export const TIER_NAMES: Record<MedalTier, string> = {
  1: "Bronze",
  2: "Prata",
  3: "Ouro",
  4: "Diamante",
  5: "Lendária",
};

/** Cor sólida por tier, para pílulas e brilhos fora do SVG. */
export const TIER_ACCENT: Record<MedalTier, string> = {
  1: "#D2A05A",
  2: "#E2E8F0",
  3: "#FFD166",
  4: "#9EEBFF",
  5: "#C77DFF",
};

export const BOSS_ACCENT = "#FF4D6D";

export function tierLabel(medal: Medal): string {
  return medal.boss ? "Leader" : TIER_NAMES[medal.tier];
}

export function tierAccent(medal: Medal): string {
  return medal.boss ? BOSS_ACCENT : TIER_ACCENT[medal.tier];
}

function ladder(
  family: MedalFamilyId,
  name: string,
  glyph: MedalGlyph,
  steps: Array<{ threshold: number; tier: MedalTier; requirement: string; blurb: string }>,
  base: number,
): Medal[] {
  return steps.map((s, i) => ({
    id: `${family}-${i + 1}`,
    family,
    tier: s.tier,
    level: ROMAN[i],
    name: `${name} ${ROMAN[i]}`,
    requirement: s.requirement,
    blurb: s.blurb,
    boss: false,
    glyph,
    prestige: base + s.tier * 100 + i,
  }));
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
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
    [1, 3, 5, 10, 25].map((n, i) => ({
      threshold: n,
      tier: (i + 1) as MedalTier,
      requirement: plural(n, "proposta fechada", "propostas fechadas"),
      blurb:
        n === 1
          ? "A primeira vez que um cliente disse «sim» a uma proposta tua."
          : `${plural(n, "proposta fechada", "propostas fechadas")} — renovações e cross-sells confirmados pelo cliente.`,
    })),
    30,
  ),
  [1, 3, 5, 10, 25],
);

const APRESENTADOR = withThresholds(
  ladder(
    "apresentador",
    "Apresentador",
    "plane",
    [1, 3, 5, 10, 20].map((n, i) => ({
      threshold: n,
      tier: (i + 1) as MedalTier,
      requirement: plural(n, "proposta apresentada", "propostas apresentadas"),
      blurb:
        n === 1
          ? "A primeira proposta que saiu da gaveta e chegou ao cliente."
          : `${plural(n, "proposta apresentada", "propostas apresentadas")} ao cliente — enviadas, aceites ou recusadas.`,
    })),
    10,
  ),
  [1, 3, 5, 10, 20],
);

const FATURACAO = withThresholds(
  ladder(
    "faturacao",
    "Faturação",
    "euro",
    [5_000, 25_000, 50_000, 100_000, 250_000].map((n, i) => ({
      threshold: n,
      tier: (i + 1) as MedalTier,
      requirement: `${eur(n)} fechados`,
      blurb: `${eur(n)} de valor fechado, sem IVA, somando todas as propostas que o cliente aceitou.`,
    })),
    40,
  ),
  [5_000, 25_000, 50_000, 100_000, 250_000],
);

const RENOVADOR = withThresholds(
  ladder(
    "renovador",
    "Renovador",
    "cycle",
    [1, 2, 3, 5, 10].map((n, i) => ({
      threshold: n,
      tier: (i + 1) as MedalTier,
      requirement: plural(n, "renovação fechada", "renovações fechadas"),
      blurb:
        n === 1
          ? "Um cliente que já era nosso decidiu ficar mais um ciclo contigo."
          : `${plural(n, "renovação fechada", "renovações fechadas")} — clientes que voltaram a assinar.`,
    })),
    20,
  ),
  [1, 2, 3, 5, 10],
);

const CROSSSELLER = withThresholds(
  ladder(
    "crossseller",
    "Cross-seller",
    "sparkle",
    [1, 3, 5, 10, 20].map((n, i) => ({
      threshold: n,
      tier: (i + 1) as MedalTier,
      requirement: plural(n, "cross-sell fechado", "cross-sells fechados"),
      blurb:
        n === 1
          ? "Vendeste um serviço novo a um cliente que já era nosso."
          : `${plural(n, "cross-sell fechado", "cross-sells fechados")} — serviços novos a clientes da casa.`,
    })),
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
      { threshold: 0.5, tier: 2, requirement: "50 % de fecho em 3+ propostas", blurb: "Metade das propostas que apresentas fecham. Com pelo menos três apresentadas." },
      { threshold: 0.75, tier: 3, requirement: "75 % de fecho em 5+ propostas", blurb: "Três em cada quatro propostas fecham. Com pelo menos cinco apresentadas." },
      { threshold: 0.9, tier: 5, requirement: "90 % de fecho em 10+ propostas", blurb: "Nove em cada dez propostas fecham. Com pelo menos dez apresentadas — quase não falhas." },
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
    [3_000, 5_000, 10_000, 20_000, 30_000].map((n, i) => ({
      threshold: n,
      tier: (i + 1) as MedalTier,
      requirement: `Um negócio de ${eur(n)}+`,
      blurb: `Uma só proposta fechada de ${eur(n)} ou mais. Conta o maior negócio, não a soma.`,
    })),
    45,
  ),
  [3_000, 5_000, 10_000, 20_000, 30_000],
);

const TOP: Medal[] = [
  {
    id: "top-fechos",
    family: "top",
    tier: 5,
    level: "★",
    name: "Top Fechos",
    requirement: "Lidera em propostas fechadas",
    blurb: "Ninguém na agência fechou mais propostas do que tu. Muda de mãos quando a classificação muda.",
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
    blurb: "És quem mais euros fechou, sem IVA. Muda de mãos quando a classificação muda.",
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
    blurb: "Ninguém apresentou mais propostas do que tu. Muda de mãos quando a classificação muda.",
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

/** Quem lidera em cada medalha «Top» agora — nomes, para a galeria dizer
 *  a quem não lidera quem é que lidera. Vazio = ninguém ainda. */
export function topLeaders(board: Leaderboard): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const medal of MEDALS) {
    if (medal.family !== "top") continue;
    out[medal.id] = board.rows.filter((row) => progressFor(medal, row, board).earned).map((row) => row.name);
  }
  return out;
}

export type EarnedMedal = { medal: Medal; progress: MedalProgress };

/** Todas as medalhas da pessoa, da mais prestigiada para a menos. */
export function computeEarned(row: LeaderboardRow | null, board: Leaderboard): EarnedMedal[] {
  return MEDALS.map((medal) => ({ medal, progress: progressFor(medal, row, board) }))
    .filter((e) => e.progress.earned)
    .sort((a, b) => b.medal.prestige - a.medal.prestige);
}

/** As medalhas que vão para o header (v77.28):
 *  1. as «Top» que a pessoa tem entram SEMPRE, automaticamente;
 *  2. depois a escolha da pessoa (só as que continua a ter);
 *  3. sem escolha, as restantes por ordem de dificuldade — Lendária, Ouro,
 *     Prata, Bronze (é a ordem de `earned`, por prestígio). */
export function resolveDisplay(chosen: string[] | null, earned: EarnedMedal[]): Medal[] {
  const tops = earned.filter((e) => e.medal.boss).map((e) => e.medal);
  const rest = earned.filter((e) => !e.medal.boss).map((e) => e.medal);
  const have = new Map(rest.map((m) => [m.id, m]));
  const manual = chosen ? chosen.map((id) => have.get(id)).filter((m): m is Medal => Boolean(m)) : rest;
  const out: Medal[] = [];
  for (const m of [...tops, ...manual]) {
    if (!out.some((x) => x.id === m.id)) out.push(m);
    if (out.length === MAX_DISPLAYED) break;
  }
  return out;
}
