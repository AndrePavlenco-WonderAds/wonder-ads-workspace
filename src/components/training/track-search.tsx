"use client";

// Pesquisa dentro de um módulo da Formação.
//
// PORQUE EXISTE, SE O HUB JÁ TEM UMA: a do hub é um índice de revisão de
// TUDO o que já foi dado, em todos os módulos. Esta responde a outra
// pergunta, feita de dentro de um módulo: «onde é que este módulo fala de
// X?». Com trinta aulas em nove capítulos, percorrer a sequência à procura
// de uma frase deixou de ser viável.
//
// NÃO FILTRA A SEQUÊNCIA, SALTA PARA A AULA. A sequência é o caminho — a
// ordem por que a matéria foi pensada — e escondê-la a meio de uma pesquisa
// dava a ideia de que o módulo tinha três aulas. A pesquisa é uma ferramenta
// de salto, e por isso vive por cima, abre uma lista de resultados e
// devolve o ecrã ao caminho assim que se limpa.
//
// PROCURA TAMBÉM NOS PONTOS-CHAVE. É lá que está o assunto: o título diz
// «Reunião real de onboarding», mas quem procura «expectativas de prazos»
// só a encontra se o «Remember» também for lido.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Search, X } from "lucide-react";
import { LessonThumb } from "@/components/training/training-ui";
import type { TrainingLessonType } from "@/lib/training/catalog";

export type TrackSearchEntry = {
  id: string;
  href: string;
  title: string;
  description: string;
  keyPoints: string[];
  moduleTitle: string;
  chapterIndex: number;
  type: TrainingLessonType;
  watched: boolean;
  comingSoon: boolean;
  locked: boolean;
};

/** Sem acentos e em minúsculas: quem escreve «onboarding» à pressa não põe
 *  cedilhas, e «Comunicação» tem de aparecer à mesma. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function TrackSearch({ entries }: { entries: TrackSearchEntry[] }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (q.length < 2) return [];
    // Todos os termos têm de aparecer algures na aula — assim «onboarding
    // reunião» encontra a aula que fala das duas coisas, e não tudo o que
    // fala de uma.
    const terms = q.split(/\s+/).filter(Boolean);
    return entries.filter((e) => {
      const haystack = fold(
        [e.title, e.description, e.moduleTitle, ...e.keyPoints].join(" "),
      );
      return terms.every((t) => haystack.includes(t));
    });
  }, [entries, query]);

  const active = query.trim().length >= 2;

  return (
    <div className="animate-fade-up mt-8">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Procurar uma aula ou um assunto neste módulo…"
          aria-label="Procurar neste módulo"
          className="w-full rounded-xl border border-white/[0.14] bg-white/[0.05] py-3 pl-10 pr-10 text-[13.5px] text-white outline-none transition placeholder:text-white/35 focus:border-[#783DF5]/60 focus:bg-white/[0.08]"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Limpar pesquisa"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {active && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.13] bg-white/[0.04]">
          <p className="border-b border-white/[0.08] px-4 py-2.5 text-[12px] text-white/55">
            {results.length === 0
              ? "Nenhuma aula deste módulo fala disso."
              : `${results.length} aula${results.length === 1 ? "" : "s"} — clica para abrir`}
          </p>
          {results.length > 0 && (
            <ul className="max-h-[26rem] overflow-y-auto">
              {results.map((r) => (
                <li key={r.id} className="border-b border-white/[0.05] last:border-0">
                  <Link
                    href={r.href}
                    className="group flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.07]"
                  >
                    <LessonThumb
                      type={r.type}
                      watched={r.watched}
                      comingSoon={r.comingSoon}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-white">
                          {r.title}
                        </span>
                        {r.watched && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/80" />
                        )}
                        {r.comingSoon && (
                          <span className="rounded-full border border-amber-400/25 bg-amber-500/[0.08] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-amber-200/75">
                            Brevemente
                          </span>
                        )}
                        {r.locked && (
                          <span className="rounded-full border border-white/12 px-2 py-0.5 text-[9.5px] uppercase tracking-wide text-white/40">
                            trancada
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-white/50">
                        Capítulo {r.chapterIndex.toString().padStart(2, "0")} ·{" "}
                        {r.moduleTitle}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
