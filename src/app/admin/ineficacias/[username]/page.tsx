// Direção → um consultor (v80.50, refeita para se ler de cima a baixo):
//   1. o ponto da situação numa faixa (PA, NO, por pontuar, desde quando
//      contam) — a escala inteira fica num «ver mais»;
//   2. POR PONTUAR: uma mesa por ocorrência, com o passado que interessa ao
//      lado (mesmo cliente, mesmo motivo, parecidas) e o efeito da pontuação
//      no PA/NO de hoje;
//   3. o HISTÓRICO: tudo numa linha cada, por mês, com filtros e pesquisa, e
//      o percurso na escala pelo meio;
// A coluna lateral tem as ações da escala, os padrões da pessoa e, no fundo,
// os RELATÓRIOS ASSINADOS num cartão mínimo (v80.57): uma linha por relatório
// com o escudo da integridade; a prova (hash, IP, user-agent) abre-se ao tocar.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  ClipboardCheck,
  Gauge,
  Hourglass,
  ListTree,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  Sigma,
  Wand2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LevelChip, LevelGauge, LEVEL_TONES } from "@/components/ineficacias/level-gauge";
import { MeasureForm, SetLevelForm } from "@/components/ineficacias/admin-ledger-actions";
import { PendingDeskCard } from "@/components/ineficacias/admin-desk";
import { AdminHistory } from "@/components/ineficacias/admin-history";
import { getCurrentEmployee } from "@/lib/auth/server";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { getTeamAvatar } from "@/lib/team-avatars";
import { loadConsultant, verifyIntegrity } from "@/lib/ineficacias/store";
import { buildAdminView } from "@/lib/ineficacias/admin-view";
import { firstName, formatISODate, formatLisbonDateTime, phaseOpenLabel, REASONS } from "@/lib/ineficacias/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Ineficácias do consultor — SuperAdmin Control Suite",
};

