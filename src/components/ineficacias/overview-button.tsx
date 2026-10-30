// O botão «O meu painel» do topo da página do consultor (v77.91). A escala
// e o PA/NO saíram do topo da página — vivem agora em /ineficacias/painel —
// e aqui fica só o essencial num relance: o nível, os contadores contra o
// limiar seguinte e o próximo reset de semestre (v78.57). Puro (sem hooks).

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatISODayMonth, type LedgerState } from "@/lib/ineficacias/shared";
import { LEVEL_TONES } from "@/components/ineficacias/level-gauge";

const LEVEL_STROKES = ["#34d399", "#fbbf24", "#fb923c", "#fb7185"] as const;

export function OverviewButton({ state, href }: { state: LedgerState; href: string }) {
  const tone = LEVEL_TONES[state.reached];
  const stroke = LEVEL_STROKES[state.reached];
  // O anel enche com o contador mais perto do limiar do próximo nível.
  const fill = state.next ? Math.min(1, Math.max(state.pa / state.next.pa, state.no / state.next.no)) : 1;
  const r = 20;
  const c = 2 * Math.PI * r;
  const pending = Boolean(state.pendingMeasure);

  return (
    <Link
      href={href}
      className="brand-gradient-border group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-white/[0.035] py-3 pl-3 pr-4 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06] sm:w-auto sm:min-w-[340px]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-80"
        style={{ background: tone.glow, opacity: 0.45 }}
      />
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
        <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(fill, 0.02))}
          />
        </svg>
        <span className="relative flex flex-col items-center leading-none">
          <span className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/45">Nível</span>
          <span className={`mt-0.5 text-[19px] font-bold ${tone.text}`}>{state.reached}</span>
        </span>
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="readout block text-white/40">O meu painel</span>
        <span className="mt-0.5 block text-[14px] font-semibold tracking-tight text-white">
          PA <span className="tabular-nums">{state.pa}</span>
          {state.next && <span className="text-white/35">/{state.next.pa}</span>}
          <span className="mx-1.5 text-white/20">·</span>
          NO <span className="tabular-nums">{state.no}</span>
          {state.next && <span className="text-white/35">/{state.next.no}</span>}
        </span>
        <span className={`mt-0.5 block truncate text-[11px] ${pending ? "text-amber-200/90" : "text-white/50"}`}>
          {pending
            ? `Nível ${state.pendingMeasure!.level} atingido · medida por aplicar`
            : state.nextReset
              ? `Volta a zero a ${formatISODayMonth(state.nextReset.at)} · escala e histórico`
              : state.phaseStart
                ? `Contadores desde ${formatISODayMonth(state.phaseStart)} · escala e histórico`
                : "Escala e histórico"}
        </span>
      </span>

      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-white/70 transition group-hover:border-white/25 group-hover:bg-white/[0.1] group-hover:text-white">
        <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-px group-hover:translate-x-px" />
      </span>
    </Link>
  );
}
