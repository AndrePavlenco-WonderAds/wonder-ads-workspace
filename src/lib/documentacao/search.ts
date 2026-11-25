// A pesquisa da Documentação (v80.46) — o motor, puro, igual no browser e no
// servidor.
//
// O que se procura são PEDAÇOS: um capítulo ou uma secção de uma página (com o
// título por cima mais perto), uma tarefa da Jornada, uma aula da Formação.
// Cada pedaço sabe para onde levar (página + âncora), por isso um resultado
// abre o sítio exato e não só a página.
//
// Como se compara uma palavra (sem acentos e sem maiúsculas):
//   igual → 1 · mesma raiz (plural, -ão/-ões) → 0,9 · começo de palavra → 0,75
//   (é o que se escreve a meio) · raiz como começo → 0,6 · um erro de escrita
//   (de 5 letras para cima; dois a partir de 8) → 0,45.
// Um pedaço tem de ter TODAS as palavras da pesquisa (com 3 ou mais, admite-se
// que falte uma, a pagar). Título da página > secção > título do bloco >
// texto; a frase inteira seguida dá bónus.

export type SearchDocKind = "doc" | "aula";

export type SearchDoc = {
  /** Único em todo o índice. */
  key: string;
  kind: SearchDocKind;
  /** A página (`DocsPage.id`) ou a especialização da Formação. */
  group: string;
  groupLabel: string;
  /** O bloco da Documentação, ou «Formação». */
  block: string;
  /** Para onde leva — pode já ter parâmetros (?tarefa=). */
  href: string;
  anchor: string | null;
  /** Capítulo/secção da página, ou o capítulo da aula. */
  section: string;
  /** O título mais perto (Slide, subtítulo) ou o título da aula. */
  heading: string | null;
  text: string;
  meta?: {
    image?: string;
    video?: boolean;
    minutes?: number;
    locked?: boolean;
    watched?: boolean;
    soon?: boolean;
    presenter?: string | null;
  };
};

// ---------------------------------------------------------------------------
// Normalização — um carácter dá sempre um carácter, para as posições no texto
// normalizado servirem no original (excertos e realces).
// ---------------------------------------------------------------------------

const charCache = new Map<string, string>();

function normChar(c: string): string {
  let out = charCache.get(c);
  if (out !== undefined) return out;
  const base = c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const first = base.charAt(0) || " ";
  out = /[a-z0-9]/.test(first) ? first : " ";
  charCache.set(c, out);
  return out;
}

/** Sem acentos, minúsculas, tudo o que não é letra/algarismo vira espaço.
 *  Mesmo comprimento que o original. */
export function normalizeKeep(s: string): string {
  let out = "";
  for (const ch of s) {
    // Pares de substituição (emoji) contam dois na string: dois espaços.
    out += ch.length === 1 ? normChar(ch) : " ".repeat(ch.length);
  }
  return out;
}

export function normalize(s: string): string {
  return normalizeKeep(s).replace(/\s+/g, " ").trim();
}

const STOPWORDS = new Set(
  (
    "a ao aos as o os e de da das do dos em no na nos nas num numa um uma uns umas para pra por pelo pela pelos pelas " +
    "com sem que se ou como mais me te eu tu ele ela eles elas isto isso aquilo este esta esse essa sobre ter ser " +
    "the of to and in on for"
  ).split(" "),
);

