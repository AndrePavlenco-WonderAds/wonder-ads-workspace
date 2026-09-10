// Pódio do Comercial — quem mais fechou, por valor (v77.24).
//
// Três degraus (2.º · 1.º · 3.º, como um pódio a sério; no telemóvel ficam
// por ordem) e, por baixo, a classificação completa. A ordem é a do
// leaderboard: valor fechado → n.º de fechos → n.º de apresentadas. Sem
// interatividade — o período troca-se por link (?periodo=tudo), o resto é
// só desenho, por isso fica componente de servidor.

import Link from "next/link";
import { AlertTriangle, FileSignature, Sparkles, Trophy } from "lucide-react";
import {
  closedCount,
  presentedCount,
  type Leaderboard,
  type LeaderboardRow,
} from "@/lib/proposals/leaderboard";
import { formatEur } from "@/lib/proposals/value";

type Place = 1 | 2 | 3;

const PLACES: Record<
  Place,
  { title: string; badge: string; ring: string; glow: string; tint: string; text: string }
> = {
  1: {
    title: "1.º lugar",
    badge: "linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)",
    ring: "#FBBF24",
    glow: "rgba(251, 191, 36, 0.45)",
    tint: "rgba(251, 191, 36, 0.11)",
    text: "text-amber-200",
  },
  2: {
    title: "2.º lugar",
    badge: "linear-gradient(135deg, #F8FAFC 0%, #94A3B8 100%)",
    ring: "#CBD5E1",
    glow: "rgba(203, 213, 225, 0.35)",
    tint: "rgba(203, 213, 225, 0.07)",
    text: "text-slate-200",
  },
  3: {
    title: "3.º lugar",
    badge: "linear-gradient(135deg, #FDBA74 0%, #C2410C 100%)",
    ring: "#FB923C",
    glow: "rgba(251, 146, 60, 0.4)",
    tint: "rgba(251, 146, 60, 0.08)",
    text: "text-orange-200",
  },
};

function rate(r: LeaderboardRow): string {
  return r.closeRate === null ? "—" : `${Math.round(r.closeRate * 100)}%`;
}

function Avatar({ row, size, ring, glow }: { row: LeaderboardRow; size: number; ring: string; glow: string }) {
  const initial = row.name.trim().charAt(0).toUpperCase() || "?";
  const style = { width: size, height: size, boxShadow: `0 0 0 3px ${ring}, 0 14px 40px -12px ${glow}` };
  return row.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.avatar} alt="" className="rounded-full object-cover object-[50%_35%]" style={style} />
  ) : (
    <span
      className="brand-gradient-bg flex items-center justify-center rounded-full text-xl font-bold text-white"
      style={style}
    >
      {initial}
    </span>
  );
}

function Mini({
  icon: Icon,
  label,
  closed,
  presented,
}: {
  icon: typeof Sparkles;
  label: string;
  closed: number;
  presented: number;
}) {
  return (
    <div
      className="rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-2 text-left"
      title={`${label}: ${closed} fechada${closed === 1 ? "" : "s"} de ${presented} apresentada${presented === 1 ? "" : "s"}`}
    >
      <p className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/40">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-1 text-[15px] font-bold leading-none tabular-nums text-white">
        {closed}
        <span className="text-[11px] font-medium text-white/35"> / {presented}</span>
      </p>
    </div>
  );
}

