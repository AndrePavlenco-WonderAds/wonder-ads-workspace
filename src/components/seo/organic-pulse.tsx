"use client";

// Etiqueta «organic · 30d» do SEO DPT (v77.16). Uma pílula na linha dos
// «clients», como antes, só que com o número a contar, a variação face
// aos 30 dias anteriores e uma mini-curva dos últimos 30 dias. Tudo o
// resto (clientes com GA4, maior subida, frescura) vive no tooltip.

import { useEffect, useId, useMemo } from "react";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";

export type OrganicPulseProps = {
  /** Visitantes orgânicos (GA4 totalUsers · Organic Search), últimos 30 dias. */
  total: number;
  /** O mesmo, nos 30 dias anteriores. */
  prevTotal: number;
  /** Sessões orgânicas por dia, do dia mais antigo até ontem. */
  daily: number[];
  clientsWithData: number;
  /** Clientes cujo valor foi transportado de uma leitura anterior. */
  clientsStale: number;
  computedAt: number | null;
  /** Clientes com mais visitas do que no período anterior… */
  growing: number;
  /** …entre os que têm período anterior comparável. */
  comparable: number;
  topClimber: { name: string; pct: number } | null;
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

export function OrganicPulse({
  total,
  prevTotal,
  daily,
  clientsWithData,
  clientsStale,
  computedAt,
  growing,
  comparable,
  topClimber,
}: OrganicPulseProps) {
  const id = useId().replace(/:/g, "");
  const hasData = total > 0;
  const shown = useCountUp(hasData ? total : 0);
  const delta = hasData && prevTotal > 0 ? total - prevTotal : null;
  const pct = delta !== null ? (delta / prevTotal) * 100 : null;

  const tooltip = hasData
    ? [
        `${fmt(total)} visitantes orgânicos nos últimos 30 dias (GA4 · Organic Search)`,
        delta !== null
          ? `${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta))} vs. 30 dias anteriores`
          : null,
        `${clientsWithData} clientes com GA4 ligado`,
        comparable > 0 ? `${growing}/${comparable} a crescer` : null,
        topClimber
          ? `maior subida: ${topClimber.name} +${pctLabel(topClimber.pct)}`
          : null,
        clientsStale > 0 ? `${clientsStale} com o último valor conhecido` : null,
        computedAt ? `atualizado ${ago(computedAt)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "A recolher os dados do GA4 — volta a abrir daqui a uns minutos.";

  return (
    <span
      className="animate-count-pop inline-flex items-center gap-2.5 rounded-full border border-emerald-400/35 bg-emerald-500/[0.10] px-3 py-1.5 text-emerald-100 backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:border-emerald-400/60 hover:bg-emerald-500/[0.16]"
      title={tooltip}
    >
      <TrendingUp className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2.5} />
      <span className="text-base font-bold leading-none tracking-tight tabular-nums">
        {hasData ? fmt(shown) : "—"}
      </span>
      <span className="text-base font-medium uppercase leading-none tracking-[0.16em] text-emerald-200/80">
        organic · 30d
      </span>
      {pct !== null && (
        <>
          <span aria-hidden className="h-4 w-px bg-emerald-300/25" />
          <span
            className={`inline-flex items-center gap-0.5 text-sm font-semibold leading-none tabular-nums ${
              pct >= 0 ? "text-emerald-200" : "text-rose-300"
            }`}
          >
            {pct >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
            {pctLabel(pct)}
          </span>
        </>
      )}
      {hasData && daily.length > 1 && (
        <>
          <span aria-hidden className="h-4 w-px bg-emerald-300/25" />
          <Sparkline daily={daily} id={id} />
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------

function pctLabel(pct: number): string {
  const abs = Math.abs(pct);
  return `${abs >= 100 ? Math.round(abs) : abs.toFixed(1)}%`;
}

function ago(at: number): string {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  return `há ${Math.round(mins / 60)} h`;
}

/** Contagem animada até ao alvo (easeOutExpo). Respeita o pedido de menos
 *  animação do sistema: salta logo para o valor final. */
function useCountUp(target: number, duration = 1400): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const W = 72;
const H = 18;
const PAD = 2;

/** Mini-curva dos últimos 30 dias, 72×18, desenhada da esquerda para a
 *  direita. Só forma — os números vivem no tooltip. */
function Sparkline({ daily, id }: { daily: number[]; id: string }) {
  const { line, area } = useMemo(() => {
    const n = daily.length;
    const max = Math.max(1, ...daily);
    const pts = daily.map((v, i) => ({
      x: PAD + (i / (n - 1)) * (W - PAD * 2),
      y: H - PAD - (v / max) * (H - PAD * 2),
    }));
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      d += ` Q${p.x.toFixed(1)} ${p.y.toFixed(1)} ${((p.x + q.x) / 2).toFixed(1)} ${((p.y + q.y) / 2).toFixed(1)}`;
    }
    const end = pts[pts.length - 1];
    d += ` L${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
    return {
      line: d,
      area: `${d} L${end.x.toFixed(1)} ${H} L${pts[0].x.toFixed(1)} ${H} Z`,
    };
  }, [daily]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="shrink-0"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-fill)`} className="organic-fill-in" />
      <path
        d={line}
        fill="none"
        stroke="#6ee7b7"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="organic-draw"
      />
    </svg>
  );
}
