// A régua das notas — de onde começa o bónus até ao 10, com o € de cada
// faixa e, quando há, onde está a média. O 10,00 é um degrau à parte: é o
// único valor exato da régua, e é o que paga mais.

import type { BonusTier } from "@/lib/documentacao/nps-bonus";
import { formatEur } from "@/lib/proposals/value";

const two = (n: number) => n.toFixed(2).replace(".", ",");

type Segment = { from: number; to: number | null; eur: number; grow: number };

function segments(tiers: BonusTier[]): Segment[] {
  const up = [...tiers].reverse();
  const below: Segment = { from: up[0].min - 0.5, to: up[0].min, eur: 0, grow: 1 };
  return [
    below,
    ...up.map((t, i) => {
      const next = up[i + 1];
      return { from: t.min, to: next ? next.min : null, eur: t.eur, grow: next ? Math.max(1, (next.min - t.min) / 0.5) : 0.9 };
    }),
  ];
}

function label(s: Segment, i: number): string {
  if (i === 0) return `< ${two(s.to!)}`;
  if (s.to === null) return two(s.from);
  return `${two(s.from)}–${two(s.to - 0.01)}`;
}

export function ScoreScale({
  tiers,
  marker,
}: {
  tiers: BonusTier[];
  /** A média a marcar na régua, ou null. */
  marker?: { label: string; value: number } | null;
}) {
  const segs = segments(tiers);
  const total = segs.reduce((n, s) => n + s.grow, 0);
  const top = segs.length - 1;

  // Posição do marcador em % da largura total.
  let markerPct: number | null = null;
  if (marker) {
    let acc = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const inside = s.to === null ? marker.value >= s.from : marker.value >= s.from && marker.value < s.to;
      const belowAll = i === 0 && marker.value < s.from;
      if (inside || belowAll) {
        const frac = s.to === null ? 0.5 : belowAll ? 0 : (marker.value - s.from) / (s.to - s.from);
        markerPct = ((acc + frac * s.grow) / total) * 100;
        break;
      }
      acc += s.grow;
    }
  }

  return (
    <div className="pt-8">
      <div className="relative">
        {markerPct !== null && marker && (
          <div className="absolute -top-8 z-10 -translate-x-1/2" style={{ left: `${markerPct}%` }}>
            <span className="block whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-[#07080d]">
              {marker.label} {two(marker.value)}
            </span>
            <span aria-hidden className="mx-auto block h-3 w-px bg-white" />
          </div>
        )}
        <div className="flex gap-1">
          {segs.map((s, i) => {
            const isTop = i === top;
            return (
              <div key={i} className="min-w-0" style={{ flexGrow: s.grow, flexBasis: 0 }}>
                <div
                  className={`h-3 rounded-full ${i === 0 ? "bg-white/[0.08]" : isTop ? "" : "bg-[#783DF5]"}`}
                  style={{
                    background: isTop ? "var(--brand-gradient)" : undefined,
                    opacity: i === 0 || isTop ? 1 : 0.35 + (i / top) * 0.55,
                  }}
                />
                <p className={`mt-2.5 truncate text-[15px] font-semibold tabular-nums sm:text-[17px] ${s.eur ? "text-white" : "text-white/35"}`}>
                  {formatEur(s.eur)}
                </p>
                <p className="truncate text-[11.5px] tabular-nums text-white/45">{label(s, i)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
