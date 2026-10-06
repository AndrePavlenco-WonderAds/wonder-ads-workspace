// O cartão de um plano em aberto na lista do SuperAdmin: os 30 dias, os
// check-ins semana a semana (semáforo), o próximo passo e o que o consultor
// já recebeu e confirmou.

import Link from "next/link";
import { ArrowRight, UserRound, UsersRound } from "lucide-react";
import { StatusChip } from "./status-chip";
import { PulseDot } from "./views";
import {
  formatISODate,
  periodDates,
  periodDay,
  planStatus,
  type ProbationPlan,
} from "@/lib/probation/shared";
import { nextSteps, type NextStep } from "@/lib/probation/progress";
import { pendingAcks, pubEntry, sendState, snapshotFor, type PublishedPlan } from "@/lib/probation/published";

const STEP_TONE: Record<NextStep["tone"], string> = {
  late: "text-rose-300",
  today: "text-[#c3aaff]",
  soon: "text-amber-200",
  info: "text-white/60",
  done: "text-emerald-300",
};

export function PlanCard({ plan, pub, today }: { plan: ProbationPlan; pub: PublishedPlan | null; today: string }) {
  const idx = plan.history.length;
  const period = plan.period;
  const dayN = periodDay(period, today);
  const pct = dayN === null ? 0 : Math.max(0, Math.min(100, (dayN / 30) * 100));
  const step = nextSteps(plan, idx, pub, today)[0] ?? null;
  const planSent = sendState(pubEntry(pub, idx, "plan"), snapshotFor(plan, period, idx, "plan")?.sig ?? null);
  const unread = pub ? pendingAcks(pub).length : 0;
  const { d15, d30 } = periodDates(period);

  return (
    <Link
      href={`/admin/probation/${plan.id}`}
      className="group block overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] transition hover:border-[#783DF5]/45 hover:bg-white/[0.04]"
    >
      <div className="h-1 w-full bg-white/[0.06]">
        <div className="h-1" style={{ width: `${pct}%`, background: "var(--brand-gradient)" }} />
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-white group-hover:underline">{plan.consultantName}</p>
            <p className="mt-0.5 truncate text-[12px] text-white/45">
              {plan.roleTeam || "—"}
              {idx > 0 ? ` · ${idx + 1}.º período` : ""}
            </p>
          </div>
          <StatusChip status={planStatus(plan)} />
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] text-white/40">Dia</p>
            <p className="text-[22px] font-bold leading-none tabular-nums text-white">
              {dayN === null ? "—" : Math.max(0, Math.min(30, dayN))}
              <span className="text-[12px] font-medium text-white/35">/30</span>
            </p>
          </div>
          <div className="text-right">
            <p className="mb-1.5 text-[11px] text-white/40">Check-ins</p>
            <div className="flex items-center gap-2">
              {period.weeks.map((w) => (
                <span key={w.n} className="flex flex-col items-center gap-1">
                  {w.done ? (
                    <PulseDot pulse={w.pulse} title={`Semana ${w.n}`} />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full border border-dashed border-white/25" title={`Semana ${w.n} por fazer`} />
                  )}
                  <span className="text-[9px] text-white/30">S{w.n}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="text-right text-[11px] text-white/40">
            <p>15d · {formatISODate(d15).slice(0, 5) || "—"}</p>
            <p>30d · {formatISODate(d30).slice(0, 5) || "—"}</p>
          </div>
        </div>

        {step && (
          <p className={`mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold ${STEP_TONE[step.tone]}`}>
            <ArrowRight className="h-3.5 w-3.5" />
            {step.title}
            <span className="font-normal text-white/40">· {step.detail}</span>
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-3 text-[11.5px] text-white/45">
          <span className="inline-flex items-center gap-1">
            {plan.hasManager ? <UsersRound className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
            {plan.hasManager ? plan.manager || "Chefia por definir" : `Só direção · ${plan.direction || "—"}`}
          </span>
          <span className="text-white/20">·</span>
          <span className={planSent.kind === "never" ? "text-white/40" : planSent.kind === "changed" ? "text-amber-200/80" : "text-emerald-300/80"}>
            {planSent.kind === "never"
              ? "Plano por enviar"
              : planSent.kind === "changed"
                ? "Plano alterado desde o envio"
                : planSent.ack
                  ? "Plano lido pelo consultor"
                  : "Plano enviado · por ler"}
          </span>
          {unread > 0 && (
            <>
              <span className="text-white/20">·</span>
              <span>{unread} por confirmar</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
