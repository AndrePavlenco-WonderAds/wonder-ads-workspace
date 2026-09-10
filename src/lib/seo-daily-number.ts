// «Número do dia» dos consultores SEO.
//
// Todos os dias úteis (segunda a sexta, hora de Lisboa) cada um dos quatro
// consultores SEO recebe um número de 1 a 4 — todos diferentes entre si — que
// aparece num cartão pequeno ao lado do nome, no canto superior direito do
// header. Ao sábado e domingo não há cartão.
//
// A distribuição é ALEATÓRIA MAS DETERMINÍSTICA: a semente é a data, por isso
// toda a gente vê a mesma distribuição no mesmo dia, um F5 não a muda e não há
// nada para guardar em KV. E é uma ROTAÇÃO a sério: ninguém repete o número
// do dia útil anterior (num baralho puro, um quarto das vezes alguém ficava
// com o mesmo número dois dias seguidos e parecia avariado). Para isso os dias
// encadeiam-se a partir de uma data-âncora — o dia D só se decide depois do
// dia útil anterior. São umas centenas de baralhos de 4 elementos por ano, e
// ficam em cache por data: nada.
//
// Módulo puro de propósito — sem KV, sem credenciais — para o header o poder
// chamar em todas as páginas sem custo e para se testar num `node` a seco.

/** Quem entra na roda — os quatro consultores SEO, por username. Só estes:
 *  o Founder e os SuperAdmins ficam de fora (o «andre» da roda é o André
 *  Pereira, consultor, não o Founder). Acrescentar alguém aqui = a roda passa
 *  a 1..5 sozinha; é preciso dar-lhe uma cor em `DAILY_NUMBER_COLORS`. */
export const SEO_ROTATION_USERNAMES = [
  "manuel-s",
  "fran-r",
  "joao-b",
  "andre-pereira",
] as const;

/** Dia-âncora da roda (uma segunda-feira). Antes disto não há número. */
export const ROTATION_EPOCH = "2026-09-07";

export type DailyNumberColor = {
  /** Hex sem alfa — o cartão deriva fundo, contorno e brilho daqui. */
  hex: string;
  /** Nome legível, para o tooltip e o aria-label. */
  label: string;
};

/** Uma cor por número, índice = número − 1. Escolhidas para se distinguirem
 *  à primeira vista sobre o fundo escuro e para não se confundirem com o
 *  roxo da marca nem com o âmbar do «Ver como». */
export const DAILY_NUMBER_COLORS: DailyNumberColor[] = [
  { hex: "#34D399", label: "verde" },
  { hex: "#38BDF8", label: "azul" },
  { hex: "#FBBF24", label: "amarelo" },
  { hex: "#FB7185", label: "rosa" },
];

const FALLBACK_COLOR: DailyNumberColor = { hex: "#A78BFA", label: "lilás" };

export function colorForNumber(n: number): DailyNumberColor {
  return DAILY_NUMBER_COLORS[n - 1] ?? FALLBACK_COLOR;
}

// ---------------------------------------------------------------------------
// Datas — sempre em Lisboa, que é onde a equipa vive o dia.
// ---------------------------------------------------------------------------

const LISBON_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** yyyy-mm-dd de um instante, visto de Lisboa. */
export function lisbonISODate(at: Date = new Date()): string {
  return LISBON_DATE.format(at);
}

