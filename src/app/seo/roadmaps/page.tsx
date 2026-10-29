// /seo/roadmaps — todos os consultores SEO seguidos numa página (v78.44).
//
// Só para SuperAdmins. Em cima, «A equipa»: uma linha por consultor com os
// mesmos números do topo da página dele, que salta para a secção dele. Depois,
// cada consultor por ordem da board, com a mesma vista de
// /seo/roadmaps/<consultor> — o que tem para fazer, o que precisa de atenção, a
// carteira e a semana projeto a projeto.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { ConsultantHeader } from "@/components/consultant-header";
import { ConsultantWeekView, summarizePortfolio } from "@/components/consultant-week-view";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { CONSULTANT_ORDER } from "@/lib/client-overrides";
import { getConsultantPortfolio } from "@/lib/consultant-portfolio";
import { formatDate } from "@/lib/dates";
import { slugify } from "@/lib/notion";
import { npsScoreColor } from "@/lib/nps-questions";
import { findEmployeeByName } from "@/lib/proposals/consultant";
import { getConsultantWeekView } from "@/lib/roadmap-admin-helpers";
import { eurCents } from "@/lib/seo-folga";
import { getTeamAvatar } from "@/lib/team-avatars";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Todos os consultores · Wonder Ads",
};

const COLS =
  "lg:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,0.8fr))_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto]";

