"use client";

// O cockpit de um plano: a linha dos 30 dias, o que fazer a seguir, a saúde
// dos KPIs semana a semana e o que já chegou ao consultor. É o que se olha
// primeiro ao abrir um plano — o formulário vem depois.

import { ArrowRight, Eye, Gauge, ListChecks, Send } from "lucide-react";
import { ProbationTimeline, PulseDot } from "./views";
import { SendBadge } from "./sheet-bits";
import { periodDay, periodDates, type ProbationDraft } from "@/lib/probation/shared";
import {
  kpiHealth,
  nextSteps,
  timelineFromPlan,
  type NextStep,
} from "@/lib/probation/progress";
import {
  pubEntry,
  sendItemLabel,
  sendState,
  snapshotFor,
  type PublishedPlan,
  type SendItem,
} from "@/lib/probation/published";

const TONE: Record<NextStep["tone"], string> = {
  late: "border-rose-400/40 bg-rose-500/[0.08] text-rose-100",
  today: "border-[#783DF5]/50 bg-[#783DF5]/[0.12] text-white",
  soon: "border-amber-400/35 bg-amber-500/[0.07] text-amber-50",
  info: "border-white/10 bg-white/[0.03] text-white/80",
  done: "border-emerald-400/30 bg-emerald-500/[0.07] text-emerald-50",
};

const TONE_LABEL: Record<NextStep["tone"], string> = {
  late: "Atrasado",
  today: "Agora",
  soon: "Em breve",
  info: "A seguir",
  done: "Fechado",
};

export const SEND_ITEMS: SendItem[] = ["plan", "week:1", "week:2", "week:3", "week:4", "eval:15", "eval:30"];

export function Cockpit({
  planId,
  draft,
  periodIndex,
  pub,
  today,
  onStep,
  onPreviewPage,
}: {
  planId: string;
  draft: ProbationDraft;
  periodIndex: number;
  pub: PublishedPlan | null;
  today: string;
  onStep: (s: NextStep) => void;
  onPreviewPage: () => void;
}) {
  const period = draft.period;
  const tl = timelineFromPlan(draft, period, today);
  const steps = nextSteps(draft, periodIndex, pub, today).slice(0, 4);
  const health = kpiHealth(period);
  const day = periodDay(period, today);
  const { d30 } = periodDates(period);
  const weeksDone = period.weeks.filter((w) => w.done).length;

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02]" aria-label={`Ponto de situação do plano ${planId}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-6 pt-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pb-1">
          <p className="text-[12px] text-white/45">
            <span className="text-[22px] font-bold tabular-nums text-white">
              {day === null ? "—" : Math.max(0, Math.min(30, day))}
            </span>
            /30 dias
          </p>
          <p className="text-[12px] text-white/45">
            <span className="text-[22px] font-bold tabular-nums text-white">{weeksDone}</span>/4 check-ins
          </p>
          <p className="text-[12px] text-white/45">Fim do período: {d30 ? d30.split("-").reverse().join("/") : "—"}</p>
        </div>
      </div>
      <div className="px-2">
        <ProbationTimeline startDate={period.startDate} today={today} weeks={tl.weeks} evals={tl.evals} />
      </div>

      <div className="grid grid-cols-1 gap-px border-t border-white/[0.06] bg-white/[0.06] lg:grid-cols-3">
        {/* próximos passos */}
        <div className="bg-[#0a0b12] p-5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            <ListChecks className="h-3.5 w-3.5" />
            O que fazer a seguir
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {steps.length === 0 ? (
              <p className="text-[12.5px] text-white/45">Tudo em dia.</p>
            ) : (
              steps.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onStep(s)}
                  className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:brightness-125 ${TONE[s.tone]}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9.5px] font-bold uppercase tracking-[0.16em] opacity-60">{TONE_LABEL[s.tone]}</span>
                    <span className="block text-[13px] font-semibold leading-snug">{s.title}</span>
                    <span className="block text-[11.5px] opacity-70">{s.detail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* saúde dos KPIs */}
        <div className="bg-[#0a0b12] p-5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            <Gauge className="h-3.5 w-3.5" />
            KPIs semana a semana
          </p>
          {health.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-white/45">Ainda sem KPIs escritos.</p>
          ) : (
            <div className="mt-3 space-y-4">
              {health.map((g) => (
                <div key={g.which}>
                  <p className="mb-1.5 flex items-center justify-between text-[10.5px] text-white/35">
                    <span>KPIs dos {g.which} dias</span>
                    <span className="tracking-[0.3em]">S1 S2 S3 S4</span>
                  </p>
                  <ul className="space-y-1.5">
                    {g.rows.map((r, i) => (
                      <li key={i} className="flex items-center gap-2 text-[12px]">
                        <span className="min-w-0 flex-1 truncate text-white/75" title={r.name}>
                          {r.name}
                          {r.latest && <span className="ml-1.5 text-white/40">· {r.latest}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-[9px]">
                          {r.pulses.map((p, j) =>
                            p === undefined ? (
                              <span key={j} className="h-2.5 w-2.5 rounded-full border border-dashed border-white/15" />
                            ) : (
                              <PulseDot key={j} pulse={p} />
                            ),
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* lado do consultor */}
        <div className="bg-[#0a0b12] p-5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            <Send className="h-3.5 w-3.5" />
            O que o consultor já recebeu
          </p>
          <ul className="mt-3 space-y-1.5">
            {SEND_ITEMS.map((item) => {
              const snap = snapshotFor(draft, period, periodIndex, item);
              const entry = pubEntry(pub, periodIndex, item);
              if (!snap && !entry) return null;
              // Um check-in que ainda não aconteceu não está «por enviar».
              const week = item.startsWith("week:") ? period.weeks.find((w) => `week:${w.n}` === item) : null;
              if (week && !week.done && !entry) return null;
              return (
                <li key={item} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate text-white/70">{sendItemLabel(item).replace("Check-in semanal · ", "Check-in ")}</span>
                  <SendBadge compact state={sendState(entry, snap?.sig ?? null)} />
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onPreviewPage}
            className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#c3aaff] hover:underline"
          >
            <Eye className="h-3.5 w-3.5" />
            Ver a página do consultor
          </button>
        </div>
      </div>
    </section>
  );
}
