"use client";

// Peças da folha que vêm da v77.73: a definição dos KPIs, o registo de uma
// avaliação (resultado por KPI, o que correu bem/aquém, decisão) e o
// interruptor Sim / Parcial / Não.

import { Plus, X } from "lucide-react";
import { Field } from "./sheet-bits";
import { formatDate } from "@/lib/dates";
import {
  DECISIONS,
  KPI_MET_OPTIONS,
  MAX_KPIS,
  emptyKpi,
  kpiFilled,
  metCount,
  type KpiMet,
  type ProbationDecision,
  type ProbationEvaluation,
  type ProbationKpi,
} from "@/lib/probation/shared";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function KpiDefinitions({
  which,
  rows,
  onChange,
}: {
  which: 15 | 30;
  rows: ProbationKpi[];
  onChange: (rows: ProbationKpi[]) => void;
}) {
  const set = (i: number, patch: Partial<ProbationKpi>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div>
      {rows.length > 0 && (
        <div className="hidden grid-cols-[22px_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_28px] gap-2 px-0.5 pb-1.5 sm:grid">
          <span />
          <span className="sheet-label">KPI</span>
          <span className="sheet-label">Meta dia {which}</span>
          <span className="sheet-label">Como medimos</span>
          <span />
        </div>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="grid grid-cols-[22px_minmax(0,1fr)_28px] items-start gap-2 sm:grid-cols-[22px_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_28px]"
          >
            <span className="pt-2.5 text-center text-[12px] font-bold text-[#783df5]">{i + 1}</span>
            <input
              className="sheet-input"
              aria-label={`KPI ${i + 1}`}
              value={r.kpi}
              onChange={(e) => set(i, { kpi: e.target.value })}
              placeholder="Ex.: reuniões qualificadas marcadas"
            />
            <div className="col-start-2 sm:col-start-auto">
              <input
                className="sheet-input"
                aria-label={`Meta dia ${which} do KPI ${i + 1}`}
                value={r.target}
                onChange={(e) => set(i, { target: e.target.value })}
                placeholder="Número"
              />
            </div>
            <div className="col-start-2 sm:col-start-auto">
              <input
                className="sheet-input"
                aria-label={`Como medimos o KPI ${i + 1}`}
                value={r.measure}
                onChange={(e) => set(i, { measure: e.target.value })}
                placeholder="Ex.: CRM"
              />
            </div>
            <button
              type="button"
              aria-label={`Remover KPI ${i + 1}`}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="col-start-3 row-start-1 mt-1.5 flex h-7 w-7 items-center justify-center rounded-md text-black/30 transition hover:bg-rose-50 hover:text-rose-600 sm:col-start-auto sm:row-start-auto"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= MAX_KPIS}
        onClick={() => onChange([...rows, emptyKpi(newId())])}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#c9c5dc] px-3 py-1.5 text-[12px] font-semibold text-[#783df5] transition hover:bg-[#f6f4fd] disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar KPI
      </button>
    </div>
  );
}

export function EvaluationEditor({
  which,
  kpis,
  evaluation,
  decidedAt,
  extensionHint,
  suggestedDecider,
  onKpis,
  onEval,
}: {
  which: 15 | 30;
  kpis: ProbationKpi[];
  evaluation: ProbationEvaluation;
  decidedAt: number | null;
  extensionHint: string;
  suggestedDecider: string;
  onKpis: (rows: ProbationKpi[]) => void;
  onEval: (ev: ProbationEvaluation) => void;
}) {
  const filled = kpis.filter(kpiFilled);
  const count = metCount(kpis);
  const setKpi = (id: string, patch: Partial<ProbationKpi>) =>
    onKpis(kpis.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  const set = (patch: Partial<ProbationEvaluation>) => onEval({ ...evaluation, ...patch });

  function decide(d: ProbationDecision | null) {
    set({
      decision: d,
      // Quem decide vem sugerido (responsável e direção) na primeira decisão.
      decidedBy: d && !evaluation.decidedBy.trim() ? suggestedDecider : evaluation.decidedBy,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="sheet-label">Resultado por KPI</span>
          {count.recorded && (
            <span className="text-[11.5px] font-semibold text-black/55">
              {count.met} de {count.total} cumpridos
            </span>
          )}
        </div>
        {filled.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 bg-white/50 px-3 py-2.5 text-[12.5px] text-black/45">
            Ainda não há KPIs dos {which} dias — escreve-os na secção {which === 15 ? 3 : 4}.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filled.map((k, i) => (
              <div key={k.id} className="rounded-lg border border-black/[0.08] bg-white/60 p-3">
                <p className="text-[12.5px] font-semibold leading-snug">
                  <span className="mr-1.5 text-[#783df5]">{i + 1}</span>
                  {k.kpi || <span className="font-normal text-black/35">KPI sem nome</span>}
                  {k.target && <span className="font-normal text-black/45"> · meta {k.target}</span>}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className="sheet-input min-w-[140px] flex-1 !py-1.5"
                    aria-label={`Resultado do KPI ${i + 1}`}
                    value={k.result}
                    onChange={(e) => setKpi(k.id, { result: e.target.value })}
                    placeholder="Resultado"
                  />
                  <MetToggle value={k.met} onChange={(m) => setKpi(k.id, { met: m })} label={`Cumprido, KPI ${i + 1}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Field label="O que correu bem">
          <textarea
            className="sheet-input min-h-[72px] resize-y"
            value={evaluation.wentWell}
            onChange={(e) => set({ wentWell: e.target.value })}
          />
        </Field>
        <Field label="O que ficou aquém">
          <textarea
            className="sheet-input min-h-[72px] resize-y"
            value={evaluation.fellShort}
            onChange={(e) => set({ fellShort: e.target.value })}
          />
        </Field>
        <Field label="Comentário do consultor">
          <textarea
            className="sheet-input min-h-[72px] resize-y"
            value={evaluation.consultantComment}
            onChange={(e) => set({ consultantComment: e.target.value })}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="sheet-label">Decisão</span>
          {evaluation.decision && (
            <button
              type="button"
              onClick={() => decide(null)}
              className="text-[11px] font-medium text-black/40 underline-offset-2 hover:text-black/70 hover:underline"
            >
              Limpar decisão
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label={`Decisão da avaliação dos ${which} dias`} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {DECISIONS.map((d) => {
            const on = evaluation.decision === d.id;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => decide(d.id)}
                className={`rounded-lg border px-3 py-2.5 text-left text-[12.5px] transition ${
                  on
                    ? "border-[#783df5] bg-[#f3eefe] font-semibold text-[#3b1d8f] shadow-[0_0_0_3px_rgba(120,61,245,0.14)]"
                    : "border-black/15 bg-white/70 text-black/70 hover:border-black/30"
                }`}
              >
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">Opção {d.n}</span>
                {d.label}
              </button>
            );
          })}
        </div>
        {evaluation.decision && (
          <p className="mt-2 text-[12px] leading-relaxed text-black/55">
            {evaluation.decision === "extensao" ? extensionHint : "O plano termina nesta avaliação."}
            {decidedAt ? ` Decisão registada a ${formatDate(decidedAt)}.` : ""}
          </p>
        )}
      </div>

      <Field label="Decisão tomada por">
        <input
          className="sheet-input"
          value={evaluation.decidedBy}
          onChange={(e) => set({ decidedBy: e.target.value })}
          placeholder={suggestedDecider || "Nome"}
        />
      </Field>
    </div>
  );
}

export function MetToggle({
  value,
  onChange,
  label,
}: {
  value: KpiMet | null;
  onChange: (m: KpiMet | null) => void;
  label: string;
}) {
  const tone: Record<KpiMet, string> = {
    sim: "border-emerald-600 bg-emerald-600 text-white",
    parcial: "border-amber-500 bg-amber-500 text-white",
    nao: "border-rose-600 bg-rose-600 text-white",
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-black/15 bg-white">
      {KPI_MET_OPTIONS.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            // Carregar outra vez na mesma opção limpa-a.
            onClick={() => onChange(on ? null : o.id)}
            className={`border-l px-3 py-1.5 text-[12px] font-semibold transition first:border-l-0 ${
              on ? tone[o.id] : "border-black/10 text-black/55 hover:bg-black/[0.04]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
