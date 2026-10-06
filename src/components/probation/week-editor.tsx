"use client";

// O check-in de uma semana, preenchido pela chefia (ou pela direção, sem
// chefia intermédia) na própria reunião: semáforo, ponto de situação de cada
// KPI, o que foi combinado na semana anterior, o que correu bem, o que
// travou, o apoio dado, os próximos passos e uma nota interna que nunca sai.

import { CalendarDays, Check, Eye, Lock, Plus, RotateCcw, X } from "lucide-react";
import { Field, PulsePicker, SendBadge } from "./sheet-bits";
import { dayLabel } from "./views";
import {
  MAX_ACTIONS,
  defaultWeekDates,
  previousActions,
  weekKpiSet,
  weekTrack,
  type ProbationAction,
  type ProbationPeriod,
  type ProbationWeek,
  type ProbationWeekKpi,
} from "@/lib/probation/shared";
import type { SendState } from "@/lib/probation/published";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function WeekEditor({
  period,
  week,
  checkinDay,
  lead,
  send,
  canSend,
  onWeek,
  onPrevActions,
  onPreview,
}: {
  period: ProbationPeriod;
  week: ProbationWeek;
  checkinDay: string;
  lead: string;
  send: SendState;
  /** false enquanto o plano não tem consultor da equipa. */
  canSend: boolean;
  onWeek: (patch: Partial<ProbationWeek>) => void;
  onPrevActions: (actions: ProbationAction[]) => void;
  onPreview: () => void;
}) {
  const computed = defaultWeekDates(period.startDate, checkinDay)[week.n - 1] ?? "";
  const date = week.date || computed;
  const track = weekTrack(period, week, checkinDay);
  const kpis = weekKpiSet(period, week, checkinDay);
  const prev = previousActions(period, week.n);
  const prevAll = period.weeks.find((w) => w.n === week.n - 1)?.actions ?? [];

  const kpiRow = (id: string): ProbationWeekKpi =>
    week.kpis.find((k) => k.kpiId === id) ?? { kpiId: id, value: "", pulse: null };
  const setKpi = (id: string, patch: Partial<ProbationWeekKpi>) => {
    const exists = week.kpis.some((k) => k.kpiId === id);
    onWeek({
      kpis: exists
        ? week.kpis.map((k) => (k.kpiId === id ? { ...k, ...patch } : k))
        : [...week.kpis, { ...kpiRow(id), ...patch }],
    });
  };
  const setAction = (i: number, patch: Partial<ProbationAction>) =>
    onWeek({ actions: week.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  return (
    <div className="flex flex-col gap-6">
      {/* cabeçalho da semana */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/45">Check-in semanal</p>
          <h3 className="mt-0.5 text-[20px] font-extrabold tracking-tight">
            Semana {week.n} · <span className="tabular-nums">{dayLabel(date)}</span>
          </h3>
          <p className="mt-0.5 text-[12px] text-black/50">Acompanha os KPIs dos {track} dias.</p>
        </div>
        <button
          type="button"
          onClick={() => onWeek({ done: !week.done })}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-bold transition ${
            week.done
              ? "bg-emerald-600 text-white shadow-[0_6px_18px_-6px_rgba(5,150,105,0.7)]"
              : "border border-black/15 bg-white text-black/70 hover:border-black/30"
          }`}
        >
          <Check className="h-4 w-4" />
          {week.done ? "Check-in feito" : "Marcar como feito"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Data da reunião"
          hint={
            week.date ? (
              <button
                type="button"
                onClick={() => onWeek({ date: "" })}
                className="inline-flex items-center gap-1 font-semibold text-[#783df5] hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                Voltar à data calculada ({dayLabel(computed)})
              </button>
            ) : (
              "Calculada pelo dia do check-in. Muda-a se a reunião mudou de dia."
            )
          }
        >
          <input
            type="date"
            className="sheet-input"
            value={date}
            onChange={(e) => onWeek({ date: e.target.value === computed ? "" : e.target.value })}
          />
        </Field>
        <Field label="Feito por" hint="Quem esteve na reunião com o consultor.">
          <input
            className="sheet-input"
            value={week.conductedBy}
            onChange={(e) => onWeek({ conductedBy: e.target.value })}
            placeholder={lead || "Nome"}
          />
        </Field>
      </div>

      <div>
        <span className="sheet-label mb-2">Como está a semana</span>
        <PulsePicker value={week.pulse} onChange={(pulse) => onWeek({ pulse })} label={`Semáforo da semana ${week.n}`} />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="sheet-label">Ponto de situação dos KPIs dos {track} dias</span>
        </div>
        {kpis.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 bg-white/50 px-3 py-2.5 text-[12.5px] text-black/45">
            Ainda não há KPIs dos {track} dias — escreve-os no separador «Plano».
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {kpis.map((k, i) => {
              const row = kpiRow(k.id);
              return (
                <div key={k.id} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-black/[0.08] bg-white/60 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                  <p className="text-[12.5px] font-semibold leading-snug">
                    <span className="mr-1.5 text-[#783df5]">{i + 1}</span>
                    {k.kpi}
                    {k.target && <span className="block text-[11.5px] font-normal text-black/45">meta {k.target}</span>}
                  </p>
                  <input
                    className="sheet-input !py-1.5"
                    aria-label={`Ponto de situação do KPI ${i + 1}`}
                    value={row.value}
                    onChange={(e) => setKpi(k.id, { value: e.target.value })}
                    placeholder="Onde está agora"
                  />
                  <PulsePicker compact value={row.pulse} onChange={(pulse) => setKpi(k.id, { pulse })} label={`Semáforo do KPI ${i + 1}`} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {prev.length > 0 && (
        <div>
          <span className="sheet-label mb-2">Combinado na semana {week.n - 1} — ficou feito?</span>
          <div className="flex flex-col gap-1.5">
            {prevAll.map((a, i) =>
              a.text.trim() ? (
                <label key={a.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-black/[0.08] bg-white/60 px-3 py-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-emerald-600"
                    checked={a.done}
                    onChange={(e) => onPrevActions(prevAll.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))}
                  />
                  <span className={a.done ? "text-black/50 line-through" : "text-black/80"}>{a.text}</span>
                </label>
              ) : null,
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <Field label="O que correu bem">
          <textarea className="sheet-input min-h-[64px] resize-y" value={week.wins} onChange={(e) => onWeek({ wins: e.target.value })} />
        </Field>
        <Field label="O que travou">
          <textarea className="sheet-input min-h-[64px] resize-y" value={week.blockers} onChange={(e) => onWeek({ blockers: e.target.value })} />
        </Field>
        <Field label="Apoio que a WonderAds deu esta semana" hint="Formação, shadowing, uma ferramenta, uma decisão desbloqueada…">
          <textarea className="sheet-input min-h-[56px] resize-y" value={week.support} onChange={(e) => onWeek({ support: e.target.value })} />
        </Field>
      </div>

      <div>
        <span className="sheet-label mb-2">Próximos passos (a semana {week.n + 1 <= 4 ? week.n + 1 : "seguinte"} confirma-os)</span>
        <div className="flex flex-col gap-2">
          {week.actions.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2">
              <span className="w-5 text-center text-[12px] font-bold text-[#783df5]">{i + 1}</span>
              <input
                className="sheet-input"
                value={a.text}
                onChange={(e) => setAction(i, { text: e.target.value })}
                placeholder="Ex.: marcar 5 reuniões com leads do CRM até quarta"
              />
              <button
                type="button"
                aria-label={`Remover passo ${i + 1}`}
                onClick={() => onWeek({ actions: week.actions.filter((_, j) => j !== i) })}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-black/30 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={week.actions.length >= MAX_ACTIONS}
          onClick={() => onWeek({ actions: [...week.actions, { id: newId(), text: "", done: false }] })}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#c9c5dc] px-3 py-1.5 text-[12px] font-semibold text-[#783df5] transition hover:bg-[#f6f4fd] disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar passo
        </button>
      </div>

      <Field label="Comentário do consultor" hint="O que o consultor disse na reunião, nas palavras dele.">
        <textarea className="sheet-input min-h-[56px] resize-y" value={week.consultantComment} onChange={(e) => onWeek({ consultantComment: e.target.value })} />
      </Field>

      <div className="rounded-xl border border-amber-500/30 bg-amber-50 p-3.5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-900/80">
          <Lock className="h-3.5 w-3.5" />
          Nota interna · nunca é enviada ao consultor
        </p>
        <textarea
          className="sheet-input mt-2 min-h-[56px] resize-y !bg-white/80"
          value={week.internalNote}
          onChange={(e) => onWeek({ internalNote: e.target.value })}
          placeholder="Impressões, riscos, o que conversar com a direção…"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-black/[0.08] pt-5">
        <button
          type="button"
          disabled={!week.done || !canSend}
          onClick={onPreview}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Eye className="h-4 w-4" />
          Pré-visualizar e enviar
        </button>
        <span className="rounded-full bg-[#0d0e16] p-0.5">
          <SendBadge state={send} />
        </span>
        {!week.done && (
          <span className="flex items-center gap-1 text-[11.5px] text-black/45">
            <CalendarDays className="h-3.5 w-3.5" />
            Envia-se depois de marcado como feito.
          </span>
        )}
        {week.done && !canSend && (
          <span className="text-[11.5px] text-black/45">Para enviar, o consultor tem de vir da lista da equipa.</span>
        )}
      </div>
    </div>
  );
}
