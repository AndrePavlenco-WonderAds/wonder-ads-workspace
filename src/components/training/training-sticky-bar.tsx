"use client";

// Barra de progresso fixa da Formação — a irmã escura da que existe no
// onboarding de clientes. Fica escondida enquanto o hero está visível e desce
// depois, para o consultor ter sempre a percentagem e o "continuar" à mão
// num módulo longo (o de ADS tem 34 aulas: o hero desaparece depressa).

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, PartyPopper } from "lucide-react";

export function TrainingStickyBar({
  title,
  percent,
  done,
  total,
  minutesLeft,
  nextHref,
  continueLabel,
  allDone,
  allDoneLabel = "Módulo concluído",
}: {
  title: string;
  percent: number;
  done: number;
  total: number;
  minutesLeft: number;
  nextHref: string | null;
  continueLabel: string;
  allDone: boolean;
  /** O que dizer quando não há nada por fazer — "concluída" e "em dia" (com
   *  aulas ainda por publicar) não são a mesma coisa. */
  allDoneLabel?: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!shown}
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        shown
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-full opacity-0"
      }`}
    >
      <div className="border-b border-white/8 bg-[color:var(--background)]/92 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.9)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
          <span className="brand-gradient-bg tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white">
            {percent}%
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-white/80">
              <span className="hidden sm:inline">{title} · </span>
              {allDone ? allDoneLabel : `${done}/${total} passos`}
              {!allDone && minutesLeft > 0 && (
                <span className="font-normal text-white/40">
                  {" "}
                  · ~{minutesLeft} min
                </span>
              )}
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="brand-gradient-bg h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          {allDone || !nextHref ? (
            <span className="hidden shrink-0 items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-[#c3aaff] sm:inline-flex">
              <PartyPopper className="h-4 w-4" />
              Tudo pronto
            </span>
          ) : (
            <Link
              href={nextHref}
              className="brand-gradient-bg group inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110"
            >
              {continueLabel}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
