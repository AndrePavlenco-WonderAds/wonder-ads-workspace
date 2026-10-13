// O medidor de um consultor — o nível na escala, o PA e o NO da janela
// corrente contra os limiares do próximo nível, e o RELÓGIO DOS 30 DIAS:
// quando cada ocorrência deixa de contar e quando os contadores voltam a
// zero. Puro (sem hooks): serve tanto a página do consultor como a da
// direção.

import { AlertTriangle, CheckCheck, Gauge, Hourglass, RotateCcw, Sigma, Timer } from "lucide-react";
import {
  formatISODate,
  formatISODayMonth,
  inDaysLabel,
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

function resetLine(state: LedgerState): string | null {
  const e = state.phaseEvent;
  if (!e) return null;
  const when = formatISODate(e.at);
  if (e.kind === "measure") {
    return e.level === 3
      ? `Último reinício: arranque do probation a ${when}.`
      : `Último reinício: 1:1 do nível ${e.level} a ${when}.`;
  }
  return `Último reinício: a direção definiu o nível ${e.level} a ${when}.`;
}

/** O anel da contagem decrescente — dias até os contadores voltarem a zero. */
function CountdownRing({ days, glow }: { days: number; glow: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const ratio = Math.min(1, Math.max(0, days / WINDOW_DAYS));
  const clear = days === 0;
  return (
    <div className="relative mx-auto h-[92px] w-[92px] shrink-0 sm:mx-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
        {!clear && (
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="url(#ine-ring)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
          />
        )}
        <defs>
          <linearGradient id="ine-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#343ED7" />
            <stop offset="54%" stopColor="#783DF5" />
            <stop offset="100%" stopColor="#C535C9" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {clear ? (
          <>
            <CheckCheck className="h-6 w-6 text-emerald-300" />
            <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-emerald-200/80">a zero</span>
          </>
        ) : (
          <>
            <span className="text-[26px] font-bold leading-none tabular-nums text-white">{days}</span>
            <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/45">
              {days === 1 ? "dia" : "dias"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** Os próximos 30 dias, com a saída de cada ocorrência marcada. */
function ClockTrack({ state }: { state: LedgerState }) {
  if (state.expiries.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-white/[0.06]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${(state.daysToClear / WINDOW_DAYS) * 100}%`, background: "var(--brand-gradient)", opacity: 0.55 }}
        />
        {state.expiries.map((e) => {
          const at = Math.min(WINDOW_DAYS, Math.max(0, state.daysToClear - (state.clearsOn ? daysBetween(e.on, state.clearsOn) : 0)));
          return (
            <span
              key={e.on}
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0b0b12] bg-white shadow-[0_0_10px_rgba(167,139,250,0.8)]"
              style={{ left: `${(at / WINDOW_DAYS) * 100}%` }}
              title={`${formatISODate(e.on)} · sai ${e.count === 1 ? "1 ocorrência" : `${e.count} ocorrências`} (−${e.points} ${e.points === 1 ? "pt" : "pts"})`}
            />
          );
        })}
      </div>
      <div className="relative mt-1.5 h-8 text-[10px]">
        <span className="absolute left-0 top-0 font-semibold uppercase tracking-[0.14em] text-white/40">hoje</span>
        {state.expiries.map((e) => {
          const at = Math.min(WINDOW_DAYS, Math.max(0, state.daysToClear - (state.clearsOn ? daysBetween(e.on, state.clearsOn) : 0)));
          return (
            <span
              key={e.on}
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-center leading-tight"
              style={{ left: `${Math.min(94, Math.max(6, (at / WINDOW_DAYS) * 100))}%` }}
            >
              <span className="block font-semibold tabular-nums text-white/80">−{e.points} {e.points === 1 ? "pt" : "pts"}</span>
              <span className="block tabular-nums text-white/40">{formatISODayMonth(e.on)}</span>
            </span>
          );
        })}
        <span className="absolute right-0 top-0 font-semibold uppercase tracking-[0.14em] text-white/30">+30 dias</span>
      </div>
    </div>
  );
}

function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/** O relógio dos 30 dias — a explicação do reinício, com os números da
 *  pessoa: quando a próxima ocorrência sai e quando tudo volta a zero. */
function ResetClock({ state, who, glow }: { state: LedgerState; who: "tu" | string; glow: string }) {
  const mine = who === "tu";
  const counters = mine ? "os teus contadores" : `os contadores de ${who}`;
  const first = state.expiries[0];
  const reset = resetLine(state);
  return (
    <div className="relative mt-5 rounded-2xl border border-white/[0.08] bg-black/25 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <CountdownRing days={state.daysToClear} glow={glow} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
            <Timer className="h-3.5 w-3.5" />
            Relógio dos {WINDOW_DAYS} dias
          </p>
          {state.clearsOn ? (
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/80">
              Sem novas ocorrências, {counters} voltam a zero a{" "}
              <span className="font-semibold text-white">{formatISODate(state.clearsOn)}</span> — {inDaysLabel(state.daysToClear)}.
              {first && state.expiries.length > 1 && (
                <>
                  {" "}
                  A próxima a sair vale <span className="font-semibold text-white">{first.points} pts</span> e sai a{" "}
                  {formatISODayMonth(first.on)}.
                </>
              )}
            </p>
          ) : (
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/80">
              PA e NO a zero — não há nenhuma ocorrência a contar{mine ? "" : ` para ${who}`}.
            </p>
          )}
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/45">
            Cada ocorrência pontuada conta durante {WINDOW_DAYS} dias a partir do dia em que aconteceu. Uma nova ocorrência
            volta a pôr o relógio a contar. Um 1:1 de nível também põe os contadores a zero — o nível mantém-se, é
            cumulativo.
          </p>
          {(reset || state.unscored > 0 || (state.pendingMeasure && state.pa === 0)) && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
              {reset && (
                <span className="inline-flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" />
                  {reset}
                </span>
              )}
              {state.unscored > 0 && (
                <span className="inline-flex items-center gap-1 text-[#c3aaff]/80">
                  <Hourglass className="h-3 w-3" />
                  {state.unscored} por pontuar — contam a partir do dia em que aconteceram, quando a direção as pontuar.
                </span>
              )}
              {state.pendingMeasure && state.pa === 0 && (
                <span className="inline-flex items-center gap-1 text-amber-200/80">
                  <AlertTriangle className="h-3 w-3" />
                  A medida do nível {state.pendingMeasure.level} continua por aplicar.
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      <ClockTrack state={state} />
    </div>
  );
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

      <ResetClock state={state} who={who} glow={tone.glow} />
    </section>
  );
}
