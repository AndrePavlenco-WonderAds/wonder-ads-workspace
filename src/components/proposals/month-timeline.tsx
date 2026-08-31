"use client";

// Plano mês a mês em acordeão: uma linha vertical com seis nós; cada mês
// mostra o título, uma frase e as etiquetas do que se entrega, e abre para
// a lista completa. O primeiro vem aberto. Na impressão abrem todos (CSS da
// moldura), para o PDF não perder nada.

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Reveal } from "./proposal-motion";
import { BRAND_GRADIENT } from "./proposal-primitives";

export type TimelineMonth = {
  index: number;
  month: string;
  title: string;
  summary: string;
  tags: string[];
  bullets: string[];
  checkpoint?: boolean;
};

export function MonthTimeline({ months }: { months: TimelineMonth[] }) {
  const [open, setOpen] = useState<number[]>([months[0]?.index ?? 1]);
  const allOpen = open.length === months.length;
  const toggle = (i: number) =>
    setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));

  return (
    <div>
      <div className="no-print mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(allOpen ? [] : months.map((m) => m.index))}
          className="text-[12px] font-medium text-[#5b21b6] underline-offset-2 hover:underline"
        >
          {allOpen ? "Recolher tudo" : "Expandir os 6 meses"}
        </button>
      </div>
      <div className="relative">
        <div
          aria-hidden
          className="absolute bottom-6 left-[19px] top-6 w-px"
          style={{ background: "linear-gradient(180deg, #343ED7, #783DF5, #C535C9)" }}
        />
        <ol className="space-y-3">
          {months.map((m, i) => {
            const isOpen = open.includes(m.index);
            return (
              <li key={m.index}>
                <Reveal delay={i * 70}>
                  <div className="flex gap-4">
                    <div className="relative z-10 mt-4 flex h-10 w-10 shrink-0 items-center justify-center">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold ring-4 ring-[#f4f4ed] transition-all duration-300 ${isOpen ? "text-white" : "border border-[#c4b5fd] bg-white text-[#5b21b6]"}`}
                        style={isOpen ? { background: BRAND_GRADIENT } : undefined}
                      >
                        {m.index}
                      </div>
                    </div>
                    <div
                      className={`min-w-0 flex-1 rounded-2xl border bg-white transition-shadow duration-300 ${isOpen ? "border-[#c4b5fd] shadow-[0_12px_32px_-20px_rgba(120,61,245,.55)]" : "border-black/8"}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(m.index)}
                        aria-expanded={isOpen}
                        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#ede9fe] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#4c1d95]">
                              {m.month}
                            </span>
                            {m.checkpoint && (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-emerald-900">
                                Checkpoint · relatório
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-[16px] font-semibold text-black/88">{m.title}</p>
                          <p className="mt-0.5 text-[13px] text-black/60">{m.summary}</p>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {m.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-md border border-black/8 bg-black/[0.03] px-2 py-0.5 text-[11px] font-medium text-black/65"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <ChevronDown
                          className={`no-print mt-1 h-4 w-4 shrink-0 text-black/40 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      <div
                        className="pr-acc-body grid transition-[grid-template-rows] duration-300 ease-out"
                        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                      >
                        <div className="overflow-hidden">
                          <ul className="space-y-2 border-t border-black/6 px-5 pb-5 pt-4 text-[13.5px] leading-relaxed text-black/70">
                            {m.bullets.map((b, j) => (
                              <li key={j} className="flex gap-2.5">
                                <span
                                  aria-hidden
                                  className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{ background: BRAND_GRADIENT }}
                                />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
