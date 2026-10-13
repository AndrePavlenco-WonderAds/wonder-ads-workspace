// O medidor de um consultor — o nível na escala, o PA e o NO da janela
// corrente contra os limiares do próximo nível, e a fase em que está. Puro
// (sem hooks): serve tanto a página do consultor como a da direção.

import { AlertTriangle, Gauge, Hourglass, Scale, Sigma } from "lucide-react";
import {
  formatISODate,
  LEVELS,
  WINDOW_DAYS,
  type IneficaciaLevel,
  type LedgerState,
} from "@/lib/ineficacias/shared";

export const LEVEL_TONES: Record<
  IneficaciaLevel,
  { text: string; bg: string; border: string; dot: string; glow: string }
> = {
  0: { text: "text-emerald-200", bg: "bg-emerald-400/10", border: "border-emerald-400/30", dot: "bg-emerald-400", glow: "rgba(52,211,153,0.45)" },
  1: { text: "text-amber-200", bg: "bg-amber-400/10", border: "border-amber-400/30", dot: "bg-amber-400", glow: "rgba(251,191,36,0.45)" },
  2: { text: "text-orange-200", bg: "bg-orange-400/10", border: "border-orange-400/30", dot: "bg-orange-400", glow: "rgba(251,146,60,0.45)" },
  3: { text: "text-rose-200", bg: "bg-rose-500/10", border: "border-rose-400/35", dot: "bg-rose-400", glow: "rgba(251,113,133,0.5)" },
};

/** A pastilha «Nível 1» — para listas e cabeçalhos. */
export function LevelChip({ state, size = "md" }: { state: Pick<LedgerState, "level" | "reached" | "pendingMeasure">; size?: "sm" | "md" }) {
  const level = state.reached;
  const t = LEVEL_TONES[level];
  const pending = Boolean(state.pendingMeasure);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${t.border} ${t.bg} ${t.text} ${
        size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot} ${pending ? "animate-pulse" : ""}`} />
      Nível {level}
      {pending && <span className="font-medium opacity-80">· medida por aplicar</span>}
    </span>
  );
}

function phaseLine(state: LedgerState): string {
  const e = state.phaseEvent;
  if (!e) return "Contadores desde o início";
  const when = formatISODate(e.at);
  if (e.kind === "measure") {
    return e.level === 3
      ? `Contadores desde o arranque do probation (${when})`
      : `Contadores desde o 1:1 do nível ${e.level} (${when})`;
  }
  return `Contadores desde que a direção definiu o nível ${e.level} (${when})`;
}

function Meter({
  label,
  hint,
  value,
  limit,
  icon: Icon,
  tone,
}: {
  label: string;
  hint: string;
  value: number;
  limit: number | null;
  icon: typeof Sigma;
  tone: { text: string; dot: string; glow: string };
}) {
  const ratio = limit ? Math.min(1, value / limit) : 0;
  const hot = limit !== null && value >= limit;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        {limit !== null && (
          <span className="text-[10.5px] text-white/35">
            limiar <span className="tabular font-semibold text-white/60">{limit}</span>
          </span>
        )}
      </div>
      <p className={`mt-1.5 text-[30px] font-bold leading-none tabular-nums ${hot ? "text-rose-300" : tone.text}`}>
        {value}
        {limit !== null && <span className="ml-1 text-[13px] font-medium text-white/30">/ {limit}</span>}
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${hot ? "bg-rose-400" : tone.dot}`}
          style={{ width: `${Math.max(ratio * 100, value > 0 ? 6 : 0)}%`, boxShadow: `0 0 14px ${tone.glow}` }}
        />
      </div>
      <p className="mt-2 text-[10.5px] leading-snug text-white/40">{hint}</p>
    </div>
  );
}

export function LevelGauge({ state, who }: { state: LedgerState; who: "tu" | string }) {
  const tone = LEVEL_TONES[state.reached];
  const subject = who === "tu" ? "Estás" : `${who} está`;
  return (
    <section
      aria-label="Escala de incumprimento"
      className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: tone.glow, opacity: 0.35 }}
      />

      {/* Os quatro degraus */}
      <div className="relative">
        <p className="readout text-white/35">Escala de incumprimento · janela de {WINDOW_DAYS} dias</p>
        <ol className="mt-3 grid grid-cols-4 gap-2">
          {LEVELS.map((l) => {
            const t = LEVEL_TONES[l.level];
            const active = l.level === state.reached;
            const passed = l.level < state.reached;
            const pending = active && Boolean(state.pendingMeasure);
            return (
              <li
                key={l.level}
                className={`relative rounded-xl border px-2.5 py-2 transition ${
                  active
                    ? `${t.border} ${t.bg} shadow-[0_12px_40px_-18px_var(--glow)]`
                    : passed
                      ? "border-white/[0.08] bg-white/[0.03]"
                      : "border-white/[0.05] bg-transparent"
                }`}
                style={{ ["--glow" as string]: t.glow }}
              >
                <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${active ? t.text : passed ? "text-white/55" : "text-white/30"}`}>
                  {l.title}
                </p>
                <p className={`mt-0.5 text-[10px] leading-snug ${active ? "text-white/70" : "text-white/30"}`}>{l.rule}</p>
                {pending && (
                  <span className={`mt-1.5 inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] ${t.text}`}>
                    <AlertTriangle className="h-3 w-3" />
                    atingido
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* O estado numa frase */}
      <div className="relative mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <LevelChip state={state} />
        <p className="text-[12.5px] text-white/60">
          {state.pendingMeasure ? (
            <>
              {subject} no <span className={`font-semibold ${tone.text}`}>nível {state.reached}</span> desde{" "}
              {formatISODate(state.pendingMeasure.since)} — {LEVELS[state.reached].measure.toLowerCase().replace(/\.$/, "")}.
            </>
          ) : (
            <>
              {subject} no <span className={`font-semibold ${tone.text}`}>nível {state.level}</span>.{" "}
              {LEVELS[state.level].measure}
            </>
          )}
        </p>
      </div>

      {/* PA · NO · por pontuar */}
      <div className="relative mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Meter
          label="PA · pontos"
          hint="Soma dos pontos das ocorrências pontuadas na janela corrente."
          value={state.pa}
          limit={state.next?.pa ?? null}
          icon={Sigma}
          tone={tone}
        />
        <Meter
          label="NO · ocorrências"
          hint="Número de ocorrências pontuadas (> 0) na janela corrente."
          value={state.no}
          limit={state.next?.no ?? null}
          icon={Gauge}
          tone={tone}
        />
        <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
            <Hourglass className="h-3.5 w-3.5" />
            Por pontuar
          </p>
          <p className={`mt-1.5 text-[30px] font-bold leading-none tabular-nums ${state.unscored ? "text-[#c3aaff]" : "text-white/40"}`}>
            {state.unscored}
          </p>
          <p className="mt-2 text-[10.5px] leading-snug text-white/40">
            Ocorrências desta fase à espera da pontuação da direção — só depois entram no PA e no NO.
          </p>
        </div>
      </div>

      <p className="relative mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/40">
        <Scale className="h-3.5 w-3.5" />
        <span>{phaseLine(state)}</span>
        <span aria-hidden>·</span>
        <span>
          janela corrente desde {formatISODate(state.windowStart)}
        </span>
        {state.next && (
          <>
            <span aria-hidden>·</span>
            <span>
              próximo limiar: PA ≥ {state.next.pa} ou NO ≥ {state.next.no}
            </span>
          </>
        )}
      </p>
    </section>
  );
}
