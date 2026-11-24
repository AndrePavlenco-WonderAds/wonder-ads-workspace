// «Porquê N pontos» (v80.45) — as parcelas da calculadora como o consultor
// as lê: a gravidade de partida, o que soma ou tira, o limite da escala e o
// ajuste da direção, até à pontuação final. Só aparece nas ocorrências em
// que a direção escolheu mostrar o cálculo. Puro (server-safe): serve o
// painel do consultor e a pré-visualização da direção (`compact`).

import type { CalcBreakdown } from "@/lib/ineficacias/shared";

function signed(v: number): string {
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return "±0";
}

function tone(v: number): string {
  return v > 0 ? "text-rose-300" : v < 0 ? "text-emerald-300" : "text-white/40";
}

/** As linhas pela ordem da soma: a base, as parcelas, o limite e o ajuste. */
function rows(b: CalcBreakdown): { label: string; value: number; base?: boolean; muted?: boolean }[] {
  const out: { label: string; value: number; base?: boolean; muted?: boolean }[] = b.lines.map((l) =>
    l.base ? { label: `Gravidade: ${l.label.charAt(0).toLowerCase()}${l.label.slice(1)}`, value: l.value, base: true } : l,
  );
  if (b.clamp !== 0) out.push({ label: "Limite da escala (de 1 a 10)", value: b.clamp, muted: true });
  if (b.adjust !== 0) out.push({ label: "Ajuste da direção", value: b.adjust });
  return out;
}

export function CalcBreakdownView({ breakdown, compact = false }: { breakdown: CalcBreakdown; compact?: boolean }) {
  const list = rows(breakdown);
  const pts = (n: number) => `${n} ${n === 1 ? "ponto" : "pontos"}`;

  if (compact) {
    return (
      <p className="text-[11px] leading-relaxed text-white/55">
        {list.map((r, i) => (
          <span key={i}>
            {i > 0 && <span className="text-white/25"> · </span>}
            {r.label} <span className={`tabular font-bold ${r.base ? "text-white/80" : tone(r.value)}`}>{r.base ? r.value : signed(r.value)}</span>
          </span>
        ))}
        <span className="text-white/25"> = </span>
        <span className="font-bold text-white">{pts(breakdown.total)}</span>
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[#783DF5]/25 bg-[#783DF5]/[0.06]">
      <ul className="divide-y divide-white/[0.05] px-3.5 py-1">
        {list.map((r, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 text-[12.5px]">
            <span className={r.base ? "font-semibold text-white/85" : r.muted ? "text-white/45" : "text-white/65"}>{r.label}</span>
            <span className={`tabular shrink-0 font-bold ${r.base ? "text-white/85" : tone(r.value)}`}>
              {r.base ? r.value : signed(r.value)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.08] px-3.5 py-2">
        <span className="text-[12px] font-semibold text-white/60">Total</span>
        <span className="tabular text-[14px] font-bold text-white">{pts(breakdown.total)}</span>
      </div>
      {breakdown.neutral.length > 0 && (
        <p className="border-t border-white/[0.05] px-3.5 py-2 text-[11px] leading-relaxed text-white/40">
          Não mexeram na pontuação: {breakdown.neutral.map((n) => n.charAt(0).toLowerCase() + n.slice(1)).join(" · ")}.
        </p>
      )}
    </div>
  );
}
