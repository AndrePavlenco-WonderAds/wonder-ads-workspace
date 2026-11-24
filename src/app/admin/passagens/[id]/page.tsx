// /admin/passagens/<id> — o cockpit de uma passagem (v80.39). Só SuperAdmin.

import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { AdminCockpit, type CockpitProject } from "@/components/passagem/admin-cockpit";
import { PageHeader, PersonAvatar, Timeline } from "@/components/passagem/ui";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getTeamAvatar } from "@/lib/team-avatars";
import { passagemOverview } from "@/lib/passagem/overview";
import { getPassagem, seoPortfolios } from "@/lib/passagem/store";
import { dayOf, exitItemsFor, reasonLabel, totalDaysOf } from "@/lib/passagem/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Passagem de consultor — Wonder Ads Workspace" };

export default async function PassagemCockpitPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentEmployee();
  if (!me?.isAdmin) {
    return (
      <PageShell backHref="/" backLabel="workspace" backPrefix="Voltar a">
        <PageHeader eyebrow="SuperAdmin" title="Passagem de consultor" lead="Esta página é só para SuperAdmin." />
      </PageShell>
    );
  }
  const { id } = await params;
  const p = await getPassagem(id);
  if (!p) notFound();

  const [o, portfolios] = await Promise.all([passagemOverview(p), seoPortfolios()]);
  const today = todayLisbonISO();
  const total = totalDaysOf(p);
  const day = dayOf(p, today);
  const inPassagem = new Set(p.projects.map((x) => x.slug));
  const addable = (portfolios.find((x) => x.username === p.outgoing.username)?.clients ?? [])
    .filter((c) => !inPassagem.has(c.slug))
    .map((c) => ({ slug: c.slug, title: c.title }));
  const candidates = portfolios
    .filter((x) => x.username !== p.outgoing.username)
    .map((x) => ({ username: x.username, name: x.name, count: x.clients.length }));
  const projects: CockpitProject[] = o.projects.map((x) => ({
    slug: x.slug,
    title: x.title,
    incoming: x.incoming,
    stage: x.stage,
    pct: x.progress.pct,
    next: x.progress.next?.label ?? null,
    health: x.ficha.health,
    healthWhy: x.ficha.healthWhy,
    signedAt: x.sign?.at ?? null,
    transferred: x.transferred,
    owner: x.owner,
    openQuestions: x.openQuestions,
  }));

  return (
    <PageShell backHref="/admin/passagens" backLabel="Passagens" backPrefix="Voltar a">
      <PageHeader
        eyebrow={`Passagem de consultor · ${reasonLabel(p.reason)}`}
        title={p.outgoing.name}
        lead={`${o.totals.ready} de ${o.totals.projects} fichas prontas · ${o.totals.assumed} assumidos · ${o.totals.transferred} passados no SEO DPT${
          o.totals.open ? ` · ${o.totals.open} pergunta${o.totals.open === 1 ? "" : "s"} por responder` : ""
        }`}
      >
        <PersonAvatar name={p.outgoing.name} avatar={getTeamAvatar(p.outgoing.username)} size={56} />
      </PageHeader>
      <div className="mt-6 space-y-8 pb-14">
        <Timeline day={day} totalDays={total} startDate={p.startDate} endDate={p.endDate} />
        <AdminCockpit passagem={p} projects={projects} candidates={candidates} addable={addable} exitItems={exitItemsFor(p.reason)} />
      </div>
    </PageShell>
  );
}
