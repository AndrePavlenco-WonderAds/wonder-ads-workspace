// O tracking do bónus NPS — o mês escolhido, já calculado. A direção vê a
// equipa toda; um consultor vê a sua linha e a média da equipa (o bónus dos
// colegas não é dele para ver).

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatAvg,
  monthLabel,
  type ConsultantMonth,
  type NpsBonusMonth,
} from "@/lib/playbook/nps-bonus";
import { formatEur } from "@/lib/proposals/value";

function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function MonthNav({
  month,
  prev,
  next,
  inProgress,
}: {
  month: string;
  prev: string | null;
  next: string | null;
  inProgress: boolean;
}) {
  const arrow =
    "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/25 hover:text-white";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        {prev ? (
          <Link href={`?mes=${prev}`} scroll={false} aria-label="Mês anterior" className={arrow}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className={`${arrow} pointer-events-none opacity-30`}>
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}
        <p className="min-w-[9.5rem] text-center text-[15px] font-semibold capitalize text-white">{monthLabel(month)}</p>
        {next ? (
          <Link href={`?mes=${next}`} scroll={false} aria-label="Mês seguinte" className={arrow}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={`${arrow} pointer-events-none opacity-30`}>
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
      <span
        className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
          inProgress
            ? "border border-amber-400/40 bg-amber-400/10 text-amber-200"
            : "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
        }`}
      >
        {inProgress ? "A decorrer — ainda pode mudar" : "Fechado"}
      </span>
    </div>
  );
}

function Money({ eur, reason }: { eur: number; reason: string | null }) {
  if (eur > 0) return <span className="font-semibold text-emerald-300">{formatEur(eur)}</span>;
  return (
    <span className="text-white/40" title={reason ?? undefined}>
      0 €{reason && <span className="block text-[10.5px] leading-tight text-white/35">{reason}</span>}
    </span>
  );
}

function ProjectList({ row }: { row: ConsultantMonth }) {
  if (row.projects.length === 0) return <p className="text-[12px] text-white/40">Sem projetos ativos.</p>;
  return (
    <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
      {row.projects.map((p) => (
        <li key={p.slug} className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-1.5 text-[12.5px]">
          <Link href={`/seo/${p.slug}/nps`} className="truncate text-white/70 hover:text-white">
            {p.name}
          </Link>
          {p.score === null ? (
            <span className="shrink-0 text-[11px] text-rose-300/80">sem resposta</span>
          ) : (
            <span className="shrink-0 font-mono text-[12px] text-white">{p.score.toFixed(1).replace(".", ",")}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/45">{sub}</p>}
    </div>
  );
}

export function NpsBonusTracker({
  data,
  prev,
  next,
  inProgress,
  viewAll,
  username,
}: {
  data: NpsBonusMonth;
  prev: string | null;
  next: string | null;
  inProgress: boolean;
  /** Direção: a equipa toda. Consultor: só a sua linha. */
  viewAll: boolean;
  username: string;
}) {
  const mine = data.consultants.find((c) => c.username === username) ?? null;
  const teamLine = `${data.teamResponses} de ${data.teamProjects} projetos responderam`;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <MonthNav month={data.month} prev={prev} next={next} inProgress={inProgress} />

      {viewAll ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Média da equipa" value={formatAvg(data.teamAverage)} sub={teamLine} />
            <Stat
              label="Bónus de equipa"
              value={data.teamTier ? formatEur(data.teamTier.eur) : "0 €"}
              sub="por consultor elegível"
            />
            <Stat label="Total a pagar" value={formatEur(data.totalEur)} sub="individual + equipa" />
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[44rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  <th className="px-4 py-2.5">Consultor</th>
                  <th className="px-3 py-2.5">Respostas</th>
                  <th className="px-3 py-2.5">Taxa</th>
                  <th className="px-3 py-2.5">Média</th>
                  <th className="px-3 py-2.5">Individual</th>
                  <th className="px-3 py-2.5">Equipa</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
              {data.consultants.map((c) => (
                  <tr key={c.username} className="border-b border-white/[0.06] align-top last:border-b-0">
                    <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                    <td className="px-3 py-3 text-white/70">
                      {c.filled}/{c.projects.length}
                    </td>
                    <td className={`px-3 py-3 ${c.fillRate !== null && c.fillRate < 0.5 ? "text-rose-300" : "text-white/70"}`}>
                      {pct(c.fillRate)}
                    </td>
                    <td className="px-3 py-3 font-mono text-white">{formatAvg(c.average)}</td>
                    <td className="px-3 py-3">
                      <Money eur={c.individual.eur} reason={c.individual.reason} />
                    </td>
                    <td className="px-3 py-3">
                      <Money eur={c.team.eur} reason={c.team.reason} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">
                      {formatEur(c.individual.eur + c.team.eur)}
                    </td>
                  </tr>
              ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-2">
            {data.consultants.map((c) => (
              <details key={c.username} className="group rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[12.5px] text-white/70 marker:hidden">
                  <span>
                    Projetos de <span className="font-medium text-white">{c.name}</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-white/35 transition group-open:rotate-90" />
                </summary>
                <div className="mt-3">
                  <ProjectList row={c} />
                </div>
              </details>
            ))}
          </div>
        </>
      ) : mine ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="A tua média"
              value={formatAvg(mine.average)}
              sub={`${mine.filled} de ${mine.projects.length} projetos · ${pct(mine.fillRate)}`}
            />
            <Stat label="Média da equipa" value={formatAvg(data.teamAverage)} sub={teamLine} />
            <Stat
              label="Bónus individual"
              value={formatEur(mine.individual.eur)}
              sub={mine.individual.reason ?? "Elegível"}
            />
            <Stat label="Bónus de equipa" value={formatEur(mine.team.eur)} sub={mine.team.reason ?? "Elegível"} />
          </div>
          <div className="mt-5">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/40">Os teus projetos</p>
            <ProjectList row={mine} />
          </div>
        </>
      ) : (
        <p className="mt-5 text-[13px] text-white/50">Não tens carteira SEO — este bónus não se aplica a ti.</p>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-white/35">
        Carteira = clientes SEO ativos atribuídos hoje (pausados e terminados não contam). Nota de cada projeto = Índice de
        satisfação da última resposta NPS do mês.
      </p>
    </div>
  );
}
