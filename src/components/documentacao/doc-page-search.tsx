"use client";

// Procurar DENTRO de uma página da Documentação (v80.46).
//
// O Ctrl+F do browser não chega: nos SOPs só se vê um capítulo de cada vez
// e o resto está escondido. Aqui procura-se na página toda — capítulos
// fechados incluídos — com as mesmas regras da pesquisa do hub (sem acentos,
// plurais, começo de palavra). Ir para um resultado abre o capítulo certo e
// leva o ecrã até lá; as palavras ficam realçadas sem mexer no HTML (CSS
// Custom Highlight API: o React não dá por nada).
//
// Abre-se no botão «Procurar nesta página», com a tecla «/», ou sozinho
// quando se chega da pesquisa do hub (?q=…#capitulo).

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { normalizeKeep, queryTokens, wordWeight } from "@/lib/documentacao/search";

type Hit = {
  range: Range;
  el: Element;
  /** O capítulo (SopChapters) onde está, para o abrir antes de lá ir. */
  panel: string | null;
  section: string | null;
  /** A palavra da pesquisa a que responde. */
  token: number;
};

type HighlightCtor = new (...ranges: Range[]) => unknown;
type Registry = { set: (name: string, h: unknown) => void; delete: (name: string) => void };

function registry(): { H: HighlightCtor; reg: Registry } | null {
  const H = (globalThis as unknown as { Highlight?: HighlightCtor }).Highlight;
  const reg = (globalThis as unknown as { CSS?: { highlights?: Registry } }).CSS?.highlights;
  return H && reg ? { H, reg } : null;
}

function clearHighlights() {
  const r = registry();
  r?.reg.delete("docs-q");
  r?.reg.delete("docs-q-now");
}

const SKIP = 'script,style,noscript,nav,[role="tablist"],[data-docs-search="skip"],[data-docs-finder],input,textarea,select';

function sectionLabel(el: Element): { panel: string | null; label: string | null } {
  const panel = el.closest('[role="tabpanel"][id^="cap-"]');
  if (panel) {
    const id = panel.id.slice(4);
    const tab = document.querySelector<HTMLElement>(`[role="tab"][data-id="${CSS.escape(id)}"]`);
    return { panel: id, label: tab?.dataset.label ?? tab?.textContent?.trim() ?? null };
  }
  const dialog = el.closest('[role="dialog"]');
  if (dialog) return { panel: null, label: dialog.querySelector("h2,h3")?.textContent?.trim() ?? null };
  const sec = el.closest("[data-doc-section][id]");
  if (sec) {
    const custom = sec.getAttribute("data-doc-label");
    const nav = document.querySelector<HTMLElement>(`a[data-id="${CSS.escape(sec.id)}"][href^="#"]`);
    return { panel: null, label: custom || nav?.textContent?.trim() || sec.querySelector("h2")?.textContent?.trim() || null };
  }
  return { panel: null, label: null };
}

function roots(): Element[] {
  const main = document.querySelector("main");
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
  return [...(main ? [main] : []), ...dialogs];
}

