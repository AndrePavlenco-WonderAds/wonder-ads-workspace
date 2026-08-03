// Superadmin da Formação — a fotografia da equipa inteira.
//
// Mesma gramática visual do overview de onboarding de clientes: back-link,
// título em gradiente, linha de indicadores e uma lista/tabela por baixo.

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  Film,
  Gauge,
  UserRound,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { TrainingAdminNav } from "@/components/training/admin-nav";
import {
  RosterTable,
  type RosterTableRow,
} from "@/components/training/roster-table";
import { StatTile } from "@/components/training/training-ui";
import { getTrainingOverview } from "@/lib/training/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Formação — Superadmin · Wonder Ads",
};

export default async function FormacaoAdminPage() {
  const overview = await getTrainingOverview();
  const trackOptions = overview.tracks
    .filter((t) => !t.isCommon)
    .map((t) => ({ slug: t.slug, name: t.name }));

  const rows: RosterTableRow[] = overview.rows.map((r) => ({
    username: r.user.username,
    name: r.user.name,
    role: r.user.role,
    dept: r.user.dept,
    trackNames: r.user.trackSlugs.map(
      (slug) => overview.tracks.find((t) => t.slug === slug)?.name ?? slug,
    ),
    trackSlugs: r.user.trackSlugs,
    derived: !r.user.assigned && r.user.trackSlugs.length > 0,
    percent: r.percent,
    currentLabel: r.currentLabel,
    watched: r.watched,
    totalLessons: r.totalLessons,
    allLessons: r.allLessons,
    quizzesPassed: r.quizzesPassed,
    quizzesTotal: r.quizzesTotal,
    attempts: r.attempts.length,
    failedAttempts: r.failedAttempts,
    lastActivity: r.lastActivity,
  }));

  const activeLearners = overview.rows.filter((r) => r.lastActivity > 0).length;

  return (
    <PageShell wide>
      <Link
        href="/formacao"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Formação
      </Link>

      <div className="animate-fade-up mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Formação — Superadmin</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Progresso de toda a equipa na Consultants University. Clica num
            consultor para ver aula a aula e teste a teste o que ele fez.
          </p>
        </div>
        <TrainingAdminNav />
      </div>

      <section className="animate-fade-up mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Média da equipa"
          value={`${overview.averagePercent}%`}
          hint={`${overview.completedCount} concluíram tudo`}
          icon={<Gauge className="h-3 w-3" />}
        />
        <StatTile
          label="Já começaram"
          value={`${activeLearners}/${overview.rows.length}`}
          hint={
            overview.notStartedCount > 0
              ? `${overview.notStartedCount} por arrancar`
              : "toda a gente arrancou"
          }
          icon={<Users className="h-3 w-3" />}
        />
        <StatTile
          label="Vídeos em falta"
          value={overview.missingVideos}
          hint="não bloqueiam ninguém"
          tone={overview.missingVideos > 0 ? "warn" : "good"}
          icon={<Film className="h-3 w-3" />}
        />
        <StatTile
          label="Sem apresentador"
          value={overview.unassignedPresenters}
          hint="aulas por atribuir"
          tone={overview.unassignedPresenters > 0 ? "warn" : "good"}
          icon={<UserRound className="h-3 w-3" />}
        />
        <StatTile
          label="Testes por escrever"
          value={overview.quizzesMissing}
          hint="capítulos sem perguntas"
          tone={overview.quizzesMissing > 0 ? "warn" : "good"}
          icon={<ClipboardCheck className="h-3 w-3" />}
        />
      </section>

      {overview.missingVideos > 0 && (
        <Link
          href="/formacao/admin/conteudo"
          className="animate-fade-up mt-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-[13px] text-amber-100/85 transition hover:border-amber-400/45"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Há {overview.missingVideos} aulas sem vídeo carregado. Abre o
          checklist de gravações para ver quem tem o quê para gravar.
        </Link>
      )}

      <section className="animate-fade-up mt-8">
        <header className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
          <Users className="h-4 w-4" />
          Equipa
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium tracking-normal text-white/60">
            {rows.length}
          </span>
        </header>
        <RosterTable rows={rows} trackOptions={trackOptions} />
      </section>
    </PageShell>
  );
}