function partsOf(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

/** 0 = domingo … 6 = sábado. A data já é a de Lisboa, por isso conta-se em
 *  UTC para o fuso do servidor não a empurrar para o dia anterior. */
function weekdayOf(iso: string): number {
  const [y, m, d] = partsOf(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isBusinessDay(iso: string): boolean {
  const wd = weekdayOf(iso);
  return wd >= 1 && wd <= 5;
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = partsOf(iso);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** «quinta-feira, 10/09/2026» — para o tooltip do cartão. */
export function describeDay(iso: string): string {
  const [y, m, d] = partsOf(iso);
  const weekday = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${weekday}, ${dd}/${mm}/${y}`;
}

// ---------------------------------------------------------------------------
// Baralhar com semente — o mesmo dia dá sempre a mesma ordem.
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — gerador de 32 bits pequeno e bem misturado. Um LCG a seco
 *  não serve aqui: os bits baixos têm período minúsculo e, num baralho de 4
 *  elementos, isso traduzia-se numa pessoa a ficar com o «4» metade das
 *  vezes das outras ao fim de um ano. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Permutação de [1..N] a partir de uma semente (Fisher-Yates). */
function seededPermutation(seed: string, size: number): number[] {
  const out = Array.from({ length: size }, (_, i) => i + 1);
  const rand = mulberry32(hashString(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Escolhe a permutação do dia: a primeira semente cujo resultado não deixa
 *  ninguém com o número do dia útil anterior. Com 4 pessoas, 9 em cada 24
 *  permutações servem — falhar 48 tentativas seguidas é impossível na
 *  prática, mas o último recurso (rodar a de ontem uma casa) é sempre um
 *  desarranjo válido, para nunca sair daqui nada que não seja uma roda. */
function pickPermutation(iso: string, prev: number[] | null): number[] {
  const size = SEO_ROTATION_USERNAMES.length;
  for (let attempt = 0; attempt < 48; attempt++) {
    const perm = seededPermutation(attempt === 0 ? iso : `${iso}#${attempt}`, size);
    if (!prev || perm.every((n, i) => n !== prev[i])) return perm;
  }
  return (prev as number[]).map((n) => (n % size) + 1);
}

/** Cache por data — o header de todas as páginas pergunta isto. Cresce um
 *  registo por dia útil desde a âncora; nunca precisa de ser limpo. */
const memo = new Map<string, number[]>();

/** Números do dia, na ordem de `SEO_ROTATION_USERNAMES`. null ao fim de
 *  semana e antes da âncora. */
export function dailyNumbersFor(iso: string): number[] | null {
  if (iso < ROTATION_EPOCH || !isBusinessDay(iso)) return null;
  const hit = memo.get(iso);
  if (hit) return hit;
  // Anda da âncora até ao dia pedido, dia útil a dia útil, encadeando — o
  // dia D só se decide depois do dia útil anterior.
  let prev: number[] | null = null;
  for (let cursor = ROTATION_EPOCH; cursor <= iso; cursor = addDays(cursor, 1)) {
    if (!isBusinessDay(cursor)) continue;
    let perm = memo.get(cursor);
    if (!perm) {
      perm = pickPermutation(cursor, prev);
      memo.set(cursor, perm);
    }
    prev = perm;
  }
  return memo.get(iso) ?? null;
}

export type DailyNumber = {
  number: number;
  color: DailyNumberColor;
};

/** O número de uma pessoa hoje (ou noutro dia). null se não está na roda, se
 *  é fim de semana ou se o dia é anterior à âncora. */
export function dailyNumberFor(
  username: string | null | undefined,
  iso: string = lisbonISODate(),
): DailyNumber | null {
  if (!username) return null;
  const idx = (SEO_ROTATION_USERNAMES as readonly string[]).indexOf(username);
  if (idx < 0) return null;
  const numbers = dailyNumbersFor(iso);
  if (!numbers) return null;
  const number = numbers[idx];
  return { number, color: colorForNumber(number) };
}

/** Quem tem que número hoje, por ordem crescente de número — para o tooltip
 *  do cartão. null nos dias sem roda. */
export function dailyRoster(
  iso: string = lisbonISODate(),
): Array<{ username: string; number: number }> | null {
  const numbers = dailyNumbersFor(iso);
  if (!numbers) return null;
  return SEO_ROTATION_USERNAMES.map((username, i) => ({
    username,
    number: numbers[i],
  })).sort((a, b) => a.number - b.number);
}
