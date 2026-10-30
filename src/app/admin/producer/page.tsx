// Direção → Producer of the Month (v78.58): o levantamento de um mês fechado
// do SEO DPT (NPS, blocos do roadmap, cross-sells/upsells, renovações e
// ineficácias) e a eleição do pódio. A tabela ordena pela pontuação de
// referência; quem ganha é a direção que decide. Só SuperAdmin: a página
// verifica isAdmin ANTES de ler o KV (o layout de /admin sozinho não chega).

import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ProducerElectForm } from "@/components/producer/elect-form";
import { getCurrentEmployee } from "@/lib/auth/server";
import { formatDate, lisbonMonthKey } from "@/lib/dates";
import { buildProducerSurvey } from "@/lib/producer/server";
import {
  PRODUCER_WEIGHTS as W,
  electableMonths,
  producerMonthLabel,
  producerMonthName,
  type ProducerRow,
} from "@/lib/producer/shared";
import { getElection } from "@/lib/producer/store";
import { formatEur } from "@/lib/proposals/value";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export const metadata = {
  title: "Producer of the Month — SuperAdmin Control Suite",
};

const MEDAL = ["🥇", "🥈", "🥉"];

function avg(n: number | null): string {
  return n === null ? "—" : n.toFixed(2).replace(".", ",");
}

function pts(n: number): string {
  const s = Math.abs(n).toLocaleString("pt-PT", { maximumFractionDigits: 1 });
  return n < 0 ? `−${s}` : s;
}

