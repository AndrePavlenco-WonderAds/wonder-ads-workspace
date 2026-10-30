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
// v78.59 — o resto do SEO DPT entrou nas medalhas (pedido do André): o
// Producer of the Month (a «Top» eleita pela direção, as vitórias e os
// pódios), o NPS dos clientes, as comissões, os meses sem ineficácias e os
// blocos do roadmap. Estes números vêm de `facts.ts` (servidor) e chegam
// aqui já feitos, em `MedalFacts`; os do Comercial continuam a sair do
// leaderboard das propostas.
//
// v78.62 — o Pódio saiu; o Producer of the Month vai até ao V; as Entregas
// pedem o dobro dos blocos; o NPS Perfeito e o Rigor, por serem difíceis,
// ganharam uma pele própria (`fx`): cor e efeitos que nenhuma outra tem.
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
  | "top"
  | "producer"
  | "nps"
  | "nps-perfeito"
  | "comissoes"
  | "rigor"
  | "entregas";

/** Os números do SEO DPT que não saem das propostas (v78.59) — ver
 *  `facts.ts`. null = pessoa fora do SEO DPT, ou números indisponíveis. */
export type MedalFacts = {
  /** Meses fechados com NPS ≥ 9, com as portas do bónus individual. */
  npsGoodMonths: number;
  /** Meses fechados com NPS 10, com as mesmas portas. */
  npsPerfectMonths: number;
  /** € de comissão ganhos desde o arranque das comissões. */
  commissionEur: number;
  /** Meses fechados (desde out/2026) sem nenhuma ineficácia pontuada. */
  cleanMonths: number;
  /** Tarefas feitas nos roadmaps dos clientes de hoje. */
  roadmapBlocks: number;
  /** Vezes eleito Producer of the Month (1.º lugar). */
  producerWins: number;
  /** É o Producer of the Month da eleição mais recente. */
  producerNow: boolean;
};

export type MedalTier = 1 | 2 | 3 | 4 | 5;

export type MedalGlyph =
  | "check"
  | "plane"
  | "euro"
  | "cycle"
  | "sparkle"
  | "crosshair"
  | "diamond"
  | "star"
  | "trophy"
  | "heart"
  | "coins"
  | "shield"
  | "blocks";

/** Pele especial (v78.62) das famílias difíceis: «estelar» (NPS Perfeito —
 *  cor holográfica e estrelas a voar à volta) e «lendaria» (Rigor — ouro e
 *  esmeralda, raios, runas, faíscas e cometas). Sobrepõe-se à cor do tier;
 *  o desenho (chevrons, asas, coroa) continua a subir com o tier. */
export type MedalFx = "estelar" | "lendaria";

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
  /** Pele especial — ver `MedalFx`. */
  fx?: MedalFx;
};

export type MedalFamily = {
  id: MedalFamilyId;
  name: string;
  description: string;
  /** Unidade da barra de progresso: «propostas», «€»… */
  unit: "count" | "eur" | "rate";
};

export const MEDAL_FAMILIES: MedalFamily[] = [
  { id: "top", name: "Top", description: "Quem lidera agora. Muda de mãos quando a classificação muda — ou, no Producer of the Month, quando a direção elege o seguinte.", unit: "count" },
  { id: "producer", name: "Producer of the Month", description: "Vezes que a direção te elegeu Producer of the Month do SEO DPT.", unit: "count" },
  { id: "nps", name: "Cliente Feliz", description: "Meses com NPS de 9 ou mais nos teus projetos, com as regras do Bónus NPS (3+ projetos, 50% de respostas).", unit: "count" },
  { id: "nps-perfeito", name: "NPS Perfeito", description: "Meses com NPS 10 nos teus projetos, com as mesmas regras.", unit: "count" },
  { id: "entregas", name: "Entregas", description: "Blocos marcados como feitos nos roadmaps dos teus clientes.", unit: "count" },
  { id: "rigor", name: "Rigor", description: "Meses fechados sem nenhuma ineficácia pontuada pela direção (desde outubro de 2026).", unit: "count" },
  { id: "comissoes", name: "Comissões", description: "Comissões ganhas em renovações e cross-sells, desde 01/10/2026.", unit: "eur" },
  { id: "fechador", name: "Fechador", description: "Propostas fechadas — o cliente aceitou.", unit: "count" },
  { id: "faturacao", name: "Faturação", description: "Valor total fechado, sem IVA.", unit: "eur" },
  { id: "grande-caca", name: "Grande Caça", description: "O maior negócio fechado numa só proposta.", unit: "eur" },
  { id: "apresentador", name: "Apresentador", description: "Propostas apresentadas — enviadas, aceites ou recusadas.", unit: "count" },
  { id: "renovador", name: "Renovador", description: "Renovações fechadas.", unit: "count" },
  { id: "crossseller", name: "Cross-seller", description: "Cross-sells fechados.", unit: "count" },
  { id: "sniper", name: "Sniper", description: "Taxa de fecho — fechadas ÷ apresentadas, com um mínimo de propostas.", unit: "rate" },
];

