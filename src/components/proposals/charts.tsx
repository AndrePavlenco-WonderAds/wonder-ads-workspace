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
        className="pr-anim absolute inset-y-0 left-0 w-full rounded-full"
        style={{
          background: color,
          transformOrigin: "left",
          transform: inView ? "scaleX(1)" : `scaleX(${pctFrom / 100})`,
          transition: "transform 1100ms cubic-bezier(.2,.7,.2,1) 150ms",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Escada de posições — onde cada frente está hoje e onde vai estar em fev.
// Uma régua partilhada (posição 20 → #1) com a zona Top 5 sombreada de alto
// a baixo; cada frente é uma cápsula em gradiente que vai do marcador «hoje»
// ao alvo, com riscas em movimento para dar a sensação de subida.
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

const COLS = "md:grid-cols-[1.05fr_2.3fr]";

export function PositionLadder({ rows }: { rows: LadderRow[] }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const maxImp = Math.max(...rows.map((r) => r.impressions));
  const top5 = xOf(5);
  const top3 = xOf(3);
  const ticks = [20, 15, 10, 5, 1];
  return (
    <div ref={ref} className="overflow-hidden rounded-3xl border border-black/8 bg-white shadow-[0_20px_50px_-30px_rgba(120,61,245,.35)]">
      {/* ----- cabeçalho com a régua ----- */}
      <div className={`grid grid-cols-1 gap-2 border-b border-black/6 bg-black/[0.02] px-5 pb-3 pt-4 md:grid ${COLS} md:gap-8`}>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-black/45">
          Frente de trabalho · procura já conquistada
        </div>
        <div className="relative h-9">
          <div
            aria-hidden
            className="absolute inset-x-0 top-1 h-1.5 rounded-full"
            style={{ background: "linear-gradient(90deg, #e5e7eb 0%, #ddd6fe 45%, #a78bfa 70%, #783DF5 85%, #C535C9 100%)" }}
          />
          {ticks.map((t) => (
            <span
              key={t}
              className={`absolute top-4 -translate-x-1/2 text-[10.5px] font-semibold ${t <= 5 ? "text-[#5b21b6]" : "text-black/45"}`}
              style={{ left: `${xOf(t)}%`, transform: t === 20 ? "translateX(0)" : t === 1 ? "translateX(-100%)" : "translateX(-50%)" }}
            >
              {t === 1 ? "#1" : `posição ${t}`}
            </span>
          ))}
        </div>
      </div>

      {/* ----- linhas ----- */}
      {rows.map((r, i) => {
        const xc = xOf(r.current);
        const xt = xOf(r.target);
        const delta = Math.max(1, Math.round(r.current - r.target));
        return (
          <div
            key={r.label}
            className={`relative grid grid-cols-1 gap-3 border-b border-black/5 px-5 py-4 last:border-b-0 md:grid ${COLS} md:items-center md:gap-8 ${r.accent ? "bg-[#f8f5ff]" : ""}`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className={`text-[14.5px] ${r.accent ? "font-bold text-black/90" : "font-semibold text-black/82"}`}>{r.label}</p>
                {r.accent && (
                  <span className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white" style={{ background: BRAND_GRADIENT }}>
                    Foco
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11.5px] text-black/65">
                  <span className="inline-block h-1.5 w-12 overflow-hidden rounded-full bg-black/8">
                    <span
                      className="pr-anim block h-full rounded-full"
                      style={{ width: `${(r.impressions / maxImp) * 100}%`, background: BRAND_GRADIENT, transformOrigin: "left", transform: inView ? "scaleX(1)" : "scaleX(0)", transition: `transform 900ms cubic-bezier(.2,.7,.2,1) ${i * 70}ms` }}
                    />
                  </span>
                  <strong className="font-semibold text-black/80">{formatPt(r.impressions)}</strong> impressões
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                  ↑ {delta} posições
                </span>
              </div>
            </div>

            <div className="relative h-16">
              {/* zona Top 5 contínua (as linhas não têm espaço entre si) */}
              <div aria-hidden className="absolute -inset-y-4 bg-[#783DF5]/[0.06]" style={{ left: `${top5}%`, right: 0 }} />
              {r.accent && <div aria-hidden className="absolute -inset-y-4 bg-[#783DF5]/[0.08]" style={{ left: `${top3}%`, right: 0 }} />}
              <div aria-hidden className="absolute left-0 right-0 top-1/2 h-px bg-black/10" />

              {/* cápsula hoje → alvo */}
              <div
                className={`pr-anim pr-stripes absolute top-1/2 h-6 rounded-full ${r.accent ? "shadow-[0_8px_24px_-8px_rgba(120,61,245,.7)]" : ""}`}
                style={{
                  left: `${xc}%`,
                  width: `${Math.max(0, xt - xc)}%`,
                  background: BRAND_GRADIENT,
                  transformOrigin: "left",
                  transform: inView ? "translateY(-50%) scaleX(1)" : "translateY(-50%) scaleX(0)",
                  transition: `transform 1100ms cubic-bezier(.2,.7,.2,1) ${120 + i * 90}ms`,
                }}
              />

              {/* marcador hoje */}
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${xc}%` }}>
                <div className="h-4 w-4 rounded-full border-[3px] border-black/40 bg-white shadow" />
                <span className="absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded-md bg-white/90 px-1.5 py-0.5 text-[10.5px] font-medium text-black/60">
                  hoje {r.currentLabel}
                </span>
              </div>

              {/* marcador alvo */}
              <div
                className="pr-anim absolute top-1/2"
                style={{
                  left: `${xt}%`,
                  opacity: inView ? 1 : 0,
                  transform: `translate(-50%, -50%) scale(${inView ? 1 : 0.4})`,
                  transition: `opacity 400ms ${1000 + i * 90}ms, transform 500ms cubic-bezier(.2,.9,.3,1.4) ${1000 + i * 90}ms`,
                }}
              >
                <div className={`rounded-full ring-[3px] ring-white ${r.accent ? "h-6 w-6" : "h-5 w-5"}`} style={{ background: BRAND_GRADIENT }} />
                <span className={`absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold text-white ${r.accent ? "text-[12px]" : ""}`} style={{ background: BRAND_GRADIENT }}>
                  {r.targetLabel} · fev 2027
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* ----- legenda ----- */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-black/6 bg-black/[0.02] px-5 py-3 text-[11.5px] text-black/55">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-[2.5px] border-black/40 bg-white" /> hoje (posição média)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: BRAND_GRADIENT }} /> alvo em fevereiro de 2027</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-[#783DF5]/10" /> zona Top 5 — onde as pessoas clicam</span>
      </div>
    </div>
  );
}
