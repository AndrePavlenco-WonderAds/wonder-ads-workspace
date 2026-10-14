// Ineficácias — a página do PRÓPRIO consultor: o relatório para assinar a
// qualquer hora (primeiro, v77.91), o botão «O meu painel» (a escala, o PA,
// o NO e o relógio dos 30 dias vivem em /ineficacias/painel) e o histórico
// dos seus relatórios com a pontuação da direção. Nunca vê os dos colegas: a
// única leitura é o índice do próprio username.
//
// Enquanto o módulo está «em construção» (lib/ineficacias/access.ts), quem
// não é SuperAdmin vê o painel de obras. A decisão usa QUEM FEZ LOGIN, para
// o André poder «Ver como» um consultor e testar a vista dele.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { History, ShieldAlert } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { UnderConstruction } from "@/components/ineficacias/under-construction";
import { OverviewButton } from "@/components/ineficacias/overview-button";
import { ReportView, ScoreBadge } from "@/components/ineficacias/report-view";
import { IneficaciaReportForm } from "@/components/ineficacias/report-form";
import { getCurrentEmployee, getImpersonation, isRealUserAdmin } from "@/lib/auth/server";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { getTeamAvatar } from "@/lib/team-avatars";
import { ineficaciasAvailable } from "@/lib/ineficacias/access";
import { loadConsultant } from "@/lib/ineficacias/store";
import { clientChoicesFor } from "@/lib/ineficacias/clients";
import { errorTypeLabel, formatISODate, formatLisbonDateTime, noticedLabel, reasonLabel } from "@/lib/ineficacias/shared";
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
  const [bundle, clients] = await Promise.all([loadConsultant(me.username, today), clientChoicesFor(me.name)]);
  const { state, reports, ledger } = bundle;
  const row = findEmployeeByUsername(me.username);
  const fullName = row?.fullName ?? me.name;
  const direct = ledger.direct.slice().sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));

  return (
    <PageShell backHref="/" backLabel="Início">
      <header className="animate-fade-up mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="readout text-white/35">Operações · Ineficácias</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Team Inefficiency</span>
          </h1>
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

      {direct.length > 0 && (
        <section className="animate-fade-up mt-10" aria-label="Ocorrências registadas pela direção">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-white">
            <ShieldAlert className="h-4 w-4 text-amber-300" />
            Ocorrências registadas pela direção
          </h2>
          <p className="mt-1 text-[12px] text-white/45">
            Registadas diretamente pela direção (não vieram de um relatório teu). Contam como as outras.
          </p>
          <div className="mt-3 space-y-3">
            {direct.map((d) => (
              <article key={d.id} className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] text-white/80">
                    <span className="font-semibold">{d.client}</span>
                    <span className="text-white/40"> · {formatISODate(d.occurredOn)} · {reasonLabel(d.reason, d.reasonOther)} · {noticedLabel(d.noticed)}
                      {d.firstTime === true ? " · primeira vez" : d.firstTime === false ? ` · repetido (última vez: ${d.lastTime || "—"})` : ""}
                      {d.errorType ? ` · ${errorTypeLabel(d.errorType).toLowerCase()}` : ""}
                    </span>
                  </p>
                  <ScoreBadge score={d.score} size="sm" />
                </header>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">{d.what}</p>
                {d.shouldHave && <p className="mt-2 text-[12px] text-white/55">Como deveria ter sido: {d.shouldHave}</p>}
                {d.score.note && (
                  <p className="mt-2 text-[12px] text-white/55">
                    Nota ({d.score.byName || "direção"}, {formatLisbonDateTime(d.score.at)}): {d.score.note}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="animate-fade-up mt-10" aria-label="Os meus relatórios">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-white">
            <History className="h-4 w-4 text-[color:var(--brand-purple)]" />
            Os meus relatórios
          </h2>
          {reports.length > 0 && <span className="tabular text-[11px] text-white/35">{reports.length} no total</span>}
        </div>
        {reports.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-white/12 px-5 py-6 text-[12.5px] text-white/45">
            Ainda não assinaste nenhum relatório. O primeiro fica aqui, com a assinatura e a pontuação da direção.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {reports.map((r, i) => (
              <ReportView key={r.id} report={r} audience="consultor" defaultOpen={i === 0} />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