const ROMAN = ["I", "II", "III", "IV", "V"];

/** Nome e cor das peles especiais — a pílula da galeria e o PNG do Slack. */
export const FX_NAMES: Record<MedalFx, string> = {
  estelar: "Estelar",
  lendaria: "Lendária",
};

export const FX_ACCENT: Record<MedalFx, string> = {
  estelar: "#FF7AD9",
  lendaria: "#FFD23F",
};

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
  if (medal.boss) return "Leader";
  return medal.fx ? FX_NAMES[medal.fx] : TIER_NAMES[medal.tier];
}

export function tierAccent(medal: Medal): string {
  if (medal.boss) return BOSS_ACCENT;
  return medal.fx ? FX_ACCENT[medal.fx] : TIER_ACCENT[medal.tier];
}

function ladder(
  family: MedalFamilyId,
  name: string,
  glyph: MedalGlyph,
  steps: Array<{ threshold: number; tier: MedalTier; requirement: string; blurb: string }>,
  base: number,
  fx?: MedalFx,
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
    ...(fx ? { fx } : {}),
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

// --- SEO DPT (v78.59) -------------------------------------------------------

const PRODUCER = withThresholds(
  ladder(
    "producer",
    "Producer of the Month",
    "trophy",
    [
      { threshold: 1, tier: 1, requirement: "Eleito 1 vez", blurb: "A direção elegeu-te Producer of the Month. Fica para sempre na tua estante." },
      { threshold: 3, tier: 2, requirement: "Eleito 3 vezes", blurb: "Três vezes Producer of the Month — já não é um mês bom, é um padrão." },
      { threshold: 6, tier: 3, requirement: "Eleito 6 vezes", blurb: "Seis vezes Producer of the Month. Meio ano de meses a ser a referência da equipa." },
      { threshold: 9, tier: 4, requirement: "Eleito 9 vezes", blurb: "Nove vezes Producer of the Month. Três trimestres de meses a ser a referência da equipa." },
      { threshold: 12, tier: 5, requirement: "Eleito 12 vezes", blurb: "Doze vezes Producer of the Month — um ano inteiro de meses a ser a referência do SEO DPT." },
    ],
    60,
  ),
  [1, 3, 6, 9, 12],
);

const NPS = withThresholds(
  ladder(
    "nps",
    "Cliente Feliz",
    "heart",
    [1, 3, 6, 9, 12].map((n, i) => ({
      threshold: n,
      tier: (i + 1) as MedalTier,
      requirement: plural(n, "mês com NPS ≥ 9", "meses com NPS ≥ 9"),
      blurb:
        n === 1
          ? "Um mês em que a média NPS dos teus projetos chegou a 9 ou mais, com as regras do Bónus NPS."
          : `${plural(n, "mês", "meses")} com a média NPS dos teus projetos em 9 ou mais.`,
    })),
    42,
  ),
  [1, 3, 6, 9, 12],
);

const NPS_PERFEITO = withThresholds(
  ladder(
    "nps-perfeito",
    "NPS Perfeito",
    "heart",
    [
      { threshold: 1, tier: 3, requirement: "1 mês com NPS 10", blurb: "Um mês com média 10 nos teus projetos: todos os clientes que responderam deram a nota máxima." },
      { threshold: 3, tier: 4, requirement: "3 meses com NPS 10", blurb: "Três meses com média 10 nos teus projetos." },
      { threshold: 6, tier: 5, requirement: "6 meses com NPS 10", blurb: "Seis meses com média 10 nos teus projetos. Clientes que não trocavam de consultor por nada." },
    ],
    55,
    "estelar",
  ),
  [1, 3, 6],
);

const ENTREGAS = withThresholds(
  ladder(
    "entregas",
    "Entregas",
    "blocks",
    [50, 200, 500, 1000, 2000].map((n, i) => ({
      threshold: n,
      tier: (i + 1) as MedalTier,
      requirement: `${n} blocos feitos`,
      blurb: `${n} blocos marcados como feitos nos roadmaps dos teus clientes.`,
    })),
    28,
  ),
  [50, 200, 500, 1000, 2000],
);

const RIGOR = withThresholds(
  ladder(
    "rigor",
    "Rigor",
    "shield",
    [1, 3, 6, 9, 12].map((n, i) => ({
      threshold: n,
      tier: (i + 1) as MedalTier,
      requirement: plural(n, "mês sem ineficácias", "meses sem ineficácias"),
      blurb:
        n === 1
          ? "Um mês fechado sem nenhuma ineficácia pontuada pela direção."
          : `${plural(n, "mês fechado", "meses fechados")} sem nenhuma ineficácia pontuada pela direção.`,
    })),
    25,
    "lendaria",
  ),
  [1, 3, 6, 9, 12],
);

const COMISSOES = withThresholds(
  ladder(
    "comissoes",
    "Comissões",
    "coins",
    [50, 250, 500, 1_000, 2_500].map((n, i) => ({
      threshold: n,
      tier: (i + 1) as MedalTier,
      requirement: `${eur(n)} em comissões`,
      blurb: `${eur(n)} ganhos em comissões de renovações e cross-sells, desde 01/10/2026.`,
    })),
    38,
  ),
  [50, 250, 500, 1_000, 2_500],
);

const TOP: Medal[] = [
  {
    id: "producer-top",
    family: "top",
    tier: 5,
    level: "★",
    name: "Producer of the Month",
    requirement: "Eleito pela direção no último mês",
    blurb: "A direção escolheu-te como o Producer of the Month mais recente. Passa para quem for eleito a seguir.",
    boss: true,
    glyph: "trophy",
    prestige: 1300,
  },
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
  ...PRODUCER,
  ...NPS,
  ...NPS_PERFEITO,
  ...ENTREGAS,
  ...RIGOR,
  ...COMISSOES,
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
    default:
      return 0;
  }
}

