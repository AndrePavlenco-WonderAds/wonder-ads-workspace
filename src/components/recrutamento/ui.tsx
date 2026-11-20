// Recrutamento (v80.13) — peças visuais partilhadas pela lista, pela ficha e
// pelo modo entrevista. Sem hooks: servem servidor e cliente.

import type { ReactNode } from "react";
import { fmtScore, GRADE_GRID, zoneOf, type GradeCell, type Zone } from "@/lib/recrutamento/scoring";
import type { CandidateStage } from "@/lib/recrutamento/shared";
import { STAGE_LABEL } from "@/lib/recrutamento/shared";

export const TONE: Record<GradeCell["tone"], { text: string; bg: string; border: string; glow: string; solid: string }> = {
  emerald: { text: "text-emerald-200", bg: "bg-emerald-400/[0.12]", border: "border-emerald-300/40", glow: "rgba(52,211,153,0.45)", solid: "#34d399" },
  sky: { text: "text-sky-200", bg: "bg-sky-400/[0.12]", border: "border-sky-300/40", glow: "rgba(56,189,248,0.4)", solid: "#38bdf8" },
  teal: { text: "text-teal-200", bg: "bg-teal-400/[0.12]", border: "border-teal-300/40", glow: "rgba(45,212,191,0.4)", solid: "#2dd4bf" },
  rose: { text: "text-rose-200", bg: "bg-rose-400/[0.12]", border: "border-rose-300/40", glow: "rgba(251,113,133,0.45)", solid: "#fb7185" },
  amber: { text: "text-amber-200", bg: "bg-amber-400/[0.12]", border: "border-amber-300/40", glow: "rgba(251,191,36,0.4)", solid: "#fbbf24" },
};

/** Cor de uma nota /10: vermelho → âmbar → verde. */
export function scoreColor(n: number | null): string {
  if (n === null) return "rgba(255,255,255,0.25)";
  const z = zoneOf(n);
  return z === "high" ? "#34d399" : z === "mid" ? "#fbbf24" : "#fb7185";
}

export function GradeBadge({ cell, size = "md" }: { cell: GradeCell | null; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-20 w-20 text-[34px] rounded-3xl" : size === "md" ? "h-11 w-11 text-[18px] rounded-2xl" : "h-7 w-7 text-[12px] rounded-xl";
  if (!cell) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center border border-dashed border-white/15 font-bold text-white/25 ${dims}`}>
        ?
      </span>
    );
  }
  const t = TONE[cell.tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border font-black tracking-tight ${t.bg} ${t.border} ${t.text} ${dims}`}
      style={{ boxShadow: `0 10px 40px -12px ${t.glow}` }}
      title={`${cell.grade} · ${cell.decision}`}
    >
      {cell.letter}
    </span>
  );
}

export function ScoreRing({ value, max = 10, size = 120, label }: { value: number | null; max?: number; size?: number; label?: ReactNode }) {
  const stroke = Math.max(6, Math.round(size / 14));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value / max));
  const color = scoreColor(value === null ? null : (value / max) * 10);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 420ms cubic-bezier(.2,.8,.2,1), stroke 300ms" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular-nums font-black leading-none text-white" style={{ fontSize: size * 0.3 }}>
          {fmtScore(value)}
        </span>
        <span className="mt-0.5 text-white/35" style={{ fontSize: Math.max(10, size * 0.1) }}>
          {label ?? `/ ${max}`}
        </span>
      </div>
    </div>
  );
}

export function ScoreBar({ label, value, hint }: { label: ReactNode; value: number | null; hint?: ReactNode }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value * 10));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] font-medium text-white/70">{label}</span>
        <span className="tabular-nums text-[13px] font-bold" style={{ color: scoreColor(value) }}>
          {fmtScore(value)}
          <span className="ml-0.5 text-[10.5px] font-medium text-white/30">/10</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: scoreColor(value), transition: "width 420ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </div>
      {hint && <p className="mt-1 text-[11px] text-white/35">{hint}</p>}
    </div>
  );
}

