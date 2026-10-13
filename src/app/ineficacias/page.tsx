// Ineficácias — a página do PRÓPRIO consultor: o seu lugar na escala (nível,
// PA, NO), o relatório semanal para assinar, e o histórico dos seus
// relatórios com a pontuação da direção. Nunca vê os dos colegas: a única
// leitura é o índice do próprio username.
//
// Enquanto o módulo está «em construção» (lib/ineficacias/access.ts), quem
// não é SuperAdmin vê o painel de obras. A decisão usa QUEM FEZ LOGIN, para
// o André poder «Ver como» um consultor e testar a vista dele.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, History, ShieldAlert } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { UnderConstruction } from "@/components/ineficacias/under-construction";
import { LevelGauge } from "@/components/ineficacias/level-gauge";
import { ScaleExplainer } from "@/components/ineficacias/scale-explainer";
import { ReportView, ScoreBadge } from "@/components/ineficacias/report-view";
import { WeeklyReportForm, type WeekOption } from "@/components/ineficacias/weekly-report-form";
import { getCurrentEmployee, getImpersonation, isRealUserAdmin } from "@/lib/auth/server";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { INEFICACIAS_SINCE, ineficaciasAvailable } from "@/lib/ineficacias/access";
import { loadConsultant } from "@/lib/ineficacias/store";
import {
  formatISODate,
  formatLisbonDateTime,
  LEVELS,
  noticedLabel,
  reasonLabel,
  reportableWeeks,
  weekLabel,
  weekRange,
} from "@/lib/ineficacias/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Ineficácias · Wonder Ads",
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
  const bundle = await loadConsultant(me.username, today);
  const { state, reports, ledger } = bundle;
  const row = findEmployeeByUsername(me.username);
  const fullName = row?.fullName ?? me.name;
  const reported = new Set(reports.map((r) => r.weekKey));
  const weeks: WeekOption[] = reportableWeeks(today, INEFICACIAS_SINCE)
    .filter((k) => !reported.has(k))
    .map((k) => ({ key: k, label: weekLabel(k), ...weekRange(k)! }));
  const direct = ledger.direct.slice().sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));

  return (
    <PageShell backHref="/" backLabel="Início">
      <header className="animate-fade-up mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="readout text-white/35">Operações · Team Inefficiency</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Ineficácias</span>
          </h1>
          <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-relaxed text-white/45">
            O teu relatório semanal, o PA e o NO, e onde estás na escala de incumprimento. Cada ocorrência que reportas é
            pontuada pela direção antes de entrar nas contas. Só tu e a direção veem esta página.
          </p>
        </div>
      </header>

      {state.pendingMeasure && (
        <p className="animate-fade-up mt-6 flex items-start gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-[12.5px] leading-relaxed text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <strong className="font-semibold">Atingiste o nível {state.pendingMeasure.level}</strong> a{" "}
            {formatISODate(state.pendingMeasure.since)} (PA {state.pendingMeasure.pa} · NO {state.pendingMeasure.no}).{" "}
            {LEVELS[state.pendingMeasure.level].measure} A direção vai marcar contigo — depois dessa reunião os contadores
            recomeçam.
          </span>
        </p>
      )}

      <div className="animate-fade-up mt-6">
        <LevelGauge state={state} who="tu" />
      </div>

      {state.counted.length > 0 && (
        <section className="animate-fade-up mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
          <p className="readout text-white/35">Na janela corrente · {state.counted.length} {state.counted.length === 1 ? "ocorrência" : "ocorrências"}</p>
          <ul className="mt-2 divide-y divide-white/[0.05]">
            {state.counted.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[12.5px]">
                <span className="tabular w-20 shrink-0 text-white/45">{formatISODate(o.occurredOn)}</span>
                <span className="min-w-0 flex-1 truncate text-white/80">
                  <span className="font-semibold">{o.client}</span> · {o.what}
                </span>
                <ScoreBadge score={o.score} size="sm" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="animate-fade-up mt-10">
        <WeeklyReportForm
          employee={{ username: me.username, name: me.name, fullName, role: me.role, dept: me.dept }}
          weeks={weeks}
          today={today}
          readOnly={Boolean(impersonation)}
        />
      </section>

      <div className="animate-fade-up mt-10">
        <ScaleExplainer />
      </div>

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
                    <span className="text-white/40"> · {formatISODate(d.occurredOn)} · {reasonLabel(d.reason, d.reasonOther)} · {noticedLabel(d.noticed)}</span>
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
