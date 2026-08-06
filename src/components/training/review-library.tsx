"use client";

// Biblioteca de revisão — o índice pesquisável de tudo o que já foi dado.
//
// PORQUE É QUE ISTO EXISTE: o resto do hub responde a "o que faço a seguir",
// e responde em sequência — capítulo a capítulo, sempre para a frente. Mas
// metade das vezes que alguém abre a Formação não é para avançar: é porque
// tem uma reunião daqui a dez minutos e quer rever a aula do onboarding. Sem
// um índice, isso obriga a abrir o módulo, procurar o capítulo, procurar a
// aula. Aqui escreve-se "onboarding" e está lá.
//
// Por defeito mostra o que a pessoa JÁ VIU — que é o que se revê. O separador
// "Todas" existe para quem quer espreitar o que aí vem.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Search } from "lucide-react";
import { LessonThumb } from "@/components/training/training-ui";
import type { TrainingLessonType } from "@/lib/training/catalog";

export type LibraryEntry = {
  id: string;
  href: string;
  title: string;
  trackName: string;
  moduleTitle: string;
  type: TrainingLessonType;
  minutes: number;
  watched: boolean;
  comingSoon: boolean;
};

type Tab = "watched" | "all";

export function ReviewLibrary({ entries }: { entries: LibraryEntry[] }) {
  const [tab, setTab] = useState<Tab>("watched");
  const [query, setQuery] = useState("");
  const watchedCount = useMemo(
    () => entries.filter((e) => e.watched).length,
    [entries],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (tab === "watched" && !e.watched) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.moduleTitle.toLowerCase().includes(q) ||
        e.trackName.toLowerCase().includes(q)
      );
    });
  }, [entries, tab, query]);

  // Agrupa por capítulo mantendo a ordem do catálogo — a mesma ordem por que
  // a matéria foi dada, que é a ordem por que as pessoas se lembram dela.
  const groups = useMemo(() => {
    const out: { key: string; trackName: string; moduleTitle: string; items: LibraryEntry[] }[] = [];
    for (const e of visible) {
      const key = `${e.trackName}::${e.moduleTitle}`;
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(e);
      else
        out.push({
          key,
          trackName: e.trackName,
          moduleTitle: e.moduleTitle,
          items: [e],
        });
    }
    return out;
  }, [visible]);

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-white/12 bg-white/[0.04] p-0.5">
          <TabButton active={tab === "watched"} onClick={() => setTab("watched")}>
            Já vistas
            <span className="tabular ml-1.5 opacity-60">{watchedCount}</span>
          </TabButton>
          <TabButton active={tab === "all"} onClick={() => setTab("all")}>
            Todas
            <span className="tabular ml-1.5 opacity-60">{entries.length}</span>
          </TabButton>
        </div>

        <label className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar aula, capítulo…"
            className="w-full rounded-lg border border-white/12 bg-white/[0.05] py-2 pl-9 pr-3 text-[12.5px] text-white outline-none transition placeholder:text-white/30 focus:border-[#783DF5]/60"
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-white/12 px-4 py-8 text-center text-[12.5px] text-white/40">
          {query.trim()
            ? "Nada com esse nome."
            : tab === "watched"
              ? "Ainda não viste nenhuma aula — assim que vires a primeira, fica aqui para reveres."
              : "Ainda não há aulas publicadas."}
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="flex flex-wrap items-baseline gap-x-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                {g.moduleTitle}
                <span className="text-[10px] font-medium normal-case tracking-normal text-white/25">
                  {g.trackName}
                </span>
              </p>
              <ul className="mt-2 space-y-1.5">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={e.href}
                      className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 transition hover:border-[#783DF5]/40 hover:bg-white/[0.06]"
                    >
                      <LessonThumb
                        type={e.type}
                        watched={e.watched}
                        comingSoon={e.comingSoon}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-white/85 group-hover:text-white">
                          {e.title}
                        </span>
                        <span className="tabular mt-0.5 flex items-center gap-1.5 text-[11px] text-white/35">
                          <Clock className="h-2.5 w-2.5" />~{e.minutes} min
                          {e.comingSoon && (
                            <span className="text-amber-200/70">
                              · por publicar
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[7px] px-3 py-1.5 text-[12px] font-semibold transition ${
        active
          ? "bg-white text-[#3b1f6e]"
          : "text-white/55 hover:text-white/85"
      }`}
    >
      {children}
    </button>
  );
}