function Meter({ label, value, limit, icon: Icon, tone }: { label: string; value: number; limit: number | null; icon: typeof Sigma; tone: string }) {
  const hot = limit !== null && value >= limit;
  const ratio = limit ? Math.min(1, value / limit) : 0;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/40">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className={`mt-1 text-[24px] font-bold leading-none tabular-nums ${hot ? "text-rose-300" : "text-white"}`}>
        {value}
        {limit !== null && <span className="ml-1 text-[12px] font-medium text-white/35">/ {limit}</span>}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full ${hot ? "bg-rose-400" : tone}`} style={{ width: `${Math.max(ratio * 100, value > 0 ? 6 : 0)}%` }} />
      </div>
    </div>
  );
}

export default async function IneficaciasConsultantPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ relatorio?: string; oc?: string }>;
}) {
  const employee = await getCurrentEmployee();
  if (!employee?.isAdmin) return null;
  const { username: raw } = await params;
  const row = findEmployeeByUsername(decodeURIComponent(raw));
  if (!row || row.isAdmin || row.viewerOf) notFound();
  const username = row.username;
  const today = todayLisbonISO();
  const { state, reports, ledger } = await loadConsultant(username, today);
  const view = buildAdminView(username, reports, ledger, state);
  const avatar = getTeamAvatar(username);
  const who = firstName(row.fullName ?? row.name) || row.name;

  // De onde se chega: o sino/Slack/painel apontam para um relatório
  // (?relatorio=) ou para uma ocorrência (?oc=). As por pontuar ficam
  // realçadas na mesa; as outras abrem-se no histórico.
  const sp = await searchParams;
  const focusReport = sp.relatorio ? reports.find((r) => r.id === sp.relatorio) : undefined;
  const focusAll = new Set<string>([...(focusReport?.items.map((it) => it.id) ?? []), ...(sp.oc ? [sp.oc] : [])]);
  const pendingIds = new Set(view.pending.map((p) => p.entry.id));
  const historyFocus = [...focusAll].filter((id) => !pendingIds.has(id));

  const impactBase = {
    pa: state.pa,
    no: state.no,
    next: state.next,
    phaseLabel: state.phaseOpen ? `${phaseOpenLabel(state.phaseOpen)}, a ${formatISODate(state.phaseOpen.at)}` : null,
    who,
  };

  // Os padrões da pessoa, para a coluna lateral.
  const scored = view.entries.filter((e) => e.score);
  const byReason = REASONS.map((r) => ({ ...r, n: view.entries.filter((e) => e.reasonId === r.id).length })).filter((r) => r.n > 0);
  const maxReason = Math.max(1, ...byReason.map((r) => r.n));
  const topClients = view.clients
    .map((c) => ({ c, n: view.entries.filter((e) => e.client === c).length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  const both = scored.filter((e) => e.selfScore !== null);
  const avg = (xs: number[]) => (xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1).replace(".", ",") : "—");
  const repeated = view.entries.filter((e) => e.firstTime === false).length;
  const tone = LEVEL_TONES[state.level];

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
            {row.role} · {row.dept} · {view.counts.todas} {view.counts.todas === 1 ? "ocorrência" : "ocorrências"} no registo · {reports.length}{" "}
            {reports.length === 1 ? "relatório assinado" : "relatórios assinados"}
          </p>
        </div>
        <Link
          href={`/admin/ineficacias/registar?consultor=${encodeURIComponent(username)}`}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px"
          style={{ background: "var(--brand-gradient)" }}
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Registar ineficácia de {who}
        </Link>
      </header>

      {state.pendingMeasure && (
        <a
          href="#medida"
          className="animate-fade-up mt-5 flex items-center gap-3 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-[12.5px] text-rose-100 transition hover:bg-rose-500/15"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">Medida do nível {state.pendingMeasure.level} por aplicar</span> — atingido a{" "}
            {formatISODate(state.pendingMeasure.since)} (PA {state.pendingMeasure.pa} · NO {state.pendingMeasure.no}).
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-rose-200/70" />
        </a>
      )}

      {/* o ponto da situação */}
      <section aria-label="Ponto da situação" className="animate-fade-up mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Meter label="PA · pontos" value={state.pa} limit={state.next?.pa ?? null} icon={Sigma} tone={tone.dot} />
        <Meter label="NO · ocorrências" value={state.no} limit={state.next?.no ?? null} icon={Gauge} tone={tone.dot} />
        <a
          href={view.pending.length ? "#por-pontuar" : "#historico"}
          className={`rounded-2xl border px-4 py-3 transition ${
            view.pending.length ? "border-[#a78bfa]/40 bg-[#783DF5]/10 hover:bg-[#783DF5]/15" : "border-white/[0.08] bg-white/[0.025]"
          }`}
        >
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/40">
            <Hourglass className="h-3.5 w-3.5" />
            Por pontuar
          </p>
          <p className={`mt-1 text-[24px] font-bold leading-none tabular-nums ${view.pending.length ? "text-[#c3aaff]" : "text-white/40"}`}>
            {view.pending.length}
          </p>
          <p className="mt-2 text-[10.5px] text-white/40">{view.pending.length ? "Ver a mesa de pontuação ↓" : "Tudo pontuado"}</p>
        </a>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/40">
            <RotateCcw className="h-3.5 w-3.5" />
            Contam desde
          </p>
          <p className="mt-1 text-[14px] font-semibold leading-snug text-white/85">
            {state.phaseStart ? formatISODate(state.phaseStart) : "o início"}
          </p>
          <p className="mt-1 text-[10.5px] leading-snug text-white/40">
            {state.phaseOpen ? `Depois de ${phaseOpenLabel(state.phaseOpen)}.` : "Nunca houve reset."}
            {state.nextReset ? ` Reset a ${formatISODate(state.nextReset.at)}.` : ""}
          </p>
        </div>
      </section>

      <details className="animate-fade-up group mt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[11.5px] font-semibold text-white/45 transition hover:text-white/80 [&::-webkit-details-marker]:hidden">
          <ListTree className="h-3.5 w-3.5" />
          <span className="group-open:hidden">Ver a escala completa e as regras</span>
          <span className="hidden group-open:inline">Esconder a escala</span>
        </summary>
        <div className="mt-3">
          <LevelGauge state={state} who={who} />
        </div>
      </details>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* coluna principal */}
        <div className="min-w-0 space-y-10">
          <section id="por-pontuar" aria-label="Por pontuar" className="animate-fade-up scroll-mt-24">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-white">
              <Hourglass className="h-4 w-4 text-[#c3aaff]" />
              Por pontuar
              <span className="tabular rounded-full bg-white/[0.08] px-2 text-[12px] text-white/60">{view.pending.length}</span>
            </h2>
            {view.pending.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 text-[12.5px] text-white/50">
                <CheckCheck className="h-4 w-4 text-emerald-300/70" />
                Nada por pontuar — o histórico de {who} está todo em baixo.
              </p>
            ) : (
              <>
                <p className="mt-1 text-[12px] text-white/45">
                  Da mais antiga para a mais recente. Ao lado de cada uma, o passado de {who}: o mesmo cliente, o mesmo motivo e as
                  parecidas. Ao escolher os pontos vês o que acontece ao PA e ao NO.
                </p>
                <div className="mt-4 space-y-5">
                  {view.pending.map((desk) => (
                    <PendingDeskCard
                      key={desk.entry.id}
                      desk={desk}
                      who={who}
                      impact={{ ...impactBase, inPhase: desk.entry.inPhase }}
                      focused={focusAll.has(desk.entry.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          <section id="historico" aria-label="Histórico" className="animate-fade-up scroll-mt-24">
            <h2 className="mb-1 flex items-center gap-2 text-[17px] font-semibold tracking-tight text-white">
              <ListTree className="h-4 w-4 text-[color:var(--brand-purple)]" />
              Histórico de {who}
            </h2>
            <p className="mb-3 text-[12px] text-white/45">
              Todas as ocorrências (reportadas e registadas pela direção), uma por linha, com as subidas de nível, os resets e as
              medidas pelo meio. Toca numa linha para ver tudo.
            </p>
            <AdminHistory
              entries={view.entries}
              journey={view.journey}
              counts={view.counts}
              clients={view.clients}
              who={who}
              impactBase={impactBase}
              focusIds={historyFocus}
            />
          </section>
        </div>

        {/* coluna lateral — ações da escala + padrões */}
        <aside className="animate-fade-up space-y-4">
          <div id="medida" className="scroll-mt-24 space-y-3">
            {state.pendingMeasure && (
              <MeasureForm username={username} pending={state.pendingMeasure} today={today} defaultConductedBy={employee.name} />
            )}
            <SetLevelForm username={username} currentLevel={state.level} today={today} />
          </div>

          {view.entries.length > 0 && (
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Padrões de {who}</p>
              <ul className="mt-3 space-y-2">
                {byReason.map((r) => (
                  <li key={r.id} className="text-[11.5px]">
                    <span className="flex items-baseline justify-between gap-2 text-white/60">
                      <span className="truncate">
                        {r.letter} · {r.label}
                      </span>
                      <span className="tabular font-semibold text-white/85">{r.n}</span>
                    </span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <span className="block h-full rounded-full bg-[#a78bfa]" style={{ width: `${(r.n / maxReason) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3.5 space-y-1.5 border-t border-white/[0.06] pt-3 text-[11.5px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-white/45">Clientes com mais</dt>
                  <dd className="truncate text-right text-white/75">{topClients.map((t) => `${t.c} (${t.n})`).join(" · ")}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-white/45">Diz que já tinha acontecido</dt>
                  <dd className="tabular text-white/75">
                    {repeated} de {view.entries.length}
                  </dd>
                </div>
                {both.length > 0 && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-white/45">Gravidade média</dt>
                    <dd className="tabular text-right text-white/75">
                      {who} {avg(both.map((e) => e.selfScore!))} · direção {avg(both.map((e) => e.score!.points))}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <p className="flex items-start gap-2 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3 text-[11px] leading-relaxed text-white/40">
            <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Pontuar a 0 significa «não conta»: a ocorrência fica registada, mas não entra no PA nem no NO.
          </p>
          {reports.length > 0 && (
            <section id="relatorios" aria-label="Relatórios assinados" className="scroll-mt-24 rounded-2xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
              <p className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                <ClipboardCheck className="h-3 w-3" />
                Relatórios assinados · {reports.length}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {reports.map((r) => {
                  const ok = verifyIntegrity(r);
                  const s = r.signature;
                  return (
                    <li key={r.id}>
                      <details id={`relatorio-${r.id}`} open={focusReport?.id === r.id} className="group scroll-mt-24">
                        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-1 py-1 text-[11px] text-white/45 transition hover:bg-white/[0.04] hover:text-white/75 [&::-webkit-details-marker]:hidden">
                          <span className="font-mono text-[10.5px] text-white/35">{r.ref}</span>
                          <span className="tabular">{formatISODate(r.submittedOn)}</span>
                          {ok ? (
                            <ShieldCheck className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-300/60" aria-label="Integridade verificada" />
                          ) : (
                            <span className="ml-auto inline-flex items-center gap-1 font-semibold text-rose-300">
                              <ShieldX className="h-3.5 w-3.5" />
                              Hash NÃO confere
                            </span>
                          )}
                        </summary>
                        <dl className="mb-1.5 ml-1 mt-1 space-y-0.5 border-l border-white/[0.08] pl-2.5 text-[10px] text-white/40">
                          <div className="flex gap-1.5">
                            <dt className="shrink-0">Assinado</dt>
                            <dd className="text-white/60">{formatLisbonDateTime(s.signedAt)}</dd>
                          </div>
                          <div className="flex gap-1.5">
                            <dt className="shrink-0">SHA-256</dt>
                            <dd className="truncate font-mono text-white/60" title={s.hash}>
                              {s.hash ? `${s.hash.slice(0, 10)}…${s.hash.slice(-6)}` : "—"}
                            </dd>
                          </div>
                          <div className="flex gap-1.5">
                            <dt className="shrink-0">IP</dt>
                            <dd className="font-mono text-white/60">{s.ip || "—"}</dd>
                          </div>
                          <div className="flex gap-1.5">
                            <dt className="shrink-0">Browser</dt>
                            <dd className="truncate font-mono text-white/60" title={s.userAgent}>
                              {s.userAgent || "—"}
                            </dd>
                          </div>
                          {r.review?.note && (
                            <div className="pt-0.5 text-white/55">
                              <span className="text-white/40">Nota da direção:</span> {r.review.note}
                            </div>
                          )}
                        </dl>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
