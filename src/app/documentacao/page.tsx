// /documentacao — o hub da Documentação da empresa (v78.5, redesenho v78.7).
//
// Um bloco por tema, filtrado pelo departamento da pessoa VISTA. Cada página
// do bloco é uma porta com o essencial à vista: os números das regras e o
// estado da pessoa neste momento, para muitas vezes nem ser preciso entrar.
// Em construção: só o André entra (lib/documentacao/access.ts).

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DocsClosed } from "@/components/documentacao/doc-ui";
import { formatDate } from "@/lib/dates";
import { DOCS_OPEN_TO_TEAM } from "@/lib/documentacao/access";
import { blocksFor, type DocsPage } from "@/lib/documentacao/blocks";
import { getDocsContext } from "@/lib/documentacao/server";
import { buildNpsBonusMonth } from "@/lib/documentacao/nps-bonus-server";
import { buildCommissionsBoard } from "@/lib/documentacao/commissions-server";
import {
  INDIVIDUAL_TIERS,
  NPS_BONUS_FIRST_MONTH,
  TEAM_TIERS,
  formatAvg,
  lisbonMonthKey,
  monthLabel,
  shiftMonth,
} from "@/lib/documentacao/nps-bonus";
import {
  COMMISSIONS_START,
  COMMISSION_TIERS,
  RENEWAL_RATE,
  formatEurCents,
  formatRate,
} from "@/lib/documentacao/commissions";
import { formatEur } from "@/lib/proposals/value";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Documentação — Wonder Ads Workspace",
};

type Preview = { figure: ReactNode; status: ReactNode };

