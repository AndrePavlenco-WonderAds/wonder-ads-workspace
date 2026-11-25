"use client";

// A pesquisa do hub da Documentação (v80.46): procura DENTRO de todas as
// páginas que a pessoa lê (capítulos, secções, tarefas da Jornada) e nas
// aulas da Formação dela, ao mesmo tempo.
//
// O índice monta-se no browser: cada página é lida com a sessão da pessoa
// (lib/documentacao/search-crawl.ts) e fica guardada neste browser até a
// página mudar (versão) ou passarem 6 horas. As aulas e as tarefas da
// Jornada vêm de /api/documentacao/pesquisa. Sem pesquisa escrita, mostra os
// cartões de sempre (children).

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CornerDownLeft,
  FileText,
  GraduationCap,
  Loader2,
  Lock,
  PlayCircle,
  Search,
  X,
} from "lucide-react";
import { buildIndex, hitHref, search, type SearchDoc, type SearchHit, type Segment } from "@/lib/documentacao/search";
import { crawlPage, type CrawlPage } from "@/lib/documentacao/search-crawl";

const CACHE_KEY = "docs-search:v1";
const RECENT_KEY = "docs-search:recent";
const TTL = 6 * 60 * 60 * 1000;
const PER_PAGE = 3;

type Cache = {
  v: 1;
  user: string;
  pages: Record<string, { version: string; at: number; docs: SearchDoc[] }>;
  extras?: { version: string; at: number; docs: SearchDoc[]; lessons: number };
};

function readCache(user: string): Cache {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as Cache;
      if (c?.v === 1 && c.user === user && c.pages) return c;
    }
  } catch {
    /* sem cache */
  }
  return { v: 1, user, pages: {} };
}

function writeCache(c: Cache) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    try {
      window.localStorage.removeItem(CACHE_KEY);
    } catch {
      /* nada */
    }
  }
}

