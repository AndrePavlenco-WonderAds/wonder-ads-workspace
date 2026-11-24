"use client";

// Os controlos da direção sobre um relatório: a pontuação de 0 a 10 de cada
// ocorrência (com nota). A revisão fecha-se sozinha quando todas estiverem
// pontuadas.
// A CALCULADORA (v77.94) — a mesma da folha RH-04: o motivo, a primeira vez
// e quem deu pelo erro vêm do que está escrito; a direção junta o tipo de
// erro e o que o erro causou, e a sugestão aplica-se com um clique. Só existe
// nas páginas da direção; o consultor só recebe estes dados quando a direção
// liga «O consultor vê o porquê destes pontos» (v80.45, `showCalc`) — senão
// loadConsultantForSelf apaga-os.
// Cada gravação pede ao servidor e faz router.refresh() — a página volta a
// derivar o estado (PA, NO, nível) com os dados frescos.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Check, Eye, EyeOff, GraduationCap, Loader2, Repeat, Save, Wand2 } from "lucide-react";
import { BAND_TONES } from "@/components/ineficacias/report-view";
import { CalcBreakdownView } from "@/components/ineficacias/calc-breakdown";
import {
  bandOf,
  calcBreakdown,
  ERROR_TYPES,
  IMPACTS,
  MAX_POINTS,
  SCORE_BANDS,
  suggestScore,
  type IneficaciaErrorType,
  type IneficaciaImpact,
  type IneficaciaNoticed,
  type IneficaciaReason,
  type IneficaciaScore,
} from "@/lib/ineficacias/shared";

const BAND_BTN: Record<string, { on: string; off: string }> = {
  zero: { on: "border-white/40 bg-white/20 text-white", off: "border-white/10 text-white/50 hover:bg-white/[0.06]" },
  baixo: { on: "border-emerald-300 bg-emerald-400/30 text-white", off: "border-emerald-400/20 text-emerald-200/70 hover:bg-emerald-400/10" },
  medio: { on: "border-amber-300 bg-amber-400/30 text-white", off: "border-amber-400/20 text-amber-200/70 hover:bg-amber-400/10" },
  alto: { on: "border-orange-300 bg-orange-400/30 text-white", off: "border-orange-400/25 text-orange-200/70 hover:bg-orange-400/10" },
  critico: { on: "border-rose-300 bg-rose-500/35 text-white", off: "border-rose-400/25 text-rose-200/70 hover:bg-rose-500/10" },
};

/** O seletor 0–10, com as bandas da escala. */
export function ScorePicker({
  value,
  onChange,
  disabled = false,
  suggested = null,
}: {
  value: number | null;
  onChange: (points: number) => void;
  disabled?: boolean;
  /** A sugestão da calculadora — leva um ponto no canto. */
  suggested?: number | null;
}) {
  const band = value === null ? null : bandOf(value);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: MAX_POINTS + 1 }, (_, p) => {
          const b = bandOf(p);
          const on = value === p;
          const cls = BAND_BTN[b.id];
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p)}
              aria-pressed={on}
              title={`${p} · ${b.label}${p === suggested ? " · sugestão da calculadora" : ""}`}
              className={`tabular relative h-8 w-8 rounded-lg border text-[12.5px] font-bold transition disabled:opacity-50 ${on ? cls.on : cls.off}`}
            >
              {p}
              {p === suggested && (
                <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#15121f] bg-[#a78bfa]" />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-white/45">
        {band ? (
          <>
            <span className="font-semibold text-white/75">{band.label}</span> · {band.hint}
          </>
        ) : (
          SCORE_BANDS.map((b) => `${b.min === b.max ? b.min : `${b.min}–${b.max}`} ${b.label.toLowerCase()}`).join(" · ")
        )}
      </p>
    </div>
  );
}

type Target = { reportId: string; itemId: string } | { username: string; occurrenceId: string };

/** O que a calculadora precisa de uma ocorrência: o que está escrito e a
 *  avaliação da direção que já esteja gravada. */
