// O tracking do bónus NPS — o mês escolhido, já calculado. A direção vê a
// equipa toda; um consultor vê a sua linha e a média da equipa (o bónus dos
// colegas não é dele para ver).

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  INDIVIDUAL_TIERS,
  TEAM_TIERS,
  formatAvg,
  monthLabel,
  type ConsultantMonth,
  type NpsBonusMonth,
} from "@/lib/documentacao/nps-bonus";
import { formatLisbonDate } from "@/lib/dates";
import { formatEur } from "@/lib/proposals/value";
import { Avatar } from "./avatar";
import { ScoreScale } from "./score-scale";

function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function MonthNav({ month, prev, next, inProgress }: { month: string; prev: string | null; next: string | null; inProgress: boolean }) {
  const arrow =
    "flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-white/65 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]";
  const off = `${arrow} pointer-events-none opacity-25`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {prev ? (
        <Link href={`?mes=${prev}`} scroll={false} aria-label="Mês anterior" className={arrow}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className={off}>
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}
      <p className="min-w-[9.5rem] text-center text-[17px] font-semibold capitalize text-white">{monthLabel(month)}</p>
      {next ? (
        <Link href={`?mes=${next}`} scroll={false} aria-label="Mês seguinte" className={arrow}>
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={off}>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
      <span
        className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${
          inProgress ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-200"
        }`}
      >
        {inProgress ? "A decorrer — ainda muda" : "Mês fechado"}
      </span>
    </div>
  );
}

function ProjectList({ row }: { row: ConsultantMonth }) {
  if (row.projects.length === 0) return <p className="text-[13px] text-white/45">Sem projetos ativos.</p>;
  return (
    <ul className="grid gap-x-8 sm:grid-cols-2">
      {row.projects.map((p) => (
        <li key={p.slug} className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2 text-[13.5px]">
          <Link href={`/seo/${p.slug}/nps`} className="truncate text-white/75 hover:text-white hover:underline">
            {p.name}
          </Link>
          {p.score === null ? (
            <span className="shrink-0 text-[12.5px] text-rose-300">sem resposta</span>
          ) : (
            <span className="flex shrink-0 items-center gap-2.5">
              {p.answeredAt !== null && (
                <span
                  title={`Preenchido a ${formatLisbonDate(p.answeredAt)}`}
                  className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11.5px] tabular-nums text-white/50"
                >
                  {formatLisbonDate(p.answeredAt)}
                </span>
              )}
              <span className="font-semibold tabular-nums text-white">{p.score.toFixed(1).replace(".", ",")}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Line({ eur, reason }: { eur: number; reason: string | null }) {
  return eur > 0 ? (
    <span className="font-semibold tabular-nums text-emerald-300">{formatEur(eur)}</span>
  ) : (
    <span className="text-white/40">
      0 €{reason && <span className="block text-[11.5px] leading-tight text-white/35">{reason}</span>}
    </span>
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
  viewAll: boolean;
  username: string;
}) {
  const mine = data.consultants.find((c) => c.username === username) ?? null;
  const teamLine = `${data.teamResponses} de ${data.teamProjects} projetos responderam (${pct(data.teamFillRate)})`;
  const individualSum = data.consultants.reduce((n, c) => n + c.individual.eur, 0);
  const teamSum = data.consultants.reduce((n, c) => n + c.team.eur, 0);
  const individualCount = data.consultants.filter((c) => c.individual.eur > 0).length;
  const teamCount = data.consultants.filter((c) => c.team.eur > 0).length;
  const shell = "space-y-8 rounded-[28px] border border-white/10 bg-white/[0.025] p-5 sm:p-8";

  if (!viewAll) {
    if (!mine) {
      return (
        <div className={shell}>
          <MonthNav month={data.month} prev={prev} next={next} inProgress={inProgress} />
          <p className="text-[14px] text-white/55">Não tens carteira SEO — este bónus não se aplica a ti.</p>
        </div>
      );
    }
    const total = mine.individual.eur + mine.team.eur;
    return (
      <div className={shell}>
        <MonthNav month={data.month} prev={prev} next={next} inProgress={inProgress} />
        <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
          <div>
            <p className="text-[12.5px] text-white/50">{inProgress ? "Se o mês fechasse hoje, ganhavas" : "Ganhas"}</p>
            <p className="mt-1 text-[2.9rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-emerald-300 sm:text-[3.4rem]">
              {formatEur(total)}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-10 gap-y-3 text-[14px]">
            <div>
              <dt className="text-[12.5px] text-white/50">Individual</dt>
              <dd className="mt-0.5">
                <Line eur={mine.individual.eur} reason={mine.individual.reason} />
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-white/50">Equipa</dt>
              <dd className="mt-0.5">
                <Line eur={mine.team.eur} reason={mine.team.reason} />
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-white/50">Respostas</dt>
              <dd className="mt-0.5 tabular-nums text-white">
                {mine.filled} de {mine.projects.length} · <span className={mine.fillRate !== null && mine.fillRate < 0.5 ? "text-rose-300" : ""}>{pct(mine.fillRate)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-white/50">Média da equipa</dt>
              <dd className="mt-0.5 tabular-nums text-white">
                {formatAvg(data.teamAverage)} ·{" "}
                <span className={data.teamFillOk ? "" : "text-rose-300"}>{pct(data.teamFillRate)} de respostas</span>
              </dd>
            </div>
          </dl>
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[13.5px] font-semibold text-white">A tua média</p>
            <ScoreScale tiers={INDIVIDUAL_TIERS} marker={mine.average !== null ? { label: "Tu", value: mine.average } : null} />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-white">Média da equipa</p>
            <ScoreScale tiers={TEAM_TIERS} marker={data.teamAverage !== null ? { label: "Equipa", value: data.teamAverage } : null} />
          </div>
        </div>
        <TeamGate data={data} />
        <div className="space-y-2">
          <p className="text-[13.5px] font-semibold text-white">Os teus projetos este mês</p>
          <ProjectList row={mine} />
        </div>
        <Footnote />
      </div>
    );
  }

  return (
    <div className={shell}>
      <MonthNav month={data.month} prev={prev} next={next} inProgress={inProgress} />
      {/* Total = individuais + equipa — três números separados para o total
          nunca se ler como «o bónus de equipa». */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-6">
        <div>
          <p className="text-[12.5px] text-white/50">{inProgress ? "Total, se o mês fechasse hoje" : "Total a pagar neste mês"}</p>
          <p className="mt-1 text-[2.9rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-emerald-300 sm:text-[3.4rem]">
            {formatEur(data.totalEur)}
          </p>
          <p className="mt-1.5 text-[12.5px] text-white/45">Soma de todos os bónus</p>
        </div>
        <span aria-hidden className="pb-7 text-[1.6rem] font-light text-white/25">=</span>
        <SumPart
          label="Bónus individuais"
          eur={individualSum}
          sub={individualCount ? `${individualCount} consultor${individualCount === 1 ? "" : "es"}` : "Ninguém chegou lá"}
        />
        <span aria-hidden className="pb-7 text-[1.6rem] font-light text-white/25">+</span>
        <SumPart
          label="Bónus de equipa"
          eur={teamSum}
          sub={
            !data.teamFillOk
              ? "Equipa abaixo de 50%"
              : teamCount
                ? `${teamCount} × ${formatEur(data.teamTier?.eur ?? 0)}`
                : "Ninguém chegou lá"
          }
        />
      </div>
      <div className="border-t border-white/[0.07] pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-[13.5px] font-semibold text-white">Bónus de equipa</p>
          <p className="text-[12.5px] text-white/50">
            Média da equipa <span className="font-semibold tabular-nums text-white">{formatAvg(data.teamAverage)}</span> · {teamLine}
          </p>
        </div>
        <ScoreScale tiers={TEAM_TIERS} marker={data.teamAverage !== null ? { label: "Equipa", value: data.teamAverage } : null} />
      </div>
      <TeamGate data={data} />
      <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
        <div className="hidden grid-cols-[1fr_6rem_5rem_6rem_6rem_5rem_1rem] gap-3 py-2 text-[12px] text-white/40 md:grid">
          <span>Consultor</span>
          <span className="text-right">Respostas</span>
          <span className="text-right">Média</span>
          <span className="text-right">Individual</span>
          <span className="text-right">Equipa</span>
          <span className="text-right">Total</span>
          <span />
        </div>
        {data.consultants.map((c) => (
          <details key={c.username} className="group">
            <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto_1rem] items-center gap-3 py-3 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] md:grid-cols-[1fr_6rem_5rem_6rem_6rem_5rem_1rem]">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={c.name} src={c.avatar} size={30} />
                <span className="truncate text-[14px] font-medium text-white">{c.name}</span>
              </span>
              <span className={`hidden text-right text-[13.5px] tabular-nums md:block ${c.fillRate !== null && c.fillRate < 0.5 ? "text-rose-300" : "text-white/70"}`}>
                {c.filled}/{c.projects.length} · {pct(c.fillRate)}
              </span>
              <span className="hidden text-right text-[14px] font-semibold tabular-nums text-white md:block">{formatAvg(c.average)}</span>
              <span className="hidden text-right text-[13.5px] md:block">
                <Line eur={c.individual.eur} reason={c.individual.reason} />
              </span>
              <span className="hidden text-right text-[13.5px] md:block">
                <Line eur={c.team.eur} reason={c.team.reason} />
              </span>
              <span className="text-right text-[14px] font-semibold tabular-nums text-white">{formatEur(c.individual.eur + c.team.eur)}</span>
              <ChevronDown className="h-4 w-4 text-white/35 transition group-open:rotate-180" />
            </summary>
            <div className="space-y-3 pb-4 md:pl-[42px]">
              <p className="text-[13px] text-white/55 md:hidden">
                {c.filled}/{c.projects.length} respostas ({pct(c.fillRate)}) · média {formatAvg(c.average)} · individual{" "}
                {formatEur(c.individual.eur)} · equipa {formatEur(c.team.eur)}
              </p>
              <ProjectList row={c} />
            </div>
          </details>
        ))}
      </div>
      <Footnote />
    </div>
  );
}

function SumPart({ label, eur, sub }: { label: string; eur: number; sub: string }) {
  return (
    <div>
      <p className="text-[12.5px] text-white/50">{label}</p>
      <p className="mt-1 text-[1.9rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-white">{formatEur(eur)}</p>
      <p className="mt-1.5 text-[12.5px] text-white/45">{sub}</p>
    </div>
  );
}

/** A porta da equipa: sem 50% de respostas na equipa toda, ninguém recebe o
 *  bónus de equipa — por muito boa que seja a média. */
function TeamGate({ data }: { data: NpsBonusMonth }) {
  if (data.teamFillRate === null) return null;
  return data.teamFillOk ? (
    <p className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.06] px-4 py-3 text-[13.5px] text-emerald-50/80">
      A equipa chegou aos 50% de respostas ({pct(data.teamFillRate)}). O bónus de equipa conta para quem também lá chegou.
    </p>
  ) : (
    <p className="rounded-2xl border border-rose-300/25 bg-rose-500/[0.08] px-4 py-3 text-[13.5px] text-rose-50/85">
      <strong className="font-semibold text-rose-100">Sem bónus de equipa neste mês.</strong> A equipa ficou nos{" "}
      {pct(data.teamFillRate)} de respostas e precisa de 50% ou mais — mesmo com média {formatAvg(data.teamAverage)}.
    </p>
  );
}

function Footnote() {
  return (
    <p className="text-[12px] leading-relaxed text-white/40">
      Carteira = clientes SEO ativos atribuídos hoje; pausados e terminados não contam. A nota de cada projeto é o Índice de
      satisfação da última resposta NPS do mês.
    </p>
  );
}