function readRecent(): string[] {
  try {
    const r = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(r) ? r.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function pushRecent(q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  try {
    const next = [t, ...readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* nada */
  }
}

function Marks({ segs }: { segs: Segment[] }) {
  return (
    <>
      {segs.map((s, i) =>
        s.mark ? (
          <mark key={i} className="rounded-[4px] bg-[#c4a6ff]/25 px-0.5 text-white">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

type Tab = "tudo" | "docs" | "aulas";

type Group = { id: string; label: string; block: string; image?: string; href: string; hits: SearchHit[] };

export function DocsSearch({
  pages,
  user,
  build,
  initialQuery,
  children,
}: {
  pages: CrawlPage[];
  /** A pessoa VISTA — a cache é dela. */
  user: string;
  build: string;
  initialQuery: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [pageDocs, setPageDocs] = useState<Record<string, SearchDoc[]>>({});
  const [extras, setExtras] = useState<{ docs: SearchDoc[]; lessons: number } | null>(null);
  const [progress, setProgress] = useState({ done: 0, failed: 0, loading: true });
  const [tab, setTab] = useState<Tab>("tudo");
  const [active, setActive] = useState(-1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAllAulas, setShowAllAulas] = useState(false);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const pagesKey = pages.map((p) => `${p.id}@${p.version}`).join("|");

  // ---- Montar o índice -------------------------------------------------
  useEffect(() => {
    setRecent(readRecent());
    const cache = readCache(user);
    const now = Date.now();
    const known: Record<string, SearchDoc[]> = {};
    const stale: CrawlPage[] = [];
    for (const p of pages) {
      const c = cache.pages[p.id];
      if (c) known[p.id] = c.docs; // serve já, mesmo antiga, até chegar a nova
      if (!c || c.version !== p.version || now - c.at > TTL) stale.push(p);
    }
    setPageDocs(known);
    const extrasFresh = Boolean(cache.extras && cache.extras.version === build && now - cache.extras.at < TTL);
    if (cache.extras) setExtras({ docs: cache.extras.docs, lessons: cache.extras.lessons });

    if (!stale.length && extrasFresh) {
      setProgress({ done: pages.length, failed: 0, loading: false });
      return;
    }
    setProgress({ done: pages.length - stale.length, failed: 0, loading: true });

    let cancelled = false;
    const ctrl = new AbortController();
    const queue = [...stale];
    const worker = async () => {
      while (queue.length && !cancelled) {
        const p = queue.shift()!;
        let docs: SearchDoc[] | null = null;
        try {
          docs = await crawlPage(p, ctrl.signal);
        } catch {
          docs = null;
        }
        if (cancelled) return;
        if (docs) {
          cache.pages[p.id] = { version: p.version, at: Date.now(), docs };
          const got = docs;
          setPageDocs((prev) => ({ ...prev, [p.id]: got }));
        }
        setProgress((pr) => ({ ...pr, done: pr.done + 1, failed: pr.failed + (docs ? 0 : 1) }));
      }
    };
    const extrasTask = extrasFresh
      ? Promise.resolve()
      : fetch("/api/documentacao/pesquisa", { credentials: "same-origin", cache: "no-store", signal: ctrl.signal })
          .then((r) => (r.ok ? r.json() : null))
          .then((j: { docs?: SearchDoc[]; lessons?: number } | null) => {
            if (cancelled || !j) return;
            const docs = Array.isArray(j.docs) ? j.docs : [];
            cache.extras = { version: build, at: Date.now(), docs, lessons: j.lessons ?? 0 };
            setExtras({ docs, lessons: j.lessons ?? 0 });
          })
          .catch(() => undefined);

    const start = window.setTimeout(
      () => {
        void Promise.all([worker(), worker(), worker(), extrasTask]).then(() => {
          if (cancelled) return;
          for (const id of Object.keys(cache.pages)) if (!pages.some((p) => p.id === id)) delete cache.pages[id];
          writeCache(cache);
          setProgress((pr) => ({ ...pr, loading: false }));
        });
      },
      initialQuery ? 0 : 700,
    );
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearTimeout(start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey, user, build]);

  const allDocs = useMemo(
    () => [...pages.flatMap((p) => pageDocs[p.id] ?? []), ...(extras?.docs ?? [])],
    [pages, pageDocs, extras],
  );
  const index = useMemo(() => buildIndex(allDocs), [allDocs]);

  // ---- Procurar --------------------------------------------------------
  const deferred = useDeferredValue(query);
  const trimmed = deferred.trim();
  const result = useMemo(() => (trimmed.length >= 2 ? search(index, trimmed, 150) : null), [index, trimmed]);

  const pageById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    for (const h of result?.hits ?? []) {
      if (h.doc.kind !== "doc") continue;
      let g = m.get(h.doc.group);
      if (!g) {
        const p = pageById.get(h.doc.group);
        g = {
          id: h.doc.group,
          label: p?.label ?? h.doc.groupLabel,
          block: p?.block ?? h.doc.block,
          image: p?.image ?? h.doc.meta?.image,
          href: p?.href ?? h.doc.href.split("?")[0],
          hits: [],
        };
        m.set(h.doc.group, g);
      }
      // O mesmo sítio duas vezes (pedaços partidos) não se repete.
      if (!g.hits.some((x) => x.doc.anchor === h.doc.anchor && x.doc.heading === h.doc.heading && x.doc.href === h.doc.href)) {
        g.hits.push(h);
      }
    }
    return [...m.values()];
  }, [result, pageById]);
  const aulas = useMemo(() => (result?.hits ?? []).filter((h) => h.doc.kind === "aula"), [result]);
  const docCount = groups.reduce((s, g) => s + g.hits.length, 0);

  const showDocs = tab !== "aulas";
  const showAulas = tab !== "docs";
  const visibleAulas = showAllAulas || tab === "aulas" ? aulas : aulas.slice(0, 8);

  // A lista por onde as setas andam, pela ordem em que se vê.
  const flat = useMemo(() => {
    const out: string[] = [];
    if (showDocs)
      for (const g of groups) {
        const shown = expanded.has(g.id) ? g.hits : g.hits.slice(0, PER_PAGE);
        for (const h of shown) out.push(hitHref(h.doc, trimmed));
      }
    if (showAulas) for (const h of visibleAulas) out.push(hitHref(h.doc, trimmed));
    return out;
  }, [groups, visibleAulas, expanded, showDocs, showAulas, trimmed]);

  useEffect(() => setActive(-1), [trimmed, tab]);
  useEffect(() => {
    if (active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // O endereço guarda a pesquisa (voltar atrás traz os resultados).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const url = new URL(window.location.href);
      if (query.trim()) url.searchParams.set("q", query.trim());
      else url.searchParams.delete("q");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, 350);
    return () => window.clearTimeout(t);
  }, [query]);

  // «/» (ou Ctrl/⌘+K) vai para a barra.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openHref = (href: string) => {
    pushRecent(trimmed);
    router.push(href);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      const href = flat[active >= 0 ? active : 0];
      if (href) {
        e.preventDefault();
        openHref(href);
      }
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  const lessonsTotal = extras?.lessons ?? 0;
  const searching = trimmed.length >= 2;
  const status = progress.loading
    ? `A preparar a pesquisa · ${Math.min(progress.done, pages.length)} de ${pages.length} páginas`
    : `Procura dentro de ${pages.length} ${pages.length === 1 ? "página" : "páginas"}${
        lessonsTotal ? ` e ${lessonsTotal} aulas da Formação` : ""
      }`;

  let idx = -1;
  const itemClass = (i: number) =>
    `group/hit block rounded-xl px-3 py-2.5 transition ${
      i === active ? "bg-white/[0.08] ring-1 ring-[#c4a6ff]/50" : "hover:bg-white/[0.05]"
    }`;

  return (
    <>
      <div className="mt-8">
        <div
          className={`flex items-center gap-3 rounded-2xl border bg-white/[0.04] px-4 transition ${
            focused ? "border-[#c4a6ff]/60 shadow-[0_0_0_4px_rgba(120,61,245,0.18)]" : "border-white/12 hover:border-white/20"
          }`}
        >
          <Search className="h-5 w-5 shrink-0 text-[#c4a6ff]" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              setFocused(true);
              setRecent(readRecent());
            }}
            onBlur={() => setFocused(false)}
            placeholder="Procura em toda a documentação e nas aulas da Formação…"
            aria-label="Procurar na documentação e na Formação"
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-white placeholder:text-white/35 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Limpar a pesquisa"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/[0.07] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden shrink-0 rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-white/40 sm:inline">/</kbd>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[12.5px] text-white/40">
          <span className="inline-flex items-center gap-1.5">
            {progress.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c4a6ff]" />}
            {status}
            {!progress.loading && progress.failed > 0 && ` · ${progress.failed} não abriram`}
          </span>
          {!searching && recent.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5">
              <span>Recentes:</span>
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setQuery(r);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-white/12 px-2.5 py-0.5 text-white/60 transition hover:border-white/25 hover:text-white"
                >
                  {r}
                </button>
              ))}
            </span>
          )}
        </div>
      </div>

      {!searching ? (
        children
      ) : (
        <div ref={listRef} className="mt-6 pb-10">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["tudo", "Tudo", docCount + aulas.length],
                ["docs", "Documentação", docCount],
                ["aulas", "Formação", aulas.length],
              ] as Array<[Tab, string, number]>
            ).map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${
                  tab === id
                    ? "border-[#c4a6ff] bg-[#c4a6ff] font-semibold text-[#120f24]"
                    : "border-white/12 text-white/60 hover:border-white/25 hover:text-white"
                }`}
              >
                {label} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            ))}
            <span className="ml-auto hidden items-center gap-1.5 text-[12px] text-white/35 sm:inline-flex">
              <CornerDownLeft className="h-3.5 w-3.5" /> abre · ↑↓ escolhe
            </span>
          </div>

          {docCount + aulas.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-8 text-center">
              <p className="text-[15px] text-white/75">
                Nada encontrado para <span className="font-semibold text-white">«{trimmed}»</span>.
              </p>
              <p className="mt-1.5 text-[13px] text-white/45">
                {progress.loading
                  ? "Ainda a ler as páginas: pode aparecer daqui a pouco."
                  : "Tenta outra palavra, ou menos palavras."}
              </p>
            </div>
          ) : (
            <div
              className={`mt-5 grid gap-6 ${
                showDocs && showAulas && groups.length && aulas.length ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""
              }`}
            >
              {showDocs && groups.length > 0 && (
                <section aria-label="Na documentação" className="min-w-0 space-y-4">
                  <h2 className="flex items-center gap-2 px-1 text-[13px] font-semibold text-white/55">
                    <BookOpen className="h-4 w-4" /> Na documentação
                  </h2>
                  {groups.map((g) => {
                    const open = expanded.has(g.id);
                    const shown = open ? g.hits : g.hits.slice(0, PER_PAGE);
                    return (
                      <article key={g.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-2.5">
                        <Link
                          href={g.href}
                          onClick={() => pushRecent(trimmed)}
                          className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.04]"
                        >
                          <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                            {g.image ? (
                              <Image src={g.image} alt="" fill sizes="56px" className="object-cover" />
                            ) : (
                              <FileText className="absolute inset-0 m-auto h-5 w-5 text-white/35" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15.5px] font-semibold text-white">{g.label}</span>
                            <span className="block truncate text-[12px] text-white/45">
                              {g.block} · {g.hits.length} {g.hits.length === 1 ? "sítio" : "sítios"}
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-white/30" />
                        </Link>
                        <ul className="mt-1 space-y-0.5">
                          {shown.map((h) => {
                            idx += 1;
                            const i = idx;
                            const href = hitHref(h.doc, trimmed);
                            return (
                              <li key={h.doc.key}>
                                <Link
                                  href={href}
                                  data-idx={i}
                                  onClick={() => pushRecent(trimmed)}
                                  onMouseEnter={() => setActive(i)}
                                  className={itemClass(i)}
                                >
                                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                                    <span className="rounded-full border border-white/12 px-2 py-0.5 text-white/55">{h.doc.section}</span>
                                    {h.heading && h.doc.heading !== h.doc.section && (
                                      <span className="min-w-0 font-medium text-white/85">
                                        <Marks segs={h.heading} />
                                      </span>
                                    )}
                                  </span>
                                  <span className="mt-1 block text-[13.5px] leading-relaxed text-white/60">
                                    <Marks segs={h.snippet} />
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                        {g.hits.length > PER_PAGE && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((s) => {
                                const n = new Set(s);
                                if (n.has(g.id)) n.delete(g.id);
                                else n.add(g.id);
                                return n;
                              })
                            }
                            className="mt-1 px-3 py-1.5 text-[12.5px] font-medium text-[#c4a6ff] transition hover:text-white"
                          >
                            {open ? "Mostrar menos" : `Mais ${g.hits.length - PER_PAGE} nesta página`}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </section>
              )}

              {showAulas && aulas.length > 0 && (
                <section aria-label="Nas aulas da Formação" className="min-w-0">
                  <h2 className="flex items-center gap-2 px-1 text-[13px] font-semibold text-white/55">
                    <GraduationCap className="h-4 w-4" /> Nas aulas da Formação
                  </h2>
                  <ul className="mt-4 space-y-1 rounded-[22px] border border-white/10 bg-white/[0.03] p-2.5">
                    {visibleAulas.map((h) => {
                      idx += 1;
                      const i = idx;
                      const m = h.doc.meta ?? {};
                      return (
                        <li key={h.doc.key}>
                          <Link
                            href={hitHref(h.doc, trimmed)}
                            data-idx={i}
                            onClick={() => pushRecent(trimmed)}
                            onMouseEnter={() => setActive(i)}
                            className={`${itemClass(i)} flex gap-3`}
                          >
                            <span
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                m.video ? "bg-[#783DF5]/25 text-[#e4d6ff]" : "bg-white/[0.06] text-white/45"
                              }`}
                            >
                              {m.video ? <PlayCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[14px] font-semibold leading-snug text-white">
                                {h.heading ? <Marks segs={h.heading} /> : h.doc.heading}
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] text-white/45">
                                {h.doc.groupLabel} · {h.doc.section}
                              </span>
                              {h.doc.text && (
                                <span className="mt-1 line-clamp-2 block text-[12.5px] leading-relaxed text-white/55">
                                  <Marks segs={h.snippet} />
                                </span>
                              )}
                              <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                                {m.video ? (
                                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-white/60">
                                    Vídeo{m.minutes ? ` · ${m.minutes} min` : ""}
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-white/45">Vídeo por gravar</span>
                                )}
                                {m.watched && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-200">
                                    <Check className="h-3 w-3" /> Vista
                                  </span>
                                )}
                                {m.locked && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-200">
                                    <Lock className="h-3 w-3" /> Bloqueada na sequência
                                  </span>
                                )}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {tab !== "aulas" && aulas.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setShowAllAulas((v) => !v)}
                      className="mt-2 px-3 py-1.5 text-[12.5px] font-medium text-[#c4a6ff] transition hover:text-white"
                    >
                      {showAllAulas ? "Mostrar menos" : `Mais ${aulas.length - 8} aulas`}
                    </button>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