export default async function ProducerPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const employee = await getCurrentEmployee();
  if (!employee?.isAdmin) return null;

  const months = electableMonths(lisbonMonthKey(Date.now()));
  const asked = (await searchParams).mes;
  const month = asked && months.includes(asked) ? asked : months[0];
  if (!month) return null;

  const [rows, election] = await Promise.all([buildProducerSurvey(month), getElection(month)]);
  const placeOf = new Map((election?.podium ?? []).map((p, i) => [p.username, i]));

  return (
    <PageShell>
      <Link href="/admin" className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Control Suite
      </Link>

      <header className="animate-fade-up mt-2">
        <p className="readout text-white/35">Operações · SEO DPT · Direção</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">Producer of the Month</span>
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] leading-relaxed text-white/50">
          O levantamento de cada mês fechado: NPS, blocos do roadmap concluídos, cross-sells e upsells, renovações e, a
          tirar, as ineficácias. A tabela ordena pela pontuação de referência, mas a app não escolhe ninguém — o pódio é
          a direção que elege.
        </p>
      </header>

      <nav className="animate-fade-up mt-6 flex flex-wrap gap-1.5" aria-label="Mês">
        {months.map((m) => (
          <Link
            key={m}
            href={`/admin/producer?mes=${m}`}
            aria-current={m === month ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${
              m === month
                ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white"
            }`}
          >
            {producerMonthLabel(m)}
          </Link>
        ))}
      </nav>

      <div className="animate-fade-up mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          {election && (
            <div className="mb-4 rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-300/[0.09] to-transparent p-4">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
                <Trophy className="h-4 w-4 text-amber-300" />
                {election.podium[0].name} é o Producer of the Month de {producerMonthLabel(month)}
              </p>
              <p className="mt-1 text-[12px] text-white/45">
                {election.podium.map((p, i) => `${MEDAL[i]} ${p.name}`).join("   ")} · eleito a {formatDate(election.electedAt)} por{" "}
                {election.electedByName || election.electedBy}
              </p>
              {election.note && <p className="mt-1.5 whitespace-pre-line text-[12.5px] italic text-white/60">{election.note}</p>}
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] font-semibold text-white/40">
                  <th className="px-4 py-3">Consultor</th>
                  <th className="px-3 py-3 text-right">NPS</th>
                  <th className="px-3 py-3 text-right">Blocos</th>
                  <th className="px-3 py-3 text-right">Cross/upsell</th>
                  <th className="px-3 py-3 text-right">Renovações</th>
                  <th className="px-3 py-3 text-right">Ineficácias</th>
                  <th className="px-4 py-3 text-right">Pontuação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Row key={r.username} row={r} place={placeOf.get(r.username) ?? null} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-[12.5px] leading-relaxed text-white/55">
            <p className="font-semibold text-white/80">Como se calcula a pontuação de referência</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              <li>
                NPS: a média do mês × {W.npsPerPoint} (9,50 dá {9.5 * W.npsPerPoint}); sem respostas, 0. É a mesma média
                do Bónus NPS, com a carteira de hoje.
              </li>
              <li>Blocos do roadmap: {W.perBlock} por cada tarefa marcada como feita no mês, nos roadmaps dos clientes de cada um.</li>
              <li>
                Cross-sells e upsells: {W.perCrossSell} por cada um fechado no mês. Renovações: {W.perRenewal} por cada uma.
              </li>
              <li>Ineficácias: menos {W.perIneficaciaPoint} por cada ponto de PA das ineficácias pontuadas com data no mês.</li>
            </ul>
            <p className="mt-1.5 text-white/40">
              Os números mexem enquanto houver respostas, decisões ou pontuações por lançar; a eleição guarda o
              levantamento do dia em que é feita.
            </p>
          </div>
        </section>

        <aside>
          <ProducerElectForm
            key={`${month}-${election?.electedAt ?? 0}`}
            month={month}
            monthLabel={producerMonthName(month).toLowerCase()}
            people={rows.map((r) => ({ username: r.username, name: r.name }))}
            current={election ? { podium: election.podium.map((p) => p.username), note: election.note } : null}
          />
        </aside>
      </div>
    </PageShell>
  );
}

function Row({ row: r, place }: { row: ProducerRow; place: number | null }) {
  return (
    <tr className={`border-b border-white/[0.05] last:border-0 ${place === 0 ? "bg-amber-300/[0.06]" : ""}`}>
      <td className="px-4 py-3">
        <span className="flex items-center gap-2.5">
          {r.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.avatar} alt="" className="h-8 w-8 rounded-full border border-white/10 object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-[12px] font-bold text-white/60">
              {r.name.charAt(0)}
            </span>
          )}
          <span className="font-medium text-white">{r.name}</span>
          {place !== null && <span aria-label={`${place + 1}.º lugar`}>{MEDAL[place]}</span>}
        </span>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        <span className="font-semibold text-white">{avg(r.nps.average)}</span>
        <span className="block text-[11px] text-white/40">
          {r.nps.answered}/{r.nps.projects} respostas
        </span>
      </td>
      <td className="px-3 py-3 text-right tabular-nums font-semibold text-white">{r.blocks}</td>
      <td className="px-3 py-3 text-right tabular-nums">
        <span className="font-semibold text-white">{r.crossSells.count}</span>
        {r.crossSells.eur > 0 && <span className="block text-[11px] text-white/40">{formatEur(r.crossSells.eur)}</span>}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        <span className="font-semibold text-white">{r.renewals.count}</span>
        {r.renewals.eur > 0 && <span className="block text-[11px] text-white/40">{formatEur(r.renewals.eur)}</span>}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        <span className={`font-semibold ${r.ineficacias.no > 0 ? "text-rose-300" : "text-white/60"}`}>{r.ineficacias.no}</span>
        {r.ineficacias.pa > 0 && <span className="block text-[11px] text-rose-300/70">PA {r.ineficacias.pa}</span>}
      </td>
      <td
        className="px-4 py-3 text-right tabular-nums"
        title={`NPS ${pts(r.parts.nps)} · blocos ${pts(r.parts.blocks)} · negócios ${pts(r.parts.deals)} · ineficácias ${pts(r.parts.ineficacias)}`}
      >
        <span className="text-[15px] font-bold text-white">{pts(r.score)}</span>
      </td>
    </tr>
  );
}
