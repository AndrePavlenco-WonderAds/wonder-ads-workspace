// Mini motor de layout em cima do pdf-lib para os templates de proposta
// (renovação e cross-sell). Sem binários nativos — corre nas funções da
// Vercel. Fluxo de cima para baixo com quebra de página automática, faixa
// de gradiente da marca (fatias sólidas — o pdf-lib não tem gradientes),
// tabelas simples, caixas com barra lateral, pastilhas e rodapé por página.
//
// Tipografia: Helvetica (WinAnsi). Os acentos do português cabem; o que
// não cabe (emoji, travessões tipográficos) é normalizado por `enc`.

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";

export const PAGE_W = 595.28; // A4
export const PAGE_H = 841.89;
export const MARGIN = 46;
export const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 34;

export const C = {
  ink: rgb(0.106, 0.141, 0.188), // #1B2430
  body: rgb(0.24, 0.26, 0.3),
  grey: rgb(0.45, 0.45, 0.5),
  faint: rgb(0.62, 0.62, 0.68),
  purple: rgb(0.471, 0.239, 0.961), // #783DF5
  blue: rgb(0.204, 0.243, 0.843), // #343ED7
  magenta: rgb(0.773, 0.208, 0.788), // #C535C9
  violetDeep: rgb(0.357, 0.129, 0.714), // #5b21b6
  lilac: rgb(0.96, 0.94, 1), // #f5f0ff
  lilacLine: rgb(0.914, 0.835, 1), // #e9d5ff
  pink: rgb(0.99, 0.95, 0.98),
  line: rgb(0.86, 0.86, 0.9),
  hairline: rgb(0.92, 0.92, 0.95),
  white: rgb(1, 1, 1),
  green: rgb(0.02, 0.47, 0.34),
  greenBg: rgb(0.85, 0.97, 0.91),
  amber: rgb(0.6, 0.38, 0.05),
  amberBg: rgb(1, 0.95, 0.82),
};

const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export function enc(s: string): string {
  return (s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—]/g, "-")
    .replace(/[–]/g, "-")
    .replace(/→/g, "->")
    .replace(/×/g, "x")
    .replace(/\t/g, "  ")
    .split("")
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return c === 10 || c <= 255 || CP1252_EXTRA.includes(ch);
    })
    .join("");
}

/** Espaçamento de letras à mão (o pdf-lib não tem `tracking`): letra a
 *  letra com um espaço, palavras com três — senão as palavras colam-se. */
export function spaced(text: string): string {
  return enc(text)
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.split("").join(" "))
    .join("   ");
}

