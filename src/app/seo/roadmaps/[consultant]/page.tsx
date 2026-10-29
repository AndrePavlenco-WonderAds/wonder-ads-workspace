// Per-consultant "my week" roadmap overview.
//
// An SEO consultant opens this from their own column header on /seo to see
// EVERY one of their projects' roadmaps + exactly which tasks are due THIS
// week across all of them — so they know what to do first and second.
//
// v78.42: redesenhada — «Fazer primeiro» (as tarefas da semana de todos os
// projetos, por ordem), «Precisa de atenção» (NPS por enviar, folga passada,
// atrasos) e a carteira com o NPS do mês anterior e do atual e a folga de
// custos de cada projeto. Ver components/consultant-week-view.tsx.
//
// Access: the consultant themselves OR a SuperAdmin (Andre/Alex/Alice).
// Every other logged-in user gets the Access Denied screen.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { ConsultantHeader } from "@/components/consultant-header";
import { ConsultantWeekView } from "@/components/consultant-week-view";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { CONSULTANT_ORDER } from "@/lib/client-overrides";
import { slugify } from "@/lib/notion";
import { getConsultantWeekView } from "@/lib/roadmap-admin-helpers";
import { getConsultantPortfolio } from "@/lib/consultant-portfolio";

export const dynamic = "force-dynamic";

/** Resolve the canonical consultant name from a URL slug. */
function consultantFromSlug(consultantSlug: string): string | null {
  return (
    CONSULTANT_ORDER.find((name) => slugify(name) === consultantSlug) ?? null
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ consultant: string }>;
}) {
  const { consultant } = await params;
  const name = consultantFromSlug(consultant);
  return {
    title: name
      ? `${name} — A Minha Semana · Wonder Ads`
      : "A Minha Semana · Wonder Ads",
  };
}

export default async function ConsultantWeekPage({
  params,
}: {
  params: Promise<{ consultant: string }>;
}) {
  const { consultant } = await params;
  const consultantName = consultantFromSlug(consultant);
  if (!consultantName) notFound();

  const employee = await getCurrentEmployee();
  // SEO access is a prerequisite; then it must be this consultant or an
  // admin. (employee.name matches the consultant display name — they were
  // renamed in lockstep, see credentials.ts + client-overrides.ts.)
  const allowed =
    employee &&
    editableDepts(employee).includes("seo") &&
    (employee.isAdmin || employee.name === consultantName);

  if (!allowed) {
    return (
      <PageShell backHref="/seo" backLabel="SEO DPT">
        <AccessDenied
          title="Visão privada"
          description={`Esta visão semanal pertence a ${consultantName}. Apenas ${consultantName} e os SuperAdmins a podem abrir.`}
          backHref="/seo"
          backLabel="SEO DPT"
          username={employee?.username ?? null}
        />
      </PageShell>
    );
  }

  const view = await getConsultantWeekView(consultantName);
  const portfolio = await getConsultantPortfolio(view.clients.map((c) => c.slug));

  return (
    <PageShell wide backHref="/seo" backLabel="SEO DPT">
      <div className="animate-fade-up mt-2">
        <ConsultantHeader view={view} own={employee.name === consultantName} />
      </div>
      {/* A direção vê todos os consultores seguidos numa página (v78.44). */}
      {employee.isAdmin && (
        <Link
          href={`/seo/roadmaps#${consultant}`}
          className="group mt-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] py-1 pl-1 pr-3 text-[12.5px] text-white/65 transition hover:border-white/25 hover:text-white"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08]">
            <Users className="h-3.5 w-3.5" />
          </span>
          Ver todos os consultores
          <ArrowRight className="h-3.5 w-3.5 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
        </Link>
      )}

      <ConsultantWeekView view={view} portfolio={portfolio} />
    </PageShell>
  );
}
