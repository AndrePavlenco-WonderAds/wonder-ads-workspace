// Os desenhos da página das Ineficácias (v78.19): a escala de 0 a 10, a
// janela dos 30 dias, a escada dos níveis e os cenários. Servidor, sem
// estado. Os números saem de lib/ineficacias/shared.ts — o desenho e as
// contas da app usam as mesmas constantes.

import {
  LEVELS,
  MAX_POINTS,
  SCORE_BANDS,
  WINDOW_DAYS,
  bandOf,
  type ScoreBand,
} from "@/lib/ineficacias/shared";

/** A cor de cada banda: a marca a aquecer até ao vermelho do crítico. */
export const BAND_COLOR: Record<ScoreBand["id"], string> = {
  zero: "rgba(255,255,255,0.10)",
  baixo: "#343ED7",
  medio: "#783DF5",
  alto: "#C535C9",
  critico: "#F43F5E",
};

function bandRange(b: ScoreBand): string {
  return b.min === b.max ? String(b.min) : `${b.min} a ${b.max}`;
}

/* ------------------------------------------------------------------ */
/*  A escala de 0 a 10                                                  */
/* ------------------------------------------------------------------ */

export function PointsScale() {
  const cells = Array.from({ length: MAX_POINTS + 1 }, (_, n) => n);
  const cols = { gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` };
  return (
    <figure aria-label="A escala de 0 a 10 pontos">
      {/* Barras que crescem com os pontos — o peso vê-se antes de se ler. */}
      <div className="grid h-36 items-end gap-1 sm:h-44 sm:gap-1.5" style={cols}>
        {cells.map((n) => {
          const b = bandOf(n);
          return (
            <div
              key={n}
              className="flex items-end justify-center rounded-t-xl rounded-b-md pb-2"
              style={{
                height: `${22 + n * 7.8}%`,
                background: n === 0 ? BAND_COLOR.zero : `linear-gradient(180deg, ${BAND_COLOR[b.id]}, ${BAND_COLOR[b.id]}99)`,
              }}
            >
              <span className={`text-[14px] font-semibold tabular-nums sm:text-[17px] ${n === 0 ? "text-white/45" : "text-white"}`}>
                {n}
              </span>
            </div>
          );
        })}
      </div>

      {/* A partir de sm, cada banda por baixo das suas barras. */}
      <div className="mt-3 hidden gap-1.5 sm:grid" style={cols}>
        {SCORE_BANDS.map((b) => (
          <div
            key={b.id}
            className="border-t-2 pt-2.5"
            style={{ gridColumn: `${b.min + 1} / ${b.max + 2}`, borderColor: BAND_COLOR[b.id] }}
          >
            <p className="text-[13px] font-semibold text-white">{b.label}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-white/50">{b.hint}</p>
          </div>
        ))}
      </div>

      {/* No telemóvel, em lista. */}
      <ul className="mt-4 space-y-2.5 sm:hidden">
        {SCORE_BANDS.map((b) => (
          <li key={b.id} className="flex items-baseline gap-3 text-[13.5px]">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-full" style={{ background: BAND_COLOR[b.id] }} />
            <span className="w-14 shrink-0 tabular-nums text-white/45">{bandRange(b)}</span>
            <span>
              <span className="font-semibold text-white">{b.label}</span>
              <span className="text-white/50"> — {b.hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  A janela dos 30 dias                                                */
/* ------------------------------------------------------------------ */

// O exemplo: três erros pontuados, hoje = dia 0. O primeiro já saiu da
// janela; os outros dois contam e têm data de saída.
const SPAN = { from: -42, to: 28 };
const EXAMPLE = [
  { day: -38, points: 3 },
  { day: -21, points: 4 },
  { day: -6, points: 2 },
];

function pos(day: number): string {
  return `${((day - SPAN.from) / (SPAN.to - SPAN.from)) * 100}%`;
}

function ago(day: number): string {
  return day === 0 ? "hoje" : `há ${-day} dias`;
}

export function WindowTimeline() {
  const windowStart = -(WINDOW_DAYS - 1);
  const inside = EXAMPLE.filter((o) => o.day >= windowStart);
  const pa = inside.reduce((s, o) => s + o.points, 0);
  const no = inside.length;

  return (
    <figure aria-label="Exemplo da janela dos 30 dias" className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-md text-[13.5px] leading-relaxed text-white/55">
          Três erros pontuados. O de há 38 dias já saiu; os outros dois ainda contam.
        </p>
        <div className="flex gap-6">
          <Counter label="PA hoje" value={pa} />
          <Counter label="NO hoje" value={no} />
        </div>
      </div>

      <div className="-mx-5 mt-6 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
        <div className="relative h-44 min-w-[560px]">
          {/* A janela que conta */}
          <div
            className="absolute bottom-12 top-10 rounded-2xl border border-[#783DF5]/40 bg-[#783DF5]/[0.10]"
            style={{ left: pos(windowStart), width: `calc(${pos(0)} - ${pos(windowStart)})` }}
          />
          <p
            className="absolute bottom-3 text-[12px] font-medium text-[#c4a6ff]"
            style={{ left: pos(windowStart) }}
          >
            Os últimos {WINDOW_DAYS} dias — contam
          </p>

          {/* A linha do tempo */}
          <div className="absolute inset-x-0 top-[6.25rem] h-px bg-white/15" />

          {/* Hoje */}
          <div className="absolute bottom-10 top-6 w-px bg-white" style={{ left: pos(0) }} />
          <span
            className="absolute top-0 -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[11.5px] font-semibold text-[#07080d]"
            style={{ left: pos(0) }}
          >
            Hoje
          </span>

          {/* Os erros */}
          {EXAMPLE.map((o) => {
            const counts = o.day >= windowStart;
            const size = 14 + o.points * 4;
            return (
              <div key={o.day} className="absolute top-[6.25rem] -translate-x-1/2 -translate-y-1/2" style={{ left: pos(o.day) }}>
                <span
                  className={`block rounded-full ${counts ? "" : "opacity-30"}`}
                  style={{ width: size, height: size, background: BAND_COLOR[bandOf(o.points).id] }}
                />
                <span
                  className={`absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap text-[12px] font-semibold tabular-nums ${counts ? "text-white" : "text-white/35 line-through"}`}
                >
                  {o.points} pts
                </span>
                <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-[11px] text-white/40">
                  {ago(o.day)}
                </span>
              </div>
            );
          })}

          {/* Quando cada um sai */}
          {inside.map((o) => {
            const out = o.day + WINDOW_DAYS;
            return (
              <div key={`out${o.day}`} className="absolute top-[6.25rem] -translate-x-1/2 -translate-y-1/2" style={{ left: pos(out) }}>
                <span className="block h-3 w-3 rounded-full border-2 border-dashed border-white/40" />
                <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-[11px] text-white/45">
                  sai em {out} dias
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </figure>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[12px] text-white/45">{label}</p>
      <p className="text-[2rem] font-semibold leading-none tabular-nums text-white">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  A escada dos níveis                                                 */
/* ------------------------------------------------------------------ */

const STEP_HEIGHT = ["44%", "60%", "78%", "100%"];

export function LevelStairs() {
  return (
    <figure aria-label="Os níveis da escala">
      {/* A partir de sm: a escada. */}
      <div className="hidden h-[26rem] grid-cols-4 items-end gap-2 sm:grid lg:h-80">
        {LEVELS.map((l) => {
          const top = l.level === 3;
          return (
            <div
              key={l.level}
              className={`flex flex-col rounded-t-3xl rounded-b-lg p-4 lg:p-5 ${
                top ? "text-white shadow-[0_24px_70px_-28px_rgba(197,53,201,0.9)]" : "border border-b-0 border-[#783DF5]/25"
              }`}
              style={{
                height: STEP_HEIGHT[l.level],
                background: top ? "var(--brand-gradient)" : `rgba(120,61,245,${0.06 + l.level * 0.07})`,
              }}
            >
              <p className={`text-[13px] font-medium ${top ? "text-white/85" : "text-white/55"}`}>
                {l.title}
                {top && " · Probation"}
              </p>
              <p className="mt-1 text-[16px] font-semibold leading-snug text-white lg:text-[17px]">{l.rule}</p>
              <p className={`mt-auto pt-3 text-[13px] leading-snug ${top ? "text-white/90" : "text-white/60"}`}>{l.measure}</p>
            </div>
          );
        })}
      </div>

      {/* No telemóvel: de cima para baixo, do mais alto para o mais baixo. */}
      <ol className="space-y-2 sm:hidden">
        {[...LEVELS].reverse().map((l) => {
          const top = l.level === 3;
          return (
            <li
              key={l.level}
              className={`rounded-2xl p-4 ${top ? "" : "border border-[#783DF5]/25"}`}
              style={{
                background: top ? "var(--brand-gradient)" : `rgba(120,61,245,${0.06 + l.level * 0.07})`,
                marginLeft: `${(3 - l.level) * 6}%`,
              }}
            >
              <p className="text-[12.5px] font-medium text-white/70">
                {l.title}
                {top && " · Probation"}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-white">{l.rule}</p>
              <p className="mt-1 text-[13px] leading-snug text-white/70">{l.measure}</p>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Os cenários                                                         */
/* ------------------------------------------------------------------ */

export function ScenarioCard({
  title,
  context,
  points,
  limit,
  result,
  top = false,
}: {
  title: string;
  context: string;
  points: number[];
  /** O limiar do nível seguinte. */
  limit: { pa: number; no: number };
  result: string;
  /** O resultado é o probation. */
  top?: boolean;
}) {
  const pa = points.reduce((s, p) => s + p, 0);
  const no = points.length;
  return (
    <article className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <h3 className="text-[17px] font-semibold text-white">{title}</h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-white/55">{context}</p>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="Os erros">
        {points.map((p, i) => (
          <span
            key={i}
            className="rounded-full px-3 py-1 text-[13px] font-semibold tabular-nums text-white"
            style={{ background: `${BAND_COLOR[bandOf(p).id]}cc` }}
          >
            {p} {p === 1 ? "ponto" : "pontos"}
          </span>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <Meter label="PA" value={pa} limit={limit.pa} />
        <Meter label="NO" value={no} limit={limit.no} />
      </div>

      <p
        className={`mt-6 rounded-2xl px-4 py-3 text-[14px] font-semibold ${top ? "text-white" : "bg-[#783DF5]/15 text-[#d9c8ff]"}`}
        style={top ? { background: "var(--brand-gradient)" } : undefined}
      >
        {result}
      </p>
    </article>
  );
}

function Meter({ label, value, limit }: { label: string; value: number; limit: number }) {
  const hit = value >= limit;
  const pct = Math.min(100, (value / limit) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className={hit ? "font-semibold text-white" : "text-white/55"}>{label}</span>
        <span className="tabular-nums">
          <span className={hit ? "font-semibold text-white" : "text-white/70"}>{value}</span>
          <span className="text-white/35"> / {limit}</span>
          {hit && <span className="ml-2 text-[12px] font-semibold text-[#e7a8ff]">passou</span>}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: hit ? "var(--brand-gradient)" : "rgba(255,255,255,0.28)" }}
        />
      </div>
    </div>
  );
}