function scan(query: string): Hit[] {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const found: Array<{ node: Text; start: number; end: number; token: number; weight: number }> = [];
  const nodes: Text[] = [];
  for (const root of roots()) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || !n.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        if (p.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        // Um diálogo dentro do main não se lê duas vezes.
        if (root.tagName === "MAIN" && p.closest('[role="dialog"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  }

  const collect = (fuzzy: boolean, only: Set<number> | null) => {
    for (const node of nodes) {
      const norm = normalizeKeep(node.data);
      for (const m of norm.matchAll(/[a-z0-9]+/g)) {
        let best = 0;
        let bestT = -1;
        tokens.forEach((t, ti) => {
          if (only && !only.has(ti)) return;
          const w = wordWeight(t, m[0], fuzzy);
          if (w > best) {
            best = w;
            bestT = ti;
          }
        });
        if (best >= 0.45 && (fuzzy || best >= 0.6)) {
          const start = m.index ?? 0;
          found.push({ node, start, end: start + m[0].length, token: bestT, weight: best });
        }
      }
    }
  };
  collect(false, null);
  // Erros de escrita só para as palavras que não apareceram de todo.
  const missing = new Set(tokens.map((_, i) => i).filter((i) => !found.some((f) => f.token === i)));
  if (missing.size) collect(true, missing);

  const order = new Map(nodes.map((n, i) => [n, i]));
  found.sort((a, b) => order.get(a.node)! - order.get(b.node)! || a.start - b.start);

  const hits: Hit[] = [];
  for (const f of found) {
    const el = f.node.parentElement!;
    const { panel, label } = sectionLabel(el);
    const panelEl = panel ? document.getElementById(`cap-${panel}`) : null;
    // Fora de um capítulo fechado, o que não ocupa espaço no ecrã (versões
    // só de telemóvel/computador escondidas) não conta.
    if (!(panelEl && panelEl.hidden) && !el.closest("details:not([open])") && el.getClientRects().length === 0) continue;
    const range = document.createRange();
    range.setStart(f.node, f.start);
    range.setEnd(f.node, f.end);
    hits.push({ range, el, panel, section: label, token: f.token });
  }
  return hits;
}

/** Por onde começar: dentro do sítio para onde o link apontava (um painel
 *  aberto, o capítulo/secção do #), e aí onde as palavras da pesquisa
 *  aparecem juntas. */
function firstIn(hits: Hit[], hash: string, nTokens: number): number {
  let pool = hits.map((_, i) => i);
  const inDialog = pool.filter((i) => hits[i].el.closest('[role="dialog"]'));
  if (inDialog.length) pool = inDialog;
  else if (hash) {
    const target = document.getElementById(hash) ?? document.getElementById(`cap-${hash}`);
    const inTarget = target ? pool.filter((i) => target.contains(hits[i].el) || hits[i].panel === hash) : [];
    if (inTarget.length) pool = inTarget;
  }
  if (nTokens > 1) {
    for (const i of pool) {
      const seen = new Set<number>();
      for (let j = i; j < hits.length && j < i + 8 && hits[j].section === hits[i].section; j++) seen.add(hits[j].token);
      if (seen.size >= nTokens) return i;
    }
  }
  return pool[0] ?? 0;
}

export function DocPageSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [cur, setCur] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qRef = useRef("");
  const hitsRef = useRef<Hit[]>([]);

  const paint = useCallback((list: Hit[], i: number) => {
    const r = registry();
    if (!r) return;
    if (!list.length) return clearHighlights();
    r.reg.set("docs-q", new r.H(...list.map((h) => h.range)));
    if (list[i]) r.reg.set("docs-q-now", new r.H(list[i].range));
  }, []);

  const goTo = useCallback(
    (list: Hit[], i: number) => {
      const h = list[i];
      if (!h) return;
      setCur(i);
      paint(list, i);
      let delay = 0;
      if (h.panel) {
        const panelEl = document.getElementById(`cap-${h.panel}`);
        if (panelEl?.hidden) {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${h.panel}`);
          window.dispatchEvent(new HashChangeEvent("hashchange"));
          delay = 140;
        }
      }
      const details = h.el.closest("details:not([open])") as HTMLDetailsElement | null;
      if (details) details.open = true;
      window.setTimeout(() => {
        h.el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, delay);
    },
    [paint],
  );

  const run = useCallback(
    (query: string, jump: "first" | "hash" | "keep") => {
      qRef.current = query;
      const list = query.trim().length >= 2 ? scan(query) : [];
      hitsRef.current = list;
      setHits(list);
      if (!list.length) {
        clearHighlights();
        setCur(0);
        return;
      }
      if (jump === "keep") {
        const i = Math.min(cur, list.length - 1);
        setCur(i);
        paint(list, i);
        return;
      }
      const n = queryTokens(query).length;
      goTo(list, firstIn(list, jump === "hash" ? decodeURIComponent(window.location.hash.slice(1)) : "", n));
    },
    [cur, goTo, paint],
  );

  // Chegada da pesquisa do hub: ?q=… abre logo, no sítio certo.
  useEffect(() => {
    setMounted(true);
    const initial = new URLSearchParams(window.location.search).get("q");
    if (!initial) return;
    setQ(initial);
    setOpen(true);
    // Deixa os capítulos e os painéis (a tarefa da Jornada) abrirem primeiro.
    const t = window.setTimeout(() => run(initial, "hash"), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // «/» abre a pesquisa da página.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      setOpen(true);
      window.setTimeout(() => inputRef.current?.select(), 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // O conteúdo muda (um painel abre, a direção edita): volta a procurar.
  useEffect(() => {
    if (!open) return;
    let t = 0;
    const obs = new MutationObserver((records) => {
      const main = document.querySelector("main");
      const relevant = records.some((r) => {
        const el = r.target.nodeType === 1 ? (r.target as Element) : r.target.parentElement;
        if (!el || el.closest("[data-docs-finder]")) return false;
        return Boolean(main?.contains(el) || el.closest('[role="dialog"]') || (r.addedNodes.length && r.target === document.body));
      });
      if (!relevant) return;
      window.clearTimeout(t);
      t = window.setTimeout(() => run(qRef.current, "keep"), 300);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      obs.disconnect();
      window.clearTimeout(t);
    };
  }, [open, run]);

  // Escrever procura (com uma pequena pausa).
  useEffect(() => {
    if (!open) return;
    if (q === qRef.current) return;
    const t = window.setTimeout(() => run(q, "first"), 180);
    return () => window.clearTimeout(t);
  }, [q, open, run]);

  useEffect(() => () => clearHighlights(), []);

  const close = () => {
    setOpen(false);
    setHits([]);
    hitsRef.current = [];
    qRef.current = "";
    clearHighlights();
    const url = new URL(window.location.href);
    if (url.searchParams.has("q")) {
      url.searchParams.delete("q");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  };

  const step = (d: 1 | -1) => {
    const list = hitsRef.current;
    if (!list.length) return;
    goTo(list, (cur + d + list.length) % list.length);
  };

  const current = hits[cur];
  const tooShort = q.trim().length < 2;

  return (
    <>
      <button
        type="button"
        data-docs-search="skip"
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium text-white/65 transition hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]"
      >
        <Search className="h-3.5 w-3.5" />
        Procurar nesta página
        <kbd className="hidden rounded border border-white/15 px-1.5 text-[10.5px] text-white/40 sm:inline">/</kbd>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            data-docs-finder
            role="search"
            aria-label="Procurar nesta página"
            className="fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 sm:bottom-6"
          >
            <div className="w-full max-w-[640px] rounded-2xl border border-white/15 bg-[#0d0e1a] p-2 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(120,61,245,0.18)]">
              <div className="flex items-center gap-1.5">
                <Search className="ml-2 h-4 w-4 shrink-0 text-[#c4a6ff]" />
                <input
                  ref={inputRef}
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (q !== qRef.current) run(q, "first");
                      else step(e.shiftKey ? -1 : 1);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      close();
                    }
                  }}
                  placeholder="Procurar nesta página…"
                  aria-label="Procurar nesta página"
                  className="h-10 min-w-0 flex-1 bg-transparent px-1.5 text-[15px] text-white placeholder:text-white/35 focus:outline-none"
                />
                <span className="shrink-0 px-1 text-[12.5px] tabular-nums text-white/50" aria-live="polite">
                  {tooShort ? "" : hits.length ? `${cur + 1} de ${hits.length}` : "0"}
                </span>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={!hits.length}
                  aria-label="Resultado anterior"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={!hits.length}
                  aria-label="Resultado seguinte"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fechar a pesquisa"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/[0.07] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/[0.07] px-2.5 pb-1 pt-2 text-[12px]">
                <span className="min-w-0 truncate text-white/50">
                  {tooShort
                    ? "Escreve pelo menos 2 letras. Enter para o seguinte."
                    : hits.length
                      ? current?.section
                        ? <>Em <span className="text-white/80">{current.section}</span></>
                        : "Nesta página"
                      : "Nada nesta página."}
                </span>
                <a
                  href={`/documentacao${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`}
                  className="inline-flex shrink-0 items-center gap-1 font-medium text-[#c4a6ff] transition hover:text-white"
                >
                  Procurar em toda a documentação
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
