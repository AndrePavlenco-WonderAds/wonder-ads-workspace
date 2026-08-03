// Os dois painéis que acompanham o vídeo na página de aula: o "Remember" e a
// zona de instrutores.
//
// DESENHO — a coluna direita já tinha a espinha do capítulo (onde estou).
// Estes dois respondem às outras duas perguntas de quem está a ver uma aula:
// «o que é que eu tenho de levar daqui?» e «quem é que me está a falar?».
//
// O Remember é numerado e cada ponto tem o seu marcador na goteira, para se
// reler em diagonal antes do quiz. Quando a aula ainda não foi destilada, o
// painel diz isso em vez de desaparecer — um espaço vazio anunciado é honesto,
// um painel que às vezes existe e às vezes não é que confunde.

import { BookMarked, Mic } from "lucide-react";
import {
  initialsOf,
  instructorsForPresenter,
} from "@/lib/training/instructors";

export function LessonKeyPoints({ points }: { points: string[] }) {
  const has = points.length > 0;
  return (
    <section className="overflow-hidden rounded-2xl border border-[#A9834F]/25 bg-[#A9834F]/[0.045]">
      <header className="flex items-center gap-2 border-b border-[#A9834F]/20 px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#A9834F]/30 bg-[#A9834F]/12 text-[#d8b98a]">
          <BookMarked className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="readout text-[#d8b98a]">Remember</p>
          <p className="text-[10.5px] text-white/35">
            {has
              ? `${points.length} ponto${points.length === 1 ? "" : "s"} a reter`
              : "por destilar"}
          </p>
        </div>
      </header>

      {has ? (
        <ol className="relative space-y-3 px-4 py-4">
          {points.map((point, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="tabular mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border border-[#A9834F]/30 bg-[#A9834F]/10 text-[9px] font-bold text-[#d8b98a]">
                {i + 1}
              </span>
              <span className="text-[12.5px] leading-relaxed text-white/70">
                {point}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-4 text-[12px] leading-relaxed text-white/40">
          Os pontos-chave desta aula ainda não foram escritos. Aparecem aqui
          assim que forem adicionados no CMS da Formação.
        </p>
      )}
    </section>
  );
}

export function LessonInstructors({ presenter }: { presenter: string | null }) {
  const instructors = instructorsForPresenter(presenter);
  if (instructors.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.018]">
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#783DF5]/30 bg-[#783DF5]/10 text-[#c3aaff]">
          <Mic className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="readout text-white/40">
            {instructors.length === 1 ? "Instrutor" : "Instrutores"}
          </p>
          <p className="text-[10.5px] text-white/30">quem dá esta aula</p>
        </div>
      </header>

      <div className="space-y-3 px-4 py-4">
        {instructors.map((i) => (
          <div key={i.key} className="flex items-center gap-3">
            {i.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={i.photo}
                alt={i.name}
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-[#783DF5]/35"
                style={{ objectPosition: i.objectPosition }}
              />
            ) : (
              <span
                aria-hidden
                className="brand-gradient-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[0_6px_20px_-8px_rgba(120,61,245,0.8)]"
              >
                {initialsOf(i.name)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white/90">
                {i.name}
              </p>
              <p className="truncate text-[11px] text-white/40">{i.role}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
