// Posições das keywords por CSV (v77.95) — ler, escrever e calcular.
//
// O fluxo do relatório mensal:
//   1. a app exporta as keywords do cliente num CSV com quatro colunas —
//      Palavra · Posição Semrush · Posição Search Console · Posição Serpstat;
//   2. o consultor preenche-o (Google Sheets) com o que vê em cada ferramenta;
//   3. carrega-o de volta, e a app fica com a MELHOR das três por keyword,
//      comparada com a melhor do mês anterior.
//
// Puro (sem KV, sem React): o browser usa-o para a pré-visualização e o
// servidor volta a ler o mesmo texto com as mesmas regras antes de gravar.

import type { TargetKeyword } from "@/lib/target-keywords-store";
import { detectDelimiter, parseDelimited, squash } from "./shopify-csv";
import {
  KW_CSV_SOURCES,
  MAX_KW_CSV_ROWS,
  kwCsvChange,
  type KeywordTrackingBlock,
  type KwCsvRow,
  type KwCsvSource,
  type KwRankSource,
  type LiveRankBlock,
  type MonthlyReportSnapshot,
} from "./report-types";

export const KW_CSV_HEADERS = [
  "Palavra",
  "Posição Semrush",
  "Posição Search Console",
  "Posição Serpstat",
] as const;

/** Um CSV de keywords cabe folgado nisto; acima é ficheiro errado. */
export const MAX_KW_CSV_CHARS = 1_000_000;

export const KW_SOURCE_LABEL: Record<KwCsvSource, { short: string; long: string }> = {
  semrush: { short: "Semrush", long: "Semrush" },
  gsc: { short: "GSC", long: "Search Console" },
  serpstat: { short: "Serpstat", long: "Serpstat" },
};

/** Sem caracteres invisíveis (espaços de largura zero, hífenes suaves —
 *  chegam à client file por copiar/colar) e com os espaços colapsados. */
export const cleanKw = (s: string) =>
  s.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "").replace(/\s+/g, " ").trim();

export const normKw = (s: string) => cleanKw(s).toLowerCase();

/** A chave para cruzar keywords entre fontes: «dentista biológico» e
 *  «dentista biologico» são a mesma linha (a client file e a folha do
 *  consultor nem sempre escrevem os acentos igual). */
