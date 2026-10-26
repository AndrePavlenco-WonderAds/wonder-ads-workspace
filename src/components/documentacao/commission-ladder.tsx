// A escada dos patamares — o desenho que explica as comissões de um relance.
//
// Quatro degraus da mesma largura: cada patamar ocupa 25.000 € de acumulado,
// por isso a régua de baixo é linear e os retratos ficam onde a pessoa está.
// A faixa de baixo é a renovação: sempre 3%, seja qual for o degrau.

import { COMMISSION_TIERS, RENEWAL_RATE, formatRate } from "@/lib/documentacao/commissions";
import { Avatar } from "./avatar";

const STEP = COMMISSION_TIERS[1].from; // 25.000 €
const SCALE = STEP * COMMISSION_TIERS.length; // 100.000 € — o fim da régua
const MAX_RATE = COMMISSION_TIERS[COMMISSION_TIERS.length - 1].rate;

export type LadderPin = { key: string; name: string; avatar: string | null; accumulated: number };

function k(n: number): string {
  return n === 0 ? "0 €" : `${n / 1000}k €`;
}

export function CommissionLadder({ pins, current }: { pins: LadderPin[]; current: number | null }) {
  // Retratos que caem no mesmo sítio da régua juntam-se num só grupo.
  const groups = new Map<number, LadderPin[]>();
  for (const p of pins) {
    const pct = Math.round((Math.min(p.accumulated, SCALE) / SCALE) * 50) * 2;
    groups.set(pct, [...(groups.get(pct) ?? []), p]);
  }

  return (
    <figure aria-label="Patamares de comissão" className="select-none">
      <div>
        {/* Degraus */}
        <div className="grid h-44 grid-cols-4 items-end gap-1.5 sm:h-52 sm:gap-2">
          {COMMISSION_TIERS.map((t) => {
            const on = current === t.n;
            return (
              <div
                key={t.n}
                className={`relative flex flex-col justify-between rounded-t-2xl px-3 pb-3 pt-3 sm:px-4 ${
                  on ? "text-white shadow-[0_20px_60px_-24px_rgba(120,61,245,0.9)]" : "border border-b-0 border-white/[0.08] bg-white/[0.035] text-white/70"
                }`}
                style={{
                  height: `${40 + (t.rate / MAX_RATE) * 60}%`,
                  background: on ? "var(--brand-gradient)" : undefined,
                }}
              >
                <span className={`text-[2rem] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[2.6rem] ${on ? "" : "text-white/85"}`}>
                  {formatRate(t.rate)}
                </span>
                <span className={`text-[12px] ${on ? "text-white/85" : "text-white/40"}`}>
                  Patamar {t.n}
                  {on && <span className="hidden sm:inline"> · estás aqui</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Régua do acumulado */}
      <div className="h-px bg-white/25" />
      <div className="relative mt-1.5 grid grid-cols-4 text-[11.5px] text-white/40">
        {COMMISSION_TIERS.map((t) => (
          <span key={t.n}>{t.to === null ? `${k(t.from)} +` : k(t.from)}</span>
        ))}
      </div>
      {pins.length > 0 && (
        <div className="relative mt-3 h-9">
          {Array.from(groups.entries()).map(([pct, group]) => (
            <div
              key={pct}
              className="absolute top-0 flex items-center"
              style={{ left: `${pct}%`, transform: pct > 85 ? "translateX(-100%)" : undefined }}
              title={group.map((g) => g.name).join(", ")}
            >
              <span aria-hidden className="absolute -top-3 left-3.5 h-3 w-px bg-white/40" />
              <span className="flex -space-x-2">
                {group.map((g) => (
                  <Avatar key={g.key} name={g.name} src={g.avatar} size={28} ring />
                ))}
              </span>
              {group.length === 1 && <span className="ml-2 whitespace-nowrap text-[12px] text-white/70">{group[0].name}</span>}
            </div>
          ))}
        </div>
      )}
      {/* Renovação: sempre 3% */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.06] px-4 py-2.5">
        <span className="text-[1.35rem] font-semibold leading-none tracking-[-0.03em] text-emerald-200 tabular-nums">
          {formatRate(RENEWAL_RATE)}
        </span>
        <span className="text-[13px] leading-snug text-emerald-50/75">
          Renovações pagam sempre {formatRate(RENEWAL_RATE)}, em qualquer patamar — e contam para subir.
        </span>
      </div>
      <figcaption className="sr-only">
        Patamar 1 até 25.000 € de acumulado (5%), patamar 2 até 50.000 € (6%), patamar 3 até 75.000 € (7%), patamar 4
        acima de 75.000 € (8%). Renovações pagam sempre 3%.
      </figcaption>
    </figure>
  );
}
