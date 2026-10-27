// Direção → Ineficácias: o painel da equipa. Os números do momento, a fila
// de relatórios por rever (cada um com as ocorrências por pontuar), e a
// tabela de consultores com o nível, o PA/NO contra o limiar e desde quando
// contam (o último 1:1). Só SuperAdmin: a página verifica isAdmin ANTES de ler o KV (o
// layout de /admin sozinho não chega — ver feedback-layout-gate).

import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCheck, ClipboardList, Gauge, Hourglass, Plus, Scale, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LevelChip } from "@/components/ineficacias/level-gauge";
import { ReportStatusChip } from "@/components/ineficacias/report-view";
import { getCurrentEmployee } from "@/lib/auth/server";
import { listImpersonationTargets, viewerDeptOf } from "@/lib/auth/credentials";
import { getTeamAvatar } from "@/lib/team-avatars";
import { INEFICACIAS_OPEN_TO_TEAM } from "@/lib/ineficacias/access";
import { ineficaciasConfigured, loadTeam, type ConsultantBundle } from "@/lib/ineficacias/store";
import { formatISODayMonth, formatLisbonDateTime } from "@/lib/ineficacias/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Ineficácias — SuperAdmin Control Suite",
};

type Person = { username: string; name: string; role: string; dept: string };

function roster(): Person[] {
  return listImpersonationTargets()
    .filter((p) => !p.isAdmin && !viewerDeptOf(p.username))
    .map((p) => ({ username: p.username, name: p.name, role: p.role, dept: p.dept }));
}

function Avatar({ username, name }: { username: string; name: string }) {
  const src = getTeamAvatar(username);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[12px] font-bold text-white/70">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function MiniBar({ value, limit, tone }: { value: number; limit: number | null; tone: string }) {
  const ratio = limit ? Math.min(1, value / limit) : 0;
  const hot = limit !== null && value >= limit;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div className={`h-full rounded-full ${hot ? "bg-rose-400" : tone}`} style={{ width: `${Math.max(ratio * 100, value > 0 ? 8 : 0)}%` }} />
    </div>
  );
}

