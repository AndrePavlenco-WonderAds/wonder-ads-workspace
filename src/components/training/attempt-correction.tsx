"use client";

// A correção, pergunta a pergunta — o mesmo desenho no ecrã logo a seguir à
// entrega e na página da tentativa (v78.63), que é onde ela fica para ler com
// calma. Num exame de 35 perguntas o que interessa são as erradas: abre-se
// nelas, com a tua resposta e a certa lado a lado e o sítio onde voltar a
// estudar; «Todas» mostra a folha inteira.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { TopicChip } from "@/components/training/exam-sheet";
import type { CorrectionRow } from "@/lib/training/exam-correction";

type Filter = "wrong" | "all";

export function CorrectionList({
  rows,
  initialFilter = "all",
}: {
  rows: CorrectionRow[];
  initialFilter?: Filter;
}) {
  const wrongCount = rows.filter((c) => !c.isCorrect && !c.manualReview).length;
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const showing: Filter = wrongCount === 0 ? "all" : filter;
  const visible = rows
    .map((c, i) => ({ c, n: i + 1 }))
    .filter(({ c }) => showing === "all" || (!c.isCorrect && !c.manualReview));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#A9834F]">
          Correção
        </h2>
        {wrongCount > 0 && wrongCount < rows.length && (
          <div
            role="tablist"
            aria-label="Que perguntas mostrar"
            className="ml-auto inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5"
          >
            <FilterTab active={showing === "wrong"} onClick={() => setFilter("wrong")}>
              Erradas · {wrongCount}
            </FilterTab>
            <FilterTab active={showing === "all"} onClick={() => setFilter("all")}>
              Todas · {rows.length}
            </FilterTab>
          </div>
        )}
      </div>

      {visible.map(({ c, n }) => (
        <CorrectionCard key={c.questionId} c={c} n={n} />
      ))}
    </div>
  );
}

function FilterTab({
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`tabular rounded-md px-3 py-1 text-[12px] font-semibold transition ${
        active ? "bg-white/[0.1] text-white" : "text-white/45 hover:text-white/80"
      }`}
    >
      {children}
    </button>
  );
}

function CorrectionCard({ c, n }: { c: CorrectionRow; n: number }) {
  const wrong = !c.isCorrect && !c.manualReview;
  const blank = c.chosenOptionIds.length === 0 && !c.manualReview;
  return (
    <div
      className={`rounded-2xl border p-5 ${
        c.manualReview
          ? "border-white/10 bg-white/[0.02]"
          : c.isCorrect
            ? "border-emerald-400/20 bg-emerald-500/[0.04]"
            : "border-rose-400/25 bg-rose-500/[0.05]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">
          {c.manualReview ? (
            <AlertTriangle className="h-4 w-4 text-white/40" />
          ) : c.isCorrect ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          ) : (
            <XCircle className="h-4 w-4 text-rose-300" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {c.topic && (
            <div className="mb-1.5">
              <TopicChip topic={c.topic} />
            </div>
          )}
          <p className="text-[14px] font-medium leading-relaxed text-white/90">
            {n}.{" "}
            {c.missing ? (
              <span className="italic text-white/45">
                Pergunta entretanto retirada do banco
              </span>
            ) : (
              c.prompt
            )}
          </p>

          {c.options.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {c.options.map((o) => {
                const chosen = c.chosenOptionIds.includes(o.id);
                const correct = c.correctOptionIds.includes(o.id);
                return (
                  <li
                    key={o.id}
                    className={`flex flex-wrap items-start gap-x-2 gap-y-0.5 rounded-lg px-2.5 py-1.5 text-[12.5px] leading-relaxed sm:flex-nowrap ${
                      correct
                        ? "bg-emerald-500/10 text-emerald-100/90"
                        : chosen
                          ? "bg-rose-500/10 text-rose-100/90"
                          : "text-white/45"
                    }`}
                  >
                    <span className="w-4 shrink-0 text-center">
                      {correct ? "✓" : chosen ? "✗" : "·"}
                    </span>
                    <span className="min-w-0 flex-1">{o.text}</span>
                    {(chosen || (correct && wrong)) && (
                      <span className="ml-6 flex w-full shrink-0 gap-x-3 text-[10px] font-semibold uppercase tracking-wide sm:ml-0 sm:w-auto sm:flex-col sm:items-end sm:gap-0.5 sm:pt-0.5">
                        {chosen && <span className="text-white/45">a tua resposta</span>}
                        {correct && wrong && <span className="text-emerald-300/90">resposta certa</span>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {wrong && (blank || c.correctOptionIds.length > 1) && (
            <p className="mt-2.5 text-[12px] leading-relaxed text-rose-100/70">
              {blank
                ? "Ficou por responder — conta como errada."
                : `Havia ${c.correctOptionIds.length} respostas certas — só contava com todas e nenhuma a mais.`}
            </p>
          )}

          {c.explanation && (
            <p className="mt-3 border-l-2 border-[#783DF5]/40 pl-3 text-[12.5px] leading-relaxed text-white/60">
              {c.explanation}
            </p>
          )}

          {wrong && c.review && (
            <Link
              href={c.review.href}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-white/70 transition hover:border-[#783DF5]/45 hover:text-white"
            >
              {c.review.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
