// /admin/passagens/<id> — o cockpit de uma passagem (v80.39). Só SuperAdmin.

import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { AdminCockpit, type CockpitProject } from "@/components/passagem/admin-cockpit";
import { KpiTile, PageHeader, PersonAvatar, ProgressRing, Timeline } from "@/components/passagem/ui";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getTeamAvatar } from "@/lib/team-avatars";
import { passagemOverview } from "@/lib/passagem/overview";
import { getPassagem, getPassagemIndex, seoPortfolios } from "@/lib/passagem/store";
import { dayOf, exitItemsFor, formatISODate, reasonLabel, totalDaysOf } from "@/lib/passagem/shared";
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

  const [o, portfolios, index] = await Promise.all([passagemOverview(p), seoPortfolios(), getPassagemIndex()]);
  const leaving = new Set(index.filter((e) => e.status === "ativa").map((e) => e.outgoing));
  const today = todayLisbonISO();
  const total = totalDaysOf(p);
  const day = dayOf(p, today);
  const inPassagem = new Set(p.projects.map((x) => x.slug));
  const addable = (portfolios.find((x) => x.username === p.outgoing.username)?.clients ?? [])
    .filter((c) => !inPassagem.has(c.slug))
    .map((c) => ({ slug: c.slug, title: c.title }));
  const candidates = portfolios
    .filter((x) => x.username !== p.outgoing.username && !leaving.has(x.username))
    .map((x) => ({ username: x.username, name: x.name, count: x.clients.length }));
  const projects: CockpitProject[] = o.projects.map((x) => ({
    slug: x.slug,
    title: x.title,
    incoming: x.incoming,
    stage: x.stage,
    pct: x.progress.pct,
    next: x.progress.next?.todo ?? null,
    health: x.ficha.health,
    healthWhy: x.ficha.healthWhy,
    signedAt: x.sign?.at ?? null,
    transferred: x.transferred,
    owner: x.owner,
    openQuestions: x.openQuestions,
    steps: x.steps,
    readyAt: x.ficha.readyAt,
    updatedAt: x.ficha.updatedAt,
  }));
  const daysLeft = total - day;
  const t = o.totals;

  return (
    <PageShell backHref="/admin/passagens" backLabel="Passagens" backPrefix="Voltar a">
      <PageHeader
        eyebrow={`Passagem de consultor · ${reasonLabel(p.reason)}`}
        title={p.outgoing.name}
        lead={p.status === "ativa" ? `${o.totals.projects} projeto${o.totals.projects === 1 ? "" : "s"} a passar até ${formatISODate(p.endDate)}.` : `Passagem ${p.status === "concluida" ? "concluída" : "cancelada"}.`}
      >
        <div className="flex items-center gap-3">
          <ProgressRing pct={t.pct} size={60} stroke={5} />
          <PersonAvatar name={p.outgoing.name} avatar={getTeamAvatar(p.outgoing.username)} size={56} />
        </div>
      </PageHeader>
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile
          label="Prazo"
          value={day <= 0 ? "—" : day > total ? "Fim" : `${day}/${total}`}
          sub={day <= 0 ? `começa a ${formatISODate(p.startDate)}` : daysLeft < 0 ? `passou há ${-daysLeft} d` : daysLeft === 0 ? "último dia" : `faltam ${daysLeft} d`}
          tone={daysLeft < 0 && t.ready < t.projects ? "bad" : daysLeft <= 5 && t.ready < t.projects ? "warn" : "default"}
        />
        <KpiTile label="Fichas prontas" value={`${t.ready}/${t.projects}`} tone={t.ready === t.projects ? "good" : "default"} />
        <KpiTile label="Assumidos" value={`${t.assumed}/${t.projects}`} tone={t.assumed === t.projects ? "good" : "default"} />
        <KpiTile label="Passados" value={`${t.transferred}/${t.projects}`} sub="no SEO DPT" tone={t.transferred === t.projects ? "good" : "default"} />
        <KpiTile label="Em risco" value={t.risk} tone={t.risk > 0 ? "bad" : "default"} />
        <KpiTile label="Perguntas" value={t.open} sub="por responder" tone={t.open > 0 ? "warn" : "default"} />
      </div>
      <div className="mt-6 space-y-8 pb-14">
        <Timeline day={day} totalDays={total} startDate={p.startDate} endDate={p.endDate} />
        <AdminCockpit passagem={p} projects={projects} candidates={candidates} addable={addable} exitItems={exitItemsFor(p.reason)} daysLeft={daysLeft} />
      </div>
    </PageShell>
  );
}