export type CalcBasis = {
  reason: IneficaciaReason;
  firstTime: boolean | null;
  noticed: IneficaciaNoticed;
  errorType: IneficaciaErrorType | null;
  impacts: IneficaciaImpact[];
  /** O consultor vê o porquê dos pontos (v80.45). */
  showCalc: boolean;
};

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function ItemScoreControl({
  target,
  initial,
  calc,
}: {
  target: Target;
  initial: IneficaciaScore | null;
  calc?: CalcBasis;
}) {
  const router = useRouter();
  const [points, setPoints] = useState<number | null>(initial?.points ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [errorType, setErrorType] = useState<IneficaciaErrorType | null>(calc?.errorType ?? null);
  const [impacts, setImpacts] = useState<IneficaciaImpact[]>(calc?.impacts ?? []);
  const [showCalc, setShowCalc] = useState(calc?.showCalc ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const suggestion = calc
    ? suggestScore({ impacts, reason: calc.reason, firstTime: calc.firstTime, errorType, noticed: calc.noticed })
    : null;
  const scoreDirty =
    points !== (initial?.points ?? null) ||
    note !== (initial?.note ?? "") ||
    (calc ? errorType !== calc.errorType || !sameSet(impacts, calc.impacts) : false);
  const visibilityDirty = calc ? showCalc !== calc.showCalc : false;
  const dirty = scoreDirty || visibilityDirty;
  // Sem «aprendizagem ou recorrência» não há cálculo para mostrar.
  const canShow = Boolean(calc && errorType);
  const preview =
    calc && errorType && points !== null && points > 0
      ? calcBreakdown({ impacts, reason: calc.reason, firstTime: calc.firstTime, errorType, noticed: calc.noticed }, points)
      : null;

  async function save() {
    if (points === null) {
      setError("Escolhe a pontuação (0 a 10).");
      return;
    }
    setError(null);
    // Só mudou a visibilidade: não se repontua (a hora da pontuação fica).
    const onlyVisibility = Boolean(initial) && !scoreDirty && visibilityDirty;
    const res = await fetch("/api/admin/ineficacias/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        onlyVisibility
          ? { ...target, op: "visibility", showCalc }
          : { ...target, points, note, ...(calc ? { errorType, impacts, showCalc: showCalc && canShow } : {}) },
      ),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Não foi possível gravar.");
      return;
    }
    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-xl border border-[#783DF5]/25 bg-[#783DF5]/[0.06] p-3.5">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#c3aaff]">
        {initial ? "Pontuação da direção" : "Pontuar esta ocorrência"}
      </p>
      {calc && suggestion && (
        <CalculatorPanel
          calc={calc}
          errorType={errorType}
          impacts={impacts}
          suggestion={suggestion}
          points={points}
          visible={showCalc && canShow}
          disabled={pending}
          onErrorType={(t) => { setErrorType(t); setSaved(false); }}
          onToggleImpact={(id) => {
            setImpacts((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
            setSaved(false);
          }}
          onApply={() => { setPoints(suggestion.points); setSaved(false); }}
        />
      )}
      {calc && (
        <div className="mt-2.5 rounded-lg border border-white/10 bg-black/20 p-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={showCalc && canShow}
            disabled={pending || !canShow}
            onClick={() => { setShowCalc((v) => !v); setSaved(false); }}
            title={canShow ? undefined : "Escolhe primeiro aprendizagem ou recorrência na calculadora."}
            className="flex w-full items-center gap-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${showCalc && canShow ? "bg-[#783DF5]" : "bg-white/15"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${showCalc && canShow ? "left-[18px]" : "left-0.5"}`}
              />
            </span>
            {showCalc && canShow ? <Eye className="h-3.5 w-3.5 shrink-0 text-[#c3aaff]" /> : <EyeOff className="h-3.5 w-3.5 shrink-0 text-white/40" />}
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold text-white/85">O consultor vê o porquê destes pontos</span>
              <span className="block text-[10.5px] text-white/45">
                {!canShow
                  ? "Escolhe aprendizagem ou recorrência na calculadora para o poderes mostrar."
                  : showCalc
                    ? "No painel do consultor aparecem as parcelas e a pontuação final."
                    : "Oculto: o consultor vê só a pontuação e a nota."}
              </span>
            </span>
          </button>
          {showCalc && canShow && preview && (
            <div className="mt-2 border-t border-white/[0.06] pt-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">O que o consultor vê</p>
              <CalcBreakdownView breakdown={preview} compact />
            </div>
          )}
        </div>
      )}
      <div className="mt-2.5">
        <ScorePicker
          value={points}
          onChange={(p) => { setPoints(p); setSaved(false); }}
          disabled={pending}
          suggested={suggestion?.points ?? null}
        />
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
        maxLength={1000}
        placeholder="Nota (opcional) — o consultor vê-a"
        className="modal-input mt-2.5 w-full text-[12.5px]"
      />
      {error && <p className="mt-2 text-[11.5px] font-semibold text-rose-300">{error}</p>}
      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          disabled={pending || points === null || (!dirty && Boolean(initial))}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--brand-gradient)" }}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {pending
            ? "A gravar…"
            : saved
              ? "Gravado"
              : initial && !scoreDirty && visibilityDirty
                ? showCalc
                  ? "Mostrar ao consultor"
                  : "Ocultar ao consultor"
                : initial
                  ? "Atualizar pontuação"
                  : "Guardar pontuação"}
        </button>
        {initial && !dirty && (
          <span className="text-[11px] text-white/40">Já pontuada — podes corrigir.</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function signed(v: number): string {
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return "±0";
}

function CalculatorPanel({
  calc,
  errorType,
  impacts,
  suggestion,
  points,
  visible,
  disabled,
  onErrorType,
  onToggleImpact,
  onApply,
}: {
  calc: CalcBasis;
  errorType: IneficaciaErrorType | null;
  impacts: IneficaciaImpact[];
  suggestion: ReturnType<typeof suggestScore>;
  points: number | null;
  /** O consultor vê as parcelas (v80.45). */
  visible: boolean;
  disabled: boolean;
  onErrorType: (t: IneficaciaErrorType) => void;
  onToggleImpact: (id: IneficaciaImpact) => void;
  onApply: () => void;
}) {
  const applied = points === suggestion.points;
  const provisional = suggestion.missing.length > 0;
  const chip = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition disabled:opacity-50 ${
      on ? "border-[#a78bfa]/70 bg-[#783DF5]/25 text-white" : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
    }`;
  return (
    <div className="mt-2.5 rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/55">
          <Calculator className="h-3.5 w-3.5 text-[#c3aaff]" />
          Calculadora
          <span className={`font-semibold normal-case tracking-normal ${visible ? "text-[#c3aaff]/80" : "text-white/30"}`}>
            {visible ? "· o consultor vê" : "· só a direção vê"}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{provisional ? "Provisória" : "Sugestão"}</span>
          <span className={`tabular rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold ${BAND_TONES[suggestion.band.id]}`}>
            {suggestion.points} pts · {suggestion.band.label}
          </span>
          <button
            type="button"
            onClick={onApply}
            disabled={disabled || applied}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
              applied ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "text-white hover:brightness-110"
            } disabled:cursor-default`}
            style={applied ? undefined : { background: "var(--brand-gradient)" }}
          >
            {applied ? <Check className="h-3 w-3" /> : <Wand2 className="h-3 w-3" />}
            {applied ? "Aplicada" : "Usar"}
          </button>
        </div>
      </div>

      <div className="mt-2.5 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {ERROR_TYPES.map((t) => {
            const Icon = t.id === "aprendizagem" ? GraduationCap : Repeat;
            return (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                onClick={() => onErrorType(t.id)}
                aria-pressed={errorType === t.id}
                title={t.hint}
                className={chip(errorType === t.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {IMPACTS.map((i) => {
            const implied = i.id === "cliente" && calc.noticed === "cliente";
            const on = implied || impacts.includes(i.id);
            return (
              <button
                key={i.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={disabled || implied}
                onClick={() => onToggleImpact(i.id)}
                title={implied ? "Foi o cliente que deu pelo erro." : i.hint}
                className={chip(on)}
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                    on ? "border-[#c3aaff] bg-[#783DF5] text-white" : "border-white/30"
                  }`}
                >
                  {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
                {i.label}
                <span className="tabular text-[10px] font-bold text-white/35">{i.base}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-white/45">
        {suggestion.lines.map((l, i) => (
          <span key={i}>
            {i > 0 && <span className="text-white/20"> · </span>}
            {l.label}{" "}
            <span
              className={`tabular font-bold ${
                l.base ? "text-white/75" : l.value > 0 ? "text-rose-300" : l.value < 0 ? "text-emerald-300" : "text-white/35"
              }`}
            >
              {l.base ? l.value : signed(l.value)}
            </span>
          </span>
        ))}
        {suggestion.raw !== suggestion.points && <span> · a soma dá {suggestion.raw}, fica {suggestion.points}</span>}
        {provisional && <span className="font-semibold text-amber-200/80"> · falta: {suggestion.missing.join(", ")}</span>}
      </p>
    </div>
  );
}