export default async function AllConsultantsPage() {
  const employee = await getCurrentEmployee();
  if (!employee || !employee.isAdmin || !editableDepts(employee).includes("seo")) {
    return (
      <PageShell backHref="/seo" backLabel="SEO DPT">
        <AccessDenied
          title="Só para SuperAdmins"
          description="A vista com todos os consultores juntos é da direção. Cada consultor tem a sua página a partir da coluna dele no SEO DPT."
          backHref="/seo"
          backLabel="SEO DPT"
          username={employee?.username ?? null}
        />
      </PageShell>
    );
  }

  const all = await Promise.all(
    CONSULTANT_ORDER.map(async (name) => {
      const view = await getConsultantWeekView(name);
      const portfolio = await getConsultantPortfolio(view.clients.map((c) => c.slug));
      return { slug: slugify(name), view, portfolio, sum: summarizePortfolio(view, portfolio) };
    }),
  );
  // Um consultor sem projetos não tem nada para mostrar.
  const team = all.filter((x) => x.view.clients.length > 0);
  const projects = team.reduce((s, x) => s + x.view.clients.length, 0);
  const left = team.reduce((s, x) => s + x.view.totals.thisWeekRemaining, 0);
  const prevShort = team.find((x) => x.sum.prevShort)?.sum.prevShort ?? "";

  return (
    <PageShell wide backHref="/seo" backLabel="SEO DPT">
      <header className="animate-fade-up mt-2">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">Todos os consultores</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-white/55">
          {formatDate(new Date())} · {team.length} consultores · {projects} projetos ·{" "}
          <span className="font-semibold text-white/85">
            {left} {left === 1 ? "tarefa" : "tarefas"}
          </span>{" "}
          por fazer esta semana
        </p>
      </header>

      {/* A equipa — uma linha por consultor, salta para a secção dele. */}
      <section id="equipa" className="mt-8 scroll-mt-24">
        <h2 className="text-[1.3rem] font-semibold tracking-[-0.01em] text-white">A equipa</h2>
        <p className="mt-0.5 text-[13px] text-white/45">Os números de cada carteira. Carrega num consultor para ir à secção dele.</p>
        <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02]">
          <div className={`hidden gap-4 border-b border-white/[0.07] px-5 py-3 text-[12px] text-white/40 lg:grid ${COLS}`}>
            <span>Consultor</span>
            <span>Projetos</span>
            <span>Esta semana</span>
            <span>Em atraso</span>
            <span>Em aprovação</span>
            <span>NPS de {prevShort.toLowerCase()}</span>
            <span>Folga livre</span>
            <span>Fim de plano</span>
            <span className="w-4" />
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {team.map(({ slug, view, sum }) => {
              const t = view.totals;
              const avatar = getTeamAvatar(findEmployeeByName(view.consultant)?.username);
              return (
                <li key={slug}>
                  <a
                    href={`#${slug}`}
                    className={`group grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-3.5 text-[13px] transition hover:bg-white/[0.03] sm:grid-cols-4 lg:items-center ${COLS}`}
                  >
                    <span className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-4 lg:col-span-1">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatar} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-white/15" />
                      ) : (
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[14px] font-semibold text-white"
                          style={{ background: "var(--brand-gradient)" }}
                        >
                          {view.consultant.slice(0, 1)}
                        </span>
                      )}
                      <span className="truncate text-[14px] font-medium text-white">{view.consultant}</span>
                    </span>
                    <Cell label="Projetos">
                      <span className="text-white/85">{t.clients}</span>
                    </Cell>
                    <Cell label="Esta semana">
                      {t.thisWeekRemaining > 0 ? (
                        <span className="text-white/85">
                          <b className="font-semibold">{t.thisWeekRemaining}</b> por fazer
                        </span>
                      ) : (
                        <span className="text-emerald-200">em dia</span>
                      )}
                    </Cell>
                    <Cell label="Em atraso">
                      <span className={t.overdue >= 5 ? "font-semibold text-rose-200" : t.overdue > 0 ? "font-semibold text-amber-200" : "text-white/40"}>
                        {t.overdue}
                      </span>
                    </Cell>
                    <Cell label="Em aprovação">
                      <span className={t.pendingApproval > 0 ? "font-semibold text-violet-200" : "text-white/40"}>{t.pendingApproval}</span>
                    </Cell>
                    <Cell label={`NPS de ${prevShort.toLowerCase()}`}>
                      {sum.prevAvg === null ? (
                        <span className="text-white/35">—</span>
                      ) : (
                        <span>
                          <b className="font-semibold" style={{ color: npsScoreColor(sum.prevAvg) }}>
                            {sum.prevAvg.toFixed(1).replace(".", ",")}
                          </b>{" "}
                          <span className="text-[11.5px] text-white/40">
                            {sum.prevAnswered}/{sum.npsProjects}
                          </span>
                        </span>
                      )}
                    </Cell>
                    <Cell label="Folga livre">
                      <span className="tabular-nums text-white/85">{eurCents(sum.folgaFree)}</span>
                      {sum.folgaOver > 0 && (
                        <span className="block text-[11.5px] text-rose-200/85">
                          {sum.folgaOver} acima da folga
                        </span>
                      )}
                    </Cell>
                    <Cell label="Fim de plano">
                      {sum.ending > 0 ? (
                        <span className="font-semibold text-amber-200">
                          {sum.ending} {sum.ending === 1 ? "projeto" : "projetos"}
                        </span>
                      ) : (
                        <span className="text-white/40">nenhum</span>
                      )}
                    </Cell>
                    <ArrowRight className="hidden h-4 w-4 rotate-90 text-white/25 transition group-hover:translate-y-0.5 group-hover:text-white/60 lg:block" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Cada consultor, pela ordem da board. */}
      {team.map(({ slug, view, portfolio }) => (
        <section key={slug} id={slug} className="mt-14 scroll-mt-24 border-t border-white/[0.08] pt-12">
          <ConsultantHeader view={view} heading="h2" href={`/seo/roadmaps/${slug}`} />
          <ConsultantWeekView view={view} portfolio={portfolio} anchorId={`semana-${slug}`} />
          <Link href="#equipa" className="text-[12.5px] text-white/40 transition hover:text-white">
            ↑ Voltar à equipa
          </Link>
        </section>
      ))}
    </PageShell>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="min-w-0">
      <span className="block text-[11px] text-white/40 lg:hidden">{label}</span>
      {children}
    </span>
  );
}
