"use client";

// Capítulos de um SOP, um de cada vez (v80.8). A página corrida da v80.7
// punha tudo à frente do olho ao mesmo tempo; o André pediu a organização da
// apresentação da Scale Labs: uma barra de capítulos numerados no topo
// («1 Canais e formatos · 2 Momentos e horários…») e, dentro de cada um, uma
// ideia por bloco. O conteúdo vem todo renderizado do servidor; aqui só se
// escolhe qual se vê. O capítulo fica no endereço (#canais) para se poder
// partilhar um link direto, e os links internos «#id» trocam de capítulo.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

export type SopChapter = {
  id: string;
  /** O número do capítulo na barra («1», «2»…). Sem número: intro/resumo. */
  num?: number;
  label: string;
  content: ReactNode;
};

export function SopChapters({ chapters }: { chapters: SopChapter[] }) {
  const ids = chapters.map((c) => c.id);
  const idsKey = ids.join("|");
  const [active, setActive] = useState(ids[0] ?? "");
  const anchorRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const scrollToTop = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
  }, []);

  // O capítulo vem do endereço — ao abrir e quando um link «#id» muda.
  useEffect(() => {
    const known = idsKey.split("|");
    const fromHash = (scroll: boolean) => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      if (known.includes(h)) {
        setActive(h);
        if (scroll) scrollToTop();
      }
    };
    fromHash(false);
    const onHash = () => fromHash(true);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [idsKey, scrollToTop]);

  // Mantém o capítulo ativo à vista quando a barra rola na horizontal.
  useEffect(() => {
    barRef.current
      ?.querySelector<HTMLElement>(`[data-id="${active}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const go = (id: string) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
    scrollToTop();
  };

  const idx = Math.max(0, ids.indexOf(active));
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = idx < chapters.length - 1 ? chapters[idx + 1] : null;
  const name = (c: SopChapter) => (c.num ? `${c.num} · ${c.label}` : c.label);

  return (
    <>
      <div ref={anchorRef} />
      <div className="sticky top-[72px] z-20 -mx-6 mt-8 border-b border-white/[0.06] bg-[color:var(--background)]/85 px-6 backdrop-blur-md sm:top-[81px] sm:-mx-10 sm:px-10">
        <div
          ref={barRef}
          role="tablist"
          aria-label="Capítulos"
          className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {chapters.map((c) => {
            const on = c.id === active;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                data-id={c.id}
                data-label={name(c)}
                aria-selected={on}
                onClick={() => go(c.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] ${
                  on
                    ? "border-[#c4a6ff] bg-[#c4a6ff] font-semibold text-[#120f24]"
                    : "border-white/12 text-white/55 hover:border-white/25 hover:text-white/90"
                }`}
              >
                {c.num !== undefined && (
                  <span className={`tabular-nums ${on ? "text-[#120f24]" : "text-white/40"}`}>{c.num}</span>
                )}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {chapters.map((c) => (
        <div key={c.id} id={`cap-${c.id}`} role="tabpanel" hidden={c.id !== active}>
          {c.content}
        </div>
      ))}

      <nav aria-label="Capítulo seguinte" className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-6 pb-10">
        {prev ? (
          <button
            type="button"
            onClick={() => go(prev.id)}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {name(prev)}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button
            type="button"
            onClick={() => go(next.id)}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[14px] font-semibold text-[#07080d] transition hover:bg-white/90"
          >
            Seguinte: {name(next)}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </nav>
    </>
  );
}
