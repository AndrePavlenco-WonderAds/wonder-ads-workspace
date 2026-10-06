// O PDF do Plano de Probation — gerado no servidor com pdf-lib, como os
// templates de proposta (pdf-kit.ts), mas com a Be Vietnam Pro embutida
// (via @pdf-lib/fontkit) e o desenho do protótipo.
//
// Porque não uma captura de ecrã (o que o protótipo fazia): a imagem cortava
// texto a meio e deslocava blocos entre páginas. Aqui cada bloco é medido
// antes de ser desenhado, o texto é texto (selecionável e pesquisável) e a
// paginação segue estas regras:
//   1. nenhum bloco é cortado: um parágrafo, uma linha de tabela, os cartões
//      dos desfechos ou uma linha dos cartões de avaliação vão inteiros para
//      a página seguinte se não couberem;
//   2. uma secção que não cabe salta inteira para a página seguinte, ou
//      parte-se ENTRE blocos — com o título sempre agarrado ao primeiro
//      bloco, o cabeçalho das tabelas repetido e cada pedaço de um cartão
//      partido fechado na sua página;
//   3. a secção 08 (confirmação + assinaturas) nunca se separa;
//   4. qual das duas (saltar ou partir) decide-se plano a plano: geram-se
//      vários planos de paginação (só com alturas) e fica o que deixa a
//      página menos cheia o mais cheia possível, com penalização por cada
//      secção partida — sobretudo os cartões da avaliação. Se a última
//      página ficar quase vazia, experimenta-se puxar blocos para ela.
// Margens iguais em todas as páginas e rodapé com «Página X de Y».
//
// O TEXTO vem todo de document.ts — a mesma fonte da pré-visualização.

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  appendBezierCurve,
  clip,
  closePath,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setCharacterSpacing,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import {
  BRAND,
  HERO,
  KPI_OPTIONS,
  PAGE_FOOTER,
  S01,
  S02,
  S03,
  S04,
  S05,
  S06,
  S07,
  S08,
  decisionNoteFor,
  infoRowsFor,
  kpiColumns,
  signaturesFor,
  type DocEval,
  type DocKpiRow,
  type DocModel,
  type Fill,
  type Para,
} from "./document";

/* ------------------------------ medidas ----------------------------- */

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
/** Margem do conteúdo — igual no topo e nos lados de todas as páginas. */
const M = 40;
const CW = PAGE_W - M * 2;
const TOP = PAGE_H - M;
/** O conteúdo pára aqui; por baixo fica só o rodapé. */
const BOTTOM = 56;
const FOOTER_BASELINE = 26;
const PAGE_CONTENT_H = TOP - BOTTOM;
const SECTION_GAP = 22;

/* ------------------------------ cores ------------------------------- */

function hex(h: string): RGB {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const C = {
  bg: hex("#07080d"),
  ink: hex("#20202a"),
  muted: hex("#6b6b7b"),
  line: hex("#e4e2ee"),
  soft: hex("#f6f4fd"),
  purple: hex("#783df5"),
  blue: hex("#343ed7"),
  magenta: hex("#c535c9"),
  empty: hex("#a9a7b8"),
  /** rgba(0,0,0,.45) sobre branco. */
  label: hex("#8c8c8c"),
  boxLine: hex("#8a8799"),
  footer: hex("#8c8a9b"),
  white: rgb(1, 1, 1),
};

/** A confirmação de leitura feita na app, por baixo da assinatura. */
const SIG_NOTE = hex("#0f7a4a");

/** Gradiente da marca (135°, #343ED7 → #783DF5 a 53,65% → #C535C9), ao
 *  longo de t ∈ [0, 1]. */
function brandAt(t: number): RGB {
  const stops: [number, [number, number, number]][] = [
    [0, [0x34, 0x3e, 0xd7]],
    [0.5365, [0x78, 0x3d, 0xf5]],
    [1, [0xc5, 0x35, 0xc9]],
  ];
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (x <= t1) {
      const k = (x - t0) / (t1 - t0);
      return rgb(
        (c0[0] + (c1[0] - c0[0]) * k) / 255,
        (c0[1] + (c1[1] - c0[1]) * k) / 255,
        (c0[2] + (c1[2] - c0[2]) * k) / 255,
      );
    }
  }
  return hex("#c535c9");
}

/* ------------------------------ fontes ------------------------------ */

type Fonts = { r: PDFFont; sb: PDFFont; b: PDFFont; xb: PDFFont };

// Caminhos literais (e não montados num ciclo) para o traçado de ficheiros
// do Next levar as fontes para dentro da função na Vercel.
const FONT_DIR = path.join(process.cwd(), "src", "lib", "probation", "fonts");
async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const [r, sb, b, xb] = await Promise.all([
    readFile(path.join(FONT_DIR, "BeVietnamPro-Regular.ttf")),
    readFile(path.join(FONT_DIR, "BeVietnamPro-SemiBold.ttf")),
    readFile(path.join(FONT_DIR, "BeVietnamPro-Bold.ttf")),
    readFile(path.join(FONT_DIR, "BeVietnamPro-ExtraBold.ttf")),
  ]);
  // Subconjunto (só os glifos usados) e sem ligaduras: um «fi» desenhado
  // como um glifo só copiava mal do PDF.
  const opts = { subset: true, features: { liga: false, clig: false } };
  return {
    r: await doc.embedFont(r, opts),
    sb: await doc.embedFont(sb, opts),
    b: await doc.embedFont(b, opts),
    xb: await doc.embedFont(xb, opts),
  };
}

/* ----------------------------- desenho ------------------------------ */

type TextStyle = {
  font: PDFFont;
  size: number;
  color: RGB;
  opacity?: number;
  /** Espaço entre letras, em pt (o `letter-spacing` do CSS). */
  tracking?: number;
};

function textWidth(text: string, s: TextStyle): number {
  return s.font.widthOfTextAtSize(text, s.size) + (s.tracking ?? 0) * Array.from(text).length;
}

function drawText(page: PDFPage, text: string, x: number, baseline: number, s: TextStyle) {
  if (!text) return;
  if (s.tracking) page.pushOperators(pushGraphicsState(), setCharacterSpacing(s.tracking));
  page.drawText(text, { x, y: baseline, font: s.font, size: s.size, color: s.color, opacity: s.opacity });
  if (s.tracking) page.pushOperators(popGraphicsState());
}

/** Linha de base de uma linha de texto com `size` dentro de uma caixa de
 *  altura `lh` cujo topo está em `top`. */
function baselineIn(top: number, size: number, lh: number): number {
  return top - (lh - size) / 2 - size * 0.8;
}

type Corners = { tl: number; tr: number; br: number; bl: number };

/** Retângulo de cantos arredondados em notação SVG (origem no canto de
 *  cima à esquerda, y para baixo — é como o drawSvgPath o lê). */
