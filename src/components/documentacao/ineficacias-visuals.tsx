// Os desenhos da página das Ineficácias (v78.19; v78.21 sem a janela dos 30
// dias): a escala de 0 a 10, o reinício ao subir de nível, a escada dos níveis e os
// cenários. Servidor, sem
// estado. Os números saem de lib/ineficacias/shared.ts — o desenho e as
// contas da app usam as mesmas constantes.

import { LEVELS, MAX_POINTS, SCORE_BANDS, bandOf, type ScoreBand } from "@/lib/ineficacias/shared";

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
            <p className="mt-0.5 text-[12.5px] leading-snug text-white/60">{b.hint}</p>
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
/*  O reinício ao subir de nível (v78.53; até aí era no 1:1)            */
/* ------------------------------------------------------------------ */

function Chip({ points, dim = false }: { points: number; dim?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[13px] font-semibold tabular-nums text-white ${dim ? "opacity-45" : ""}`}
      style={{ background: `${BAND_COLOR[bandOf(points).id]}cc` }}
    >
      {points} {points === 1 ? "ponto" : "pontos"}
    </span>
  );
}

function Phase({ title, points, foot }: { title: string; points: number[]; foot: string }) {
  const pa = points.reduce((s, p) => s + p, 0);
  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-[#0b0c12] p-5">
      <p className="text-[14px] font-semibold text-white">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {points.map((p, i) => (
          <Chip key={i} points={p} />
        ))}
      </div>
      <div className="mt-5 flex gap-8">
        <p>
          <span className="block text-[12.5px] text-white/50">PA</span>
          <span className="text-[2rem] font-semibold leading-none tabular-nums text-white">{pa}</span>
        </p>
        <p>
          <span className="block text-[12.5px] text-white/50">NO</span>
          <span className="text-[2rem] font-semibold leading-none tabular-nums text-white">{points.length}</span>
        </p>
      </div>
      <p className="mt-auto pt-4 text-[13.5px] text-white/65">{foot}</p>
    </div>
  );
}

/** A regra num desenho: subir de nível fecha a fase, os contadores
 *  recomeçam do zero e os erros passam ao histórico. */
export function PhaseReset() {
  return (
    <figure aria-label="O que acontece ao subir de nível" className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <Phase title="Antes de subir" points={[4, 2]} foot="PA 6 passa o limiar: nível 1." />

        <div className="flex items-center justify-center md:flex-col md:px-1">
          <span
            className="rounded-2xl px-4 py-3 text-center text-white shadow-[0_18px_50px_-22px_rgba(197,53,201,0.9)]"
            style={{ background: "var(--brand-gradient)" }}
          >
            <span className="block text-[14px] font-semibold">Sobe ao nível 1</span>
            <span className="block text-[12.5px] text-white/85">PA e NO a zero</span>
          </span>
        </div>

        <Phase title="Depois de subir" points={[1]} foot="Recomeça do zero, a caminho do nível 2." />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-dashed border-white/15 px-5 py-3.5">
        <span className="text-[14px] font-semibold text-white">Histórico</span>
        <span className="flex flex-wrap gap-2">
          {[4, 2, 1].map((p, i) => (
            <Chip key={i} points={p} dim />
          ))}
        </span>
        <span className="text-[13.5px] text-white/60">Nada se apaga.</span>
      </div>
    </figure>
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
              <p className={`mt-auto pt-3 text-[13.5px] leading-snug ${top ? "text-white/90" : "text-white/70"}`}>{l.measure}</p>
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
      <p className="mt-1 text-[14px] leading-relaxed text-white/65">{context}</p>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="Os erros">
        {points.map((p, i) => (
          <Chip key={i} points={p} />
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
