// A leitura das páginas para a pesquisa da Documentação (v80.46) — corre no
// BROWSER.
//
// Cada página é pedida com a sessão de quem pesquisa (o mesmo HTML que essa
// pessoa lê, nem mais nem menos: o que a direção vê a mais só entra no índice
// da direção) e partida em pedaços:
//   - capítulos dos SOPs (SopChapters: `[role=tabpanel]#cap-<id>`);
//   - secções com âncora (`[data-doc-section][id]`, as da SectionNav);
//   - dentro de cada um, um pedaço por título (h2/h3/h4).
// Fica de fora o que não é documento: trilho, barras de capítulos, botões de
// navegação, painéis vivos marcados com `data-docs-search="skip"` e o que a
// API já dá por inteiro (`data-docs-index="skip"`: as tarefas da Jornada).

import type { SearchDoc } from "./search";

export type CrawlPage = {
  id: string;
  label: string;
  href: string;
  block: string;
  image?: string;
  /** Muda quando a página muda — é a chave da cache no browser. */
  version: string;
};

const BLOCK_TAGS = new Set([
  "P", "DIV", "LI", "UL", "OL", "SECTION", "ARTICLE", "HEADER", "TR", "TD", "TH", "TABLE", "BLOCKQUOTE",
  "DT", "DD", "DL", "FIGCAPTION", "FIGURE", "ASIDE", "BR", "SUMMARY", "DETAILS", "H1", "H2", "H3", "H4", "H5", "H6",
]);
const HEADINGS = new Set(["H2", "H3", "H4"]);
const MAX_CHUNK = 2400;

type Anchor = { id: string | null; label: string };

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function extractPage(html: string, page: CrawlPage): SearchDoc[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const main = doc.querySelector("main");
  if (!main || main.querySelector("[data-docs-closed]")) return [];

  // Rótulos dos capítulos e das secções, antes de tirar as barras.
  const labels = new Map<string, string>();
  main.querySelectorAll<HTMLElement>("[role=tab][data-id]").forEach((el) => {
    labels.set(`cap-${el.dataset.id}`, el.dataset.label || clean(el.textContent ?? ""));
  });
  main.querySelectorAll<HTMLAnchorElement>('a[data-id][href^="#"]').forEach((el) => {
    if (el.dataset.id) labels.set(el.dataset.id, clean(el.textContent ?? ""));
  });

  main
    .querySelectorAll(
      'script,style,noscript,svg,template,footer,nav,[role=tablist],[data-docs-search="skip"],[data-docs-index="skip"],[aria-hidden="true"]',
    )
    .forEach((el) => el.remove());

  const chunks: SearchDoc[] = [];
  let cur: { anchor: Anchor; heading: string | null; parts: string[] } | null = null;
  let n = 0;

  const flush = () => {
    if (!cur) return;
    const text = clean(cur.parts.join(""));
    if (text.length >= 2 || cur.heading) {
      chunks.push({
        key: `${page.id}#${n++}`,
        kind: "doc",
        group: page.id,
        groupLabel: page.label,
        block: page.block,
        href: page.href,
        anchor: cur.anchor.id,
        section: cur.anchor.label,
        heading: cur.heading,
        text,
        meta: page.image ? { image: page.image } : undefined,
      });
    }
    cur = null;
  };
  const push = (anchor: Anchor, heading: string | null, s: string) => {
    if (!cur || cur.anchor.id !== anchor.id || cur.heading !== heading) {
      flush();
      cur = { anchor, heading, parts: [] };
    }
    cur.parts.push(s);
    if (cur.parts.length > 40 && clean(cur.parts.join("")).length > MAX_CHUNK) {
      // Pedaço grande demais: parte-se, com o mesmo título.
      const keep = { anchor, heading };
      flush();
      cur = { ...keep, parts: [] };
    }
  };

  const intro: Anchor = { id: null, label: "Início" };
  // O título mais perto, por âncora.
  const headingOf = new Map<string | null, string | null>();

  const sectionAnchor = (el: Element): Anchor | null => {
    const id = el.getAttribute("id");
    if (!id) return null;
    if (el.getAttribute("role") === "tabpanel" && id.startsWith("cap-")) {
      return { id: id.slice(4), label: labels.get(id) ?? id.slice(4) };
    }
    if (el.hasAttribute("data-doc-section") || labels.has(id)) {
      const custom = el.getAttribute("data-doc-label");
      const h = el.querySelector("h2,h3");
      return { id, label: custom || labels.get(id) || clean(h?.textContent ?? "") || id };
    }
    return null;
  };

  const walk = (node: Node, anchor: Anchor) => {
    if (node.nodeType === 3) {
      const t = node.textContent ?? "";
      if (t.trim()) push(anchor, headingOf.get(anchor.id) ?? null, t);
      // O espaço entre dois pedaços de texto ({" "} no JSX) conta.
      else if (t && cur) cur.parts.push(" ");
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName;
    if (tag === "H1") return; // o título da página
    let a = anchor;
    const own = sectionAnchor(el);
    if (own) {
      a = own;
      headingOf.set(own.id, null);
    }
    if (HEADINGS.has(tag)) {
      const h = clean(el.textContent ?? "");
      if (h) {
        headingOf.set(a.id, h);
        // O título fica no pedaço que abre (campo próprio, não no texto).
        flush();
        cur = { anchor: a, heading: h, parts: [] };
      }
      return;
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) push(a, headingOf.get(a.id) ?? null, " ");
    for (const child of Array.from(el.childNodes)) walk(child, a);
    if (block) push(a, headingOf.get(a.id) ?? null, " ");
  };

  walk(main, intro);
  flush();
  return chunks;
}

/** Pede e lê uma página. null quando não abre (sem acesso, erro). */
export async function crawlPage(page: CrawlPage, signal?: AbortSignal): Promise<SearchDoc[] | null> {
  const res = await fetch(page.href, {
    credentials: "same-origin",
    headers: { accept: "text/html" },
    cache: "no-store",
    signal,
  });
  if (!res.ok || res.redirected) return null;
  const html = await res.text();
  return extractPage(html, page);
}
