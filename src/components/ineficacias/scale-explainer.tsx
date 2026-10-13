// O explicador — a apresentação «As ineficácias: o que conta e quanto
// vale», em texto, sempre à mão. Sem JS (um <details>), para abrir também
// na vista da direção sem hidratar nada.

import { BookOpen, Brain, ChevronDown, TrendingUp, TriangleAlert } from "lucide-react";
import { EXAMPLES, LEVELS, SCORE_BANDS } from "@/lib/ineficacias/shared";
import { LEVEL_TONES } from "./level-gauge";

const SCENARIOS = [
  {
    icon: TriangleAlert,
    title: "Cenário A — a gravidade basta",
    body: "Duas falhas, uma de 4 e outra de 2 pontos. PA = 6, logo nível 1.",
    tone: "text-amber-300",
  },
  {
    icon: Brain,
    title: "Cenário B — a recorrência basta",
    body: "Três falhas de 1 ponto cada. PA = 3 é baixo, mas NO = 3, logo nível 1.",
    tone: "text-sky-300",
  },
  {
    icon: TrendingUp,
    title: "Cenário C — a progressão é cumulativa",
    body: "Depois do nível 2 e com o contador a zero, duas falhas leves. NO = 2 no período seguinte, logo probation.",
    tone: "text-[#c3aaff]",
  },
];

export function ScaleExplainer({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-3xl border border-white/[0.08] bg-white/[0.02] open:bg-white/[0.03]"
    >
      <summary className="flex cursor-pointer select-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#c3aaff]">
          <BookOpen className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-white/90">Como funciona — o que conta e quanto vale</span>
          <span className="block text-[11.5px] text-white/45">
            Erro de aprendizagem vs erro de recorrência · a escala de 0 a 10 · os quatro níveis · o probation
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/40 transition group-open:rotate-180" />
      </summary>

      <div className="border-t border-white/[0.06] px-5 pb-6 pt-5">
        <p className="max-w-[720px] text-[13px] leading-relaxed text-white/65">
          <strong className="text-white/90">Erro de aprendizagem vs erro de recorrência.</strong> Errar faz parte de
          aprender. O que a escala mede é o que <em>se repete</em>: cada ineficácia é registada uma a uma, com data e
          peso, e quando se acumulam sobe-se de nível. O probation trata o que já não se resolve sozinho — não é o
          princípio do fim, é a última oportunidade estruturada.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="readout text-white/35">Exemplos de ineficácias</p>
            <ul className="mt-2.5 space-y-1.5">
              {EXAMPLES.map((e) => (
                <li key={e} className="flex items-start gap-2 text-[12.5px] text-white/70">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#a78bfa]" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="readout text-white/35">Escala de 0 a 10 — o peso de cada ocorrência</p>
            <ul className="mt-2.5 space-y-1.5">
              {SCORE_BANDS.map((b) => (
                <li key={b.id} className="flex items-center gap-2.5 text-[12.5px] text-white/70">
                  <span className="tabular w-12 shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-center text-[11px] font-semibold text-white/80">
                    {b.min === b.max ? b.min : `${b.min}–${b.max}`}
                  </span>
                  <span className="font-semibold text-white/85">{b.label}</span>
                  <span className="text-white/45">· {b.hint}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="readout mt-7 text-white/35">A escala — os quatro níveis · 30 dias · PA = soma dos pontos · NO = número de ocorrências</p>
        <ol className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {LEVELS.map((l) => {
            const t = LEVEL_TONES[l.level];
            return (
              <li key={l.level} className={`rounded-2xl border px-4 py-3.5 ${t.border} ${t.bg}`}>
                <p className={`text-[12px] font-bold uppercase tracking-[0.16em] ${t.text}`}>{l.title}</p>
                <p className="mt-1 text-[12.5px] font-semibold text-white/85">{l.rule}</p>
                <p className="mt-1 text-[11.5px] leading-snug text-white/55">{l.measure}</p>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3.5 text-[12.5px] leading-relaxed text-white/65">
          <strong className="text-white/90">A regra do reinício.</strong> Sempre que uma reunião de nível (1:1) é
          realizada, os contadores (PA e NO) reiniciam a zero para a fase seguinte. A progressão de níveis é linear e
          cumulativa — reinicia, mas as ineficácias não se apagam. Uma falha grave sozinha pode levar a probation
          direto.
        </div>

        <p className="readout mt-7 text-white/35">Três cenários na prática</p>
        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {SCENARIOS.map((s) => (
            <div key={s.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
              <s.icon className={`h-4 w-4 ${s.tone}`} />
              <p className="mt-2 text-[12.5px] font-semibold text-white/85">{s.title}</p>
              <p className="mt-1 text-[11.5px] leading-snug text-white/55">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