/** O valor da pessoa numa família do SEO DPT (v78.59). */
export function factMetric(family: MedalFamilyId, facts: MedalFacts | null): number | null {
  if (!facts) return null;
  switch (family) {
    case "producer":
      return facts.producerWins;
    case "nps":
      return facts.npsGoodMonths;
    case "nps-perfeito":
      return facts.npsPerfectMonths;
    case "entregas":
      return facts.roadmapBlocks;
    case "rigor":
      return facts.cleanMonths;
    case "comissoes":
      return facts.commissionEur;
    default:
      return null;
  }
}

const FACT_FAMILIES: ReadonlySet<MedalFamilyId> = new Set([
  "producer",
  "nps",
  "nps-perfeito",
  "entregas",
  "rigor",
  "comissoes",
]);

/** As famílias novas da v78.59 — a sincronização com o Slack usa isto para
 *  não anunciar de uma vez tudo o que já se tinha ganho antes de existirem. */
export function isFactFamily(family: MedalFamilyId): boolean {
  return FACT_FAMILIES.has(family);
}

function leads(board: Leaderboard, row: LeaderboardRow, metric: (r: LeaderboardRow) => number): boolean {
  const mine = metric(row);
  if (mine <= 0) return false;
  return board.rows.every((r) => metric(r) <= mine);
}

/** Progresso de uma pessoa numa medalha — para a galeria (barra) e para
 *  decidir se a ganhou. `row` null = pessoa sem propostas; `facts` null =
 *  fora do SEO DPT (ou números indisponíveis). */
export function progressFor(
  medal: Medal,
  row: LeaderboardRow | null,
  board: Leaderboard,
  facts: MedalFacts | null = null,
): MedalProgress {
  if (medal.id === "producer-top") {
    const earned = Boolean(facts?.producerNow);
    return { value: earned ? 1 : 0, threshold: 1, earned };
  }
  if (isFactFamily(medal.family)) {
    const threshold = THRESHOLDS[medal.id] ?? 1;
    const value = factMetric(medal.family, facts) ?? 0;
    return { value, threshold, earned: value >= threshold };
  }
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
 *  a quem não lidera quem é que lidera. Vazio = ninguém ainda. O Producer
 *  of the Month não sai do leaderboard: é o nome da última eleição. */
export function topLeaders(board: Leaderboard, producerName: string | null = null): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const medal of MEDALS) {
    if (medal.family !== "top") continue;
    out[medal.id] =
      medal.id === "producer-top"
        ? producerName
          ? [producerName]
          : []
        : board.rows.filter((row) => progressFor(medal, row, board).earned).map((row) => row.name);
  }
  return out;
}

export type EarnedMedal = { medal: Medal; progress: MedalProgress };

/** Todas as medalhas da pessoa, da mais prestigiada para a menos. */
export function computeEarned(
  row: LeaderboardRow | null,
  board: Leaderboard,
  facts: MedalFacts | null = null,
): EarnedMedal[] {
  return MEDALS.map((medal) => ({ medal, progress: progressFor(medal, row, board, facts) }))
    .filter((e) => e.progress.earned)
    .sort((a, b) => b.medal.prestige - a.medal.prestige);
}

/** As medalhas que vão para o header. Desde a v78.62 a escolha é toda da
 *  pessoa — nem as «Top» entram à força:
 *  1. com escolha gravada, exatamente essa, pela ordem dela (só as que
 *     continua a ter; uma lista vazia = nenhuma no header);
 *  2. sem escolha, as três de maior prestígio (as «Top» primeiro, depois
 *     Lendária, Diamante, Ouro… — é a ordem de `earned`). */
export function resolveDisplay(chosen: string[] | null, earned: EarnedMedal[]): Medal[] {
  if (!chosen) return earned.slice(0, MAX_DISPLAYED).map((e) => e.medal);
  const have = new Map(earned.map((e) => [e.medal.id, e.medal]));
  const out: Medal[] = [];
  for (const id of chosen) {
    const m = have.get(id);
    if (m && !out.some((x) => x.id === m.id)) out.push(m);
    if (out.length === MAX_DISPLAYED) break;
  }
  return out;
}