/** Raiz leve para o português: plurais, -ão/-ões/-ães, vogal final. */
export function stem(w: string): string {
  let s = w;
  if (s.length > 4 && /(oes|aes)$/.test(s)) s = `${s.slice(0, -3)}ao`;
  else if (s.length > 4 && s.endsWith("ns")) s = `${s.slice(0, -2)}m`;
  else if (s.length > 4 && s.endsWith("es")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s")) s = s.slice(0, -1);
  if (s.length > 4 && /[aeo]$/.test(s)) s = s.slice(0, -1);
  return s;
}

export function queryTokens(query: string): string[] {
  const all = normalize(query).split(" ").filter(Boolean);
  const kept = all.filter((t) => !STOPWORDS.has(t));
  const tokens = kept.length ? kept : all;
  return [...new Set(tokens)].slice(0, 8);
}

/** Damerau–Levenshtein com teto: para assim que passa de `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array<number>(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

/** Quanto uma palavra do texto vale para uma palavra da pesquisa (0 = nada).
 *  `fuzzy` desliga os erros de escrita (os realces da página usam-no só
 *  quando não há nada melhor). */
export function wordWeight(q: string, w: string, fuzzy = true): number {
  if (w === q) return 1;
  if (/^\d+$/.test(q)) return w.startsWith(q) && q.length >= 2 ? 0.7 : 0;
  const sq = stem(q);
  const sw = stem(w);
  if (sq === sw && sq.length >= 2) return 0.9;
  if (q.length >= 2 && w.startsWith(q)) return 0.75;
  if (sq.length >= 4 && w.startsWith(sq)) return 0.6;
  if (fuzzy && q.length >= 5 && w.length >= 4) {
    const max = q.length >= 8 ? 2 : 1;
    if (editDistance(q, w, max) <= max || editDistance(sq, sw, max) <= max) return 0.45;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Índice
// ---------------------------------------------------------------------------

type Field = 0 | 1 | 2 | 3; // texto, título do bloco, secção, página
const FIELD_BOOST = [1, 2.2, 2.6, 3.2];

type Prepared = {
  doc: SearchDoc;
  /** Texto normalizado, com o mesmo comprimento do original. */
  normText: string;
  normHeading: string;
  /** Palavra → melhor campo em que aparece + quantas vezes no texto. */
  words: Map<string, { field: Field; count: number }>;
};

export type SearchIndex = {
  docs: Prepared[];
  /** Todas as palavras → os pedaços onde aparecem. */
  vocab: Map<string, number[]>;
};

function addWords(target: Prepared["words"], s: string, field: Field) {
  const norm = normalize(s);
  if (!norm) return;
  const parts = norm.split(" ");
  for (const w of parts) {
    const cur = target.get(w);
    if (!cur) target.set(w, { field, count: field === 0 ? 1 : 0 });
    else {
      if (field > cur.field) cur.field = field;
      if (field === 0) cur.count += 1;
    }
  }
  // «cross-sell» também se encontra por «crosssell».
  const raw = s.toLowerCase();
  for (const m of raw.matchAll(/([a-zà-ú0-9]+)-([a-zà-ú0-9]+)/gi)) {
    const joined = normalize(`${m[1]}${m[2]}`);
    if (joined && !target.has(joined)) target.set(joined, { field, count: 0 });
  }
}

export function buildIndex(input: SearchDoc[]): SearchIndex {
  const docs: Prepared[] = [];
  const vocab = new Map<string, number[]>();
  input.forEach((doc) => {
    const words: Prepared["words"] = new Map();
    addWords(words, doc.text, 0);
    if (doc.heading) addWords(words, doc.heading, doc.kind === "aula" ? 3 : 1);
    addWords(words, doc.section, 2);
    addWords(words, doc.groupLabel, doc.kind === "aula" ? 1 : 3);
    const i = docs.length;
    docs.push({ doc, normText: normalizeKeep(doc.text), normHeading: normalize(doc.heading ?? ""), words });
    for (const w of words.keys()) {
      const list = vocab.get(w);
      if (list) list.push(i);
      else vocab.set(w, [i]);
    }
  });
  return { docs, vocab };
}

// ---------------------------------------------------------------------------
// Procurar
// ---------------------------------------------------------------------------

export type Segment = { text: string; mark: boolean };

export type SearchHit = {
  doc: SearchDoc;
  score: number;
  /** Excerto do texto à volta do sítio com mais palavras da pesquisa. */
  snippet: Segment[];
  heading: Segment[] | null;
};

/** As palavras do índice que respondem a cada palavra da pesquisa. */
export function expandTokens(vocab: Iterable<string>, tokens: string[]): Map<string, number>[] {
  const out = tokens.map(() => new Map<string, number>());
  const words = [...vocab];
  tokens.forEach((t, ti) => {
    let best = 0;
    const exactish = out[ti];
    for (const w of words) {
      const wt = wordWeight(t, w, false);
      if (wt > 0) {
        exactish.set(w, wt);
        if (wt > best) best = wt;
      }
    }
    // Erros de escrita só quando não há nada com a palavra certa.
    if (best < 0.75) {
      for (const w of words) {
        if (exactish.has(w)) continue;
        const wt = wordWeight(t, w, true);
        if (wt > 0) exactish.set(w, wt);
      }
    }
  });
  return out;
}

/** Marca as palavras de `text` que estão em `matched`. */
export function markText(text: string, matched: Set<string>, norm = normalizeKeep(text)): Segment[] {
  const segs: Segment[] = [];
  let last = 0;
  for (const m of norm.matchAll(/[a-z0-9]+/g)) {
    if (!matched.has(m[0])) continue;
    const start = m.index ?? 0;
    if (start > last) segs.push({ text: text.slice(last, start), mark: false });
    segs.push({ text: text.slice(start, start + m[0].length), mark: true });
    last = start + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last), mark: false });
  return segs;
}

const SNIPPET = 190;

function snippetOf(p: Prepared, perToken: Map<string, number>[]): Segment[] {
  const { text } = p.doc;
  const norm = p.normText;
  const allMatched = new Set<string>();
  perToken.forEach((m) => m.forEach((_, w) => allMatched.add(w)));
  // As ocorrências, com a palavra da pesquisa a que respondem.
  const occ: Array<{ pos: number; token: number }> = [];
  for (const m of norm.matchAll(/[a-z0-9]+/g)) {
    const w = m[0];
    if (!allMatched.has(w)) continue;
    const token = perToken.findIndex((map) => map.has(w));
    occ.push({ pos: m.index ?? 0, token });
  }
  let start = 0;
  if (occ.length) {
    // A janela com mais palavras diferentes da pesquisa.
    let bestCount = -1;
    let bestPos = occ[0].pos;
    for (let i = 0; i < occ.length; i++) {
      const seen = new Set<number>();
      for (let j = i; j < occ.length && occ[j].pos - occ[i].pos < SNIPPET - 40; j++) seen.add(occ[j].token);
      if (seen.size > bestCount) {
        bestCount = seen.size;
        bestPos = occ[i].pos;
      }
    }
    start = Math.max(0, bestPos - 50);
    if (start > 0) {
      const space = text.lastIndexOf(" ", start);
      start = space > start - 25 && space >= 0 ? space + 1 : start;
    }
  }
  let end = Math.min(text.length, start + SNIPPET);
  if (end < text.length) {
    const space = text.indexOf(" ", end);
    end = space >= 0 && space - end < 20 ? space : end;
  }
  const slice = text.slice(start, end).replace(/\s+/g, " ");
  const segs = markText(slice, allMatched);
  if (start > 0) segs.unshift({ text: "…", mark: false });
  if (end < text.length) segs.push({ text: "…", mark: false });
  return segs;
}

export function search(index: SearchIndex, query: string, limit = 80): { hits: SearchHit[]; tokens: string[] } {
  const tokens = queryTokens(query);
  if (!tokens.length) return { hits: [], tokens };
  const perToken = expandTokens(index.vocab.keys(), tokens);
  const phrase = tokens.length >= 2 ? normalize(query) : null;

  // Pedaço → melhor peso por palavra da pesquisa.
  const scores = new Map<number, number[]>();
  perToken.forEach((cands, ti) => {
    cands.forEach((wt, w) => {
      for (const di of index.vocab.get(w) ?? []) {
        const entry = index.docs[di].words.get(w)!;
        const v = wt * FIELD_BOOST[entry.field] + Math.min(entry.count, 6) * 0.12 * wt;
        let arr = scores.get(di);
        if (!arr) {
          arr = new Array(tokens.length).fill(0);
          scores.set(di, arr);
        }
        if (v > arr[ti]) arr[ti] = v;
      }
    });
  });

  const hits: SearchHit[] = [];
  scores.forEach((arr, di) => {
    const missing = arr.filter((v) => v === 0).length;
    if (missing > (tokens.length >= 3 ? 1 : 0)) return;
    const p = index.docs[di];
    let score = arr.reduce((s, v) => s + v, 0) * (missing ? 0.6 : 1);
    if (phrase) {
      const flat = p.normText.replace(/\s+/g, " ");
      if (p.normHeading.includes(phrase)) score += 4;
      else if (flat.includes(phrase)) score += 2.5;
    }
    // Pedaços curtos e certeiros sobem um pouco.
    score += 0.4 / (1 + p.doc.text.length / 1500);
    const matchedForDoc = perToken.map((m) => {
      const kept = new Map<string, number>();
      m.forEach((wt, w) => {
        if (p.words.has(w)) kept.set(w, wt);
      });
      return kept;
    });
    const matchedSet = new Set<string>();
    matchedForDoc.forEach((m) => m.forEach((_, w) => matchedSet.add(w)));
    hits.push({
      doc: p.doc,
      score,
      snippet: snippetOf(p, matchedForDoc),
      heading: p.doc.heading ? markText(p.doc.heading, matchedSet) : null,
    });
  });
  hits.sort((a, b) => b.score - a.score);
  return { hits: hits.slice(0, limit), tokens };
}

/** O link de um resultado: a página, com a pesquisa (?q=) para a página
 *  realçar, e a âncora do capítulo/secção. */
export function hitHref(doc: SearchDoc, query: string): string {
  const [path, qs = ""] = doc.href.split("?");
  const params = new URLSearchParams(qs);
  if (doc.kind === "doc") params.set("q", query.trim());
  const s = params.toString();
  return `${path}${s ? `?${s}` : ""}${doc.anchor ? `#${doc.anchor}` : ""}`;
}