function roundedPath(w: number, h: number, r: number | Corners): string {
  const c = typeof r === "number" ? { tl: r, tr: r, br: r, bl: r } : r;
  const k = 0.5523;
  return [
    `M ${c.tl} 0`,
    `L ${w - c.tr} 0`,
    `C ${w - c.tr + c.tr * k} 0 ${w} ${c.tr - c.tr * k} ${w} ${c.tr}`,
    `L ${w} ${h - c.br}`,
    `C ${w} ${h - c.br + c.br * k} ${w - c.br + c.br * k} ${h} ${w - c.br} ${h}`,
    `L ${c.bl} ${h}`,
    `C ${c.bl - c.bl * k} ${h} 0 ${h - c.bl + c.bl * k} 0 ${h - c.bl}`,
    `L 0 ${c.tl}`,
    `C 0 ${c.tl - c.tl * k} ${c.tl - c.tl * k} 0 ${c.tl} 0`,
    "Z",
  ].join(" ");
}

function roundRect(
  page: PDFPage,
  x: number,
  top: number,
  w: number,
  h: number,
  r: number | Corners,
  o: { fill?: RGB; border?: RGB; borderWidth?: number; opacity?: number; borderOpacity?: number },
) {
  page.drawSvgPath(roundedPath(w, h, r), {
    x,
    y: top,
    color: o.fill,
    borderColor: o.border,
    borderWidth: o.border ? (o.borderWidth ?? 0.75) : undefined,
    opacity: o.opacity,
    borderOpacity: o.borderOpacity,
  });
}

/** Recorta o que se desenhar a seguir a um retângulo arredondado. Fecha-se
 *  com `endClip`. */
function beginClip(page: PDFPage, x: number, top: number, w: number, h: number, r: number) {
  const y = top - h;
  const k = 0.5523 * r;
  page.pushOperators(
    pushGraphicsState(),
    moveTo(x + r, y),
    lineTo(x + w - r, y),
    appendBezierCurve(x + w - r + k, y, x + w, y + r - k, x + w, y + r),
    lineTo(x + w, y + h - r),
    appendBezierCurve(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h),
    lineTo(x + r, y + h),
    appendBezierCurve(x + r - k, y + h, x, y + h - r + k, x, y + h - r),
    lineTo(x, y + r),
    appendBezierCurve(x, y + r - k, x + r - k, y, x + r, y),
    closePath(),
    clip(),
    endPath(),
  );
}

function endClip(page: PDFPage) {
  page.pushOperators(popGraphicsState());
}

function hline(page: PDFPage, x: number, y: number, w: number, color: RGB, thickness = 0.75) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, color, thickness });
}

/** Faixa com o gradiente da marca, em fatias (o pdf-lib não tem gradientes). */
function gradientBar(page: PDFPage, x: number, y: number, w: number, h: number) {
  const n = 120;
  const step = w / n;
  for (let i = 0; i < n; i++) {
    page.drawRectangle({ x: x + i * step, y, width: step + 0.4, height: h, color: brandAt((i + 0.5) / n) });
  }
}

/** Caixa de escolha do protótipo: quadrado com contorno; marcada, roxa com
 *  um filete branco por dentro. */
function checkbox(page: PDFPage, x: number, top: number, size: number, on: boolean) {
  if (on) {
    roundRect(page, x, top, size, size, 2, { fill: C.purple });
    roundRect(page, x + 1.6, top - 1.6, size - 3.2, size - 3.2, 1, { fill: C.purple, border: C.white, borderWidth: 1.1 });
  } else {
    roundRect(page, x, top, size, size, 2, { fill: C.white, border: C.boxLine, borderWidth: 1 });
  }
}

/* -------------------------- texto corrido --------------------------- */
// Um parágrafo é uma lista de «runs» (texto num estilo, ou uma linha em
// branco para escrever à mão). As palavras podem atravessar runs — o
// «[Nome]» e a vírgula que se lhe segue ficam sempre juntos.

type Run = { text: string; style: TextStyle } | { blank: number; style: TextStyle };

type Frag = { text: string; style: TextStyle; w: number } | { blank: number; w: number; style: TextStyle };
type Word = { frags: Frag[]; w: number };
type Line = { words: { word: Word; spaceBefore: number }[]; w: number };

function tokenize(runs: Run[]): (Word | { space: number } | { br: true })[] {
  const out: (Word | { space: number } | { br: true })[] = [];
  let cur: Word | null = null;
  const push = () => {
    if (cur && cur.frags.length) out.push(cur);
    cur = null;
  };
  for (const run of runs) {
    if ("blank" in run) {
      cur ??= { frags: [], w: 0 };
      cur.frags.push({ blank: run.blank, w: run.blank, style: run.style });
      cur.w += run.blank;
      continue;
    }
    // O espaço não separável (U+00A0) fica dentro da palavra de propósito:
    // é ele que mantém «Data: ____ / ____ / ______» numa linha só.
    const parts = run.text.split(/(\n|[ \t]+)/);
    for (const part of parts) {
      if (!part) continue;
      if (part === "\n") {
        push();
        out.push({ br: true });
      } else if (/^[ \t]+$/.test(part)) {
        push();
        out.push({ space: textWidth(" ", run.style) });
      } else {
        cur ??= { frags: [], w: 0 };
        const w = textWidth(part, run.style);
        cur.frags.push({ text: part, style: run.style, w });
        cur.w += w;
      }
    }
  }
  push();
  return out;
}

/** Parte uma palavra mais larga do que a linha (um URL, um código) letra a
 *  letra. */
