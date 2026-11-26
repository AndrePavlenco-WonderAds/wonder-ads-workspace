// Direção → Ineficácias: o painel da equipa. Os números do momento, a fila
// de relatórios por rever (cada um com as ocorrências por pontuar), e a
// tabela de consultores com o nível, o PA/NO contra o limiar e desde quando
// contam (desde a última subida de nível). Só SuperAdmin: a página verifica isAdmin ANTES de ler o KV (o
// layout de /admin sozinho não chega — ver feedback-layout-gate).

import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCheck, ClipboardList, Gauge, History, Hourglass, Plus, Scale, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LevelChip } from "@/components/ineficacias/level-gauge";
import { ScoreBadge } from "@/components/ineficacias/report-view";
import { shortDate, SourceChip, StatusChip } from "@/components/ineficacias/admin-status";
import { getCurrentEmployee } from "@/lib/auth/server";
import { listImpersonationTargets, viewerDeptOf } from "@/lib/auth/credentials";
import { getTeamAvatar } from "@/lib/team-avatars";
import { INEFICACIAS_OPEN_TO_TEAM } from "@/lib/ineficacias/access";
import { ineficaciasConfigured, loadTeam, type ConsultantBundle } from "@/lib/ineficacias/store";
import { buildAdminView, type AdminEntry } from "@/lib/ineficacias/admin-view";
import { formatISODayMonth, phaseOpenLabel } from "@/lib/ineficacias/shared";
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

function Avatar({ username, name, small = false }: { username: string; name: string; small?: boolean }) {
  const src = getTeamAvatar(username);
  const box = small ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-[12px]";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${box} shrink-0 rounded-full border border-white/10 object-cover`} />
  ) : (
    <span className={`${box} flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] font-bold text-white/70`}>
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

  const all = people
    .map((p) => ({ person: p, bundle: team.get(p.username) }))
    .filter((x): x is { person: Person; bundle: ConsultantBundle } => Boolean(x.bundle))
    .map((x) => ({ ...x, view: buildAdminView(x.person.username, x.bundle.reports, x.bundle.ledger, x.bundle.state) }));
  const toReview = all.flatMap((b) => b.bundle.reports.filter((r) => !r.review));
  // v80.50: a fila é de OCORRÊNCIAS (o que há para pontuar), não de relatórios.
  const queue = all
    .flatMap((b) => b.view.pending.map((d) => ({ e: d.entry, person: b.person })))
    .sort((a, b) => a.e.occurredOn.localeCompare(b.e.occurredOn));
  const unscored = queue.length;
  const pendingMeasures = all.filter((b) => b.bundle.state.pendingMeasure);
  const escalated = all.filter((b) => b.bundle.state.reached >= 1).length;
  // Quem pede atenção primeiro: por pontuar, medida por aplicar, nível, PA/NO.
  const heat = (b: (typeof all)[number]) => {
    const s = b.bundle.state;
    const ratio = s.next ? Math.max(s.pa / s.next.pa, s.no / s.next.no) : 1;
    return b.view.pending.length * 100 + (s.pendingMeasure ? 50 : 0) + s.level * 10 + ratio;
  };
  const active = all.filter((b) => b.view.entries.length > 0 || b.bundle.state.level > 0).sort((a, b) => heat(b) - heat(a));
  const quiet = all.filter((b) => !active.includes(b));
  // O passado da equipa: as últimas ocorrências de toda a gente.
  const recent: { e: AdminEntry; person: Person }[] = all
    .flatMap((b) => b.view.entries.map((e) => ({ e, person: b.person })))
    .sort((a, b) => b.e.occurredOn.localeCompare(a.e.occurredOn) || (b.e.score?.at ?? 0) - (a.e.score?.at ?? 0))
    .slice(0, 12);

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
            <span className="font-normal normal-case tracking-normal text-white/30">· quem pede atenção primeiro</span>
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {active.length === 0 && <p className="px-4 py-5 text-[12.5px] text-white/45">Ninguém tem ocorrências registadas.</p>}
            {active.map(({ person, bundle, view }, i) => {
              const s = bundle.state;
              const last = bundle.reports[0];
              const pendingItems = view.pending.length;
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
                      {s.phaseOpen ? `Desde ${phaseOpenLabel(s.phaseOpen)} (${formatISODayMonth(s.phaseOpen.at)})` : "Desde o início"}
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
            {quiet.length > 0 && (
              <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${active.length ? "border-t border-white/[0.05]" : ""}`}>
                <span className="text-[11px] text-white/40">Sem ocorrências · nível 0:</span>
                {quiet.map(({ person }) => (
                  <Link
                    key={person.username}
                    href={`/admin/ineficacias/${encodeURIComponent(person.username)}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] py-0.5 pl-0.5 pr-2.5 text-[11.5px] text-white/60 transition hover:text-white"
                  >
                    <Avatar username={person.username} name={person.name} small />
                    {person.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {recent.length > 0 && (
            <div className="mt-8">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                <History className="h-3.5 w-3.5" />
                Últimas ocorrências da equipa
              </p>
              <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                {recent.map(({ e, person }) => (
                  <li key={e.id}>
                    <Link
                      href={
                        e.status === "pontuar"
                          ? `/admin/ineficacias/${encodeURIComponent(person.username)}#oc-${e.id}`
                          : `/admin/ineficacias/${encodeURIComponent(person.username)}?oc=${e.id}`
                      }
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 transition hover:bg-white/[0.04]"
                    >
                      <span className="tabular w-[58px] text-[11.5px] text-white/45">{shortDate(e.occurredOn)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] text-white/85">
                          <span className="font-semibold">{person.name}</span>
                          <span className="text-white/35"> · </span>
                          {e.client}
                          <span className="text-white/35"> · </span>
                          <span className="text-white/65">{e.what}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          <StatusChip status={e.status} />
                          <SourceChip source={e.source} reportRef={e.reportRef} />
                          <span className="text-[10.5px] text-white/40">{e.reason}</span>
                        </span>
                      </span>
                      <ScoreBadge score={e.score} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* a fila */}
        <aside className="animate-fade-up space-y-6">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Por pontuar · {queue.length}</p>
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              {queue.length === 0 ? (
                <p className="flex items-center gap-2 px-4 py-5 text-[12.5px] text-white/45">
                  <CheckCheck className="h-4 w-4 text-emerald-300/70" />
                  Nada por pontuar.
                </p>
              ) : (
                queue.map(({ e, person }, i) => (
                  <Link
                    key={e.id}
                    href={`/admin/ineficacias/${encodeURIComponent(person.username)}#oc-${e.id}`}
                    className={`group flex items-start gap-3 px-4 py-3 transition hover:bg-white/[0.04] ${i ? "border-t border-white/[0.05]" : ""}`}
                  >
                    <Avatar username={person.username} name={person.name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[12.5px] font-semibold text-white/85">{person.name}</span>
                        <span className="tabular shrink-0 text-[10.5px] text-white/35">{shortDate(e.occurredOn)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-white/55">
                        <span className="font-semibold text-white/70">{e.client}</span> · {e.what}
                      </span>
                      <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#c3aaff] opacity-80 group-hover:opacity-100">
                        Pontuar com o histórico ao lado
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </span>
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
