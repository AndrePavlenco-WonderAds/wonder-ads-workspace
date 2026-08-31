// Quadro de metas: os indicadores agrupados por tema, cada linha com o
// valor de hoje → meta de novembro → meta de fevereiro. Cor só nas metas
// (lilás claro para T1, gradiente para T2); os valores vestem tinta normal.

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "./proposal-motion";
import { BRAND_GRADIENT } from "./proposal-primitives";

export type KpiRow = { label: string; baseline: string; t1: string; t2: string; accent?: boolean };
export type KpiGroup = { title: string; Icon: LucideIcon; rows: KpiRow[] };

function Cell({ children, tone }: { children: ReactNode; tone: "base" | "t1" | "t2" }) {
  if (tone === "t2") {
    return (
      <span
        className="inline-flex min-w-[88px] items-center justify-center rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-white"
        style={{ background: BRAND_GRADIENT }}
      >
        {children}
      </span>
    );
  }
  if (tone === "t1") {
    return (
      <span className="inline-flex min-w-[88px] items-center justify-center rounded-lg bg-[#ede9fe] px-2.5 py-1.5 text-[13px] font-semibold text-[#4c1d95]">
        {children}
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-[88px] items-center justify-center rounded-lg bg-black/[0.05] px-2.5 py-1.5 text-[13px] font-medium text-black/65">
      {children}
    </span>
  );
}

export function KpiBoard({ groups }: { groups: KpiGroup[] }) {
  return (
    <div className="space-y-4">
      <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr] gap-3 px-5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-black/45 sm:grid">
        <span>Indicador</span>
        <span className="text-center">Hoje · ago 2026</span>
        <span className="text-center">Meta · nov 2026</span>
        <span className="text-center text-[#5b21b6]">Meta · fev 2027</span>
      </div>
      {groups.map((g, gi) => (
        <Reveal key={g.title} delay={gi * 60}>
          <div className="overflow-hidden rounded-2xl border border-black/8 bg-white">
            <div className="flex items-center gap-2 border-b border-black/6 bg-black/[0.02] px-5 py-2.5">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white"
                style={{ background: BRAND_GRADIENT }}
              >
                <g.Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/65">
                {g.title}
              </span>
            </div>
            <ul>
              {g.rows.map((r) => (
                <li
                  key={r.label}
                  className={`grid grid-cols-1 gap-2 px-5 py-3 sm:grid-cols-[1.6fr_1fr_1fr_1fr] sm:items-center sm:gap-3 ${r.accent ? "bg-[#f5f0ff]" : ""} border-b border-black/5 last:border-b-0`}
                >
                  <span className={`text-[13.5px] ${r.accent ? "font-bold text-black/90" : "text-black/78"}`}>
                    {r.label}
                  </span>
                  <div className="flex items-center gap-2 sm:contents">
                    <div className="sm:text-center"><Cell tone="base">{r.baseline}</Cell></div>
                    <span className="text-black/30 sm:hidden">→</span>
                    <div className="sm:text-center"><Cell tone="t1">{r.t1}</Cell></div>
                    <span className="text-black/30 sm:hidden">→</span>
                    <div className="sm:text-center"><Cell tone="t2">{r.t2}</Cell></div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