function splitWord(word: Word, maxW: number): Word[] {
  const out: Word[] = [];
  let cur: Word = { frags: [], w: 0 };
  for (const f of word.frags) {
    if (!("text" in f)) {
      if (cur.w + f.w > maxW && cur.frags.length) {
        out.push(cur);
        cur = { frags: [], w: 0 };
      }
      cur.frags.push(f);
      cur.w += f.w;
      continue;
    }
    let chunk = "";
    for (const ch of Array.from(f.text)) {
      const w = textWidth(chunk + ch, f.style);
      if (cur.w + w > maxW && (chunk || cur.frags.length)) {
        if (chunk) cur.frags.push({ text: chunk, style: f.style, w: textWidth(chunk, f.style) });
        cur.w += chunk ? textWidth(chunk, f.style) : 0;
        out.push(cur);
        cur = { frags: [], w: 0 };
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    if (chunk) {
      const w = textWidth(chunk, f.style);
      cur.frags.push({ text: chunk, style: f.style, w });
      cur.w += w;
    }
  }
  if (cur.frags.length) out.push(cur);
  return out;
}

function wrapRuns(runs: Run[], maxW: number): Line[] {
  const lines: Line[] = [];
  let line: Line = { words: [], w: 0 };
  let pendingSpace = 0;
  const flush = () => {
    lines.push(line);
    line = { words: [], w: 0 };
    pendingSpace = 0;
  };
  for (const tok of tokenize(runs)) {
    if ("br" in tok) {
      flush();
      continue;
    }
    if ("space" in tok) {
      if (line.words.length) pendingSpace = tok.space;
      continue;
    }
    const pieces = tok.w > maxW ? splitWord(tok, maxW) : [tok];
    for (const word of pieces) {
      const sp = line.words.length ? pendingSpace : 0;
      if (line.words.length && line.w + sp + word.w > maxW) flush();
      const space = line.words.length ? pendingSpace : 0;
      line.words.push({ word, spaceBefore: space });
      line.w += space + word.w;
      pendingSpace = 0;
    }
  }
  if (line.words.length || lines.length === 0) lines.push(line);
  return lines;
}

function drawLines(
  page: PDFPage,
  lines: Line[],
  x: number,
  top: number,
  size: number,
  lh: number,
  align: "left" | "right" = "left",
  boxW = 0,
) {
  lines.forEach((line, i) => {
    const base = baselineIn(top - i * lh, size, lh);
    let cx = align === "right" ? x + boxW - line.w : x;
    for (const { word, spaceBefore } of line.words) {
      cx += spaceBefore;
      for (const f of word.frags) {
        if ("text" in f) {
          drawText(page, f.text, cx, base, f.style);
        } else {
          hline(page, cx + 1, base - 2, f.w - 2, f.style.color, 0.7);
        }
        cx += f.w;
      }
    }
  });
}

/** Um bloco de texto medido: altura + função que o desenha. */
type TextBlock = { lines: Line[]; h: number; draw: (page: PDFPage, x: number, top: number) => void };

function textBlock(runs: Run[], maxW: number, size: number, lh: number, align: "left" | "right" = "left"): TextBlock {
  const lines = wrapRuns(runs, maxW);
  return {
    lines,
    h: lines.length * lh,
    draw: (page, x, top) => drawLines(page, lines, x, top, size, lh, align, maxW),
  };
}

/* --------------------- do documento para «runs» --------------------- */

/** Largura da linha em branco de cada campo por preencher. */
const FILL_W: Record<Fill, number> = {
  prazo: 58,
  checkin: 86,
  recursos: 190,
  apoio: 96,
  ferramenta: 96,
};

type Ctx = { doc: PDFDocument; f: Fonts; logo: PDFImage | null; model: DocModel };

function paraRuns(
  ctx: Ctx,
  para: Para,
  base: { font: PDFFont; bold: PDFFont; size: number; color: RGB; empty: RGB; emptyOpacity?: number; opacity?: number },
): Run[] {
  const runs: Run[] = [];
  const st = (font: PDFFont, color: RGB, opacity?: number): TextStyle => ({
    font,
    size: base.size,
    color,
    opacity,
  });
  for (const seg of para) {
    if (typeof seg === "string") {
      runs.push({ text: seg, style: st(base.font, base.color, base.opacity) });
    } else if ("b" in seg) {
      runs.push({ text: seg.b, style: st(base.bold, base.color, base.opacity) });
    } else if ("bind" in seg) {
      const v = ctx.model.binds[seg.bind];
      const font = seg.strong ? base.bold : base.font;
      runs.push(
        v
          ? { text: v, style: st(font, base.color, base.opacity) }
          : { text: seg.empty, style: st(font, base.empty, base.emptyOpacity) },
      );
    } else {
      const v = ctx.model.fills[seg.fill];
      runs.push(
        v
          ? { text: v, style: st(base.font, base.color, base.opacity) }
          : { blank: FILL_W[seg.fill], style: st(base.font, C.boxLine) },
      );
    }
  }
  return runs;
}

/* ------------------------------ estilos ------------------------------ */

const BODY = 9.8;
const BODY_LH = 15;
const P_GAP = 6.5;

function bodyRuns(ctx: Ctx, para: Para, size = BODY): Run[] {
  return paraRuns(ctx, para, { font: ctx.f.r, bold: ctx.f.b, size, color: C.ink, empty: C.empty });
}

/** Rótulo pequeno em maiúsculas espaçadas («QUANDO SE APLICA»). */
function labelStyle(ctx: Ctx, color = C.label): TextStyle {
  return { font: ctx.f.b, size: 6.4, color, tracking: 1.15 };
}

/* ------------------------------ blocos ------------------------------- */
// Um bloco tem altura conhecida e desenha-se a partir do topo. A paginação
// só olha para alturas — nunca desenha nada que não saiba se cabe.

type Block = {
  h: number;
  draw: (page: PDFPage, top: number) => void;
};

/** Uma moldura à volta de vários blocos (o par de cartões da avaliação). Os
 *  blocos paginam-se um a um; a moldura desenha-se no fim, por página, à
 *  volta dos que lá ficaram — partida entre páginas, cada pedaço sai como um
 *  cartão fechado. */
type Frame = {
  /** Margem de baixo do cartão: reservada em cada página onde ele parte. */
  padBottom: number;
  draw: (page: PDFPage, top: number, bottom: number) => void;
};

type Item = {
  block: Block;
  /** Espaço antes do bloco. */
  gap: number;
  /** Vai sempre na mesma página que o bloco seguinte (títulos, e a frase
   *  que apresenta uma tabela ou um par de cartões). */
  keepWithNext?: boolean;
  /** Desenhado antes do bloco quando ele abre uma página nova (o cabeçalho
   *  de uma tabela partida, o topo de um cartão partido). */
  header?: Block;
  frame?: Frame;
  /** Último bloco da moldura (já traz a margem de baixo). */
  frameEnd?: boolean;
};

type Section = {
  /** Os blocos da secção, pela ordem. */
  items: Item[];
  /** Nunca partir (a secção 08). */
  keepTogether?: boolean;
};

function stack(blocks: { block: Block; gap: number }[]): Block {
  const h = blocks.reduce((s, b, i) => s + b.block.h + (i ? b.gap : 0), 0);
  return {
    h,
    draw: (page, top) => {
      let y = top;
      blocks.forEach((b, i) => {
        if (i) y -= b.gap;
        b.block.draw(page, y);
        y -= b.block.h;
      });
    },
  };
}

function paragraph(ctx: Ctx, para: Para, opts: { x?: number; w?: number; size?: number; lh?: number } = {}): Block {
  const x = opts.x ?? M;
  const w = opts.w ?? CW;
  const tb = textBlock(bodyRuns(ctx, para, opts.size ?? BODY), w, opts.size ?? BODY, opts.lh ?? BODY_LH);
  return { h: tb.h, draw: (page, top) => tb.draw(page, x, top) };
}

function heading(ctx: Ctx, n: string, title: string): Block {
  const numStyle: TextStyle = { font: ctx.f.xb, size: 8.2, color: C.purple, tracking: 1 };
  const titleStyle: TextStyle = { font: ctx.f.b, size: 13.2, color: C.ink };
  const h = 19;
  return {
    h,
    draw: (page, top) => {
      const base = baselineIn(top, 13.2, h);
      drawText(page, n, M, base, numStyle);
      drawText(page, title, M + textWidth(n, numStyle) + 8, base, titleStyle);
    },
  };
}

/** Lista com marcadores roxos. */
function bulletList(ctx: Ctx, items: Para[], x: number, w: number, gap = 3.5): Block {
  const indent = 13;
  const blocks = items.map((it) => textBlock(bodyRuns(ctx, it), w - indent, BODY, BODY_LH));
  const h = blocks.reduce((s, b) => s + b.h, 0) + gap * (blocks.length - 1);
  return {
    h,
    draw: (page, top) => {
      let y = top;
      for (const b of blocks) {
        page.drawCircle({ x: x + 4.5, y: baselineIn(y, BODY, BODY_LH) + BODY * 0.32, size: 1.6, color: C.purple });
        b.draw(page, x + indent, y);
        y -= b.h + gap;
      }
    },
  };
}

/** A caixa lilás com a barra roxa à esquerda. */
function note(ctx: Ctx, inner: (x: number, w: number) => Block): Block {
  const padX = 12;
  const padY = 9;
  const bar = 2.2;
  const content = inner(M + bar + padX, CW - bar - padX * 2);
  const h = content.h + padY * 2;
  return {
    h,
    draw: (page, top) => {
      roundRect(page, M, top, CW, h, { tl: 0, tr: 7, br: 7, bl: 0 }, { fill: C.soft });
      page.drawRectangle({ x: M, y: top - h, width: bar, height: h, color: C.purple });
      content.draw(page, top - padY);
    },
  };
}

/* ------------------------------- tabelas ------------------------------ */

type Measured = { h: number; draw: (page: PDFPage, x: number, top: number) => void };
type Cell = { runs: Run[] } | { custom: (w: number) => Measured };

function tableRow(
  cells: Cell[],
  widths: number[],
  opts: { size: number; lh: number; padX: number; padY: number; minH?: number; border: RGB; borderW: number },
): Block {
  const laid: Measured[] = cells.map((c, i) => {
    const w = widths[i] - opts.padX * 2;
    if ("runs" in c) {
      const tb = textBlock(c.runs, w, opts.size, opts.lh);
      return { h: tb.h, draw: tb.draw };
    }
    return c.custom(w);
  });
  const h = Math.max(Math.max(...laid.map((l) => l.h), 0) + opts.padY * 2, opts.minH ?? 0);
  return {
    h,
    draw: (page, top) => {
      let x = M;
      laid.forEach((l, i) => {
        l.draw(page, x + opts.padX, top - opts.padY);
        x += widths[i];
      });
      hline(page, M, top - h, CW, opts.border, opts.borderW);
    },
  };
}

function infoTable(ctx: Ctx): Block[] {
  const widths = [CW * 0.34, CW * 0.66];
  return infoRowsFor(ctx.model).map((r) =>
    tableRow(
      [
        { runs: [{ text: r.label, style: { font: ctx.f.sb, size: 9.2, color: C.ink } }] },
        { runs: paraRuns(ctx, r.value, { font: ctx.f.r, bold: ctx.f.b, size: 9.2, color: C.ink, empty: C.empty }) },
      ],
      widths,
      { size: 9.2, lh: 13.5, padX: 7, padY: 6.2, border: C.line, borderW: 0.75 },
    ),
  );
}

/** As caixas Sim / Parcial / Não, em linha (partem para a linha de baixo se
 *  a coluna for estreita). */
function optionsInline(ctx: Ctx, met: DocKpiRow["met"]) {
  return (w: number): Measured => {
    const box = 7.6;
    const gapIn = 3.4;
    const gapOut = 6;
    const lh = 13;
    const items = KPI_OPTIONS.map((o) => {
      const on = met === o.id;
      const st: TextStyle = { font: on ? ctx.f.sb : ctx.f.r, size: 8.1, color: C.ink };
      return { o, on, st, w: box + gapIn + textWidth(o.label, st) };
    });
    const rows: (typeof items)[] = [[]];
    let cur = 0;
    for (const it of items) {
      if (rows[rows.length - 1].length && cur + gapOut + it.w > w) {
        rows.push([]);
        cur = 0;
      }
      cur += (rows[rows.length - 1].length ? gapOut : 0) + it.w;
      rows[rows.length - 1].push(it);
    }
    return {
      h: rows.length * lh,
      draw: (page, x, top) => {
        rows.forEach((row, r) => {
          let cx = x;
          const rowTop = top - r * lh;
          const base = baselineIn(rowTop, 8.1, lh);
          for (const it of row) {
            checkbox(page, cx, base + box - 0.6, box, it.on);
            drawText(page, it.o.label, cx + box + gapIn, base, it.st);
            cx += it.w + gapOut;
          }
        });
      },
    };
  };
}

function kpiTable(ctx: Ctx, rows: DocKpiRow[], which: 15 | 30): Item[] {
  const cols = kpiColumns(which);
  const numW = 24;
  const fixed = cols.map((c) => (c.width ? c.width * CW : 0));
  const used = numW + fixed.reduce((s, v) => s + v, 0);
  const widths = cols.map((c, i) => (i === 0 ? numW : c.width ? c.width * CW : CW - used));
  const headerStyle: TextStyle = { font: ctx.f.b, size: 6.3, color: C.muted, tracking: 1 };
  const header = tableRow(
    cols.map((c) => ({ runs: [{ text: c.label.toUpperCase(), style: headerStyle }] })),
    widths,
    { size: 6.3, lh: 9.5, padX: 6, padY: 6, border: C.ink, borderW: 1.4 },
  );
  const cell = (text: string): Cell => ({ runs: [{ text, style: { font: ctx.f.r, size: 8.8, color: C.ink } }] });
  const body = rows.map((r, i) =>
    tableRow(
      [
        { runs: [{ text: String(i + 1), style: { font: ctx.f.b, size: 8.8, color: C.purple } }] },
        cell(r.kpi),
        cell(r.target),
        cell(r.measure),
        cell(r.result),
        { custom: optionsInline(ctx, r.met) },
      ],
      widths,
      // Linhas vazias (template, ou KPI por escrever) ficam mais altas para
      // se escrever à mão.
      { size: 8.8, lh: 12.6, padX: 6, padY: 6.5, minH: r.kpi || r.target || r.measure ? 27 : 32, border: C.line, borderW: 0.75 },
    ),
  );
  // O cabeçalho vai agarrado à primeira linha; as outras repetem-no se
  // abrirem página.
  return [
    { block: stack([{ block: header, gap: 0 }, { block: body[0], gap: 0 }]), gap: 8 },
    ...body.slice(1).map((b) => ({ block: b, gap: 0, header })),
  ];
}

/* -------------------------- cartões (05 e 07) ------------------------- */

function outcomeCards(ctx: Ctx): Block {
  const gap = 8;
  const w = (CW - gap * 2) / 3;
  const pad = 11;
  const inner = w - pad * 2;
  const label = labelStyle(ctx);
  const cards = S05.outcomes.map((o) => {
    const color = hex(o.color);
    const title = textBlock([{ text: o.title, style: { font: ctx.f.b, size: 10.2, color: C.ink } }], inner, 10.2, 12.8);
    const p = (t: string) => textBlock([{ text: t, style: { font: ctx.f.r, size: 8.5, color: C.ink } }], inner, 8.5, 12.6);
    const when = p(o.when);
    const what = p(o.what);
    const h = 3 + 11 + 9 + 2 + title.h + 6 + 9 + 2 + when.h + 7 + 9 + 2 + what.h + 10;
    return { o, color, title, when, what, h };
  });
  const h = Math.max(...cards.map((c) => c.h));
  return {
    h,
    draw: (page, top) => {
      cards.forEach((c, i) => {
        const x = M + i * (w + gap);
        beginClip(page, x, top, w, h, 9);
        page.drawRectangle({ x, y: top - 3, width: w, height: 3, color: c.color });
        endClip(page);
        roundRect(page, x, top, w, h, 9, { border: C.line, borderWidth: 0.75 });
        let y = top - 3 - 11;
        drawText(page, c.o.k.toUpperCase(), x + pad, y - 6.4, { ...label, color: c.color });
        y -= 9 + 2;
        c.title.draw(page, x + pad, y);
        y -= c.title.h + 6;
        drawText(page, S05.whenLabel.toUpperCase(), x + pad, y - 6.4, label);
        y -= 9 + 2;
        c.when.draw(page, x + pad, y);
        y -= c.when.h + 7;
        drawText(page, S05.whatLabel.toUpperCase(), x + pad, y - 6.4, label);
        y -= 9 + 2;
        c.what.draw(page, x + pad, y);
      });
    },
  };
}

/** O par de cartões da secção 07, linha a linha: cada linha (título, KPIs
 *  cumpridos, cada caixa, decisão…) leva os dois cartões lado a lado, com a
 *  mesma altura. Assim o par pode partir ENTRE linhas quando as avaliações
 *  têm textos compridos, em vez de saltar inteiro e deixar meia página em
 *  branco. Normalmente cabe tudo e sai igual ao protótipo. */
function evalRows(ctx: Ctx): Item[] {
  const gap = 9;
  const w = (CW - gap) / 2;
  const pad = 11;
  const inner = w - pad * 2;
  const xs = [M, M + w + gap];
  const b = ctx.model.binds;
  const sides = [
    { title: S07.evals[0].title, when: b.d15, ev: ctx.model.eval15 },
    { title: S07.evals[1].title, when: b.d30, ev: ctx.model.eval30 },
  ];
  const label = labelStyle(ctx);
  const valueStyle: TextStyle = { font: ctx.f.r, size: 8.9, color: C.ink };
  const blankStyle: TextStyle = { ...valueStyle, color: C.boxLine };
  const val = (v: string, blank: number): Run => (v ? { text: v, style: valueStyle } : { blank, style: blankStyle });
  const inline = (runs: Run[]) => textBlock(runs, inner, 8.9, 13);
  /** Espaço antes do rótulo + rótulo + folga. */
  const LAB = 7 + 9 + 1.5;
  const drawLabel = (page: PDFPage, x: number, top: number, text: string) =>
    drawText(page, text.toUpperCase(), x, top - 7 - 6.4, label);

  type Part = { h: number; draw: (page: PDFPage, x: number, top: number, h: number) => void };
  const row = (parts: Part[], padTop = 0, padBottom = 0): Block => {
    const inH = Math.max(...parts.map((p) => p.h));
    return {
      h: inH + padTop + padBottom,
      draw: (page, top) => parts.forEach((p, i) => p.draw(page, xs[i] + pad, top - padTop, inH)),
    };
  };

  const head = row(
    sides.map((sd) => ({
      h: 26,
      draw: (page, x, top) => {
        drawText(page, sd.title, x, baselineIn(top, 10.2, 13.5), { font: ctx.f.b, size: 10.2, color: C.ink });
        drawText(page, sd.when || HERO.dateEmpty, x, baselineIn(top - 13.5, 8.5, 12.5), {
          font: ctx.f.r,
          size: 8.5,
          color: sd.when ? C.muted : C.empty,
        });
      },
    })),
    pad,
  );

  const labelled = (text: string, content: (sd: (typeof sides)[number]) => TextBlock): Block =>
    row(
      sides.map((sd) => {
        const tb = content(sd);
        return {
          h: LAB + tb.h,
          draw: (page, x, top) => {
            drawLabel(page, x, top, text);
            tb.draw(page, x, top - LAB);
          },
        };
      }),
    );

  const met = labelled(S07.labels.met, (sd) =>
    inline([val(sd.ev.metN, 34), { text: S07.metPh.of, style: valueStyle }, val(sd.ev.metTotal, 34)]),
  );

  // As caixas de texto: as duas do mesmo par ficam com a mesma altura.
  const box = (text: string, pick: (ev: DocEval) => string): Block => {
    const tbs = sides.map((sd) => {
      const v = pick(sd.ev);
      return { v, tb: textBlock(v ? [{ text: v, style: valueStyle }] : [], inner - 14, 8.9, 12.8) };
    });
    const boxH = Math.max(43, ...tbs.map((t) => (t.v ? t.tb.h + 11 : 0)));
    return row(
      tbs.map((t) => ({
        h: LAB + boxH,
        draw: (page, x, top) => {
          drawLabel(page, x, top, text);
          roundRect(page, x, top - LAB, inner, boxH, 6, { border: C.line, borderWidth: 0.75 });
          if (t.v) t.tb.draw(page, x + 7, top - LAB - 5);
        },
      })),
    );
  };

  const decLh = 13.5;
  const decH = S07.options.length * decLh + 14;
  const decision = row(
    sides.map((sd) => ({
      h: LAB + decH,
      draw: (page, x, top) => {
        drawLabel(page, x, top, S07.labels.decision);
        const t = top - LAB;
        roundRect(page, x, t, inner, decH, 7, { fill: C.soft });
        S07.options.forEach((o, i) => {
          const base = baselineIn(t - 7 - i * decLh, 8.9, decLh);
          const on = sd.ev.decision === o.id;
          checkbox(page, x + 8, base + 7.6 - 0.6, 7.6, on);
          drawText(page, o.label, x + 8 + 7.6 + 4, base, { font: on ? ctx.f.sb : ctx.f.r, size: 8.9, color: C.ink });
        });
      },
    })),
  );

  const newDate = labelled(S07.labels.newDate, (sd) => inline([val(sd.ev.newDate, 80)]));
  const decidedByParts = sides.map((sd) => {
    const tb = inline([val(sd.ev.decidedBy, 120)]);
    return {
      h: LAB + tb.h,
      draw: (page: PDFPage, x: number, top: number) => {
        drawLabel(page, x, top, S07.labels.decidedBy);
        tb.draw(page, x, top - LAB);
      },
    };
  });
  const decidedBy = row(decidedByParts, 0, pad);

  const frame: Frame = {
    padBottom: pad,
    draw: (page, top, bottom) =>
      xs.forEach((x) => roundRect(page, x, top, w, top - bottom, 9, { border: C.line, borderWidth: 0.75 })),
  };
  // Num cartão partido, o pedaço da página seguinte começa com a margem de
  // cima (os rótulos já trazem 7 pt).
  const cont: Block = { h: pad - 5, draw: () => {} };
  const f = (block: Block, extra: Partial<Item> = {}): Item => ({ block, gap: 0, frame, header: cont, ...extra });

  return [
    f(head, { gap: 9, header: undefined, keepWithNext: true }),
    f(met, { keepWithNext: true }),
    f(box(S07.labels.wentWell, (ev) => ev.wentWell)),
    f(box(S07.labels.fellShort, (ev) => ev.fellShort)),
    f(box(S07.labels.comment, (ev) => ev.consultantComment)),
    // Decisão, nova data e quem decidiu vão sempre juntos.
    f(decision, { keepWithNext: true }),
    f(newDate, { keepWithNext: true }),
    f(decidedBy, { frameEnd: true }),
  ];
}

function signatures(ctx: Ctx): Block {
  const gap = 15;
  // Três assinaturas, ou duas quando a direção assina sozinha (sem chefia
  // intermédia) — as colunas alargam para ocupar a linha toda.
  const sigs = signaturesFor(ctx.model);
  const w = (CW - gap * (sigs.length - 1)) / sigs.length;
  const b = ctx.model.binds;
  const roleStyle: TextStyle = { font: ctx.f.r, size: 7.6, color: C.muted };
  const noteStyle: TextStyle = { font: ctx.f.sb, size: 7.4, color: SIG_NOTE };
  const roles = sigs.map((s) => textBlock([{ text: s.role, style: roleStyle }], w, 7.6, 11));
  const names = sigs.map((s) =>
    textBlock(
      [{ text: b[s.bind] || s.empty, style: { font: ctx.f.b, size: 9, color: b[s.bind] ? C.ink : C.empty } }],
      w,
      9,
      12.5,
    ),
  );
  const notes = sigs.map((s) => {
    const t = ctx.model.sigNotes[s.bind];
    return t ? textBlock([{ text: t, style: noteStyle }], w, 7.4, 10.5) : null;
  });
  const lineAt = 40;
  const h =
    lineAt +
    4 +
    Math.max(...names.map((n) => n.h)) +
    Math.max(...roles.map((r) => r.h)) +
    Math.max(0, ...notes.map((n) => (n ? n.h + 2 : 0)));
  return {
    h,
    draw: (page, top) => {
      sigs.forEach((_, i) => {
        const x = M + i * (w + gap);
        hline(page, x, top - lineAt, w, C.ink, 1.1);
        names[i].draw(page, x, top - lineAt - 4);
        roles[i].draw(page, x, top - lineAt - 4 - names[i].h);
        notes[i]?.draw(page, x, top - lineAt - 4 - names[i].h - roles[i].h - 2);
      });
    },
  };
}

function docFoot(ctx: Ctx): Block {
  const st: TextStyle = { font: ctx.f.r, size: 7.6, color: C.muted };
  const left = S08.foot[0];
  const leftW = textWidth(left, st);
  const gap = 16;
  const right = textBlock([{ text: S08.foot[1], style: st }], CW - leftW - gap, 7.6, 11);
  const h = 10 + Math.max(11, right.h);
  return {
    h,
    draw: (page, top) => {
      hline(page, M, top, CW, C.line);
      drawText(page, left, M, baselineIn(top - 10, 7.6, 11), st);
      right.draw(page, M + leftW + gap, top - 10);
    },
  };
}

/* -------------------------------- topo -------------------------------- */

function hero(ctx: Ctx): Block {
  const padX = 24;
  const padTop = 22;
  const padBottom = 24;
  const innerW = CW - padX * 2;
  const b = ctx.model.binds;
  const white = C.white;

  const title = textBlock(
    paraRuns(ctx, [HERO.title], {
      font: ctx.f.xb,
      bold: ctx.f.xb,
      size: 22,
      color: white,
      empty: white,
      emptyOpacity: 0.38,
    }),
    innerW,
    22,
    25.5,
  );
  const sub = textBlock(
    paraRuns(ctx, HERO.sub, {
      font: ctx.f.r,
      bold: ctx.f.b,
      size: 9.5,
      color: white,
      opacity: 0.72,
      empty: white,
      emptyOpacity: 0.38,
    }),
    innerW,
    9.5,
    13.5,
  );
  const brandH = 26;
  const eyebrowH = 9;
  const tileH = 54;
  const h = padTop + brandH + 19 + eyebrowH + 5 + title.h + 5 + sub.h + 16 + tileH + padBottom;

  return {
    h,
    draw: (page, top) => {
      const x = M;
      beginClip(page, x, top, CW, h, 10);
      page.drawRectangle({ x, y: top - h, width: CW, height: h, color: C.bg });
      // O brilho do canto: anéis concêntricos com a opacidade calculada para
      // o conjunto imitar o radial-gradient do protótipo.
      const cx = x + CW - 61;
      const cy = top - 34;
      const R = 143;
      const N = 48;
      const target = (t: number) =>
        t < 0.45 ? 0.75 + (0.3 - 0.75) * (t / 0.45) : t < 0.68 ? 0.3 + (0.12 - 0.3) * ((t - 0.45) / 0.23) : 0.12 * (1 - (t - 0.68) / 0.32);
      const colorAt = (t: number) => {
        const lerp = (a: number[], c: number[], k: number) => rgb(...(a.map((v, i) => (v + (c[i] - v) * k) / 255) as [number, number, number]));
        const p = [120, 61, 245];
        const bl = [52, 62, 215];
        const mg = [197, 53, 201];
        return t < 0.45 ? lerp(p, bl, t / 0.45) : lerp(bl, mg, Math.min(1, (t - 0.45) / 0.23));
      };
      let acc = 0;
      for (let i = 0; i < N; i++) {
        const t = 1 - i / N; // de fora para dentro
        const want = target(Math.max(0, t - 0.5 / N));
        const a = acc >= 1 ? 0 : Math.max(0, (want - acc) / (1 - acc));
        if (a > 0.001) page.drawCircle({ x: cx, y: cy, size: R * t, color: colorAt(t), opacity: Math.min(1, a) });
        acc = acc + a * (1 - acc);
      }
      gradientBar(page, x, top - h, CW, 2.8);
      endClip(page);

      const ix = x + padX;
      let y = top - padTop;
      if (ctx.logo) {
        page.drawImage(ctx.logo, { x: ix, y: y - brandH, width: brandH, height: brandH });
      }
      drawText(page, BRAND, ix + (ctx.logo ? brandH + 7 : 0), baselineIn(y, 13.5, brandH), {
        font: ctx.f.b,
        size: 13.5,
        color: white,
      });
      y -= brandH + 19;
      const eyebrow = `${HERO.eyebrow}${ctx.model.periodLabel ? ` · ${ctx.model.periodLabel}` : ""}`.toUpperCase();
      drawText(page, eyebrow, ix, y - 6.8, { font: ctx.f.b, size: 6.8, color: white, opacity: 0.62, tracking: 1.5 });
      y -= eyebrowH + 5;
      title.draw(page, ix, y);
      y -= title.h + 5;
      sub.draw(page, ix, y);
      y -= sub.h + 16;

      const gap = 8;
      const tw = (innerW - gap * 2) / 3;
      HERO.tiles.forEach((t, i) => {
        const tx = ix + i * (tw + gap);
        roundRect(page, tx, y, tw, tileH, 8, {
          fill: white,
          opacity: 0.05,
          border: white,
          borderOpacity: 0.16,
          borderWidth: 0.75,
        });
        drawText(page, t.label.toUpperCase(), tx + 10, y - 9 - 6.4, {
          font: ctx.f.b,
          size: 6.4,
          color: white,
          opacity: 0.6,
          tracking: 1.4,
        });
        const v = b[t.bind];
        drawText(page, v || HERO.dateEmpty, tx + 10, y - 9 - 9 - 14.2, {
          font: ctx.f.b,
          size: 14.2,
          color: white,
          opacity: v ? 1 : 0.38,
        });
        drawText(page, t.small, tx + 10, y - tileH + 9, { font: ctx.f.r, size: 7.6, color: white, opacity: 0.6 });
      });
    },
  };
}

/* ------------------------------- secções ------------------------------ */

function sections(ctx: Ctx): Section[] {
  const m = ctx.model;
  const H = (n: string, t: string): Block => heading(ctx, n, t);
  const s01: Section = {
    items: [{ block: H(S01.n, S01.title), gap: 0, keepWithNext: true }, ...infoTable(ctx).map((b, i) => ({ block: b, gap: i ? 0 : 4 }))],
  };

  const s02: Section = {
    items: [
      { block: H(S02.n, S02.title), gap: 0, keepWithNext: true },
      ...S02.paragraphs.map((p, i) => ({ block: paragraph(ctx, p), gap: i ? P_GAP : 6 })),
      {
        block: note(ctx, (x, w) =>
          stack([
            {
              block: (() => {
                const tb = textBlock([{ text: S02.note.title, style: { font: ctx.f.b, size: BODY, color: C.ink } }], w, BODY, BODY_LH);
                return { h: tb.h, draw: (page: PDFPage, top: number) => tb.draw(page, x, top) };
              })(),
              gap: 0,
            },
            { block: bulletList(ctx, S02.note.items, x, w), gap: 5 },
          ]),
        ),
        gap: 10,
      },
    ],
  };

  const kpiSection = (s: typeof S03, rows: DocKpiRow[], which: 15 | 30): Section => ({
    items: [
      { block: H(s.n, s.title), gap: 0, keepWithNext: true },
      { block: paragraph(ctx, s.intro), gap: 6, keepWithNext: true },
      ...kpiTable(ctx, rows, which),
      { block: paragraph(ctx, s.outro), gap: 9 },
    ],
  });

  const s05: Section = {
    items: [
      { block: H(S05.n, S05.title), gap: 0, keepWithNext: true },
      { block: paragraph(ctx, S05.intro), gap: 6, keepWithNext: true },
      { block: outcomeCards(ctx), gap: 9 },
      { block: note(ctx, (x, w) => paragraph(ctx, decisionNoteFor(ctx.model), { x, w })), gap: 10 },
    ],
  };

  const s06: Section = {
    items: [
      { block: H(S06.n, S06.title), gap: 0, keepWithNext: true },
      { block: paragraph(ctx, S06.intro), gap: 6, keepWithNext: true },
      { block: bulletList(ctx, S06.ours, M + 4, CW - 4), gap: 5 },
      { block: paragraph(ctx, S06.askIntro), gap: 8, keepWithNext: true },
      { block: bulletList(ctx, S06.theirs, M + 4, CW - 4), gap: 5 },
    ],
  };

  const s07: Section = {
    items: [
      { block: H(S07.n, S07.title), gap: 0, keepWithNext: true },
      { block: paragraph(ctx, S07.intro), gap: 6, keepWithNext: true },
      ...evalRows(ctx),
    ],
  };

  const s08: Section = {
    keepTogether: true,
    items: [
      { block: H(S08.n, S08.title), gap: 0, keepWithNext: true },
      { block: paragraph(ctx, S08.text), gap: 6 },
      { block: signatures(ctx), gap: 4 },
      { block: docFoot(ctx), gap: 20 },
    ],
  };

  return [
    s01,
    s02,
    kpiSection(S03, m.kpis15, 15),
    kpiSection(S04, m.kpis30, 30),
    s05,
    s06,
    s07,
    s08,
  ];
}

/* ------------------------------ paginação ----------------------------- */
// Em duas fases: primeiro um PLANO (que bloco fica em que página, só com
// alturas), depois o desenho. Assim dá para experimentar planos diferentes
// antes de desenhar uma linha — é o que evita a última página quase vazia.

type Placed = { block: Block; top: number; item?: Item; sec?: number };
type PagePlan = { placed: Placed[]; y: number };

/** Abaixo do limiar, uma secção que não cabe parte-se entre blocos; acima,
 *  salta inteira para a página seguinte. Cada limiar dá um plano (0 = parte
 *  sempre, 1 = nunca parte) e fica o que pontuar melhor — não há um número
 *  mágico que sirva para um plano curto e para um com 12 KPIs. */
const WHOLE_THRESHOLDS = [0, 0.2, 0.3, 0.45, 0.6, 1];
/** Abaixo disto, a última página conta como quase vazia e tenta-se encher. */
const LAST_PAGE_MIN = 0.4;
/** Ao encher a última página: mover uma secção inteira não pode deixar a
 *  anterior abaixo de 25%; partir uma secção, abaixo de meio. */
const PREV_MIN_WHOLE = 0.25;
const PREV_MIN_SPLIT = 0.5;
/** Penalizações da pontuação, em fração de página: partir o par de cartões
 *  da avaliação conta como uma página 25% mais vazia (é o formulário da
 *  reunião — partido, vira-se a página a meio de uma avaliação); partir outra
 *  secção que cabia numa página conta 10%. */
const PENALTY_FRAME_SPLIT = 0.25;
const PENALTY_SECTION_SPLIT = 0.1;

/** Cadeias de blocos que vão sempre na mesma página (keepWithNext). */
function chainsOf(sec: Section): Item[][] {
  const out: Item[][] = [];
  let cur: Item[] = [];
  for (const it of sec.items) {
    cur.push(it);
    if (!it.keepWithNext) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

const chainHeight = (c: Item[]) => c.reduce((s, it, i) => s + it.block.h + (i ? it.gap : 0), 0);
const sectionHeight = (sec: Section) =>
  chainsOf(sec).reduce((s, c, i) => s + chainHeight(c) + (i ? c[0].gap : 0), 0);
const reserveAfter = (it: Item) => (it.frame && !it.frameEnd ? it.frame.padBottom : 0);

function paginate(first: Block, secs: Section[], forced: Set<Item>, wholeMin: number): PagePlan[] {
  const pages: PagePlan[] = [];
  let cur: PagePlan = { placed: [], y: TOP };
  const newPage = () => {
    cur = { placed: [], y: TOP };
    pages.push(cur);
  };
  pages.push(cur);
  const atTop = () => cur.y === TOP;
  const room = () => cur.y - BOTTOM;
  let secIdx = -1;
  const put = (block: Block, item?: Item) => {
    cur.placed.push({ block, top: cur.y, item, sec: item ? secIdx : undefined });
    cur.y -= block.h;
  };
  const putChain = (c: Item[]) =>
    c.forEach((it, i) => {
      if (i) cur.y -= it.gap;
      put(it.block, it);
    });
  const putAll = (chains: Item[][]) =>
    chains.forEach((c, i) => {
      if (i) cur.y -= c[0].gap;
      putChain(c);
    });

  put(first);
  secs.forEach((sec, idx) => {
    secIdx = idx;
    const chains = chainsOf(sec);
    const total = sectionHeight(sec);
    const lead = atTop() ? 0 : SECTION_GAP;
    const forcedHere = sec.items.some((it) => forced.has(it));
    const fullEnough = room() - lead < PAGE_CONTENT_H * (1 - wholeMin);

    if (!forcedHere && lead + total <= room()) {
      cur.y -= lead;
      putAll(chains);
      return;
    }
    if (!forcedHere && total <= PAGE_CONTENT_H && (sec.keepTogether || fullEnough)) {
      newPage();
      putAll(chains);
      return;
    }
    // Parte-se entre cadeias, nunca dentro de um bloco.
    cur.y -= lead;
    chains.forEach((c, i) => {
      const head = c[0];
      const gap = i && !atTop() ? head.gap : 0;
      const need = gap + chainHeight(c) + reserveAfter(c[c.length - 1]);
      if (!atTop() && (forced.has(head) || need > room())) {
        newPage();
        if (head.header) put(head.header, { block: head.header, gap: 0, frame: head.frame });
        putChain(c);
        return;
      }
      cur.y -= gap;
      putChain(c);
    });
  });
  return pages;
}

const fillOf = (p: PagePlan) => (TOP - p.y) / PAGE_CONTENT_H;

/** Pontuação de um plano: a página menos cheia (quanto mais cheia, melhor),
 *  menos as penalizações por secções partidas e um nada por cada página. */
function planScore(pages: PagePlan[], secs: Section[]): number {
  const secPages = new Map<number, Set<number>>();
  const framePages = new Map<Frame, Set<number>>();
  pages.forEach((p, i) =>
    p.placed.forEach((pl) => {
      if (pl.sec !== undefined) secPages.set(pl.sec, (secPages.get(pl.sec) ?? new Set()).add(i));
      const fr = pl.item?.frame;
      if (fr) framePages.set(fr, (framePages.get(fr) ?? new Set()).add(i));
    }),
  );
  let penalty = 0;
  framePages.forEach((set) => {
    if (set.size > 1) penalty += PENALTY_FRAME_SPLIT;
  });
  secPages.forEach((set, idx) => {
    const sec = secs[idx];
    const hasFrame = sec.items.some((it) => it.frame);
    if (set.size > 1 && !hasFrame && sectionHeight(sec) <= PAGE_CONTENT_H) penalty += PENALTY_SECTION_SPLIT;
  });
  return Math.min(...pages.map(fillOf)) - penalty - pages.length * 0.005;
}

/** Os blocos onde se pode forçar uma quebra: o início de cada secção (a
 *  secção salta inteira) e, só como segunda escolha, o início de cada cadeia
 *  dentro de uma secção que se pode partir. */
function breakCandidates(secs: Section[]): { sectionStarts: Set<Item>; inner: Set<Item> } {
  const sectionStarts = new Set<Item>();
  const inner = new Set<Item>();
  for (const sec of secs) {
    const chains = chainsOf(sec);
    sectionStarts.add(chains[0][0]);
    if (!sec.keepTogether) chains.slice(1).forEach((c) => inner.add(c[0]));
  }
  return { sectionStarts, inner };
}

/** Os planos de um limiar: o direto e, se a última página ficar quase
 *  vazia, os que se obtêm puxando para ela blocos da anterior — primeiro uma
 *  secção inteira, partir uma secção só em último caso. */
function plansFor(first: Block, secs: Section[], wholeMin: number): PagePlan[][] {
  const { sectionStarts, inner } = breakCandidates(secs);
  const forced = new Set<Item>();
  let current = paginate(first, secs, forced, wholeMin);
  const out = [current];
  for (let i = 0; i < 8; i++) {
    if (current.length < 2 || fillOf(current[current.length - 1]) >= LAST_PAGE_MIN) break;
    const prev = current[current.length - 2];
    const usable = (set: Set<Item>, min: number) =>
      prev.placed
        .slice(1)
        .filter((p) => p.item && set.has(p.item) && !forced.has(p.item))
        .filter((p) => (TOP - p.top) / PAGE_CONTENT_H >= min);
    const whole = usable(sectionStarts, PREV_MIN_WHOLE);
    const split = usable(inner, PREV_MIN_SPLIT);
    const pick = whole[whole.length - 1] ?? split[split.length - 1];
    if (!pick?.item) break;
    forced.add(pick.item);
    current = paginate(first, secs, forced, wholeMin);
    out.push(current);
  }
  return out;
}

/** Experimenta os limiares todos e fica com o melhor plano. São só contas
 *  com alturas — nada se desenha antes da escolha. */
function planPages(first: Block, secs: Section[]): PagePlan[] {
  let best: PagePlan[] | null = null;
  let bestScore = -Infinity;
  for (const t of WHOLE_THRESHOLDS) {
    for (const plan of plansFor(first, secs, t)) {
      const sc = planScore(plan, secs);
      if (sc > bestScore + 1e-9) {
        best = plan;
        bestScore = sc;
      }
    }
  }
  return best!;
}

function render(doc: PDFDocument, pages: PagePlan[]) {
  for (const plan of pages) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const frames = new Map<Frame, { top: number; bottom: number; closed: boolean }>();
    for (const p of plan.placed) {
      p.block.draw(page, p.top);
      const fr = p.item?.frame;
      if (!fr) continue;
      const box = frames.get(fr) ?? { top: p.top, bottom: p.top, closed: false };
      box.bottom = p.top - p.block.h;
      box.closed = Boolean(p.item?.frameEnd);
      frames.set(fr, box);
    }
    frames.forEach((box, fr) => fr.draw(page, box.top, box.closed ? box.bottom : box.bottom - fr.padBottom));
  }
}

function stampFooters(doc: PDFDocument, f: Fonts) {
  const pages = doc.getPages();
  const st: TextStyle = { font: f.r, size: 7, color: C.footer };
  pages.forEach((page, i) => {
    drawText(page, PAGE_FOOTER, M, FOOTER_BASELINE, st);
    const label = `Página ${i + 1} de ${pages.length}`;
    drawText(page, label, PAGE_W - M - textWidth(label, st), FOOTER_BASELINE, st);
  });
}

/* ------------------------------- entrada ------------------------------ */

export async function buildProbationPdf(model: DocModel, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setLanguage("pt-PT");
  doc.setProducer("Wonder Ads Workspace");
  doc.setCreator("Wonder Ads Workspace");
  doc.setSubject("Plano de Probation — documento interno e confidencial");

  const f = await loadFonts(doc);
  let logo: PDFImage | null = null;
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "wonder-ads-butterfly.png"));
    logo = await doc.embedPng(bytes);
  } catch {
    logo = null;
  }
  const ctx: Ctx = { doc, f, logo, model };

  render(doc, planPages(hero(ctx), sections(ctx)));
  stampFooters(doc, f);

  return doc.save();
}
