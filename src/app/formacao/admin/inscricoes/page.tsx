// Gestão de inscrições — quem faz que especialização.
//
// Por defeito ninguém precisa de ser inscrito: a trilha deriva do
// departamento da credencial. Esta página existe para os casos que fogem à
// regra (um C-Level que quer fazer a trilha de ADS, alguém que mudou de
// departamento, um consultor que vai passar a fazer Comercial).

import Link from "next/link";
import { ArrowLeft, ClipboardList, Info } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { TrainingAdminNav } from "@/components/training/admin-nav";
import {
  EnrollmentsPanel,
  type EnrollmentRow,
} from "@/components/training/enrollments-panel";
import { getTrainingCatalog } from "@/lib/training/content-store";
import {
  getEnrollments,
  rosterWithTracks,
} from "@/lib/training/enrollments-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Inscrições — Formação · Wonder Ads",
};

export default async function EnrollmentsPage() {
  const [tracks, enrollments] = await Promise.all([
    getTrainingCatalog(),
    getEnrollments(),
  ]);
  const roster = rosterWithTracks(enrollments);
  const rows: EnrollmentRow[] = roster.map((u) => ({
    username: u.username,
    name: u.name,
    role: u.role,
    dept: u.dept,
    trackSlug: u.trackSlug,
    assigned: u.assigned,
    assignedBy: u.assignedBy,
  }));
  const options = tracks
    .filter((t) => !t.isCommon)
    .map((t) => ({ slug: t.slug, name: t.name }));

  return (
    <PageShell wide>
      <Link
        href="/formacao/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Formação — Overview
      </Link>

      <div className="animate-fade-up mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Inscrições</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            A Categoria Comum é automática para toda a gente. Aqui define-se
            apenas a especialização.
          </p>
        </div>
        <TrainingAdminNav />
      </div>

      <div className="animate-fade-up mt-6 flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-[12.5px] text-white/55">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-purple)]" />
        <span>
          Sem atribuição explícita, a especialização deriva do departamento da
          credencial (SEO → SEO/GEO, ADS → ADS, Web → WEB, Commercial →
          Comercial). Uma escolha feita aqui vence sempre o departamento; o
          botão de repor devolve a pessoa ao automático.
        </span>
      </div>

      <section className="animate-fade-up mt-6">
        <header className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
          <ClipboardList className="h-4 w-4" />
          Equipa
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium tracking-normal text-white/60">
            {rows.length}
          </span>
        </header>
        <EnrollmentsPanel rows={rows} tracks={options} />
      </section>
    </PageShell>
  );
}