function Step({ row, place }: { row: LeaderboardRow | null; place: Place }) {
  const P = PLACES[place];
  const order = place === 1 ? "order-1 sm:order-2" : place === 2 ? "order-2 sm:order-1" : "order-3";
  const lift = place === 1 ? "sm:pb-10 sm:pt-9" : place === 2 ? "sm:pb-7 sm:pt-7" : "sm:pb-5 sm:pt-6";
  if (!row) {
    return (
      <div
        className={`${order} flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] text-[12px] text-white/35 ${lift}`}
      >
        {P.title} · por ocupar
      </div>
    );
  }
  return (
    <div
      className={`${order} relative overflow-hidden rounded-2xl border border-white/10 p-5 ${lift}`}
      style={{
        background: `linear-gradient(180deg, ${P.tint} 0%, rgba(255,255,255,0.025) 100%)`,
        boxShadow: place === 1 ? `0 30px 80px -34px ${P.glow}` : undefined,
      }}
    >
      {/* Numeral gigante em marca de água — lê-se o lugar de longe. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1 -top-5 select-none text-[128px] font-black leading-none text-white/[0.045]"
      >
        {place}
      </span>
      <div className="relative flex flex-col items-center text-center">
        <div className="relative">
          <Avatar row={row} size={place === 1 ? 76 : 62} ring={P.ring} glow={P.glow} />
          <span
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-black/85 shadow-md"
            style={{ background: P.badge }}
          >
            {place}.º
          </span>
        </div>
        <p className="mt-5 text-[15px] font-semibold text-white">{row.name}</p>
        <p className="text-[11px] text-white/45">{row.role ?? "Consultor"}</p>
        <p className={`mt-4 text-[28px] font-bold leading-none tabular-nums tracking-tight sm:text-[32px] ${P.text}`}>
          {formatEur(row.closedValue)}
        </p>
        <p className="mt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-white/40">
          fechado · confirmado pelo cliente
        </p>
        <div className="mt-4 grid w-full grid-cols-2 gap-2">
          <Mini icon={FileSignature} label="Renovações" closed={row.closedRenovacoes} presented={row.presentedRenovacoes} />
          <Mini icon={Sparkles} label="Cross-sells" closed={row.closedCrossSells} presented={row.presentedCrossSells} />
        </div>
        <p className="mt-3 text-[11px] text-white/45">
          Apresentado {formatEur(row.presentedValue)} · fecho {rate(row)}
        </p>
        {row.closedWithoutValue > 0 && (
          <p className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-amber-200/80">
            <AlertTriangle className="h-3 w-3" />
            {row.closedWithoutValue} fechada{row.closedWithoutValue === 1 ? "" : "s"} sem valor
          </p>
        )}
      </div>
    </div>
  );
}

export function CommercialPodium({
  board,
  hasAnyProposals,
}: {
  board: Leaderboard;
  /** Há propostas de todo (para distinguir «nada este ano» de «nada»). */
  hasAnyProposals: boolean;
}) {
  const thisYear = new Date().getFullYear();
  const periodLabel = board.year === null ? "desde sempre" : String(board.year);
  const [first, second, third] = board.rows;

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
      active
        ? "border-[#783DF5]/60 bg-[#783DF5]/20 text-white"
        : "border-white/12 bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white"
    }`;

  return (
    <section id="podio" className="animate-fade-up mt-10 scroll-mt-8 sm:mt-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
            <Trophy className="h-3.5 w-3.5 text-amber-300" />
            Leaderboard · {periodLabel}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Pódio comercial</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/commercial" scroll={false} className={pill(board.year !== null)} aria-current={board.year !== null ? "page" : undefined}>
            {thisYear}
          </Link>
          <Link href="/commercial?periodo=tudo" scroll={false} className={pill(board.year === null)} aria-current={board.year === null ? "page" : undefined}>
            Desde sempre
          </Link>
        </div>
      </div>

      {board.rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-white/50">
          {hasAnyProposals && board.year !== null ? (
            <>
              Ainda não há propostas apresentadas em {board.year}.{" "}
              <Link href="/commercial?periodo=tudo" className="text-white underline-offset-2 hover:underline">
                Ver desde sempre
              </Link>
              .
            </>
          ) : (
            "O pódio enche-se à medida que as propostas são apresentadas e fechadas."
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <Step row={second ?? null} place={2} />
            <Step row={first ?? null} place={1} />
            <Step row={third ?? null} place={3} />
          </div>

          <p className="mt-4 text-[11.5px] leading-relaxed text-white/40">
            Ordem: <span className="text-white/65">valor fechado</span> (confirmado pelo cliente) → n.º de fechos → n.º de
            apresentadas. Um cross-sell de 5.000 € vale mais do que um de 700 €. Cada célula «fechadas / apresentadas»
            conta por tipo. Valores sem IVA.
            {board.totals.closedWithoutValue > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 text-amber-200/85">
                <AlertTriangle className="h-3 w-3" />
                {board.totals.closedWithoutValue} proposta{board.totals.closedWithoutValue === 1 ? "" : "s"} fechada
                {board.totals.closedWithoutValue === 1 ? "" : "s"} sem valor — edita o valor no cartão para contar.
              </span>
            )}
          </p>

          {/* Classificação completa — também os que não subiram ao pódio. */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025]">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/8 text-[10px] uppercase tracking-[0.16em] text-white/40">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Consultor</th>
                  <th className="px-4 py-3 text-right font-semibold">Fechado</th>
                  <th className="px-4 py-3 text-right font-semibold">Apresentado</th>
                  <th className="px-4 py-3 text-right font-semibold">Renovações</th>
                  <th className="px-4 py-3 text-right font-semibold">Cross-sells</th>
                  <th className="px-4 py-3 text-right font-semibold">Fecho</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((r, i) => {
                  const place = (i + 1) as number;
                  const P = place <= 3 ? PLACES[place as Place] : null;
                  return (
                    <tr key={r.key} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3">
                        {P ? (
                          <span
                            className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold text-black/85"
                            style={{ background: P.badge }}
                          >
                            {place}
                          </span>
                        ) : (
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-white/10 px-1.5 text-[11px] font-semibold text-white/55">
                            {place}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {r.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full border border-white/15 object-cover object-[50%_35%]" />
                          ) : (
                            <span className="brand-gradient-bg flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white">
                              {r.name.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                          )}
                          <div className="min-w-0 leading-tight">
                            <p className="truncate font-semibold text-white">{r.name}</p>
                            <p className="truncate text-[11px] text-white/45">{r.role ?? "Consultor"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-white">{formatEur(r.closedValue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-white/70">{formatEur(r.presentedValue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-white/85">
                        {r.closedRenovacoes}
                        <span className="text-white/35"> / {r.presentedRenovacoes}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-white/85">
                        {r.closedCrossSells}
                        <span className="text-white/35"> / {r.presentedCrossSells}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-white/70">
                        {rate(r)}
                        <span className="text-white/30"> · {closedCount(r)}/{presentedCount(r)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
