// Ineficácias — a página do PRÓPRIO consultor: o relatório para assinar a
// qualquer hora (primeiro, v77.91), o botão «O meu painel» (a escala, o PA,
// o NO e a escala vivem em /ineficacias/painel) e o histórico
// dos seus relatórios com a pontuação da direção (IneficaciasHistory, o mesmo
// do painel desde a v78.71). Nunca vê os dos colegas: a
// única leitura é o índice do próprio username.
//
// Enquanto o módulo está «em construção» (lib/ineficacias/access.ts), quem
// não é SuperAdmin vê o painel de obras. A decisão usa QUEM FEZ LOGIN, para
// o André poder «Ver como» um consultor e testar a vista dele.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { DocsGuideChip } from "@/components/documentacao/docs-guide-chip";
import { UnderConstruction } from "@/components/ineficacias/under-construction";
import { OverviewButton } from "@/components/ineficacias/overview-button";
import { IneficaciasHistory } from "@/components/ineficacias/history-sections";
import { IneficaciaReportForm } from "@/components/ineficacias/report-form";
import { getCurrentEmployee, getImpersonation, isRealUserAdmin } from "@/lib/auth/server";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { getTeamAvatar } from "@/lib/team-avatars";
import { ineficaciasAvailable } from "@/lib/ineficacias/access";
import { loadConsultantForSelf } from "@/lib/ineficacias/store";
import { clientChoicesFor } from "@/lib/ineficacias/clients";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Team Inefficiency · Wonder Ads",
  robots: { index: false, follow: false },
};

export default async function IneficaciasPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login?next=/ineficacias");
  // Viewers não entram (o middleware já os devolve ao departamento).
  if (me.viewerOf) return null;
  const impersonation = await getImpersonation().catch(() => null);
  // A direção não tem relatório próprio — o lugar dela é o painel da equipa.
  if (me.isAdmin && !impersonation) redirect("/admin/ineficacias");

  if (!ineficaciasAvailable(await isRealUserAdmin())) {
    return (
      <PageShell backHref="/" backLabel="Início">
        <UnderConstruction name={me.name} />
      </PageShell>
    );
  }

  const today = todayLisbonISO();
  const [bundle, clients] = await Promise.all([loadConsultantForSelf(me.username, today), clientChoicesFor(me.name)]);
  const { state, reports, ledger } = bundle;
  const row = findEmployeeByUsername(me.username);
  const fullName = row?.fullName ?? me.name;

  return (
    <PageShell backHref="/" backLabel="Início">
      <header className="animate-fade-up mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="readout text-white/35">Operações · Ineficácias</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Team Inefficiency</span>
          </h1>
          <div className="mt-3">
            <DocsGuideChip blockId="ineficacias" href="/documentacao/ineficacias" label="Como funcionam as ineficácias" />
          </div>
        </div>
        <OverviewButton state={state} href="/ineficacias/painel" />
      </header>

      <section id="relatorio" className="animate-fade-up mt-8 scroll-mt-24">
        <IneficaciaReportForm
          employee={{ username: me.username, name: me.name, fullName, role: me.role, dept: me.dept, avatar: getTeamAvatar(me.username) }}
          today={today}
          clients={clients}
          readOnly={Boolean(impersonation)}
        />
      </section>

      <IneficaciasHistory reports={reports} direct={ledger.direct} />
    </PageShell>
  );
}
