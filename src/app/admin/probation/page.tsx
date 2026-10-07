// SuperAdmin → Planos de Probation: o painel de todos os planos.
//
// v77.77 — deixa de ser uma tabela e passa a ser um painel de
// acompanhamento: os números do momento, a agenda dos próximos 7 dias
// (check-ins e avaliações, atrasados à cabeça), um cartão por plano em
// aberto com os 30 dias, os check-ins semana a semana e o que o consultor
// já recebeu e confirmou; os fechados ficam numa lista compacta por baixo.
//
// Só SuperAdmin: a página verifica isAdmin antes de ler o KV (o layout de
// /admin sozinho não basta — ver abaixo) e as APIs voltam a verificar.

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  CheckCheck,
  ClipboardCheck,
  FileDown,
  PencilLine,
  Plus,
  Scale,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { StatusChip } from "@/components/probation/status-chip";
import { PlanCard } from "@/components/probation/plan-card";
import { getPublishedMany, listPlans, probationConfigured } from "@/lib/probation/store";
import {
  activationProblem,
  addDaysISO,
  finalDecision,
  formatISODate,
  periodDates,
  planStatus,
  weekDate,
  type ProbationPlan,
} from "@/lib/probation/shared";
import { todayLisbonISO } from "@/lib/probation/progress";
import { pendingAcks } from "@/lib/probation/published";
import { getCurrentEmployee } from "@/lib/auth/server";
import { formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Planos de Probation — SuperAdmin Control Suite",
};