export default async function DocumentacaoPage() {
  const ctx = await getDocsContext();
  if (ctx.state === "no-session") return null;
  if (ctx.state !== "ok") {
    return (
      <PageShell backHref="/" backLabel="workspace">
        <DocsClosed kind={ctx.state} name={ctx.state === "closed" ? ctx.name : ctx.reader.name} />
      </PageShell>
    );
  }

  const { reader } = ctx;
  const blocks = blocksFor(reader);
  const pageIds = new Set(blocks.flatMap((b) => b.pages.map((p) => p.id)));

  // Os resumos vivos — só se lê o que vai ser mostrado.
  const current = lisbonMonthKey(Date.now());
  const closed = shiftMonth(current, -1) < NPS_BONUS_FIRST_MONTH ? NPS_BONUS_FIRST_MONTH : shiftMonth(current, -1);
  const [nps, board] = await Promise.all([
    pageIds.has("bonus-nps") ? buildNpsBonusMonth(closed).catch(() => null) : null,
    pageIds.has("comissoes") ? buildCommissionsBoard().catch(() => null) : null,
  ]);

  const previews: Record<string, Preview> = {};
  if (pageIds.has("bonus-nps")) {
    const mine = nps?.consultants.find((c) => c.username === reader.username) ?? null;
    previews["bonus-nps"] = {
      figure: (
        <div className="flex items-end gap-6">
          <Figure value={formatEur(INDIVIDUAL_TIERS[0].eur)} label="teu, por mês" />
          <span className="pb-6 text-2xl font-light text-white/30">+</span>
          <Figure value={formatEur(TEAM_TIERS[0].eur)} label="de equipa, por mês" />
        </div>
      ),
      status: !nps ? (
        <StatusLine title={monthLabel(closed)} body="Sem dados de NPS de momento." />
      ) : reader.isAdmin ? (
        <StatusLine
          title={monthLabel(closed)}
          money={formatEur(nps.totalEur)}
          body={`a pagar à equipa · média ${formatAvg(nps.teamAverage)} · ${nps.teamResponses} de ${nps.teamProjects} responderam`}
        />
      ) : mine ? (
        <StatusLine
          title={monthLabel(closed)}
          money={formatEur(mine.individual.eur + mine.team.eur)}
          body={`ganhas · a tua média ${formatAvg(mine.average)} · ${mine.filled} de ${mine.projects.length} responderam`}
        />
      ) : (
        <StatusLine title={monthLabel(closed)} body="Não tens carteira SEO — este bónus não se aplica a ti." />
      ),
    };
  }
  if (pageIds.has("comissoes")) {
    const mine = board?.find((r) => r.username === reader.username) ?? null;
    const tier = mine?.tier ?? COMMISSION_TIERS[0];
    const total = (board ?? []).reduce((n, r) => n + r.totalCommission, 0);
    const deals = (board ?? []).reduce((n, r) => n + r.deals.length, 0);
    previews["comissoes"] = {
      figure: (
        <div className="flex items-end gap-6">
          <Figure value={formatRate(RENEWAL_RATE)} label="renovações" />
          <Figure
            value={`${formatRate(COMMISSION_TIERS[0].rate).replace("%", "")}–${formatRate(COMMISSION_TIERS[COMMISSION_TIERS.length - 1].rate)}`}
            label="cross-sells e upsells"
          />
        </div>
      ),
      status: reader.isAdmin ? (
        <StatusLine
          title={`Desde ${formatDate(COMMISSIONS_START)}`}
          money={formatEurCents(total)}
          body={`previstos · ${deals} fecho${deals === 1 ? "" : "s"} no COMMERCIAL DPT`}
        />
      ) : (
        <StatusLine
          title={`Patamar ${tier.n} · ${formatRate(tier.rate)}`}
          money={formatEurCents(mine?.totalCommission ?? 0)}
          body={`previstos · ${formatEur(mine?.accumulated ?? 0)} acumulados`}
        />
      ),
    };
  }

  return (
    <PageShell backHref="/" backLabel="workspace">
      <header className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-6">
        <h1 className="text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white sm:text-[3.4rem]">
          Documentação da empresa
        </h1>
        {!DOCS_OPEN_TO_TEAM && (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[12px] font-medium text-amber-200">
            Em construção — só tu vês
          </span>
        )}
      </header>

      {blocks.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-white/15 p-8 text-center text-[14px] text-white/50">
          Ainda não há documentação para o teu departamento.
        </p>
      ) : (
        <div className="mt-10 space-y-14 pb-10">
          {blocks.map((b) => (
            <section key={b.id} aria-labelledby={`bloco-${b.id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-white/[0.08] pb-3">
                <h2 id={`bloco-${b.id}`} className="text-[1.5rem] font-semibold tracking-[-0.02em] text-white">
                  {b.title}
                </h2>
                <p className="text-[12.5px] text-white/40">
                  {reader.isAdmin && <>Visível para SuperAdmin e {b.audienceLabel}. </>}
                  Atualizado a {formatDate(b.updatedAt)}.
                </p>
              </div>
              <p className="mt-3 max-w-2xl text-[15px] text-white/55">{b.summary}</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {b.pages.map((p) => (
                  <Door key={p.id} page={p} preview={previews[p.id] ?? null} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-[2.6rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-white sm:text-[3rem]">{value}</p>
      <p className="mt-1.5 text-[12.5px] text-white/45">{label}</p>
    </div>
  );
}

function StatusLine({ title, money, body }: { title: string; money?: string; body: string }) {
  return (
    <div>
      <p className="text-[12.5px] capitalize text-white/45">{title}</p>
      <p className="mt-1 text-[14px] leading-snug text-white/65">
        {money && <span className="mr-1.5 text-[17px] font-semibold tabular-nums text-emerald-300">{money}</span>}
        {body}
      </p>
    </div>
  );
}

function Door({ page, preview }: { page: DocsPage; preview: Preview | null }) {
  return (
    <Link
      href={page.href}
      className="group relative flex flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#783DF5] sm:p-7"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-0 blur-3xl transition duration-500 group-hover:opacity-40"
        style={{ background: "var(--brand-gradient)" }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[19px] font-semibold text-white">{page.label}</p>
          <p className="mt-0.5 text-[13.5px] text-white/50">{page.hint}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/60 transition group-hover:border-white group-hover:bg-white group-hover:text-[#07080d]">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
      {preview && (
        <>
          <div className="relative mt-8">{preview.figure}</div>
          <div className="relative mt-6 border-t border-white/[0.08] pt-4">{preview.status}</div>
        </>
      )}
    </Link>
  );
}
