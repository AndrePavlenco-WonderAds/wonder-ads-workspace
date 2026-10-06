// As peças que o CONSULTOR vê — e que a direção vê iguais na pré-visualização
// antes de enviar. Sem hooks: só desenham a fotografia que recebem
// (published.ts), por isso o que se pré-visualiza é literalmente o que chega.

import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleDot,
  Flag,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { formatISODate, type WeekPulse } from "@/lib/probation/shared";
import { S05 } from "@/lib/probation/document";
import {
  MET_TEXT,
  PULSE_TEXT,
  PULSE_TONE,
  type EvalView,
  type WeekView,
} from "@/lib/probation/published";
import type { TimelineEval, TimelineWeek } from "@/lib/probation/progress";

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** «sex 17/10/2026» a partir de YYYY-MM-DD, sem passar pelo fuso. */
export function dayLabel(iso: string): string {
  const f = formatISODate(iso);
  if (!f) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${f}`;
}

export function PulseBadge({ pulse, size = "md" }: { pulse: WeekPulse | null; size?: "sm" | "md" }) {
  if (!pulse) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/40">
        <span className="h-2 w-2 rounded-full bg-white/20" />
        Sem semáforo
      </span>
    );
  }
  const t = PULSE_TONE[pulse];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${
        size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]"
      }`}
      style={{ background: t.bg, color: t.dot, boxShadow: `inset 0 0 0 1px ${t.ring}` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: t.dot }} />
      {PULSE_TEXT[pulse]}
    </span>
  );
}

export function PulseDot({ pulse, title }: { pulse: WeekPulse | null; title?: string }) {
  return (
    <span
      title={title ?? (pulse ? PULSE_TEXT[pulse] : "Sem registo")}
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={
        pulse
          ? { background: PULSE_TONE[pulse].dot, boxShadow: `0 0 0 3px ${PULSE_TONE[pulse].bg}` }
          : { background: "rgba(255,255,255,0.14)" }
      }
    />
  );
}

function Block({ title, icon, children, tone }: { title: string; icon: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: tone ?? "rgba(255,255,255,0.45)" }}>
        {icon}
        {title}
      </p>
      <div className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-white/75">{children}</div>
    </div>
  );
}

