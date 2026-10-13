// Direção → um consultor: o seu lugar na escala, as ações (medida por
// aplicar, nível à mão, ocorrência direta), o histórico de eventos, e todos
// os relatórios dele com a pontuação por ocorrência e a assinatura completa
// (IP, user-agent, hash e verificação de integridade).

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarX2, ClipboardCheck, History, ShieldAlert, Wand2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LevelChip, LevelGauge } from "@/components/ineficacias/level-gauge";
import { ScaleExplainer } from "@/components/ineficacias/scale-explainer";
import { ReportView, ScoreBadge } from "@/components/ineficacias/report-view";
import { ItemScoreControl, MarkReviewedButton } from "@/components/ineficacias/admin-scoring";
import { DirectOccurrenceForm, MeasureForm, SetLevelForm } from "@/components/ineficacias/admin-ledger-actions";
import { getCurrentEmployee } from "@/lib/auth/server";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { getTeamAvatar } from "@/lib/team-avatars";
import { INEFICACIAS_OPEN_TO_TEAM, INEFICACIAS_SINCE } from "@/lib/ineficacias/access";
import { loadConsultant, verifyIntegrity } from "@/lib/ineficacias/store";
import {
  firstName,
  formatISODate,
  formatLisbonDateTime,
  missingWeeks,
  noticedLabel,
  reasonLabel,
  weekLabel,
  type LedgerEvent,
} from "@/lib/ineficacias/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Ineficácias do consultor — SuperAdmin Control Suite",
};

function eventTitle(e: LedgerEvent): string {
  if (e.kind === "measure") {
    return e.level === 3 ? "Probation iniciado (nível 3)" : `1:1 do nível ${e.level} realizado`;
  }
  return `Nível definido à mão: ${e.level}`;
}

