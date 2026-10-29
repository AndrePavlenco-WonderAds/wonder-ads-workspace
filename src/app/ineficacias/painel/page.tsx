// «O meu painel» das Ineficácias (v77.91) — o lugar do consultor na escala:
// o nível, o PA e o NO desde a última subida de nível e as ocorrências que contam
// agora. Saiu do topo da página do relatório (o André pediu o formulário
// primeiro) e abre-se pelo botão «O meu painel».
//
// Os mesmos portões da página do relatório: só o próprio índice, a direção
// vai para o painel da equipa, e «em construção» decide-se por quem fez
// login.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, PenLine } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { UnderConstruction } from "@/components/ineficacias/under-construction";
import { LevelGauge } from "@/components/ineficacias/level-gauge";
import { ScoreBadge } from "@/components/ineficacias/report-view";
import { getCurrentEmployee, getImpersonation, isRealUserAdmin } from "@/lib/auth/server";
import { ineficaciasAvailable } from "@/lib/ineficacias/access";
import { loadConsultantForSelf } from "@/lib/ineficacias/store";
import { formatISODate, LEVELS } from "@/lib/ineficacias/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "O meu painel · Ineficácias · Wonder Ads",
  robots: { index: false, follow: false },
};

export default async function IneficaciasPainelPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login?next=/ineficacias/painel");
  if (me.viewerOf) return null;
  const impersonation = await getImpersonation().catch(() => null);
  if (me.isAdmin && !impersonation) redirect("/admin/ineficacias");

  if (!ineficaciasAvailable(await isRealUserAdmin())) {
    return (
      <PageShell backHref="/" backLabel="Início">
        <UnderConstruction name={me.name} />
      </PageShell>
    );
  }

  const today = todayLisbonISO();
  const { state } = await loadConsultantForSelf(me.username, today);

  return (
    <PageShell backHref="/ineficacias" backLabel="Team Inefficiency">
      <header className="animate-fade-up mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="readout text-white/35">Ineficácias · Team Inefficiency</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">O meu painel</span>
          </h1>
        </div>
        <Link
          href="/ineficacias"
          className="group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_14px_40px_-14px_rgba(120,61,245,0.8)] transition hover:-translate-y-0.5 hover:brightness-110"
          style={{ background: "var(--brand-gradient)" }}
        >
          <PenLine className="h-4 w-4" />
          Reportar um erro
        </Link>
      </header>

      {state.pendingMeasure && (
        <p className="animate-fade-up mt-6 flex items-start gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-[12.5px] leading-relaxed text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <strong className="font-semibold">Atingiste o nível {state.pendingMeasure.level}</strong> a{" "}
            {formatISODate(state.pendingMeasure.since)} (PA {state.pendingMeasure.pa} · NO {state.pendingMeasure.no}).{" "}
            {LEVELS[state.pendingMeasure.level].measure} A direção vai marcar contigo. Os teus contadores já recomeçaram do
            zero no dia seguinte.
          </span>
        </p>
      )}

      <div className="animate-fade-up mt-6">
        <LevelGauge state={state} who="tu" />
      </div>

      <section className="animate-fade-up mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
        <p className="readout text-white/35">
          Desde a última subida de nível · {state.counted.length} {state.counted.length === 1 ? "ocorrência" : "ocorrências"}
        </p>
        {state.counted.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-white/45">Nenhuma ocorrência pontuada a contar neste momento.</p>
        ) : (
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
        )}
      </section>
    </PageShell>
  );
}
