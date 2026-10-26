// O tracking das comissões — lido das propostas aceites no COMMERCIAL DPT.
// A direção vê a equipa na escada; um consultor vê o seu degrau e os seus
// fechos.

import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import {
  COMMISSIONS_START,
  COMMISSION_TIERS,
  formatEurCents,
  formatRate,
  type ConsultantCommissions,
} from "@/lib/documentacao/commissions";
import type { DocsPerson } from "@/lib/documentacao/people";
import { formatEur } from "@/lib/proposals/value";
import { proposalPath } from "@/lib/proposals";
import { formatDate } from "@/lib/dates";
import { Avatar } from "./avatar";
import { CommissionLadder, type LadderPin } from "./commission-ladder";

function DealsList({ row }: { row: ConsultantCommissions }) {
  if (row.deals.length === 0) {
    return <p className="text-[13px] text-white/45">Sem fechos desde {formatDate(COMMISSIONS_START)}.</p>;
  }
  return (
    <ul className="divide-y divide-white/[0.06]">
      {row.deals.map((d) => (
        <li key={d.slug} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[6rem_1fr_8rem_4rem_7rem] sm:items-baseline">
          <span className="order-3 text-[12px] text-white/40 sm:order-none">{formatDate(d.closedOn)}</span>
          <span className="min-w-0">
            <Link href={proposalPath(d.slug)} className="text-[14px] font-medium text-white hover:underline">
              {d.clientName}
            </Link>
            <span className="ml-2 text-[12px] text-white/45">{d.kind === "renovacao" ? "Renovação" : "Cross-sell / upsell"}</span>
          </span>
          <span className="hidden text-right text-[13.5px] tabular-nums text-white/70 sm:block">
            {d.value === null ? <span className="text-rose-300">sem valor</span> : formatEur(d.value)}
            {d.estimated && (
              <span className="ml-1 text-[11px] text-amber-300" title="Valor estimado a partir do texto da proposta">
                estimado
              </span>
            )}
          </span>
          <span className="hidden text-right text-[13px] text-white/50 sm:block">{formatRate(d.rate)}</span>
          <span className="text-right text-[14px] font-semibold tabular-nums text-emerald-300">{formatEurCents(d.commission)}</span>
        </li>
      ))}
    </ul>
  );
}

function Source() {
  return (
    <p className="text-[12px] leading-relaxed text-white/40">
      Contas feitas com as propostas aceites no{" "}
      <Link href="/commercial" className="inline-flex items-center gap-0.5 text-white/65 underline-offset-2 hover:text-white hover:underline">
        COMMERCIAL DPT
        <ArrowUpRight className="h-3 w-3" />
      </Link>{" "}
      desde {formatDate(COMMISSIONS_START)}, pelo valor do cartão. É a comissão prevista: nos serviços com custo externo a
      base é a margem ou a fee, e recebes à medida que o cliente paga.
    </p>
  );
}