const STAGE_TONE: Record<CandidateStage, string> = {
  "por-entrevistar": "border-white/15 bg-white/[0.05] text-white/60",
  "em-entrevista": "border-amber-300/35 bg-amber-400/[0.1] text-amber-200",
  entrevistado: "border-sky-300/35 bg-sky-400/[0.1] text-sky-200",
  aceite: "border-emerald-300/40 bg-emerald-400/[0.12] text-emerald-200",
  recusado: "border-rose-300/30 bg-rose-400/[0.08] text-rose-200/80",
};

export function StageChip({ stage }: { stage: CandidateStage }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${STAGE_TONE[stage]}`}>
      {stage === "em-entrevista" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />}
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function Initials({ name, size = 44 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  // Cor estável por nome.
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 60) % 360} 70% 42%))`,
        boxShadow: `0 8px 30px -10px hsl(${h} 70% 50% / 0.6)`,
      }}
    >
      {ini}
    </span>
  );
}

const ZONES: Zone[] = ["high", "mid", "low"];
const COLS: Zone[] = ["low", "mid", "high"];
const ROW_LABEL: Record<Zone, string> = { high: "Alto", mid: "Médio", low: "Baixo" };
const ROW_RANGE: Record<Zone, string> = { high: "8–10", mid: "5–7", low: "0–4" };
const COL_LABEL: Record<Zone, string> = { low: "Baixa (0–4)", mid: "Média (5–7)", high: "Alta (8–10)" };

/** A grelha D–A do guião (Fit Cultural × Capacidade Técnica), com a casa do
 *  candidato acesa. */
export function GradeMatrix({ fit, tech, compact = false }: { fit: number | null; tech: number | null; compact?: boolean }) {
  const fz = zoneOf(fit);
  const tz = zoneOf(tech);
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold text-white/45">Fit baixo = não contratar, mesmo com técnica alta</p>
      <div className="flex gap-2">
        <div className="flex w-5 items-center justify-center">
          <span className="-rotate-90 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Fit Cultural</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: compact ? "44px repeat(3, minmax(0,1fr))" : "56px repeat(3, minmax(0,1fr))" }}>
            {ZONES.map((row) => (
              <Row key={row} row={row} fz={fz} tz={tz} compact={compact} />
            ))}
            <span />
            {COLS.map((col) => (
              <span key={col} className="pt-1 text-center text-[10.5px] text-white/40">
                {COL_LABEL[col]}
              </span>
            ))}
          </div>
          <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Capacidade Técnica</p>
        </div>
      </div>
    </div>
  );
}

function Row({ row, fz, tz, compact }: { row: Zone; fz: Zone | null; tz: Zone | null; compact: boolean }) {
  return (
    <>
      <span className="flex flex-col items-end justify-center pr-1 text-right">
        <span className="text-[11.5px] font-semibold text-white/65">{ROW_LABEL[row]}</span>
        <span className="text-[10px] text-white/30">{ROW_RANGE[row]}</span>
      </span>
      {COLS.map((col) => {
        const cell = GRADE_GRID[row][col];
        const on = fz === row && tz === col;
        const t = TONE[cell.tone];
        return (
          <div
            key={col}
            className={`relative rounded-xl border px-2 text-center transition ${compact ? "py-1.5" : "py-2.5"} ${
              on ? `${t.border} ${t.bg}` : "border-white/[0.06] bg-white/[0.015] opacity-55"
            }`}
            style={on ? { boxShadow: `0 0 0 1px ${t.solid}55, 0 14px 40px -14px ${t.glow}` } : undefined}
          >
            {on && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full" style={{ background: t.solid }} />}
            <p className={`font-bold ${on ? t.text : "text-white/70"} ${compact ? "text-[11px]" : "text-[12.5px]"}`}>{cell.grade}</p>
            {!compact && <p className="mt-0.5 text-[10.5px] leading-snug text-white/45">{cell.line}</p>}
            <p className={`mt-0.5 font-semibold ${on ? "text-white/85" : "text-white/40"} ${compact ? "text-[9.5px]" : "text-[10.5px]"}`}>→ {cell.decision}</p>
          </div>
        );
      })}
    </>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/35">{children}</p>;
}