export default async function IneficaciasConsultantPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ relatorio?: string }>;
}) {
  const employee = await getCurrentEmployee();
  if (!employee?.isAdmin) return null;
  const { username: raw } = await params;
  const row = findEmployeeByUsername(decodeURIComponent(raw));
  if (!row || row.isAdmin || row.viewerOf) notFound();
  const username = row.username;
  const today = todayLisbonISO();
  const bundle = await loadConsultant(username, today);
  const { state, reports, ledger } = bundle;
  const openId = (await searchParams).relatorio ?? reports.find((r) => !r.review)?.id ?? reports[0]?.id ?? null;
  // Enquanto o módulo está fechado à equipa ninguém deve relatório nenhum.
  const missing = INEFICACIAS_OPEN_TO_TEAM ? missingWeeks(new Set(reports.map((r) => r.weekKey)), today, INEFICACIAS_SINCE) : [];
  const events = ledger.events.slice().sort((a, b) => b.at.localeCompare(a.at) || b.createdAt - a.createdAt);
  const direct = ledger.direct.slice().sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  const avatar = getTeamAvatar(username);
  const who = firstName(row.fullName ?? row.name) || row.name;

  return (
    <PageShell>
      <Link href="/admin/ineficacias" className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Ineficácias da equipa
      </Link>

      <header className="animate-fade-up mt-2 flex flex-wrap items-center gap-4">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-14 w-14 rounded-2xl border border-white/10 object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-[18px] font-bold text-white/70">
            {row.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="readout text-white/35">Operações · Team Inefficiency · Direção</p>
          <h1 className="mt-0.5 flex flex-wrap items-center gap-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            <span className="brand-gradient-text">{row.fullName ?? row.name}</span>
            <LevelChip state={state} />
          </h1>
          <p className="mt-1 text-[12.5px] text-white/45">
            {row.role} · {row.dept} · {reports.length} {reports.length === 1 ? "relatório" : "relatórios"}
            {missing.length ? ` · ${missing.length} ${missing.length === 1 ? "semana em falta" : "semanas em falta"}` : " · semanas em dia"}
          </p>
        </div>
      </header>

      <div className="animate-fade-up mt-6">
        <LevelGauge state={state} who={who} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* coluna principal */}
        <div className="min-w-0 space-y-10">
          {state.counted.length > 0 && (
            <section className="animate-fade-up rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
              <p className="readout text-white/35">Na janela corrente · {state.counted.length} {state.counted.length === 1 ? "ocorrência" : "ocorrências"} · PA {state.pa} · NO {state.no}</p>
              <ul className="mt-2 divide-y divide-white/[0.05]">
                {state.counted.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[12.5px]">
                    <span className="tabular w-20 shrink-0 text-white/45">{formatISODate(o.occurredOn)}</span>
                    <span className="min-w-0 flex-1 truncate text-white/80">
                      <span className="font-semibold">{o.client}</span> · {o.what}
                      {o.source === "direcao" && <span className="ml-1.5 text-[10.5px] uppercase tracking-[0.12em] text-amber-200/70">direção</span>}
                    </span>
                    <ScoreBadge score={o.score} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="animate-fade-up" aria-label="Relatórios semanais">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-white">
              <ClipboardCheck className="h-4 w-4 text-[color:var(--brand-purple)]" />
              Relatórios semanais
            </h2>
            {reports.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-white/12 px-5 py-6 text-[12.5px] text-white/45">
                {who} ainda não assinou nenhum relatório.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {reports.map((r) => (
                  <ReportView
                    key={r.id}
                    report={r}
                    audience="direcao"
                    integrity={verifyIntegrity(r)}
                    defaultOpen={r.id === openId}
                    itemExtras={Object.fromEntries(
                      r.items.map((it) => [it.id, <ItemScoreControl key={it.id} target={{ reportId: r.id, itemId: it.id }} initial={it.score} />]),
                    )}
                    footer={
                      !r.review ? (
                        r.noErrors ? (
                          <MarkReviewedButton reportId={r.id} label="Confirmar receção (sem erros)" />
                        ) : (
                          <p className="text-[11.5px] text-white/40">
                            A revisão fecha-se sozinha quando todas as ocorrências estiverem pontuadas — e {who} recebe o aviso no sino.
                          </p>
                        )
                      ) : (
                        <p className="text-[11.5px] text-white/40">
                          Revisto por {r.review.byName || r.review.by} a {formatLisbonDateTime(r.review.at)}.
                        </p>
                      )
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {direct.length > 0 && (
            <section className="animate-fade-up" aria-label="Ocorrências registadas pela direção">
              <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-white">
                <ShieldAlert className="h-4 w-4 text-amber-300" />
                Ocorrências registadas pela direção
              </h2>
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
                    <div className="mt-3">
                      <ItemScoreControl target={{ username, occurrenceId: d.id }} initial={d.score} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* coluna lateral — ações + histórico */}
        <aside className="animate-fade-up space-y-4">
          <div id="medida" className="scroll-mt-24 space-y-3">
            {state.pendingMeasure && (
              <MeasureForm username={username} pending={state.pendingMeasure} today={today} defaultConductedBy={employee.name} />
            )}
            <SetLevelForm username={username} currentLevel={state.level} today={today} />
            <DirectOccurrenceForm username={username} today={today} />
          </div>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
              <History className="h-3.5 w-3.5" />
              Histórico da escala
            </p>
            {events.length === 0 ? (
              <p className="mt-2 text-[12px] text-white/40">Sem medidas registadas — {who} está no nível 0 desde o início.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="relative pl-5 text-[12px]">
                    <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${e.kind === "measure" ? "bg-[#a78bfa]" : "bg-amber-300"}`} />
                    <p className="font-semibold text-white/85">{eventTitle(e)}</p>
                    <p className="text-white/45">
                      {formatISODate(e.at)} · por {e.byName || e.by}
                      {e.kind === "measure" && e.conductedBy ? ` · conduziu: ${e.conductedBy}` : ""}
                    </p>
                    {e.kind === "measure" && e.actions.length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-white/60">
                        {e.actions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    )}
                    {e.note && <p className="mt-1 text-white/55">{e.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
              <CalendarX2 className="h-3.5 w-3.5" />
              Semanas em falta
            </p>
            {missing.length === 0 ? (
              <p className="mt-2 text-[12px] text-emerald-200/80">
                {INEFICACIAS_OPEN_TO_TEAM
                  ? `Em dia — todas as semanas desde ${formatISODate(INEFICACIAS_SINCE)} têm relatório.`
                  : "O módulo ainda está fechado à equipa — ninguém deve relatório nenhum por enquanto."}
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-[12px] text-white/65">
                {missing.map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-rose-400" />
                    {weekLabel(k)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="flex items-start gap-2 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3 text-[11px] leading-relaxed text-white/40">
            <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Pontuar a 0 significa «não conta» — a ocorrência fica registada, mas não entra no PA nem no NO.
          </p>
        </aside>
      </div>

      <div className="animate-fade-up mt-10">
        <ScaleExplainer />
      </div>
    </PageShell>
  );
}
