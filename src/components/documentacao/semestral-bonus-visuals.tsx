// Os desenhos do Bónus semestral (v78.30): a escada dos quatro escalões e o
// semestre de cada um até hoje. Servidor, sem estado.

import { formatEur } from "@/lib/proposals/value";
import { SEMESTER_TIERS, tierRange, type Semester } from "@/lib/documentacao/semestral-bonus";
import type { SemesterBoard, SemesterRow } from "@/lib/documentacao/semestral-bonus-server";
import { Avatar } from "./avatar";

/** A altura de cada escalão: o bónus maior é o degrau mais alto. */
const HEIGHT = ["100%", "74%", "50%", "30%"];

/** Os quatro escalões, do melhor para o pior. `current` acende um deles. */
export function SemesterTiers({ current = null }: { current?: number | null }) {
  return (
    <figure aria-label="Os escalões do bónus semestral">
      <div className="grid h-72 grid-cols-4 items-end gap-1.5 sm:h-80 sm:gap-2">
        {SEMESTER_TIERS.map((t, i) => {
          const on = current === i;
          const best = i === 0;
          return (
            <div
              key={t.eur}
              className={`flex flex-col rounded-t-3xl rounded-b-lg p-3 sm:p-5 ${
                on || (best && current === null) ? "text-white shadow-[0_24px_70px_-28px_rgba(197,53,201,0.9)]" : "border border-b-0 border-[#783DF5]/25"
              }`}
              style={{
                height: HEIGHT[i],
                background:
                  on || (best && current === null)
                    ? "var(--brand-gradient)"
                    : t.eur === 0
                      ? "rgba(255,255,255,0.03)"
                      : `rgba(120,61,245,${0.26 - i * 0.06})`,
              }}
            >
              <p className={`text-[1.5rem] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[2.2rem] ${t.eur === 0 && !on ? "text-white/45" : "text-white"}`}>
                {formatEur(t.eur)}
              </p>
              {on && <p className="mt-1.5 text-[12px] font-semibold text-white/90">Estás aqui</p>}
              <div className="mt-auto space-y-0.5 pt-3 text-[12px] leading-snug sm:text-[13.5px]">
                <p className={on || (best && current === null) ? "text-white/90" : "text-white/70"}>
                  <span className="font-semibold">NO</span> {tierRange(i, "no")}
                </p>
                <p className={on || (best && current === null) ? "text-white/90" : "text-white/70"}>
                  <span className="font-semibold">PA</span> {tierRange(i, "pa")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

function tierIndex(row: SemesterRow): number {
  return SEMESTER_TIERS.findIndex((t) => t.eur === row.tier.eur);
}

function SemesterHead({ semester }: { semester: Semester }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-[17px] font-semibold capitalize text-white">
        {semester.label} <span className="font-normal normal-case text-white/50">· {semester.months}</span>
      </p>
      <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[12px] font-medium text-amber-200">
        A decorrer — avaliado em {semester.evaluatedIn}
      </span>
    </div>
  );
}

/** O semestre até hoje: o próprio vê-se a si; a direção vê a equipa. */
export function SemesterTracker({ board, viewAll }: { board: SemesterBoard; viewAll: boolean }) {
  const { semester, rows } = board;
  if (!viewAll) {
    const me = rows[0];
    if (!me) return null;
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-7">
        <SemesterHead semester={semester} />
        <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-5">
          <div>
            <p className="text-[13px] text-white/50">O teu bónus, se o semestre acabasse hoje</p>
            <p className="text-[3.4rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">{formatEur(me.tier.eur)}</p>
          </div>
          <div className="flex gap-8">
            <p>
              <span className="block text-[13px] text-white/50">NO</span>
              <span className="text-[2rem] font-semibold leading-none tabular-nums text-white">{me.no}</span>
            </p>
            <p>
              <span className="block text-[13px] text-white/50">PA</span>
              <span className="text-[2rem] font-semibold leading-none tabular-nums text-white">{me.pa}</span>
            </p>
          </div>
        </div>
        {me.unscored > 0 && (
          <p className="mt-4 text-[13.5px] text-[#c4a6ff]">
            {me.unscored} {me.unscored === 1 ? "ineficácia por pontuar" : "ineficácias por pontuar"} — {me.unscored === 1 ? "entra" : "entram"} nas contas quando a direção pontuar.
          </p>
        )}
        <div className="mt-7">
          <SemesterTiers current={tierIndex(me)} />
        </div>
      </section>
    );
  }

  const total = rows.reduce((s, r) => s + r.tier.eur, 0);
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-7">
      <SemesterHead semester={semester} />
      <p className="mt-5 text-[13px] text-white/50">Se o semestre acabasse hoje</p>
      <p className="text-[2.6rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">
        {formatEur(total)} <span className="text-[15px] font-medium text-white/50">a pagar à equipa</span>
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[480px] text-[14px]">
          <thead>
            <tr className="border-b border-white/10 text-left text-[12.5px] text-white/45">
              <th className="py-2.5 font-medium">Pessoa</th>
              <th className="py-2.5 text-right font-medium">NO</th>
              <th className="py-2.5 text-right font-medium">PA</th>
              <th className="py-2.5 text-right font-medium">Bónus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((r) => (
              <tr key={r.username}>
                <td className="py-3">
                  <span className="flex items-center gap-3">
                    <Avatar name={r.name} src={r.avatar} />
                    <span>
                      <span className="block font-medium text-white">{r.name}</span>
                      <span className="block text-[12px] text-white/45">
                        {r.dept}
                        {r.unscored > 0 && <span className="text-[#c4a6ff]"> · {r.unscored} por pontuar</span>}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="py-3 text-right tabular-nums text-white/80">{r.no}</td>
                <td className="py-3 text-right tabular-nums text-white/80">{r.pa}</td>
                <td className={`py-3 text-right font-semibold tabular-nums ${r.tier.eur === 0 ? "text-rose-300" : "text-white"}`}>
                  {formatEur(r.tier.eur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
