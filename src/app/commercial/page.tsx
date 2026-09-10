// COMMERCIAL DPT — as propostas comerciais (renovações e cross-sell).
//
// v77.12: o cabeçalho perdeu o ícone, a frase de apresentação e o contador
// — o que fica são os dois templates em PDF (canto superior direito) e o
// botão «Carregar proposta», que fecha o ciclo: template → Claude na sessão
// do consultor → PDF → cartão aqui, com página pública em /proposta/<slug>.
// A lista lê código + KV (tipo editado, decisão do cliente, uploads).
//
// v77.24: o PÓDIO abre a página — quem mais fechou, por valor. Ordena pelo
// valor fechado (confirmado pelo cliente), não pelo n.º de fechos: um
// cross-sell de 5.000 € vale mais do que um de 700 €. O período é o ano
// civil por defeito; ?periodo=tudo mostra desde sempre.

import { PageShell } from "@/components/page-shell";
import { DepartmentHeader } from "@/components/department-header";
import { TemplateChips } from "@/components/commercial/template-chips";
import { ProposalUploadButton } from "@/components/commercial/proposal-upload-button";
import { ProposalCard, type ProposalCardData } from "@/components/commercial/proposal-card";
import { CommercialPodium } from "@/components/commercial/podium";
import type { ClientOption } from "@/components/client-combobox";
import { getClientLogo } from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";
import { getSeoClients } from "@/lib/notion";
import { getCurrentEmployee } from "@/lib/auth/server";
import { canEditDept } from "@/lib/auth/credentials";
import { proposalPath } from "@/lib/proposals";
import { listAllProposals } from "@/lib/proposals/store";
import { listProposalSigners, resolveProposalConsultant } from "@/lib/proposals/consultant";
import { buildLeaderboard } from "@/lib/proposals/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "COMMERCIAL DPT — Wonder Ads Workspace",
};

export default async function CommercialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [proposals, employee, clients, sp] = await Promise.all([
    listAllProposals(),
    getCurrentEmployee(),
    getSeoClients().catch(() => []),
    searchParams,
  ]);
  const canEdit = Boolean(employee && canEditDept(employee.username, "commercial"));
  const allTime = sp.periodo === "tudo";

  // O consultor resolve-se uma vez por proposta: serve o cartão e o pódio.
  const resolved = proposals.map((record) => ({
    record,
    consultant: resolveProposalConsultant({
      clientSlug: record.clientSlug,
      consultant: record.consultant,
      consultantUsername: record.consultantUsername,
    }),
  }));

  const board = buildLeaderboard(resolved, allTime ? null : new Date().getFullYear());

  const cards: ProposalCardData[] = resolved.map(({ record: p, consultant }) => ({
    slug: p.slug,
    href: proposalPath(p.slug),
    clientSlug: p.clientSlug,
    clientName: p.clientName,
    logo: p.clientSlug ? getClientLogo(p.clientSlug) : null,
    gradient: p.clientSlug ? paletteToGradient(getClientPalette(p.clientSlug)) : "var(--brand-gradient)",
    title: p.title,
    kind: p.kind,
    status: p.status,
    date: p.date,
    period: p.period,
    investment: p.investment,
    valueEur: p.valueEur,
    valueEstimated: p.valueEstimated,
    summary: p.summary,
    source: p.source,
    decision: p.decision,
    file: p.file,
    uploadedAt: p.uploadedAt,
    uploadedByName: p.uploadedByName,
    consultant,
  }));

  const clientOptions: ClientOption[] = clients
    .map((c) => ({ slug: c.slug, name: c.title }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));

  const counts = {
    enviada: cards.filter((c) => c.status === "enviada").length,
    aceite: cards.filter((c) => c.status === "aceite").length,
    recusada: cards.filter((c) => c.status === "recusada").length,
  };

  return (
    <PageShell>
      <DepartmentHeader
        title="COMMERCIAL DPT"
        rightSlot={
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <TemplateChips />
            {canEdit && (
              <ProposalUploadButton
                clients={clientOptions}
                signers={listProposalSigners()}
                defaultSigner={employee?.username ?? null}
              />
            )}
          </div>
        }
      />

      {/* ----- Pódio ----- */}
      <CommercialPodium board={board} hasAnyProposals={proposals.length > 0} />

      {/* ----- Propostas ----- */}
      <section id="propostas" className="animate-fade-up mt-10 scroll-mt-8 sm:mt-14">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Propostas</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Propostas comerciais
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em]">
            <Stat n={counts.enviada} label="enviadas" cls="text-amber-100/80 border-amber-300/25" />
            <Stat n={counts.aceite} label="aceites" cls="text-emerald-100/80 border-emerald-300/25" />
            <Stat n={counts.recusada} label="recusadas" cls="text-rose-100/80 border-rose-300/25" />
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-white/50">
            Ainda não há propostas. Descarrega um template, prepara o PDF e usa «Carregar proposta».
          </div>
        ) : (
          <ul className="space-y-4">
            {cards.map((p) => (
              <ProposalCard key={p.slug} p={p} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </section>

      <section className="animate-fade-up mt-10 sm:mt-14">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">Em construção</p>
          <p className="mt-3 max-w-xl text-base text-white/60">
            Pipeline, contas e contratos vão viver aqui. Por agora, o departamento guarda as propostas.
          </p>
        </div>
      </section>
    </PageShell>
  );
}

function Stat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border bg-white/[0.03] px-2.5 py-1 ${cls}`}>
      <span className="text-[13px] font-bold tracking-normal text-white">{n}</span>
      {label}
    </span>
  );
}
