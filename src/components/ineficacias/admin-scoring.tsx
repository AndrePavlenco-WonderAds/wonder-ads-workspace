"use client";

// Pontuar uma ocorrência (direção) — v80.53, refeito como um passo a passo:
//   1. Que tipo de erro é? (aprendizagem ou recorrência)
//   2. O que é que o erro causou? (nada, refazer, prazo, cliente, negócio)
//   3. A pontuação — segue a calculadora sozinha, com a conta à vista; um
//      clique noutro número ajusta à mão (e «voltar à sugestão» desfaz). Por
//      baixo, o que acontece ao PA/NO de hoje e se passa o limiar.
//   4. Nota para o consultor, se ele vê o cálculo, e gravar.
// O motivo, a primeira vez e quem deu pelo erro vêm do que está escrito. A
// avaliação (tipo de erro e impactos) só chega ao consultor quando a direção
// liga «vê o cálculo» (`showCalc`, v80.45) — senão loadConsultantForSelf
// apaga-a. Cada gravação faz router.refresh(): a página volta a derivar o
// estado (PA, NO, nível) com os dados frescos.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Eye, EyeOff, GraduationCap, Info, Loader2, Repeat, RotateCcw, Save } from "lucide-react";
import { BAND_TONES } from "@/components/ineficacias/report-view";
import {
  bandOf,
  ERROR_TYPES,
  formatLisbonDateTime,
  IMPACTS,
  MAX_POINTS,
  SCORE_RULES,
  suggestScore,
  type IneficaciaErrorType,
  type IneficaciaImpact,
  type IneficaciaNoticed,
  type IneficaciaReason,
  type IneficaciaScore,
} from "@/lib/ineficacias/shared";

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

/** O que a pontuação faz aos contadores de hoje (v80.50): o PA e o NO da
 *  fase corrente e o limiar do próximo nível. */
export type ScoreImpact = {
  pa: number;
  no: number;
  next: { level: 1 | 2 | 3; pa: number; no: number } | null;
  /** A ocorrência é da fase corrente (conta no PA/NO de hoje)? */
  inPhase: boolean;
  /** «a subida ao nível 1, a 12/10/2026» — para as que ficam fora da fase. */
  phaseLabel: string | null;
  who: string;
};

/* ------------------------------------------------------------------ */

const BAND_BTN: Record<string, { on: string; off: string }> = {
  zero: { on: "border-white/50 bg-white/25 text-white", off: "border-white/10 text-white/55 hover:bg-white/[0.07]" },
  baixo: { on: "border-emerald-300 bg-emerald-400/35 text-white", off: "border-emerald-400/20 text-emerald-200/75 hover:bg-emerald-400/10" },
  medio: { on: "border-amber-300 bg-amber-400/35 text-white", off: "border-amber-400/20 text-amber-200/75 hover:bg-amber-400/10" },
  alto: { on: "border-orange-300 bg-orange-400/35 text-white", off: "border-orange-400/25 text-orange-200/75 hover:bg-orange-400/10" },
  critico: { on: "border-rose-300 bg-rose-500/40 text-white", off: "border-rose-400/25 text-rose-200/75 hover:bg-rose-500/10" },
};

const BAND_STRIP = [
  { span: 1, label: "0", cls: "text-white/35" },
  { span: 3, label: "Baixo", cls: "text-emerald-200/60" },
  { span: 3, label: "Médio", cls: "text-amber-200/60" },
  { span: 2, label: "Alto", cls: "text-orange-200/60" },
  { span: 2, label: "Crítico", cls: "text-rose-200/60" },
];

function signed(v: number): string {
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return "±0";
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function Step({ n, title, aside, children }: { n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.1] text-[10.5px] font-bold text-white/80">{n}</span>
        <span className="text-[12.5px] font-semibold text-white/90">{title}</span>
        {aside && <span className="ml-auto text-[10.5px] text-white/40">{aside}</span>}
      </p>
      <div className="mt-2 pl-7">{children}</div>
    </div>
  );
}