export function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const rawLine of enc(text).split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) <= maxW) {
        line = trial;
      } else {
        if (line) out.push(line);
        if (font.widthOfTextAtSize(w, size) > maxW) {
          let chunk = "";
          for (const ch of w) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxW) {
              out.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else {
          line = w;
        }
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export type TextOpts = {
  size?: number;
  font?: PDFFont;
  color?: RGB;
  x?: number;
  maxW?: number;
  lineHeight?: number;
  align?: "left" | "right" | "center";
  tracking?: number;
};

export type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

export class Sheet {
  readonly doc: PDFDocument;
  readonly f: Fonts;
  page!: PDFPage;
  y = PAGE_H - MARGIN;
  private logo: PDFImage | null;
  private footerText: string;

  private constructor(doc: PDFDocument, f: Fonts, logo: PDFImage | null, footerText: string) {
    this.doc = doc;
    this.f = f;
    this.logo = logo;
    this.footerText = footerText;
    this.newPage();
  }

  static async create(opts: { title: string; footerText: string }): Promise<Sheet> {
    const doc = await PDFDocument.create();
    doc.setTitle(opts.title);
    doc.setProducer("Wonder Ads Workspace");
    doc.setCreator("Wonder Ads Workspace");
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
    let logo: PDFImage | null = null;
    try {
      const bytes = await readFile(path.join(process.cwd(), "public", "wonder-ads-butterfly.png"));
      logo = await doc.embedPng(bytes);
    } catch {
      logo = null;
    }
    return new Sheet(doc, { regular, bold, italic }, logo, opts.footerText);
  }

  // ------------------------------------------------------------ páginas

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  /** Garante `h` pontos livres; senão salta de página. */
  ensure(h: number) {
    if (this.y - h < MARGIN + FOOTER_H) this.newPage();
  }

  gap(n: number) {
    this.y -= n;
  }

  get bottom(): number {
    return this.y;
  }

  // -------------------------------------------------------------- texto

  measure(text: string, opts: TextOpts = {}): { lines: string[]; height: number; lh: number } {
    const size = opts.size ?? 10;
    const font = opts.font ?? this.f.regular;
    const maxW = opts.maxW ?? CONTENT_W - ((opts.x ?? MARGIN) - MARGIN);
    const lh = opts.lineHeight ?? size * 1.42;
    const lines = wrap(text, font, size, maxW);
    return { lines, height: lines.length * lh, lh };
  }

  /** Escreve texto (com quebra de linha) na posição atual e avança. */
  text(text: string, opts: TextOpts = {}): number {
    const size = opts.size ?? 10;
    const font = opts.font ?? this.f.regular;
    const color = opts.color ?? C.body;
    const x = opts.x ?? MARGIN;
    const maxW = opts.maxW ?? CONTENT_W - (x - MARGIN);
    const { lines, lh } = this.measure(text, { ...opts, size, font, maxW, x });
    for (const line of lines) {
      this.ensure(lh);
      const w = font.widthOfTextAtSize(line, size);
      const lx =
        opts.align === "right" ? x + maxW - w : opts.align === "center" ? x + (maxW - w) / 2 : x;
      this.page.drawText(line, { x: lx, y: this.y - size, size, font, color });
      this.y -= lh;
    }
    return lines.length * lh;
  }

  /** Texto numa posição absoluta (não mexe no cursor). */
  textAt(text: string, x: number, y: number, opts: TextOpts = {}) {
    const size = opts.size ?? 10;
    const font = opts.font ?? this.f.regular;
    const color = opts.color ?? C.body;
    const maxW = opts.maxW ?? CONTENT_W;
    const lines = wrap(text, font, size, maxW);
    const lh = opts.lineHeight ?? size * 1.42;
    let yy = y;
    for (const line of lines) {
      const w = font.widthOfTextAtSize(line, size);
      const lx =
        opts.align === "right" ? x + maxW - w : opts.align === "center" ? x + (maxW - w) / 2 : x;
      this.page.drawText(line, { x: lx, y: yy - size, size, font, color });
      yy -= lh;
    }
    return lines.length * lh;
  }

  eyebrow(text: string, opts: { color?: RGB; x?: number; maxW?: number } = {}) {
    // Desenha-se direto (não passa pelo `wrap`, que colapsava os três
    // espaços entre palavras do `spaced`). Uma linha; se não couber,
    // encolhe a fonte até caber.
    const x = opts.x ?? MARGIN;
    const maxW = opts.maxW ?? CONTENT_W - (x - MARGIN);
    const sp = spaced(text);
    let size = 7.2;
    while (size > 5 && this.f.bold.widthOfTextAtSize(sp, size) > maxW) size -= 0.3;
    const lh = size * 1.5;
    this.ensure(lh);
    this.page.drawText(sp, { x, y: this.y - size, size, font: this.f.bold, color: opts.color ?? C.purple });
    this.y -= lh;
  }

  h1(text: string) {
    this.text(text, { size: 22, font: this.f.bold, color: C.ink, lineHeight: 26 });
  }

  h2(text: string) {
    // Espaço para o título E o arranque do bloco seguinte — um título
    // sozinho no fundo da página é o que se quer evitar.
    this.ensure(110);
    this.gap(4);
    this.text(text, { size: 13.5, font: this.f.bold, color: C.ink, lineHeight: 17 });
    this.gap(4);
    this.rule(C.purple, 1.4);
    this.gap(8);
  }

  p(text: string, opts: TextOpts = {}) {
    this.text(text, { size: 9.6, color: C.body, lineHeight: 13.6, ...opts });
  }

  small(text: string, opts: TextOpts = {}) {
    this.text(text, { size: 8.2, color: C.grey, lineHeight: 11.5, ...opts });
  }

  rule(color: RGB = C.line, thickness = 0.6) {
    this.ensure(thickness + 2);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT_W, y: this.y },
      thickness,
      color,
    });
    this.y -= thickness + 1;
  }

  // ------------------------------------------------------------ marca

  /** Faixa com o gradiente da marca (fatias sólidas), largura total. */
  gradientRect(x: number, y: number, w: number, h: number, slices = 72, radius = 0) {
    void radius;
    const stops: [number, RGB][] = [
      [0, C.blue],
      [0.5365, C.purple],
      [1, C.magenta],
    ];
    for (let i = 0; i < slices; i++) {
      const t = i / (slices - 1);
      let a = stops[0];
      let b = stops[stops.length - 1];
      for (let k = 0; k < stops.length - 1; k++) {
        if (t >= stops[k][0] && t <= stops[k + 1][0]) {
          a = stops[k];
          b = stops[k + 1];
          break;
        }
      }
      const span = b[0] - a[0] || 1;
      const u = (t - a[0]) / span;
      const col = rgb(
        a[1].red + (b[1].red - a[1].red) * u,
        a[1].green + (b[1].green - a[1].green) * u,
        a[1].blue + (b[1].blue - a[1].blue) * u,
      );
      const sw = w / slices;
      this.page.drawRectangle({ x: x + i * sw, y, width: sw + 0.6, height: h, color: col });
    }
  }

  brandBand(opts: {
    eyebrowRight: string[];
    title: string;
    subtitle: string;
    height?: number;
  }) {
    const pad = 20;
    const titleLines = wrap(opts.title, this.f.bold, 22, CONTENT_W - pad * 2).length;
    const h = Math.max(opts.height ?? 150, 70 + titleLines * 26 + 34);
    this.ensure(h);
    const top = this.y;
    this.gradientRect(MARGIN, top - h, CONTENT_W, h);
    // Wordmark
    this.page.drawText("Wonder", { x: MARGIN + pad, y: top - pad - 16, size: 18, font: this.f.bold, color: C.white });
    const wW = this.f.bold.widthOfTextAtSize("Wonder", 18);
    this.page.drawText("Ads", { x: MARGIN + pad + wW, y: top - pad - 16, size: 18, font: this.f.bold, color: rgb(1, 0.85, 0.95) });
    // Eyebrows à direita
    let ey = top - pad - 8;
    for (const [i, line] of opts.eyebrowRight.entries()) {
      const sp = spaced(line);
      const size = i === 0 ? 7.4 : 6.8;
      const font = i === 0 ? this.f.bold : this.f.regular;
      const w = font.widthOfTextAtSize(sp, size);
      this.page.drawText(sp, { x: MARGIN + CONTENT_W - pad - w, y: ey - size, size, font, color: C.white, opacity: i === 0 ? 1 : 0.85 });
      ey -= size + 5;
    }
    // Separador fino
    this.page.drawLine({
      start: { x: MARGIN + pad, y: top - 58 },
      end: { x: MARGIN + CONTENT_W - pad, y: top - 58 },
      thickness: 0.6,
      color: C.white,
      opacity: 0.35,
    });
    // Título + subtítulo
    this.textAt(opts.title, MARGIN + pad, top - 70, { size: 22, font: this.f.bold, color: C.white, maxW: CONTENT_W - pad * 2, lineHeight: 26 });
    this.textAt(opts.subtitle, MARGIN + pad, top - 70 - titleLines * 26 - 4, { size: 10.5, font: this.f.regular, color: C.white, maxW: CONTENT_W - pad * 2 });
    this.y = top - h;
  }

  // ------------------------------------------------------------ blocos

  /** Caixa com barra lateral: mede primeiro, desenha depois. */
  box(
    lines: { text: string; opts?: TextOpts }[],
    style: { fill?: RGB; accent?: RGB; stroke?: RGB; pad?: number } = {},
  ) {
    const pad = style.pad ?? 12;
    const inner = CONTENT_W - pad * 2 - 4;
    let h = pad * 2;
    const measured = lines.map((l) => {
      const m = this.measure(l.text, { size: 9.4, lineHeight: 13.2, ...l.opts, maxW: inner });
      h += m.height + 3;
      return m;
    });
    void measured;
    this.ensure(Math.min(h, PAGE_H - MARGIN * 2 - FOOTER_H));
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - h,
      width: CONTENT_W,
      height: h,
      color: style.fill ?? C.lilac,
      borderColor: style.stroke,
      borderWidth: style.stroke ? 0.6 : 0,
    });
    if (style.accent) {
      this.page.drawRectangle({ x: MARGIN, y: top - h, width: 3, height: h, color: style.accent });
    }
    this.y = top - pad;
    for (const l of lines) {
      this.text(l.text, { size: 9.4, lineHeight: 13.2, ...l.opts, x: MARGIN + pad + 4, maxW: inner });
      this.gap(3);
    }
    this.y = top - h;
  }

  /** Caixa de instruções do template — amarela, chama a atenção. */
  note(title: string, body: string[]) {
    this.box(
      [
        { text: title, opts: { font: this.f.bold, color: C.amber, size: 8.4 } },
        ...body.map((b) => ({ text: b, opts: { color: C.body, size: 9 } })),
      ],
      { fill: C.amberBg, accent: rgb(0.95, 0.65, 0.1) },
    );
  }

  /** Grelha de tiles (estatísticas): valor grande + rótulo + subtítulo. */
  tiles(items: { value: string; label: string; sub?: string }[], cols = 4) {
    const gapX = 8;
    const w = (CONTENT_W - gapX * (cols - 1)) / cols;
    const h = 62;
    let i = 0;
    while (i < items.length) {
      this.ensure(h + 4);
      const top = this.y;
      const row = items.slice(i, i + cols);
      row.forEach((it, k) => {
        const x = MARGIN + k * (w + gapX);
        this.page.drawRectangle({ x, y: top - h, width: w, height: h, color: C.white, borderColor: C.line, borderWidth: 0.6 });
        this.page.drawRectangle({ x, y: top - 3, width: w, height: 3, color: C.purple });
        this.textAt(it.value, x + 10, top - 10, { size: 17, font: this.f.bold, color: C.ink, maxW: w - 20 });
        this.textAt(enc(it.label).toUpperCase(), x + 10, top - 33, { size: 6.4, font: this.f.bold, color: C.grey, maxW: w - 20, lineHeight: 8 });
        if (it.sub) this.textAt(it.sub, x + 10, top - 47, { size: 7.6, color: C.faint, maxW: w - 20 });
      });
      this.y = top - h - 8;
      i += cols;
    }
  }

  /** Tabela simples: cabeçalho roxo claro, linhas com quebra e zebra. */
  table(opts: {
    cols: { label: string; w: number; align?: "left" | "right" }[];
    rows: string[][];
    boldFirst?: boolean;
    numberFirst?: boolean;
    fontSize?: number;
  }) {
    const size = opts.fontSize ?? 8.8;
    const lh = size * 1.4;
    const padX = 7;
    const padY = 6;
    const totalW = opts.cols.reduce((a, c) => a + c.w, 0);
    const scale = CONTENT_W / totalW;
    const cols = opts.cols.map((c) => ({ ...c, w: c.w * scale }));

    const drawHeader = () => {
      const hh = 18;
      this.ensure(hh + lh);
      const top = this.y;
      this.page.drawRectangle({ x: MARGIN, y: top - hh, width: CONTENT_W, height: hh, color: C.lilac });
      let x = MARGIN;
      for (const c of cols) {
        const lab = spaced(c.label);
        const w = this.f.bold.widthOfTextAtSize(lab, 5.8);
        const lx = c.align === "right" ? x + c.w - padX - w : x + padX;
        this.page.drawText(lab, { x: lx, y: top - 12, size: 5.8, font: this.f.bold, color: C.violetDeep });
        x += c.w;
      }
      this.y = top - hh;
    };

    drawHeader();
    opts.rows.forEach((row, ri) => {
      const cellLines = row.map((cell, ci) => {
        const font = (opts.boldFirst && ci === (opts.numberFirst ? 1 : 0)) ? this.f.bold : this.f.regular;
        return { lines: wrap(cell, font, size, cols[ci].w - padX * 2), font };
      });
      const n = Math.max(1, ...cellLines.map((c) => c.lines.length));
      const rh = n * lh + padY * 2;
      if (this.y - rh < MARGIN + FOOTER_H) {
        this.newPage();
        drawHeader();
      }
      const top = this.y;
      if (ri % 2 === 1) {
        this.page.drawRectangle({ x: MARGIN, y: top - rh, width: CONTENT_W, height: rh, color: rgb(0.985, 0.98, 1) });
      }
      let x = MARGIN;
      cellLines.forEach((c, ci) => {
        const col = cols[ci];
        const color = opts.numberFirst && ci === 0 ? C.purple : ci === 0 || (opts.boldFirst && ci === 1) ? C.ink : C.body;
        let yy = top - padY;
        for (const line of c.lines) {
          const w = c.font.widthOfTextAtSize(line, size);
          const lx = col.align === "right" ? x + col.w - padX - w : x + padX;
          this.page.drawText(line, { x: lx, y: yy - size, size, font: opts.numberFirst && ci === 0 ? this.f.bold : c.font, color });
          yy -= lh;
        }
        x += col.w;
      });
      this.page.drawLine({ start: { x: MARGIN, y: top - rh }, end: { x: MARGIN + CONTENT_W, y: top - rh }, thickness: 0.5, color: C.hairline });
      this.y = top - rh;
    });
    this.gap(6);
  }

  /** Lista com marcador. */
  bullets(items: string[], opts: { x?: number; maxW?: number; size?: number; color?: RGB } = {}) {
    const x = opts.x ?? MARGIN;
    const size = opts.size ?? 9.2;
    const maxW = (opts.maxW ?? CONTENT_W - (x - MARGIN)) - 12;
    for (const it of items) {
      const m = this.measure(it, { size, maxW, lineHeight: size * 1.4 });
      this.ensure(m.height);
      this.page.drawCircle({ x: x + 3, y: this.y - size * 0.62, size: 1.5, color: opts.color ?? C.purple });
      this.text(it, { size, x: x + 12, maxW, lineHeight: size * 1.4, color: opts.color ?? C.body });
      this.gap(2);
    }
  }

  /** Duas colunas de caixas com título + bullets (Incluído / Não incluído). */
  twoColumnLists(left: { title: string; items: string[]; color?: RGB }, right: { title: string; items: string[]; color?: RGB }) {
    const gapX = 12;
    const w = (CONTENT_W - gapX) / 2;
    const pad = 12;
    const size = 8.8;
    const lh = size * 1.45;
    const measureCol = (items: string[]) =>
      items.reduce((acc, it) => acc + wrap(it, this.f.regular, size, w - pad * 2 - 12).length * lh + 2, 0);
    const h = Math.max(measureCol(left.items), measureCol(right.items)) + pad * 2 + 22;
    this.ensure(h);
    const top = this.y;
    [left, right].forEach((col, k) => {
      const x = MARGIN + k * (w + gapX);
      this.page.drawRectangle({ x, y: top - h, width: w, height: h, color: C.white, borderColor: C.line, borderWidth: 0.6 });
      const lab = spaced(col.title);
      this.page.drawText(lab, { x: x + pad, y: top - pad - 6, size: 6.2, font: this.f.bold, color: col.color ?? C.violetDeep });
      let yy = top - pad - 20;
      for (const it of col.items) {
        this.page.drawCircle({ x: x + pad + 3, y: yy - size * 0.62, size: 1.4, color: col.color ?? C.purple });
        const lines = wrap(it, this.f.regular, size, w - pad * 2 - 12);
        for (const line of lines) {
          this.page.drawText(line, { x: x + pad + 12, y: yy - size, size, font: this.f.regular, color: C.body });
          yy -= lh;
        }
        yy -= 2;
      }
    });
    this.y = top - h;
  }

  /** Linha «rótulo | valor» com separador — para condições comerciais. */
  keyValues(rows: [string, string][]) {
    const labelW = 150;
    const size = 9;
    const lh = size * 1.45;
    for (const [k, v] of rows) {
      const lines = wrap(v, this.f.regular, size, CONTENT_W - labelW - 8);
      const rh = Math.max(1, lines.length) * lh + 9;
      this.ensure(rh);
      const top = this.y;
      this.page.drawText(enc(k), { x: MARGIN, y: top - 5 - size, size, font: this.f.bold, color: C.violetDeep });
      let yy = top - 5;
      for (const line of lines) {
        this.page.drawText(line, { x: MARGIN + labelW, y: yy - size, size, font: this.f.regular, color: C.body });
        yy -= lh;
      }
      this.page.drawLine({ start: { x: MARGIN, y: top - rh }, end: { x: MARGIN + CONTENT_W, y: top - rh }, thickness: 0.5, color: C.hairline });
      this.y = top - rh;
    }
    this.gap(4);
  }

  /** Pastilhas em linha (com quebra de linha). */
  pills(items: string[], opts: { strongPrefix?: string } = {}) {
    const size = 7.6;
    const padX = 7;
    const h = 15;
    let x = MARGIN;
    this.ensure(h + 4);
    for (const raw of items) {
      const label = enc(raw);
      const strong = Boolean(opts.strongPrefix && raw.startsWith(opts.strongPrefix));
      const font = strong ? this.f.bold : this.f.regular;
      const w = font.widthOfTextAtSize(label, size) + padX * 2;
      if (x + w > MARGIN + CONTENT_W) {
        x = MARGIN;
        this.y -= h + 4;
        this.ensure(h + 4);
      }
      this.page.drawRectangle({
        x,
        y: this.y - h,
        width: w,
        height: h,
        color: strong ? C.lilac : C.white,
        borderColor: strong ? C.purple : C.line,
        borderWidth: 0.6,
      });
      this.page.drawText(label, { x: x + padX, y: this.y - h + 4.2, size, font, color: strong ? C.violetDeep : C.body });
      x += w + 5;
    }
    this.y -= h + 6;
  }

  /** Dois cartões de preço lado a lado (mensal / pré-pago). */
  priceTiles(a: { eyebrow: string; value: string; sub: string }, b: { eyebrow: string; value: string; sub: string; badge?: string }) {
    const gapX = 10;
    const w = (CONTENT_W - gapX) / 2;
    const h = 74;
    this.ensure(h + 6);
    const top = this.y;
    const draw = (t: typeof b, x: number, highlight: boolean) => {
      if (highlight) {
        this.gradientRect(x, top - h, w, h);
        this.page.drawRectangle({ x: x + 2, y: top - h + 2, width: w - 4, height: h - 4, color: C.white });
      } else {
        this.page.drawRectangle({ x, y: top - h, width: w, height: h, color: C.white, borderColor: C.line, borderWidth: 0.7 });
      }
      const lab = spaced(t.eyebrow);
      this.page.drawText(lab, { x: x + 12, y: top - 18, size: 6, font: this.f.bold, color: highlight ? C.violetDeep : C.grey });
      if (t.badge) {
        const bw = this.f.bold.widthOfTextAtSize(enc(t.badge), 6.6) + 12;
        this.page.drawRectangle({ x: x + w - 12 - bw, y: top - 22, width: bw, height: 13, color: C.greenBg });
        this.page.drawText(enc(t.badge), { x: x + w - 12 - bw + 6, y: top - 18.5, size: 6.6, font: this.f.bold, color: C.green });
      }
      this.page.drawText(enc(t.value), { x: x + 12, y: top - 46, size: 22, font: this.f.bold, color: C.purple });
      this.page.drawText(enc(t.sub), { x: x + 12, y: top - 62, size: 8, font: this.f.regular, color: C.grey });
    };
    draw(a, MARGIN, false);
    draw(b, MARGIN + w + gapX, true);
    this.y = top - h - 10;
  }

  /** Linhas de assinatura, lado a lado. */
  signatures(left: string, right: string) {
    this.ensure(46);
    const w = (CONTENT_W - 30) / 2;
    const top = this.y - 24;
    [left, right].forEach((label, k) => {
      const x = MARGIN + k * (w + 30);
      this.page.drawLine({ start: { x, y: top }, end: { x: x + w, y: top }, thickness: 0.6, color: C.grey });
      this.page.drawText(enc(label), { x, y: top - 12, size: 8, font: this.f.regular, color: C.grey });
    });
    this.y = top - 22;
  }

  // ----------------------------------------------------------- rodapé

  /** Rodapé em todas as páginas + numeração — chamar no fim. */
  finish(): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((page, i) => {
      page.drawLine({ start: { x: MARGIN, y: MARGIN + 14 }, end: { x: MARGIN + CONTENT_W, y: MARGIN + 14 }, thickness: 0.5, color: C.hairline });
      if (this.logo) {
        page.drawImage(this.logo, { x: MARGIN, y: MARGIN - 4, width: 12, height: 12 });
      }
      page.drawText(enc(this.footerText), { x: MARGIN + (this.logo ? 16 : 0), y: MARGIN - 1, size: 7, font: this.f.regular, color: C.faint });
      const num = `${i + 1} / ${pages.length}`;
      const w = this.f.regular.widthOfTextAtSize(num, 7);
      page.drawText(num, { x: MARGIN + CONTENT_W - w, y: MARGIN - 1, size: 7, font: this.f.regular, color: C.faint });
    });
    return this.doc.save();
  }
}