/** O template em branco — uma rota de API (descarga), não uma página. */
const TEMPLATE_PDF = "/api/admin/probation/template/pdf";

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function day(iso: string): string {
  const f = formatISODate(iso);
  if (!f) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${f.slice(0, 5)}`;
}

function isOpen(plan: ProbationPlan): boolean {
  if (plan.isDraft) return false;
  const f = finalDecision(plan.period);
  return !f || f === "extensao";
}

type AgendaItem = {
  key: string;
  date: string;
  kind: "checkin" | "eval";
  title: string;
  who: string;
  href: string;
};

function agendaFor(plans: ProbationPlan[], today: string): AgendaItem[] {
  const horizon = addDaysISO(today, 7);
  const out: AgendaItem[] = [];
  for (const plan of plans) {
    if (!isOpen(plan) || !plan.period.startDate) continue;
    const href = `/admin/probation/${plan.id}`;
    for (const w of plan.period.weeks) {
      if (w.done) continue;
      const date = weekDate(w, plan.period.startDate, plan.checkinDay);
      if (date && date <= horizon) {
        out.push({ key: `${plan.id}-w${w.n}`, date, kind: "checkin", title: `Check-in · semana ${w.n}`, who: plan.consultantName, href: `${href}?tab=semanas&semana=${w.n}` });
      }
    }
    const { d15, d30 } = periodDates(plan.period);
    if (!plan.period.eval15.decision && d15 <= horizon) {
      out.push({ key: `${plan.id}-e15`, date: d15, kind: "eval", title: "Avaliação dos 15 dias", who: plan.consultantName, href: `${href}?tab=avaliacoes` });
    } else if (plan.period.eval15.decision === "extensao" && !plan.period.eval30.decision && d30 <= horizon) {
      out.push({ key: `${plan.id}-e30`, date: d30, kind: "eval", title: "Avaliação dos 30 dias", who: plan.consultantName, href: `${href}?tab=avaliacoes` });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export default async function ProbationListPage({
  searchParams,
}: {
  searchParams: Promise<{ guardado?: string }>;
}) {
  // O layout de /admin mostra o «SuperAdmin only», mas NÃO chega: no App
  // Router a página renderiza em paralelo com o layout e o payload dela
  // segue na resposta mesmo quando o layout recusa. Dados de RH → a página
  // verifica por conta própria, ANTES de ler o que quer que seja.
  const employee = await getCurrentEmployee();
  if (!employee?.isAdmin) return null;
  const today = todayLisbonISO();
  const plans = await listPlans();
  const pubs = await getPublishedMany(plans.map((p) => p.id));

  const open = plans.filter(isOpen).sort((a, b) => (a.period.startDate || "").localeCompare(b.period.startDate || ""));
  const drafts = plans.filter((p) => p.isDraft).sort((a, b) => b.updatedAt - a.updatedAt);
  const closed = plans.filter((p) => !p.isDraft && !isOpen(p)).sort((a, b) => b.updatedAt - a.updatedAt);
  const justSaved = (await searchParams).guardado === "1";
  const agenda = agendaFor(open, today);
  const toConfirm = open.reduce((s, p) => s + (pubs.get(p.id) ? pendingAcks(pubs.get(p.id)!).length : 0), 0);
  const late = agenda.filter((a) => a.date < today).length;

  return (
    <PageShell>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Control Suite
      </Link>

      <header className="animate-fade-up mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="readout text-white/35">Recursos Humanos · Direção</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Planos de Probation</span>
          </h1>
          <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-relaxed text-white/45">
            30 dias, um check-in por semana com a chefia (ou a direção) e duas avaliações. Tudo o que o consultor
            recebe passa antes pela pré-visualização, e fica registado quando ele confirma que leu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={TEMPLATE_PDF}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[12.5px] font-medium text-white/75 transition hover:border-white/25 hover:text-white"
          >
            <FileDown className="h-3.5 w-3.5" />
            Template em branco (PDF)
          </a>
          <Link
            href="/admin/probation/novo"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo plano
          </Link>
        </div>
      </header>

      {justSaved && (
        <p className="animate-fade-up mt-6 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-[12.5px] text-emerald-100">
          <PencilLine className="h-4 w-4" />
          Rascunho guardado — está em «Rascunhos», mais abaixo. Abre-o quando quiseres continuar.
        </p>
      )}

      {!probationConfigured && (
        <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-100">
          O armazenamento (KV) não está configurado neste ambiente — os planos não podem ser lidos nem gravados.
        </p>
      )}

      {plans.length === 0 ? (
        <div className="animate-fade-up mt-8 rounded-2xl border border-dashed border-white/12 px-6 py-10 text-center">
          <ClipboardCheck className="mx-auto h-6 w-6 text-white/30" />
          <p className="mt-3 text-[13px] text-white/55">Nenhum plano de probation criado.</p>
        </div>
      ) : (
        <>
          {/* números do momento */}
          <section className="animate-fade-up mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Planos em aberto", value: open.length, tone: "text-white" },
              { label: "Para os próximos 7 dias", value: agenda.length, tone: "text-[#c3aaff]" },
              { label: "Atrasados", value: late, tone: late ? "text-rose-300" : "text-white/60" },
              { label: "Por confirmar pelos consultores", value: toConfirm, tone: toConfirm ? "text-amber-200" : "text-white/60" },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5">
                <p className={`text-[26px] font-bold leading-none tabular-nums ${k.tone}`}>{k.value}</p>
                <p className="mt-1.5 text-[11.5px] text-white/45">{k.label}</p>
              </div>
            ))}
          </section>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* planos em aberto */}
            <section className="animate-fade-up min-w-0">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Em aberto · {open.length}
              </p>
              {open.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/12 px-5 py-6 text-[12.5px] text-white/45">
                  Nenhum plano em curso.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {open.map((p) => (
                    <PlanCard key={p.id} plan={p} pub={pubs.get(p.id) ?? null} today={today} />
                  ))}
                </div>
              )}
            </section>

            {/* agenda */}
            <aside className="animate-fade-up">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Agenda · próximos 7 dias</p>
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                {agenda.length === 0 ? (
                  <p className="flex items-center gap-2 px-4 py-5 text-[12.5px] text-white/45">
                    <CheckCheck className="h-4 w-4 text-emerald-300/70" />
                    Nada marcado para os próximos dias.
                  </p>
                ) : (
                  agenda.map((a, i) => {
                    const lateItem = a.date < today;
                    const isToday = a.date === today;
                    return (
                      <Link
                        key={a.key}
                        href={a.href}
                        className={`flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04] ${i ? "border-t border-white/[0.05]" : ""}`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            a.kind === "eval" ? "bg-[#783DF5]/15 text-[#c3aaff]" : "bg-white/[0.06] text-white/60"
                          }`}
                        >
                          {a.kind === "eval" ? <Scale className="h-4 w-4" /> : <CalendarCheck2 className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold text-white/85">{a.who}</span>
                          <span className="block truncate text-[11.5px] text-white/45">{a.title}</span>
                        </span>
                        <span
                          className={`shrink-0 text-right text-[11px] font-semibold tabular-nums ${
                            lateItem ? "text-rose-300" : isToday ? "text-[#c3aaff]" : "text-white/50"
                          }`}
                        >
                          {lateItem ? "atrasado" : isToday ? "hoje" : day(a.date)}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </aside>
          </div>

          {drafts.length > 0 && (
            <section className="animate-fade-up mt-10">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Rascunhos · {drafts.length}
              </p>
              <div className="overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.015]">
                {drafts.map((p, i) => {
                  const missing = activationProblem(p);
                  return (
                    <Link
                      key={p.id}
                      href={`/admin/probation/${p.id}`}
                      className={`group flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04] ${i ? "border-t border-white/[0.05]" : ""}`}
                    >
                      <PencilLine className="h-4 w-4 shrink-0 text-white/35" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-white/85">
                          {p.consultantName.trim() || "Rascunho sem nome"}
                        </span>
                        <span className="block truncate text-[11.5px] text-white/40">
                          Guardado a {formatDateTime(p.updatedAt)}
                          {missing ? ` · falta ${missing.replace(/^Falta /, "").replace(/\.$/, "")}` : " · pronto a ativar"}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#c3aaff] group-hover:underline">
                        Continuar
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {closed.length > 0 && (
            <section className="animate-fade-up mt-10">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Fechados · {closed.length}</p>
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                {closed.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/admin/probation/${p.id}`}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04] ${i ? "border-t border-white/[0.05]" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-white/85">{p.consultantName}</span>
                      <span className="block truncate text-[11.5px] text-white/40">
                        {p.roleTeam || "—"} · início {formatISODate(p.period.startDate) || "—"}
                      </span>
                    </span>
                    <StatusChip status={planStatus(p)} />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </PageShell>
  );
}
