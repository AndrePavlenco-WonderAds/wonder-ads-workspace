"use client";

// Gráficos da proposta — HTML/CSS puro, sem biblioteca. Uma série por
// painel (nunca dois eixos), marcas finas com topo arredondado, rótulos
// diretos só no primeiro e último ponto, tooltip nos restantes ao passar o
// rato, e uma vista em tabela ao lado (o corpo mantém a tabela mensal num
// <details>). As barras crescem a partir da linha de base quando entram
// no ecrã; na impressão ficam no estado final.

import { useState } from "react";
import { formatPt, useInView } from "./proposal-motion";
import { BRAND_GRADIENT } from "./proposal-primitives";

export type MonthPoint = { label: string; clicks: number; impressions: number };

function BarPanel({
  title,
  subtitle,
  data,
  color,
  colorStrong,
  growth,
  inView,
}: {
  title: string;
  subtitle: string;
  data: { label: string; value: number }[];
  color: string;
  colorStrong: string;
  growth: string;
  inView: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value));
  const last = data.length - 1;
  return (
    <div className="rounded-2xl border border-black/8 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-black/85">{title}</p>
          <p className="text-[11.5px] text-black/50">{subtitle}</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
          {growth}
        </span>
      </div>
      <div className="relative mt-5 h-44">
        {/* grelha recessiva */}
        {[0.5, 1].map((g) => (
          <div
            key={g}
            aria-hidden
            className="absolute left-0 right-0 border-t border-dashed border-black/8"
            style={{ bottom: `${g * 100}%` }}
          />
        ))}
        <div className="absolute inset-0 flex items-end gap-2 sm:gap-3">
          {data.map((d, i) => {
            const h = max ? (d.value / max) * 100 : 0;
            const isLast = i === last;
            const labelled = i === 0 || isLast || hover === i;
            return (
              <div
                key={d.label}
                className="relative flex h-full flex-1 flex-col justify-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-opacity duration-200 ${labelled ? "opacity-100" : "opacity-0"} ${hover === i && !isLast && i !== 0 ? "bg-black/85 text-white" : "text-black/80"}`}
                  style={{ bottom: `calc(${h}% + 6px)` }}
                >
                  {formatPt(d.value)}
                </div>
                <div
                  className="pr-anim mx-auto w-[62%] rounded-t-[4px]"
                  style={{
                    height: `${h}%`,
                    background: isLast ? colorStrong : color,
                    opacity: hover === null || hover === i ? 1 : 0.55,
                    transformOrigin: "bottom",
                    transform: inView ? "scaleY(1)" : "scaleY(0)",
                    transition: `transform 900ms cubic-bezier(.2,.7,.2,1) ${i * 90}ms, opacity 200ms`,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div aria-hidden className="absolute bottom-0 left-0 right-0 border-t border-black/20" />
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center text-[11px] text-black/55">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyGrowthChart({ months }: { months: MonthPoint[] }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const first = months[0];
  const lastM = months[months.length - 1];
  const gClicks = lastM.clicks / first.clicks;
  const gImp = lastM.impressions / first.impressions;
  return (
    <div ref={ref} className="grid gap-4 md:grid-cols-2">
      <BarPanel
        title="Cliques na Pesquisa Google"
        subtitle="por mês · fevereiro → julho 2026"
        data={months.map((m) => ({ label: m.label, value: m.clicks }))}
        color="#a78bfa"
        colorStrong="#783DF5"
        growth={`×${formatPt(gClicks, 1)} em 6 meses`}
        inView={inView}
      />
      <BarPanel
        title="Impressões"
        subtitle="vezes que o site apareceu no Google · por mês"
        data={months.map((m) => ({ label: m.label, value: m.impressions }))}
        color="#93a5f5"
        colorStrong="#343ED7"
        growth={`×${formatPt(gImp, 1)} em 6 meses`}
        inView={inView}
      />
    </div>
  );
}

/** Barra de progresso «de → para» dos tiles secundários. */
export function GrowthBar({ from, to, color = BRAND_GRADIENT }: { from: number; to: number; color?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const pctFrom = to ? Math.max(6, (from / to) * 100) : 0;
  return (
    <div ref={ref} className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-black/6">
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-full bg-black/15"
        style={{ width: `${pctFrom}%` }}
      />
      <div
        className="pr-anim absolute inset-y-0 left-0 rounded-full"
        style={{
          width: inView ? "100%" : `${pctFrom}%`,
          background: color,
          transition: "width 1100ms cubic-bezier(.2,.7,.2,1) 150ms",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Escada de posições — onde cada frente está hoje e onde vai estar em fev.
// ---------------------------------------------------------------------------

export type LadderRow = {
  label: string;
  impressions: number;
  /** posição média atual (número) */
  current: number;
  currentLabel: string;
  /** posição alvo (número) */
  target: number;
  targetLabel: string;
  accent?: boolean;
};

const WORST = 20;
function xOf(pos: number): number {
  const p = Math.min(WORST, Math.max(1, pos));
  return ((WORST - p) / (WORST - 1)) * 100;
}

export function PositionLadder({ rows }: { rows: LadderRow[] }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const maxImp = Math.max(...rows.map((r) => r.impressions));
  const top5 = xOf(5);
  return (
    <div ref={ref} className="space-y-3">
      <div className="hidden grid-cols-[1.25fr_0.9fr_2fr] gap-4 px-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-black/45 md:grid">
        <span>Frente de trabalho</span>
        <span>Procura já conquistada</span>
        <span className="flex justify-between">
          <span>Posição 20</span>
          <span>Posição 10</span>
          <span className="text-[#5b21b6]">Top 5 · onde clicam</span>
          <span>#1</span>
        </span>
      </div>
      {rows.map((r, i) => {
        const xc = xOf(r.current);
        const xt = xOf(r.target);
        return (
          <div
            key={r.label}
            className={`grid grid-cols-1 gap-3 rounded-2xl bg-white px-4 py-4 md:grid-cols-[1.25fr_0.9fr_2fr] md:items-center md:gap-4 ${r.accent ? "border-2 border-transparent [background:linear-gradient(#fff,#fff)_padding-box,linear-gradient(135deg,#343ED7,#783DF5,#C535C9)_border-box] shadow-[0_10px_30px_-18px_rgba(120,61,245,.5)]" : "border border-black/8"}`}
          >
            <div className="flex items-center gap-2">
              <p className={`text-[14px] ${r.accent ? "font-bold text-black/90" : "font-medium text-black/80"}`}>
                {r.label}
              </p>
              {r.accent && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white"
                  style={{ background: BRAND_GRADIENT }}
                >
                  Foco
                </span>
              )}
            </div>
            <div>
              <div className="flex items-baseline justify-between text-[12px] text-black/60 md:hidden">
                <span>Procura já conquistada</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/6">
                  <div
                    className="pr-anim h-full rounded-full bg-[#c4b5fd]"
                    style={{
                      width: inView ? `${(r.impressions / maxImp) * 100}%` : "0%",
                      transition: `width 900ms cubic-bezier(.2,.7,.2,1) ${i * 70}ms`,
                    }}
                  />
                </div>
                <span className="w-[76px] text-right text-[12px] font-semibold tabular-nums text-black/75">
                  {formatPt(r.impressions)}
                  <span className="ml-0.5 font-normal text-black/45">imp.</span>
                </span>
              </div>
            </div>
            <div className="relative h-9">
              {/* zona Top 5 */}
              <div
                aria-hidden
                className="absolute inset-y-2 rounded-r-full bg-[#783DF5]/8"
                style={{ left: `${top5}%`, right: 0 }}
              />
              <div aria-hidden className="absolute left-0 right-0 top-1/2 h-px bg-black/12" />
              {/* segmento de → para */}
              <div
                className="pr-anim absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                style={{
                  left: `${xc}%`,
                  width: inView ? `${Math.max(0, xt - xc)}%` : "0%",
                  background: BRAND_GRADIENT,
                  transition: `width 1000ms cubic-bezier(.2,.7,.2,1) ${150 + i * 90}ms`,
                }}
              />
              {/* marcador atual */}
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${xc}%` }}>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-black/35 bg-white" />
                <span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-medium text-black/55">
                  {r.currentLabel}
                </span>
              </div>
              {/* marcador alvo */}
              <div
                className="pr-anim absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${xt}%`,
                  opacity: inView ? 1 : 0,
                  transform: `translate(-50%, -50%) scale(${inView ? 1 : 0.4})`,
                  transition: `opacity 400ms ${900 + i * 90}ms, transform 500ms cubic-bezier(.2,.9,.3,1.4) ${900 + i * 90}ms`,
                }}
              >
                <div className="h-4 w-4 rounded-full ring-2 ring-white" style={{ background: BRAND_GRADIENT }} />
                <span className={`absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] ${r.accent ? "font-bold" : "font-semibold"} text-[#4c1d95]`}>
                  {r.targetLabel}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