function ImpactLine({ impact, points, initial }: { impact: ScoreImpact; points: number | null; initial: IneficaciaScore | null }) {
  if (points === null) return null;
  const base = "flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11.5px] leading-snug";
  if (!impact.inPhase) {
    return (
      <p className={`${base} border border-white/10 bg-black/20 text-white/55`}>
        <Info className="mt-px h-3.5 w-3.5 shrink-0 text-white/35" />
        Aconteceu antes da fase atual{impact.phaseLabel ? ` (${impact.phaseLabel})` : ""}: não mexe no PA nem no NO de hoje.
      </p>
    );
  }
  const cur = initial && initial.points > 0 ? initial.points : 0;
  const pa = impact.pa - cur + (points > 0 ? points : 0);
  const no = impact.no - (cur > 0 ? 1 : 0) + (points > 0 ? 1 : 0);
  if (points === 0) {
    return (
      <p className={`${base} border border-white/10 bg-black/20 text-white/55`}>
        <Info className="mt-px h-3.5 w-3.5 shrink-0 text-white/35" />
        0 = não conta: PA {pa} e NO {no} {cur > 0 ? "(sai das contas)" : "ficam iguais"}.
      </p>
    );
  }
  const n = impact.next;
  const crosses = n !== null && (pa >= n.pa || no >= n.no);
  return (
    <p className={`${base} border ${crosses ? "border-rose-400/40 bg-rose-500/10 text-rose-100" : "border-white/10 bg-black/20 text-white/65"}`}>
      {crosses ? <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-rose-300" /> : <ArrowRight className="mt-px h-3.5 w-3.5 shrink-0 text-white/35" />}
      <span>
        PA <span className="tabular font-bold text-white">{impact.pa}→{pa}</span>
        {n ? <span className="text-white/40"> de {n.pa}</span> : null} · NO <span className="tabular font-bold text-white">{impact.no}→{no}</span>
        {n ? <span className="text-white/40"> de {n.no}</span> : null}
        {crosses && n ? (
          <span className="font-semibold"> — passa o limiar: {impact.who} sobe ao nível {n.level} e os contadores voltam a zero.</span>
        ) : !n ? (
          <span className="text-white/45"> · nível 3, sem limiar acima.</span>
        ) : null}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */

export function ItemScoreControl({
  target,
  initial,
  calc,
  impact,
  hints = [],
}: {
  target: Target;
  initial: IneficaciaScore | null;
  calc: CalcBasis;
  /** Mostra o que a pontuação faz ao PA/NO de hoje (v80.50). */
  impact?: ScoreImpact;
  /** Pistas para o tipo de erro («diz que já aconteceu», «1 parecida»…). */
  hints?: { text: string; warn?: boolean }[];
}) {
  const router = useRouter();
  const who = impact?.who ?? "o consultor";
  const [errorType, setErrorType] = useState<IneficaciaErrorType | null>(calc.errorType);
  const [impacts, setImpacts] = useState<IneficaciaImpact[]>(calc.impacts);
  // null = segue a calculadora; um número = escolhido à mão.
  const [manual, setManual] = useState<number | null>(initial?.points ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [showCalc, setShowCalc] = useState(calc.showCalc);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const suggestion = suggestScore({ impacts, reason: calc.reason, firstTime: calc.firstTime, errorType, noticed: calc.noticed });
  const points = manual ?? (errorType ? suggestion.points : null);
  const adjusted = manual !== null && errorType !== null && manual !== suggestion.points;
  const band = points === null ? null : bandOf(points);
  const clientImplied = calc.noticed === "cliente";

  const scoreDirty =
    points !== (initial?.points ?? null) ||
    note !== (initial?.note ?? "") ||
    errorType !== calc.errorType ||
    !sameSet(impacts, calc.impacts);
  const canShow = Boolean(errorType);
  const visibilityDirty = (showCalc && canShow) !== calc.showCalc;
  const dirty = scoreDirty || visibilityDirty;
  const onlyVisibility = Boolean(initial) && !scoreDirty && visibilityDirty;

  const touch = () => setSaved(false);
  const pick = (p: number) => {
    // Escolher o número que a calculadora dá volta a segui-la.
    setManual(errorType && p === suggestion.points ? null : p);
    touch();
  };

  async function save() {
    if (points === null) {
      setError("Escolhe o tipo de erro (1) ou uma pontuação (3).");
      return;
    }
    setError(null);
    const res = await fetch("/api/admin/ineficacias/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        onlyVisibility
          ? { ...target, op: "visibility", showCalc: showCalc && canShow }
          : { ...target, points, note, errorType, impacts, showCalc: showCalc && canShow },
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

  const chip = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-left text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
      on ? "border-[#a78bfa]/80 bg-[#783DF5]/25 text-white" : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.07] hover:text-white"
    }`;

  return (
    <div className="rounded-2xl border border-[#783DF5]/25 bg-[#783DF5]/[0.05]">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#c3aaff]">
          {initial ? "Pontuação da direção" : "Pontuar esta ocorrência"}
        </p>
        {initial && (
          <span className="text-[11px] text-white/40">
            · {initial.byName || "direção"}, {formatLisbonDateTime(initial.at)}
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-5">
        {/* 1 e 2 — a avaliação */}
        <div className="min-w-0 space-y-5">
          <Step n={1} title="Que tipo de erro é?">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ERROR_TYPES.map((t) => {
                const Icon = t.id === "aprendizagem" ? GraduationCap : Repeat;
                const on = errorType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setErrorType(t.id);
                      touch();
                    }}
                    aria-pressed={on}
                    className={`${chip(on)} flex-col items-start`}
                  >
                    <span className="flex w-full items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {t.id === "aprendizagem" ? "Aprendizagem" : "Recorrência"}
                      <span className={`tabular ml-auto text-[11px] font-bold ${SCORE_RULES.errorType[t.id] > 0 ? "text-rose-300" : "text-emerald-300"}`}>
                        {signed(SCORE_RULES.errorType[t.id])}
                      </span>
                    </span>
                    <span className="text-[10.5px] font-normal leading-snug text-white/45">{t.hint}</span>
                  </button>
                );
              })}
            </div>
            {hints.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px] leading-snug">
                {hints.map((h) => (
                  <li key={h.text} className={`flex items-start gap-1.5 ${h.warn ? "text-amber-200/90" : "text-white/50"}`}>
                    {h.warn ? <AlertTriangle className="mt-px h-3 w-3 shrink-0" /> : <Info className="mt-px h-3 w-3 shrink-0" />}
                    {h.text}
                  </li>
                ))}
              </ul>
            )}
          </Step>

          <Step n={2} title="O que é que o erro causou?" aside="podes marcar vários">
            <div className="grid grid-cols-1 gap-1.5 [&>button]:w-full [&>button]:py-1.5">
              <button
                type="button"
                disabled={pending || clientImplied}
                onClick={() => {
                  setImpacts([]);
                  touch();
                }}
                aria-pressed={impacts.length === 0 && !clientImplied}
                title="Recuperável no próprio dia"
                className={chip(impacts.length === 0 && !clientImplied)}
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${impacts.length === 0 && !clientImplied ? "border-[#c3aaff] bg-[#783DF5]" : "border-white/30"}`}
                >
                  {impacts.length === 0 && !clientImplied && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                Nada de grave — recuperável no próprio dia
                <span className="tabular ml-auto text-[10.5px] font-bold text-white/40">{SCORE_RULES.noImpactBase}</span>
              </button>
              {IMPACTS.map((i) => {
                const implied = i.id === "cliente" && clientImplied;
                const on = implied || impacts.includes(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={pending || implied}
                    onClick={() => {
                      setImpacts((cur) => (cur.includes(i.id) ? cur.filter((x) => x !== i.id) : [...cur, i.id]));
                      touch();
                    }}
                    title={implied ? "Foi o cliente que deu pelo erro." : i.hint}
                    className={chip(on)}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${on ? "border-[#c3aaff] bg-[#783DF5] text-white" : "border-white/30"}`}
                    >
                      {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                    {i.label}
                    <span className="tabular ml-auto text-[10.5px] font-bold text-white/40">{i.base}</span>
                  </button>
                );
              })}
            </div>
          </Step>
        </div>

        {/* 3 — a pontuação */}
        <div className="min-w-0">
          <Step
            n={3}
            title="Pontuação"
            aside={
              adjusted ? (
                <button
                  type="button"
                  onClick={() => {
                    setManual(null);
                    touch();
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-[#c3aaff] hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" />
                  voltar à sugestão ({suggestion.points})
                </button>
              ) : errorType ? (
                "segue a calculadora"
              ) : null
            }
          >
            <div className="rounded-xl border border-white/[0.08] bg-black/25">
              {/* a conta */}
              <ul className="divide-y divide-white/[0.04] px-3 py-1 text-[11.5px]">
                {suggestion.lines.map((l, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-1">
                    <span className={l.base ? "text-white/75" : "text-white/50"}>{l.label}</span>
                    <span
                      className={`tabular shrink-0 font-bold ${
                        l.base ? "text-white/80" : l.value > 0 ? "text-rose-300" : l.value < 0 ? "text-emerald-300" : "text-white/30"
                      }`}
                    >
                      {l.base ? l.value : signed(l.value)}
                    </span>
                  </li>
                ))}
                {!errorType && (
                  <li className="flex items-baseline justify-between gap-3 py-1">
                    <span className="font-semibold text-amber-200/85">Tipo de erro — escolhe em 1</span>
                    <span className="tabular font-bold text-amber-200/60">?</span>
                  </li>
                )}
                {suggestion.raw !== suggestion.points && (
                  <li className="flex items-baseline justify-between gap-3 py-1">
                    <span className="text-white/40">Limite da escala (1 a 10)</span>
                    <span className="tabular font-bold text-white/40">{signed(suggestion.points - suggestion.raw)}</span>
                  </li>
                )}
                {adjusted && manual !== null && (
                  <li className="flex items-baseline justify-between gap-3 py-1">
                    <span className="text-white/60">Ajuste da direção</span>
                    <span className={`tabular font-bold ${manual - suggestion.points > 0 ? "text-rose-300" : "text-emerald-300"}`}>
                      {signed(manual - suggestion.points)}
                    </span>
                  </li>
                )}
              </ul>
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-3 py-2">
                <span className="text-[11.5px] font-semibold text-white/55">
                  {points === null
                    ? `Provisória: ${suggestion.points}`
                    : !errorType
                      ? "Escolhida à mão"
                      : adjusted
                        ? "Pontuação final"
                        : "Sugestão da calculadora"}
                </span>
                {points !== null && band ? (
                  <span className={`tabular rounded-full border px-3 py-1 text-[13px] font-extrabold ${BAND_TONES[band.id]}`}>
                    {points} {points === 1 ? "ponto" : "pontos"} · {band.label}
                  </span>
                ) : (
                  <span className="rounded-full border border-dashed border-white/20 px-3 py-1 text-[12px] font-semibold text-white/40">falta o passo 1</span>
                )}
              </div>
            </div>

            {/* ajustar à mão */}
            <div className="mt-3">
              <div className="grid grid-cols-11 gap-1">
                {Array.from({ length: MAX_POINTS + 1 }, (_, p) => {
                  const b = bandOf(p);
                  const on = points === p;
                  const sug = p === suggestion.points;
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={pending}
                      onClick={() => pick(p)}
                      aria-pressed={on}
                      title={`${p} · ${b.label} — ${b.hint}${sug ? " · sugestão da calculadora" : ""}`}
                      className={`tabular relative h-8 rounded-lg border text-[12.5px] font-bold transition disabled:opacity-50 ${on ? BAND_BTN[b.id].on : BAND_BTN[b.id].off}`}
                    >
                      {p}
                      {sug && !on && (
                        <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#15121f] bg-[#a78bfa]" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 grid grid-cols-11 gap-1 text-center text-[9.5px] font-semibold uppercase tracking-wide">
                {BAND_STRIP.map((s) => (
                  <span key={s.label} className={s.cls} style={{ gridColumn: `span ${s.span} / span ${s.span}` }}>
                    {s.label}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[10.5px] text-white/35">Clica noutro número para ajustar à mão · 0 = não conta.</p>
            </div>

            {impact && points !== null && (
              <div className="mt-2.5">
                <ImpactLine impact={impact} points={points} initial={initial} />
              </div>
            )}
          </Step>
        </div>
      </div>

      {/* 4 — nota e gravar */}
      <div className="border-t border-white/[0.06] px-4 pb-4 pt-3.5">
        <Step n={4} title={`Nota para ${who}`} aside="opcional">
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              touch();
            }}
            rows={2}
            maxLength={1000}
            placeholder={`O que ${who} deve tirar daqui — ${who} lê esta nota.`}
            className="modal-input w-full resize-y text-[12.5px]"
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
            <button
              type="button"
              disabled={pending || points === null || (!dirty && Boolean(initial))}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-10px_rgba(120,61,245,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: "var(--brand-gradient)" }}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {pending
                ? "A gravar…"
                : saved
                  ? "Gravado"
                  : points === null
                    ? "Escolhe o tipo de erro"
                    : onlyVisibility
                      ? showCalc
                        ? `Mostrar o cálculo a ${who}`
                        : `Ocultar o cálculo a ${who}`
                      : `${initial ? "Atualizar" : "Guardar"} · ${points} ${points === 1 ? "ponto" : "pontos"}`}
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={showCalc && canShow}
              disabled={pending || !canShow}
              onClick={() => {
                setShowCalc((v) => !v);
                touch();
              }}
              title={canShow ? undefined : "Escolhe primeiro o tipo de erro (1)."}
              className="flex items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${showCalc && canShow ? "bg-[#783DF5]" : "bg-white/15"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${showCalc && canShow ? "left-[18px]" : "left-0.5"}`} />
              </span>
              {showCalc && canShow ? <Eye className="h-3.5 w-3.5 shrink-0 text-[#c3aaff]" /> : <EyeOff className="h-3.5 w-3.5 shrink-0 text-white/40" />}
              <span className="text-[11.5px] text-white/70">
                {who} vê a conta
                <span className="text-white/35"> {showCalc && canShow ? "· vê as parcelas e o total" : "· vê só os pontos e a nota"}</span>
              </span>
            </button>

            {initial && !dirty && <span className="text-[11px] text-white/40">Já pontuada — podes corrigir.</span>}
          </div>
          {error && <p className="mt-2 text-[11.5px] font-semibold text-rose-300">{error}</p>}
        </Step>
      </div>
    </div>
  );
}
