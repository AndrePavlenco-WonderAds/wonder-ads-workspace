// /admin/passagens — Passagem de consultor (v80.39), lado da direção.
// As passagens a decorrer (com o andamento de cada uma), a «Nova passagem»
// e as fechadas. Só SuperAdmin — a página verifica-o ela própria (o layout
// do /admin não é tranca: ver feedback_layout_gate_not_security_boundary).

import Link from "next/link";
import { AlertTriangle, ArrowRight, MessageCircleQuestion } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { CreatePassagem, type CreateConsultant } from "@/components/passagem/create-passagem";
import { PageHeader, PersonAvatar, ProgressRing } from "@/components/passagem/ui";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getTeamAvatar } from "@/lib/team-avatars";
import { passagemOverview, type PassagemOverview } from "@/lib/passagem/overview";
import { listPassagens, seoPortfolios } from "@/lib/passagem/store";
import { dayOf, formatISODate, reasonLabel, totalDaysOf } from "@/lib/passagem/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Passagem de consultor — Wonder Ads Workspace" };

function Stat({ value, label, tone = "text-white" }: { value: string; label: string; tone?: string }) {
  return (
    <div>
      <p className={`text-[18px] font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[11.5px] text-white/45">{label}</p>
    </div>
  );
}

function ActiveCard({ o, today }: { o: PassagemOverview; today: string }) {
  const p = o.passagem;
  const total = totalDaysOf(p);
  const day = dayOf(p, today);
  const t = o.totals;
  return (
    <Link
      href={`/admin/passagens/${p.id}`}
      className="group block rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/25 hover:bg-white/[0.04] sm:p-6"
    >
      <div className="flex items-center gap-4">
        <PersonAvatar name={p.outgoing.name} avatar={getTeamAvatar(p.outgoing.username)} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-white">{p.outgoing.name}</p>
          <p className="text-[12.5px] text-white/50">
            {reasonLabel(p.reason)} · {day <= 0 ? `começa a ${formatISODate(p.startDate)}` : day > total ? "prazo terminado" : `dia ${day} de ${total}`} ·
            até {formatISODate(p.endDate)}
          </p>
        </div>
        <ProgressRing pct={t.pct} size={52} />
      </div>
      <div className="mt-5 grid grid-cols-4 gap-3 border-t border-white/[0.06] pt-4">
        <Stat value={`${t.ready}/${t.projects}`} label="fichas prontas" />
        <Stat value={`${t.assumed}/${t.projects}`} label="assumidos" />
        <Stat value={`${t.transferred}/${t.projects}`} label="passados" tone={t.transferred === t.projects ? "text-emerald-300" : "text-white"} />
        <Stat value={String(t.risk)} label="em risco" tone={t.risk > 0 ? "text-rose-300" : "text-white/60"} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[12.5px]">
        {t.open > 0 && (
          <span className="inline-flex items-center gap-1.5 text-amber-200">
            <MessageCircleQuestion className="h-3.5 w-3.5" /> {t.open} pergunta{t.open === 1 ? "" : "s"} por responder
          </span>
        )}
        {t.risk > 0 && (
          <span className="inline-flex items-center gap-1.5 text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5" /> {o.projects.filter((x) => x.ficha.health === "vermelho").map((x) => x.title).join(", ")}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-white/55 transition group-hover:text-white">
          Abrir cockpit <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

export default async function PassagensAdminPage() {
  const me = await getCurrentEmployee();
  if (!me?.isAdmin) {
    return (
      <PageShell backHref="/" backLabel="workspace" backPrefix="Voltar a">
        <PageHeader eyebrow="SuperAdmin" title="Passagem de consultor" lead="Esta página é só para SuperAdmin." />
      </PageShell>
    );
  }

  const today = todayLisbonISO();
  const [all, portfolios] = await Promise.all([listPassagens(), seoPortfolios()]);
  const active = all.filter((p) => p.status === "ativa");
  const closed = all.filter((p) => p.status !== "ativa");
  const overviews = await Promise.all(active.map((p) => passagemOverview(p)));
  const busy = new Set(active.map((p) => p.outgoing.username));
  const consultants: CreateConsultant[] = portfolios.map((c) => ({
    ...c,
    avatar: getTeamAvatar(c.username),
    busy: busy.has(c.username),
  }));

  return (
    <PageShell backHref="/" backLabel="workspace" backPrefix="Voltar a">
      <PageHeader
        eyebrow="SuperAdmin · offboarding"
        title="Passagem de consultor"
        lead="Quando um consultor sai, cada projeto passa com uma ficha escrita por ele, os acessos garantidos, o cliente avisado e uma reunião a três. Quem entra assina que leu e assume, e só depois passas o projeto no SEO DPT."
      />

      <div className="mt-8 space-y-10 pb-14">
        {overviews.length > 0 && (
          <section>
            <h2 className="mb-3 text-[18px] font-semibold text-white">A decorrer</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {overviews.map((o) => (
                <ActiveCard key={o.passagem.id} o={o} today={today} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-white">Nova passagem</h2>
          <div className="max-w-4xl">
            <CreatePassagem consultants={consultants} today={today} />
          </div>
        </section>

        {closed.length > 0 && (
          <section>
            <h2 className="mb-3 text-[18px] font-semibold text-white">Fechadas</h2>
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10">
              {closed.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/passagens/${p.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.03]">
                    <PersonAvatar name={p.outgoing.name} avatar={getTeamAvatar(p.outgoing.username)} size={28} />
                    <span className="min-w-0 flex-1 text-[14px] text-white">
                      {p.outgoing.name}
                      <span className="ml-2 text-[12.5px] text-white/45">
                        {formatISODate(p.startDate)} → {formatISODate(p.endDate)} · {p.projects.length} projeto{p.projects.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11.5px] ${
                        p.status === "concluida" ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-white/55"
                      }`}
                    >
                      {p.status === "concluida" ? "Concluída" : "Cancelada"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  );
}