export default async function IneficaciasAdminPage() {
  const employee = await getCurrentEmployee();
  if (!employee?.isAdmin) return null;
  const today = todayLisbonISO();
  const people = roster();
  const team = await loadTeam(people.map((p) => p.username), today);

  const bundles = people.map((p) => ({ person: p, bundle: team.get(p.username) })).filter((x): x is { person: Person; bundle: ConsultantBundle } => Boolean(x.bundle));
  const allReports = bundles.flatMap((b) => b.bundle.reports.map((r) => ({ r, person: b.person })));
  const toReview = allReports.filter((x) => !x.r.review).sort((a, b) => a.r.createdAt - b.r.createdAt);
  const unscored = allReports.reduce((s, x) => s + x.r.items.filter((it) => !it.score).length, 0);
  const pendingMeasures = bundles.filter((b) => b.bundle.state.pendingMeasure);
  const escalated = bundles.filter((b) => b.bundle.state.reached >= 1).length;

  return (
    <PageShell>
      <Link href="/admin" className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Control Suite
      </Link>

      <header className="animate-fade-up mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="readout text-white/35">Operações · Team Inefficiency · Direção</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Ineficácias da equipa</span>
          </h1>
          <p className="mt-1.5 max-w-[680px] text-[12.5px] leading-relaxed text-white/45">
            Os consultores reportam os erros quando querem, num relatório assinado. Tu pontuas cada ocorrência de 0 a
            10 — só depois entra no PA e no NO — e registas as medidas quando a escala sobe de nível.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {!INEFICACIAS_OPEN_TO_TEAM && (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
            Em construção para os consultores — só a direção vê o módulo
          </span>
        )}
          <Link
            href="/admin/ineficacias/registar"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(120,61,245,0.7)] transition hover:-translate-y-px"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Registar ineficácia
          </Link>
        </div>
      </header>

      {!ineficaciasConfigured && (
        <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-100">
          O armazenamento (KV) não está configurado neste ambiente — os relatórios não podem ser lidos nem gravados.
        </p>
      )}

      {/* números do momento */}
      <section className="animate-fade-up mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Relatórios por rever", value: toReview.length, tone: toReview.length ? "text-[#c3aaff]" : "text-white/60", icon: ClipboardList },
          { label: "Ocorrências por pontuar", value: unscored, tone: unscored ? "text-amber-200" : "text-white/60", icon: Hourglass },
          { label: "Medidas por aplicar", value: pendingMeasures.length, tone: pendingMeasures.length ? "text-rose-300" : "text-white/60", icon: Scale },
          { label: "Consultores em nível ≥ 1", value: escalated, tone: escalated ? "text-amber-200" : "text-white/60", icon: Gauge },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5">
            <p className={`text-[26px] font-bold leading-none tabular-nums ${k.tone}`}>{k.value}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-white/45">
              <k.icon className="h-3.5 w-3.5" />
              {k.label}
            </p>
          </div>
        ))}
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* a equipa */}
        <section className="animate-fade-up min-w-0">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
            <Users className="h-3.5 w-3.5" />
            Equipa · {people.length}
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {bundles.map(({ person, bundle }, i) => {
              const s = bundle.state;
              const last = bundle.reports[0];
              const pendingItems = bundle.reports.reduce((n, r) => n + r.items.filter((it) => !it.score).length, 0);
              return (
                <Link
                  key={person.username}
                  href={`/admin/ineficacias/${encodeURIComponent(person.username)}`}
                  className={`group grid grid-cols-1 gap-3 px-4 py-3.5 transition hover:bg-white/[0.04] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center ${i ? "border-t border-white/[0.05]" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar username={person.username} name={person.name} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-white/90">{person.name}</span>
                      <span className="block truncate text-[11px] text-white/40">
                        {person.role} · {person.dept}
                      </span>
                      <span className="mt-1 block sm:hidden">
                        <LevelChip state={s} size="sm" />
                      </span>
                    </span>
                  </span>
                  <span className="grid grid-cols-2 gap-3">
                    <span>
                      <span className="flex items-baseline justify-between text-[10.5px] text-white/40">
                        PA
                        <span className="tabular text-[12.5px] font-bold text-white/85">
                          {s.pa}
                          {s.next && <span className="font-medium text-white/30">/{s.next.pa}</span>}
                        </span>
                      </span>
                      <MiniBar value={s.pa} limit={s.next?.pa ?? null} tone="bg-[#a78bfa]" />
                    </span>
                    <span>
                      <span className="flex items-baseline justify-between text-[10.5px] text-white/40">
                        NO
                        <span className="tabular text-[12.5px] font-bold text-white/85">
                          {s.no}
                          {s.next && <span className="font-medium text-white/30">/{s.next.no}</span>}
                        </span>
                      </span>
                      <MiniBar value={s.no} limit={s.next?.no ?? null} tone="bg-[#a78bfa]" />
                    </span>
                  </span>
                  <span className="text-[11px] leading-snug text-white/45">
                    <span className="block">
                      {last ? `Último relatório: ${formatISODayMonth(last.submittedOn)}` : "Sem relatórios"}
                      {pendingItems ? <span className="text-amber-200"> · {pendingItems} por pontuar</span> : null}
                    </span>
                    <span className={`block ${s.no > 0 ? "text-[#c3aaff]/80" : "text-emerald-300/70"}`}>
                      {s.phaseEvent ? `Desde o 1:1 de ${formatISODayMonth(s.phaseEvent.at)}` : "Desde o início"}
                      {s.no === 0 && " · contadores a zero"}
                    </span>
                  </span>
                  <span className="hidden items-center gap-2 sm:flex">
                    <LevelChip state={s} size="sm" />
                    <ArrowRight className="h-3.5 w-3.5 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* a fila */}
        <aside className="animate-fade-up space-y-6">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Por rever · {toReview.length}</p>
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              {toReview.length === 0 ? (
                <p className="flex items-center gap-2 px-4 py-5 text-[12.5px] text-white/45">
                  <CheckCheck className="h-4 w-4 text-emerald-300/70" />
                  Nenhum relatório à espera.
                </p>
              ) : (
                toReview.map(({ r, person }, i) => (
                  <Link
                    key={r.id}
                    href={`/admin/ineficacias/${encodeURIComponent(person.username)}?relatorio=${r.id}`}
                    className={`flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04] ${i ? "border-t border-white/[0.05]" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-white/85">{person.name}</span>
                      <span className="block truncate text-[11px] text-white/45">
                        {r.ref} · {r.items.length} {r.items.length === 1 ? "ocorrência" : "ocorrências"} · {formatLisbonDateTime(r.signature.signedAt)}
                      </span>
                    </span>
                    <ReportStatusChip report={r} />
                  </Link>
                ))
              )}
            </div>
          </div>

          {pendingMeasures.length > 0 && (
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-300/70">Medidas por aplicar · {pendingMeasures.length}</p>
              <div className="overflow-hidden rounded-2xl border border-rose-400/20 bg-rose-500/[0.04]">
                {pendingMeasures.map(({ person, bundle }, i) => {
                  const pm = bundle.state.pendingMeasure!;
                  return (
                    <Link
                      key={person.username}
                      href={`/admin/ineficacias/${encodeURIComponent(person.username)}#medida`}
                      className={`flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04] ${i ? "border-t border-white/[0.05]" : ""}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-white/85">{person.name}</span>
                        <span className="block truncate text-[11px] text-white/45">
                          Nível {pm.level} atingido · PA {pm.pa} · NO {pm.no}
                        </span>
                      </span>
                      <LevelChip state={bundle.state} size="sm" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