/** O check-in de uma semana, tal como o consultor o recebe. */
export function WeekCardView({ view }: { view: WeekView }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0d0e16]">
      <div
        aria-hidden
        className="h-1 w-full"
        style={{ background: view.pulse ? PULSE_TONE[view.pulse].dot : "var(--brand-gradient)" }}
      />
      <div className="p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="readout text-white/40">Check-in semanal · semana {view.n}</p>
            <h3 className="mt-1 flex flex-wrap items-center gap-x-2 text-[17px] font-semibold text-white">
              <CalendarDays className="h-4 w-4 text-white/40" />
              {dayLabel(view.date)}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-white/45">
              <UserRound className="h-3.5 w-3.5" />
              com {view.conductedBy || "a direção"} · acompanha os KPIs dos {view.track} dias
            </p>
          </div>
          <PulseBadge pulse={view.pulse} />
        </header>

        {view.kpis.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07]">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="bg-white/[0.03] text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  <th className="px-3 py-2 font-semibold">KPI</th>
                  <th className="px-3 py-2 font-semibold">Meta</th>
                  <th className="px-3 py-2 font-semibold">Esta semana</th>
                  <th className="w-8 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {view.kpis.map((k, i) => (
                  <tr key={i} className="border-t border-white/[0.05]">
                    <td className="px-3 py-2 text-white/85">{k.name || "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-white/50">{k.target || "—"}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums text-white">{k.value || <span className="font-normal text-white/30">—</span>}</td>
                    <td className="px-3 py-2">
                      <PulseDot pulse={k.pulse} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view.prevActions.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Combinado na semana anterior</p>
            <ul className="mt-1.5 space-y-1">
              {view.prevActions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px]">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                      a.done ? "bg-emerald-500/20 text-emerald-300" : "border border-white/15 text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <span className={a.done ? "text-white/70" : "text-white/55"}>
                    {a.text}
                    {!a.done && <span className="ml-1.5 text-[11px] text-amber-300/80">· por fazer</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(view.wins || view.blockers || view.support) && (
          <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {view.wins && (
              <Block title="Correu bem" icon={<Sparkles className="h-3 w-3" />} tone="#6ee7b7">
                {view.wins}
              </Block>
            )}
            {view.blockers && (
              <Block title="O que travou" icon={<TriangleAlert className="h-3 w-3" />} tone="#fcd34d">
                {view.blockers}
              </Block>
            )}
            {view.support && (
              <Block title="Apoio da WonderAds" icon={<ShieldCheck className="h-3 w-3" />} tone="#c3aaff">
                {view.support}
              </Block>
            )}
          </div>
        )}

        {view.actions.length > 0 && (
          <div className="mt-4 rounded-xl border border-[#783DF5]/25 bg-[#783DF5]/[0.07] p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c3aaff]">
              <Flag className="h-3 w-3" />
              Para a próxima semana
            </p>
            <ul className="mt-1.5 space-y-1">
              {view.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-white/80">
                  <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-[#c3aaff]" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {view.consultantComment && (
          <p className="mt-4 flex gap-2 border-l-2 border-white/15 pl-3 text-[12.5px] italic leading-relaxed text-white/60">
            <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 not-italic text-white/35" />
            {view.consultantComment}
          </p>
        )}
      </div>
    </article>
  );
}

const DECISION_COLOR: Record<string, string> = Object.fromEntries(S05.outcomes.map((o) => [o.id, o.color]));

/** O resultado de uma avaliação, tal como o consultor o recebe. */
export function EvalCardView({ view }: { view: EvalView }) {
  const color = DECISION_COLOR[view.decision] ?? "#783df5";
  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0d0e16]">
      <div aria-hidden className="h-1 w-full" style={{ background: color }} />
      <div className="p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="readout text-white/40">Avaliação dos {view.which} dias</p>
            <h3 className="mt-1 text-[17px] font-semibold text-white">{dayLabel(view.date)}</h3>
            {view.metTotal > 0 && (
              <p className="mt-0.5 text-[12px] text-white/50">
                <span className="font-semibold text-white/85">
                  {view.metN} de {view.metTotal}
                </span>{" "}
                KPIs cumpridos
              </p>
            )}
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-white"
            style={{ background: color }}
          >
            <CircleDot className="h-3.5 w-3.5" />
            {view.decisionLabel}
          </span>
        </header>

        {view.kpis.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07]">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="bg-white/[0.03] text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  <th className="px-3 py-2 font-semibold">KPI</th>
                  <th className="px-3 py-2 font-semibold">Meta</th>
                  <th className="px-3 py-2 font-semibold">Resultado</th>
                  <th className="px-3 py-2 font-semibold">Cumprido</th>
                </tr>
              </thead>
              <tbody>
                {view.kpis.map((k, i) => (
                  <tr key={i} className="border-t border-white/[0.05]">
                    <td className="px-3 py-2 text-white/85">{k.name || "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-white/50">{k.target || "—"}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums text-white">{k.result || "—"}</td>
                    <td className="px-3 py-2">
                      {k.met ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            k.met === "sim"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : k.met === "parcial"
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {MET_TEXT[k.met]}
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(view.wentWell || view.fellShort) && (
          <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {view.wentWell && (
              <Block title="O que correu bem" icon={<Sparkles className="h-3 w-3" />} tone="#6ee7b7">
                {view.wentWell}
              </Block>
            )}
            {view.fellShort && (
              <Block title="O que ficou aquém" icon={<TriangleAlert className="h-3 w-3" />} tone="#fcd34d">
                {view.fellShort}
              </Block>
            )}
          </div>
        )}

        <div className="mt-4 rounded-xl p-3.5" style={{ background: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}55` }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">O que acontece agora</p>
          <p className="mt-1 text-[13px] leading-relaxed text-white/85">{view.outcome}</p>
          {view.nextDate && (
            <p className="mt-1.5 text-[12.5px] font-semibold text-white">Próxima avaliação: {dayLabel(view.nextDate)}</p>
          )}
        </div>

        {view.consultantComment && (
          <p className="mt-4 flex gap-2 border-l-2 border-white/15 pl-3 text-[12.5px] italic leading-relaxed text-white/60">
            <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 not-italic text-white/35" />
            {view.consultantComment}
          </p>
        )}
        {view.decidedBy && <p className="mt-3 text-[11.5px] text-white/40">Decisão tomada por {view.decidedBy}.</p>}
      </div>
    </article>
  );
}

/* ------------------------------ linha do tempo ------------------------------ */

/** Os 30 dias numa linha: check-ins por baixo, avaliações por cima e o dia
 *  de hoje marcado. A mesma linha na direção e no consultor. */
export function ProbationTimeline({
  startDate,
  today,
  weeks,
  evals,
}: {
  startDate: string;
  today: string;
  weeks: TimelineWeek[];
  evals: TimelineEval[];
}) {
  const at = (iso: string) => {
    if (!iso || !startDate) return 0;
    const [a, b] = [startDate, iso].map((x) => {
      const [y, m, d] = x.split("-").map(Number);
      return Date.UTC(y, m - 1, d);
    });
    return Math.max(0, Math.min(100, ((b - a) / 86_400_000 / 30) * 100));
  };
  const todayPos = at(today);
  const started = startDate && today >= startDate;
  const ended = startDate && today > (evals.find((e) => e.which === 30)?.date ?? "");
  const weekTone: Record<TimelineWeek["state"], string> = {
    done: "border-emerald-400/60 bg-emerald-500/25 text-emerald-200",
    due: "border-[#783DF5] bg-[#783DF5]/30 text-white animate-pulse",
    late: "border-rose-400/70 bg-rose-500/25 text-rose-100",
    future: "border-white/15 bg-[#0d0e16] text-white/45",
  };
  return (
    // Em ecrãs estreitos a linha desliza na horizontal em vez de encolher
    // até os marcadores se taparem uns aos outros.
    <div className="overflow-x-auto">
      <div className="relative min-w-[560px] px-10 pb-12 pt-[96px]">
        {/* trilho */}
        <div className="relative h-1.5 rounded-full bg-white/[0.07]">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${started ? (ended ? 100 : todayPos) : 0}%`, background: "var(--brand-gradient)" }}
          />
          {/* início */}
          <span className="absolute -top-[5px] left-0 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white/60 bg-[#0d0e16]" />
          <span className="absolute bottom-4 left-0 -translate-x-1/2 whitespace-nowrap text-[10px] text-white/40">
            Dia 0 · {formatISODate(startDate).slice(0, 5) || "—"}
          </span>

          {/* avaliações, por cima */}
          {evals.map((e) => {
            const pos = at(e.date);
            const tone =
              e.state === "decided"
                ? { background: e.color ?? "#783df5", border: "transparent" }
                : e.state === "late"
                  ? { background: "rgba(244,63,94,0.25)", border: "rgba(251,113,133,0.8)" }
                  : e.state === "due"
                    ? { background: "rgba(120,61,245,0.35)", border: "#783df5" }
                    : { background: "#0d0e16", border: "rgba(255,255,255,0.25)" };
            return (
              <div key={e.which} className="absolute top-1/2" style={{ left: `${pos}%` }}>
                {/* As avaliações vivem numa faixa por cima do trilho, presas a
                    ele por uma haste — um check-in no mesmo dia não as tapa. */}
                <span className="absolute bottom-0 left-1/2 h-[22px] w-px -translate-x-1/2 bg-white/20" />
                <span
                  className={`absolute bottom-[22px] left-1/2 flex h-[18px] w-[18px] -translate-x-1/2 translate-y-1/2 rotate-45 items-center justify-center rounded-[4px] border-2 ${
                    e.state === "na" ? "opacity-30" : ""
                  }`}
                  style={{ background: tone.background, borderColor: tone.border }}
                  title={`Avaliação dos ${e.which} dias · ${formatISODate(e.date)}`}
                />
                <span className="absolute bottom-[38px] left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-[10px] font-semibold text-white/70">
                  Avaliação {e.which}d
                  <span className="block font-normal text-white/40">{formatISODate(e.date).slice(0, 5)}</span>
                </span>
              </div>
            );
          })}

          {/* check-ins, por baixo */}
          {weeks.map((w) => {
            const pos = at(w.date);
            return (
              <div key={w.n} className="absolute top-1/2" style={{ left: `${pos}%` }}>
                <span
                  className={`absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[9px] font-bold ${weekTone[w.state]}`}
                  style={w.state === "done" && w.pulse ? { borderColor: PULSE_TONE[w.pulse].dot } : undefined}
                  title={`Check-in semana ${w.n} · ${formatISODate(w.date)}`}
                >
                  {w.state === "done" ? <Check className="h-3 w-3" /> : w.n}
                </span>
                <span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap text-center text-[10px] text-white/45">
                  S{w.n}
                  <span className="block text-white/30">{formatISODate(w.date).slice(0, 5)}</span>
                </span>
              </div>
            );
          })}

          {/* hoje */}
          {started && !ended && (
            <div className="absolute -top-[68px] bottom-[-6px] w-px bg-white/40" style={{ left: `${todayPos}%` }}>
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black">
                Hoje
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