export const foldKw = (s: string) =>
  normKw(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// —— Escrever ——————————————————————————————————————————————————————————

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Uma posição como o Sheets PT a escreve: «6,8», «3». */
export function fmtCsvPos(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
}

/** Linhas → texto CSV (vírgula, como o export do Google Sheets). */
export function toCsv(header: readonly string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

/** O modelo para preencher: as keywords escolhidas, posições em branco. A
 *  coluna Serpstat pode vir já preenchida com a recolha automática deste
 *  relatório (o consultor confirma ou corrige). */
export function kwTemplateCsv(
  keywords: string[],
  serpstatPrefill?: Map<string, number | null>,
): string {
  return toCsv(
    KW_CSV_HEADERS,
    keywords.map((kw) => [
      cleanKw(kw),
      "",
      "",
      serpstatPrefill ? fmtCsvPos(serpstatPrefill.get(foldKw(kw)) ?? null) : "",
    ]),
  );
}

/** A tabela já calculada — para analisar fora (Semrush, Sheets): as três
 *  posições, a melhor, de onde veio, o mês anterior e o Δ. */
export function kwResultsCsv(rows: KwCsvRow[]): string {
  return toCsv(
    [
      ...KW_CSV_HEADERS,
      "Melhor posição",
      "Fonte",
      "Mês anterior",
      "Δ mês",
      "Volume",
      "No plano",
    ],
    rows.map((r) => {
      const c = kwCsvChange(r);
      return [
        r.keyword,
        fmtCsvPos(r.semrush),
        fmtCsvPos(r.gsc),
        fmtCsvPos(r.serpstat),
        fmtCsvPos(r.best),
        r.bestSource ? KW_SOURCE_LABEL[r.bestSource].long : "",
        r.previous ? (r.previous.best === null ? "fora do top 100" : fmtCsvPos(r.previous.best)) : "",
        c === null ? "" : c === "in" ? "entrou" : c === "lost" ? "saiu" : fmtCsvPos(c),
        r.volume,
        r.inPlan ? "sim" : "não",
      ];
    }),
  );
}

/** Uma linha da tabela do Serpstat («Onde o site aparece») para o export. */
export type SerpstatCsvRow = {
  keyword: string;
  position: number | null;
  inPlan: boolean;
  change?: number | null;
  volume?: number | null;
  difficulty?: number | null;
  traffic?: number | null;
  url?: string | null;
};

/** A tabela do Serpstat → CSV, para analisar no Semrush ou no Sheets. */
export function serpstatCsv(rows: SerpstatCsvRow[]): string {
  return toCsv(
    ["Keyword", "Posição Serpstat", "Δ mês", "Volume", "KD", "Tráfego", "URL", "No plano"],
    rows.map((r) => [
      r.keyword,
      r.position ?? "fora do top 100",
      r.change ?? "",
      r.volume ?? "",
      r.difficulty ?? "",
      r.traffic ?? "",
      r.url ?? "",
      r.inPlan ? "sim" : "não",
    ]),
  );
}

/** «Wonderads_Posicoes_White-Clinic_2026-09.csv». */
export function kwCsvFileName(kind: string, client: string, period: string): string {
  const c = client
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `Wonderads_${kind}_${c || "cliente"}_${period}.csv`;
}

// —— Ler ——————————————————————————————————————————————————————————————

export type KwCsvParsedRow = {
  keyword: string;
  semrush: number | null;
  gsc: number | null;
  serpstat: number | null;
};

export type KwCsvParse =
  | {
      ok: true;
      rows: KwCsvParsedRow[];
      warnings: string[];
      /** Que colunas se encontraram — para a pré-visualização dizer «sem
       *  coluna Serpstat» em vez de mostrar uma coluna vazia sem explicação. */
      columns: Record<KwCsvSource, boolean>;
    }
  | { ok: false; error: string };

/** O que se escreve numa célula para dizer «não aparece». */
const NOT_RANKING = new Set([
  "", "-", "–", "—", "x", "n/a", "na", "nd", "n.d.", "0", ">100", "100+",
  "+100", "fora", "fora do top 100", "sem dados", "nao aparece", "não aparece",
  "nan", "none", "null",
]);

/** Uma célula de posição: número de 1 a 100 (uma casa decimal), null =
 *  não aparece, undefined = ilegível. Acima de 100 conta como fora. */
export function parseCsvPos(raw: string | undefined): number | null | undefined {
  const v = (raw ?? "").trim().toLowerCase();
  if (NOT_RANKING.has(v)) return null;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  if (n < 1 || n > 100) return null;
  return Math.round(n * 10) / 10;
}

const KW_HEADERS = [
  "palavra", "palavras", "palavrachave", "palavraschave", "keyword",
  "keywords", "query", "consulta", "termo", "pesquisa", "kw",
];

function findHeaderCols(cells: string[]) {
  const h = cells.map(squash);
  const find = (pred: (x: string) => boolean) => h.findIndex(pred);
  return {
    keyword: find((x) => KW_HEADERS.includes(x) || x.startsWith("palavra") || x.startsWith("keyword")),
    semrush: find((x) => x.includes("semrush")),
    gsc: find((x) => x.includes("searchconsole") || x.includes("gsc") || x.includes("consola")),
    serpstat: find((x) => x.includes("serpstat")),
  };
}

/** Lê o CSV preenchido. Aceita vírgula, ponto e vírgula ou tab (colagem
 *  do Sheets), «6,8» e «6.8», BOM, colunas a mais e por outra ordem. Sem
 *  cabeçalho reconhecível, lê pela ordem do modelo. */
export function parseKwPositionsCsv(text: string): KwCsvParse {
  const clean = text.replace(/^﻿/, "");
  if (!clean.trim()) return { ok: false, error: "O ficheiro está vazio." };
  if (clean.length > MAX_KW_CSV_CHARS) {
    return { ok: false, error: "Ficheiro grande demais para um CSV de keywords." };
  }
  const table = parseDelimited(clean, detectDelimiter(clean));
  if (table.length === 0) return { ok: false, error: "Não encontrei linhas no ficheiro." };

  let cols = findHeaderCols(table[0]);
  let body = table.slice(1);
  const hasHeader =
    cols.keyword >= 0 || cols.semrush >= 0 || cols.gsc >= 0 || cols.serpstat >= 0;
  if (!hasHeader) {
    // Sem cabeçalho: a ordem do modelo.
    cols = { keyword: 0, semrush: 1, gsc: 2, serpstat: 3 };
    body = table;
  } else if (cols.keyword < 0) {
    // Cabeçalho sem a coluna da keyword: a primeira que não é de posição.
    const used = new Set([cols.semrush, cols.gsc, cols.serpstat]);
    cols.keyword = table[0].findIndex((_, i) => !used.has(i));
  }
  if (cols.keyword < 0) {
    return { ok: false, error: "Não encontrei a coluna «Palavra»." };
  }
  if (hasHeader && cols.semrush < 0 && cols.gsc < 0 && cols.serpstat < 0) {
    return {
      ok: false,
      error:
        "Não encontrei nenhuma coluna de posição. O cabeçalho tem de ter «Posição Semrush», «Posição Search Console» ou «Posição Serpstat».",
    };
  }

  const rows: KwCsvParsedRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let dupes = 0;
  const firstLine = hasHeader ? 2 : 1;
  body.forEach((cells, i) => {
    const line = i + firstLine;
    const keyword = cleanKw(cells[cols.keyword] ?? "").slice(0, 120);
    if (!keyword) return;
    const k = foldKw(keyword);
    if (seen.has(k)) {
      dupes += 1;
      return;
    }
    if (rows.length >= MAX_KW_CSV_ROWS) return;
    seen.add(k);
    const read = (src: KwCsvSource): number | null => {
      const idx = cols[src];
      if (idx < 0) return null;
      const v = parseCsvPos(cells[idx]);
      if (v === undefined) {
        warnings.push(
          `Linha ${line} («${keyword}»): «${(cells[idx] ?? "").trim()}» no ${KW_SOURCE_LABEL[src].long} não é uma posição — ficou em branco.`,
        );
        return null;
      }
      return v;
    };
    rows.push({ keyword, semrush: read("semrush"), gsc: read("gsc"), serpstat: read("serpstat") });
  });

  if (rows.length === 0) return { ok: false, error: "O ficheiro não tem keywords." };
  if (dupes > 0) {
    warnings.unshift(
      `${dupes} ${dupes === 1 ? "linha repetida ignorada" : "linhas repetidas ignoradas"} (fica a primeira).`,
    );
  }
  if (body.length > MAX_KW_CSV_ROWS + dupes) {
    warnings.unshift(`Só entram as primeiras ${MAX_KW_CSV_ROWS} keywords.`);
  }
  return {
    ok: true,
    rows,
    warnings: warnings.slice(0, 30),
    columns: { semrush: cols.semrush >= 0, gsc: cols.gsc >= 0, serpstat: cols.serpstat >= 0 },
  };
}

// —— Calcular ———————————————————————————————————————————————————————————

/** A melhor (mais baixa) das três; nos empates ganha a ordem de
 *  KW_CSV_SOURCES (lugar exato antes da média do GSC). */
export function bestOf(r: Pick<KwCsvParsedRow, KwCsvSource>): {
  best: number | null;
  bestSource: KwCsvSource | null;
} {
  let best: number | null = null;
  let bestSource: KwCsvSource | null = null;
  for (const src of KW_CSV_SOURCES) {
    const v = r[src];
    if (v !== null && (best === null || v < best)) {
      best = v;
      bestSource = src;
    }
  }
  return { best, bestSource };
}

/** A melhor posição que a keyword tinha no relatório anterior. null = não
 *  foi acompanhada (ou ficou por medir) nesse mês. */
export function previousBest(
  prev: MonthlyReportSnapshot | null | undefined,
  keyword: string,
): KwCsvRow["previous"] {
  const b = prev?.kwTracking;
  if (!b) return null;
  const k = foldKw(keyword);
  if (b.format === "csv") {
    if (!b.upload) return null;
    const hit = b.rows?.find((r) => foldKw(r.keyword) === k);
    return hit ? { best: hit.best, source: hit.bestSource } : null;
  }
  // Formato v77.82: a melhor das posições escritas à mão.
  const hit = b.keywords.find((x) => foldKw(x.keyword) === k);
  if (!hit) return null;
  let best: number | null = null;
  let source: KwRankSource | null = null;
  let measured = false;
  for (const src of ["semrush", "google", "gsc"] as KwRankSource[]) {
    const v = hit[src];
    if (v !== null) measured = true;
    if (typeof v === "number" && (best === null || v < best)) {
      best = v;
      source = src;
    }
  }
  return measured ? { best, source } : null;
}

/** As linhas lidas → as linhas do relatório: melhor posição, Δ mês e o
 *  que a app já sabe de cada keyword (volume e ★ da client file;
 *  dificuldade e AI Overview do Serpstat deste relatório). */
export function deriveKwCsvRows(
  parsed: KwCsvParsedRow[],
  ctx: {
    targets: TargetKeyword[];
    prev: MonthlyReportSnapshot | null | undefined;
    live?: LiveRankBlock;
  },
): KwCsvRow[] {
  const targetBy = new Map(ctx.targets.map((t) => [foldKw(t.keyword), t] as const));
  const liveBy = new Map(
    [...(ctx.live?.ranks ?? []), ...(ctx.live?.others ?? [])].map(
      (r) => [foldKw(r.keyword), r] as const,
    ),
  );
  return parsed.map((p) => {
    const k = foldKw(p.keyword);
    const t = targetBy.get(k);
    const l = liveBy.get(k);
    const types = l?.types ?? [];
    const aio = types.some((x) => x === "snip_url_in_aio" || x === "snip_fqdn_in_aio")
      ? ("cited" as const)
      : types.includes("ai_overview")
        ? ("shown" as const)
        : undefined;
    return {
      keyword: p.keyword,
      semrush: p.semrush,
      gsc: p.gsc,
      serpstat: p.serpstat,
      ...bestOf(p),
      volume: t?.searchVolume ?? l?.volume ?? null,
      ...(t?.premium ? { premium: true } : {}),
      inPlan: Boolean(t),
      ...(l?.difficulty !== undefined && l?.difficulty !== null ? { difficulty: l.difficulty } : {}),
      ...(aio ? { aio } : {}),
      previous: previousBest(ctx.prev, p.keyword),
    };
  });
}

/** Volta a calcular um bloco CSV já gravado — no Regenerar, para o Δ mês e
 *  o volume acompanharem o relatório anterior e a client file de agora. */
export function refreshKwCsvBlock(
  block: KeywordTrackingBlock,
  ctx: Parameters<typeof deriveKwCsvRows>[1],
): KeywordTrackingBlock {
  if (block.format !== "csv" || !block.rows?.length) return block;
  return {
    ...block,
    required: ctx.targets.length,
    rows: deriveKwCsvRows(block.rows, ctx),
  };
}
