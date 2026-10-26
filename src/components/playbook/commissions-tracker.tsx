// O tracking das comissões — lido das propostas aceites no COMMERCIAL DPT.
// A direção vê toda a gente; um consultor vê só o seu patamar e os seus
// fechos.

import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import {
  COMMISSIONS_START,
  COMMISSION_TIERS,
  formatEurCents,
  formatRate,
  type ConsultantCommissions,
} from "@/lib/playbook/commissions";
import { formatEur } from "@/lib/proposals/value";
import { proposalPath } from "@/lib/proposals";
import { formatDate } from "@/lib/dates";

/** O fim da régua: o último patamar começa a ¾ dela (100k para 75k). */
const SCALE = (COMMISSION_TIERS[COMMISSION_TIERS.length - 1].from * 4) / 3;
const at = (eur: number) => `${Math.min(eur / SCALE, 1) * 100}%`;

/** A régua dos 4 patamares com o acumulado marcado. */
function TierBar({ acc }: { acc: number }) {
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-white/[0.06]">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: at(acc), background: "var(--brand-gradient)" }} />
        {COMMISSION_TIERS.slice(1).map((t) => (
          <span
            key={t.n}
            aria-hidden
            className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-white/30"
            style={{ left: at(t.from) }}
          />
        ))}
      </div>
      <div className="relative mt-1.5 h-4 text-[10px] text-white/40">
        {COMMISSION_TIERS.map((t) => (
          <span
            key={t.n}
            className="absolute whitespace-nowrap"
            style={{ left: at(t.from) }}
          >
            {t.from === 0 ? "0" : `${t.from / 1000}k`} · {formatRate(t.rate)}
          </span>
        ))}
      </div>
    </div>
  );
}

function DealsTable({ row }: { row: ConsultantCommissions }) {
  if (row.deals.length === 0) return <p className="text-[12px] text-white/40">Sem fechos desde {formatDate(COMMISSIONS_START)}.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            <th className="py-2 pr-3">Fecho</th>
            <th className="py-2 pr-3">Cliente</th>
            <th className="py-2 pr-3">Tipo</th>
            <th className="py-2 pr-3 text-right">Valor s/ IVA</th>
            <th className="py-2 pr-3 text-right">%</th>
            <th className="py-2 text-right">Comissão</th>
          </tr>
        </thead>
        <tbody>
          {row.deals.map((d) => (
            <tr key={d.slug} className="border-b border-white/[0.05] last:border-b-0">
              <td className="py-2 pr-3 text-white/55">{formatDate(d.closedOn)}</td>
              <td className="py-2 pr-3">
                <Link href={proposalPath(d.slug)} className="text-white/80 hover:text-white">
                  {d.clientName}
                </Link>
              </td>
              <td className="py-2 pr-3 text-white/60">{d.kind === "renovacao" ? "Renovação" : "Cross-sell / upsell"}</td>
              <td className="py-2 pr-3 text-right font-mono text-white/80">
                {d.value === null ? <span className="text-rose-300/80">sem valor</span> : formatEur(d.value)}
                {d.estimated && <span className="ml-1 text-[10px] text-amber-300/80" title="Valor estimado a partir do texto da proposta">est.</span>}
              </td>
              <td className="py-2 pr-3 text-right text-white/60">{formatRate(d.rate)}</td>
              <td className="py-2 text-right font-mono font-semibold text-emerald-300">{formatEurCents(d.commission)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

function Footnote() {
  return (
    <p className="mt-4 text-[11px] leading-relaxed text-white/35">
      Fonte: propostas aceites no{" "}
      <Link href="/commercial" className="inline-flex items-center gap-0.5 text-white/55 underline-offset-2 hover:text-white hover:underline">
        COMMERCIAL DPT
        <ArrowUpRight className="h-3 w-3" />
      </Link>{" "}
      desde {formatDate(COMMISSIONS_START)}, pelo valor do cartão. É a comissão prevista: nos serviços com custo externo a base
      é a margem ou a fee, e o pagamento segue o que o cliente paga (ver secção 04).
    </p>
  );
}

export function CommissionsTracker({
  board,
  viewAll,
  username,
}: {
  board: ConsultantCommissions[];
  viewAll: boolean;
  username: string;
}) {
  if (!viewAll) {
    const mine = board.find((r) => r.username === username) ?? null;
    const acc = mine?.accumulated ?? 0;
    const tier = mine?.tier ?? COMMISSION_TIERS[0];
    const toNext = mine ? mine.toNext : COMMISSION_TIERS[1].from;
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <p className="text-[15px] font-semibold text-white">O teu patamar</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Acumulado" value={formatEur(acc)} sub="renovações + cross-sells + upsells" />
          <Stat
            label="Patamar"
            value={`${tier.n} · ${formatRate(tier.rate)}`}
            sub={toNext === null ? "Último patamar" : `Faltam ${formatEur(toNext)} para o ${tier.n + 1}`}
          />
          <Stat label="Comissão prevista" value={formatEurCents(mine?.totalCommission ?? 0)} sub={`${mine?.deals.length ?? 0} fechos`} />
        </div>
        <TierBar acc={acc} />
        <div className="mt-6">{mine ? <DealsTable row={mine} /> : <p className="text-[12px] text-white/40">Ainda sem fechos.</p>}</div>
        <Footnote />
      </div>
    );
  }

  const total = board.reduce((n, r) => n + r.totalCommission, 0);
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px] font-semibold text-white">Patamares da equipa</p>
        <p className="text-[12px] text-white/50">
          Comissão prevista total: <span className="font-semibold text-white">{formatEurCents(total)}</span>
        </p>
      </div>
      {board.length === 0 ? (
        <p className="mt-4 text-[13px] text-white/50">Ainda não há propostas aceites desde {formatDate(COMMISSIONS_START)}.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {board.map((r) => (
            <details key={r.username ?? r.name} className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 marker:hidden sm:grid-cols-[1fr_8rem_7rem_8rem_auto]">
                <span className="font-medium text-white">{r.name}</span>
                <span className="hidden text-right font-mono text-[13px] text-white/70 sm:block">{formatEur(r.accumulated)}</span>
                <span className="hidden text-right text-[12.5px] text-white/60 sm:block">
                  {r.tier.n} · {formatRate(r.tier.rate)}
                </span>
                <span className="hidden text-right font-mono text-[13px] font-semibold text-emerald-300 sm:block">
                  {formatEurCents(r.totalCommission)}
                </span>
                <ChevronRight className="h-4 w-4 text-white/35 transition group-open:rotate-90" />
                <span className="col-span-2 text-[11.5px] text-white/50 sm:hidden">
                  {formatEur(r.accumulated)} · patamar {r.tier.n} · {formatEurCents(r.totalCommission)}
                </span>
              </summary>
              <div className="mt-4">
                <DealsTable row={r} />
              </div>
            </details>
          ))}
        </div>
      )}
      <Footnote />
    </div>
  );
}