function Figure({ label, value, sub, money = false }: { label: string; value: string; sub?: string; money?: boolean }) {
  return (
    <div>
      <p className="text-[12.5px] text-white/50">{label}</p>
      <p
        className={`mt-1 font-semibold leading-none tracking-[-0.03em] tabular-nums ${
          money ? "text-[2.4rem] text-emerald-300 sm:text-[2.9rem]" : "text-[1.6rem] text-white"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[12.5px] text-white/45">{sub}</p>}
    </div>
  );
}

export function CommissionsTracker({
  board,
  people,
  viewAll,
  username,
}: {
  board: ConsultantCommissions[];
  /** Os consultores SEO — entram na escada mesmo sem fechos. */
  people: DocsPerson[];
  viewAll: boolean;
  username: string;
}) {
  const byUser = new Map(board.filter((r) => r.username).map((r) => [r.username!, r]));

  if (!viewAll) {
    const mine = byUser.get(username) ?? null;
    const me = people.find((p) => p.username === username);
    const acc = mine?.accumulated ?? 0;
    const tier = mine?.tier ?? COMMISSION_TIERS[0];
    const toNext = mine ? mine.toNext : COMMISSION_TIERS[1].from;
    const next = COMMISSION_TIERS.find((t) => t.n === tier.n + 1);
    return (
      <div className="space-y-7 rounded-[28px] border border-white/10 bg-white/[0.025] p-5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <Figure
            label="A tua comissão prevista"
            value={formatEurCents(mine?.totalCommission ?? 0)}
            sub={`${mine?.deals.length ?? 0} fecho${mine?.deals.length === 1 ? "" : "s"} desde ${formatDate(COMMISSIONS_START)}`}
            money
          />
          <div className="flex gap-10">
            <Figure label="Acumulado" value={formatEur(acc)} />
            <Figure
              label="Patamar"
              value={`${tier.n} · ${formatRate(tier.rate)}`}
              sub={toNext === null || !next ? "O último patamar" : `Faltam ${formatEur(toNext)} para ${formatRate(next.rate)}`}
            />
          </div>
        </div>
        <CommissionLadder
          current={tier.n}
          pins={me ? [{ key: me.username, name: "Tu", avatar: me.avatar, accumulated: acc }] : []}
        />
        <div className="space-y-3">
          <p className="text-[14px] font-semibold text-white">Os teus fechos</p>
          {mine ? <DealsList row={mine} /> : <p className="text-[13px] text-white/45">Ainda sem fechos.</p>}
        </div>
        <Source />
      </div>
    );
  }

  // Direção: todos os consultores SEO + quem mais tiver fechos.
  const rows: Array<{ person: { key: string; name: string; avatar: string | null }; row: ConsultantCommissions | null }> = [
    ...people.map((p) => ({ person: { key: p.username, name: p.name, avatar: p.avatar }, row: byUser.get(p.username) ?? null })),
    ...board
      .filter((r) => !r.username || !people.some((p) => p.username === r.username))
      .map((r) => ({ person: { key: r.username ?? r.name, name: r.name, avatar: null }, row: r })),
  ].sort((a, b) => (b.row?.accumulated ?? 0) - (a.row?.accumulated ?? 0) || a.person.name.localeCompare(b.person.name, "pt"));

  const total = board.reduce((n, r) => n + r.totalCommission, 0);
  const deals = board.reduce((n, r) => n + r.deals.length, 0);
  const pins: LadderPin[] = rows.map((r) => ({ ...r.person, accumulated: r.row?.accumulated ?? 0 }));

  return (
    <div className="space-y-7 rounded-[28px] border border-white/10 bg-white/[0.025] p-5 sm:p-8">
      <Figure
        label="Comissão prevista da equipa"
        value={formatEurCents(total)}
        sub={`${deals} fecho${deals === 1 ? "" : "s"} desde ${formatDate(COMMISSIONS_START)}`}
        money
      />
      <CommissionLadder current={null} pins={pins} />
      <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {rows.map(({ person, row }) => (
          <details key={person.key} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 py-3 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5]">
              <Avatar name={person.name} src={person.avatar} size={30} />
              <span className="min-w-0 flex-1 text-[14px] font-medium text-white">{person.name}</span>
              <span className="hidden w-24 text-right text-[13px] tabular-nums text-white/60 sm:block">{formatEur(row?.accumulated ?? 0)}</span>
              <span className="w-16 text-right text-[13px] text-white/60">
                {(row?.tier ?? COMMISSION_TIERS[0]).n} · {formatRate((row?.tier ?? COMMISSION_TIERS[0]).rate)}
              </span>
              <span className="w-24 text-right text-[14px] font-semibold tabular-nums text-emerald-300">
                {formatEurCents(row?.totalCommission ?? 0)}
              </span>
              <ChevronDown className="h-4 w-4 text-white/35 transition group-open:rotate-180" />
            </summary>
            <div className="pb-4 pl-[42px]">
              {row ? <DealsList row={row} /> : <p className="text-[13px] text-white/45">Sem fechos desde {formatDate(COMMISSIONS_START)}.</p>}
            </div>
          </details>
        ))}
      </div>
      <Source />
    </div>
  );
}
