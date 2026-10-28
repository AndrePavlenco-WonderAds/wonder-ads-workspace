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

import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { Greeting } from "@/components/greeting";
import { ConsultantWeekView } from "@/components/consultant-week-view";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { CONSULTANT_ORDER } from "@/lib/client-overrides";
import { slugify } from "@/lib/notion";
import { getConsultantWeekView } from "@/lib/roadmap-admin-helpers";
import { getConsultantPortfolio } from "@/lib/consultant-portfolio";
import { formatDate } from "@/lib/dates";
import { getTeamAvatar } from "@/lib/team-avatars";
import { findEmployeeByName } from "@/lib/proposals/consultant";

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
  const firstName = consultantName.split(/\s+/)[0].replace(/\.$/, "");
  const avatar = getTeamAvatar(findEmployeeByName(consultantName)?.username);
  const own = employee.name === consultantName;
  const projects = view.clients.filter((c) => c.hasRoadmap).length;

  return (
    <PageShell wide backHref="/seo" backLabel="SEO DPT">
      <header className="animate-fade-up mt-2 flex flex-wrap items-center gap-5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-white/15 sm:h-[72px] sm:w-[72px]"
          />
        ) : (
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold text-white sm:h-[72px] sm:w-[72px]"
            style={{ background: "var(--brand-gradient)" }}
          >
            {firstName.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {own ? (
              <>
                <span className="brand-gradient-text">
                  <Greeting name={firstName} />
                </span>{" "}
                <span aria-hidden>👋</span>
              </>
            ) : (
              <span className="brand-gradient-text">{consultantName}</span>
            )}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[14px] text-white/55">
            {formatDate(new Date())} · {view.clients.length}{" "}
            {view.clients.length === 1 ? "projeto" : "projetos"} na carteira ·{" "}
            {view.totals.thisWeekRemaining > 0 ? (
              <>
                <span className="font-semibold text-white/85">
                  {view.totals.thisWeekRemaining}{" "}
                  {view.totals.thisWeekRemaining === 1 ? "tarefa" : "tarefas"}
                </span>{" "}
                para esta semana em {projects} {projects === 1 ? "roadmap" : "roadmaps"}
              </>
            ) : (
              <>semana em dia</>
            )}
          </p>
        </div>
      </header>

      <ConsultantWeekView view={view} portfolio={portfolio} />
    </PageShell>
  );
}
