// /passagem — Passagem de consultor (v80.39), lado da equipa.
//
//   • Quem sai: os 30 dias, a fase em que está, a nota da direção e um
//     cartão por projeto com o andamento e o próximo passo.
//   • Quem entra: os projetos que vai receber, de quem, e se a ficha já
//     está pronta para ler e assumir.
// A direção é mandada para o cockpit. Com «Ver como» mostra o lado da
// pessoa vista, só para ler.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, MessageCircleQuestion, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { HealthDot, PageHeader, PersonAvatar, ProgressRing, StageChip, Timeline } from "@/components/passagem/ui";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getTeamAvatar } from "@/lib/team-avatars";
import { passagemOverview, type PassagemOverview, type ProjectView } from "@/lib/passagem/overview";
import { activePassagemOf, getPassagem, incomingPassagensOf } from "@/lib/passagem/store";
import { dayOf, formatISODate, phaseFor, totalDaysOf } from "@/lib/passagem/shared";
import { todayLisbonISO } from "@/lib/probation/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Passagem — Wonder Ads Workspace" };

function ProjectCard({ id, x, incomingSide }: { id: string; x: ProjectView; incomingSide?: boolean }) {
  return (
    <Link
      href={`/passagem/${id}/${x.slug}`}
      className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/25 hover:bg-white/[0.04]"
    >
      <div className="flex items-start gap-3">
        <ProgressRing pct={x.progress.pct} size={46} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-white">
            <HealthDot health={x.ficha.health} />
            <span className="truncate">{x.title}</span>
          </p>
          <div className="mt-1.5">
            <StageChip stage={x.stage} />
          </div>
        </div>
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-white/55">
        {incomingSide
          ? x.sign
            ? "Já assumiste este projeto."
            : x.ficha.readyAt
              ? "A ficha está pronta: lê e assume."
              : "A ficha ainda está a ser escrita. Já podes ler e perguntar."
          : x.progress.next
            ? `Próximo: ${x.progress.next.label}`
            : "Tudo feito."}
      </p>
      <div className="mt-auto flex items-center gap-3 border-t border-white/[0.06] pt-3 text-[12.5px] text-white/50">
        {!incomingSide &&
          (x.incoming ? (
            <span className="inline-flex items-center gap-1.5">
              <PersonAvatar name={x.incoming.name} avatar={getTeamAvatar(x.incoming.username)} size={20} /> {x.incoming.name}
            </span>
          ) : (
            <span>Quem entra: por decidir</span>
          ))}
        {x.openQuestions > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-200">
            <MessageCircleQuestion className="h-3.5 w-3.5" /> {x.openQuestions}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 transition group-hover:text-white">
          {incomingSide ? "Ler ficha" : "Abrir ficha"} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function OutgoingView({ o, today, firstName }: { o: PassagemOverview; today: string; firstName: string }) {
  const p = o.passagem;
  const total = totalDaysOf(p);
  const day = dayOf(p, today);
  const phase = day > 0 ? phaseFor(day, total) : null;
  const left = Math.max(0, total - day);
  return (
    <>
      <PageHeader
        eyebrow="A tua passagem"
        title={`${firstName}, vamos passar os teus projetos`}
        lead={`Tens até ${formatISODate(p.endDate)} para deixar cada projeto pronto para quem entra: acessos garantidos, ficha escrita, cliente avisado e uma reunião a três. ${
          o.totals.ready
        } de ${o.totals.projects} fichas prontas.`}
      />
      <div className="mt-6 space-y-6 pb-14">
        {p.note && (
          <p className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] px-5 py-3.5 text-[14px] leading-relaxed text-white/80">
            <span className="font-semibold text-amber-200">Nota da direção:</span> {p.note}
          </p>
        )}
        <Timeline day={day} totalDays={total} startDate={p.startDate} endDate={p.endDate} />
        {phase && day <= total && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#783DF5]/30 bg-[#783DF5]/[0.08] px-5 py-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#c4a6ff]" />
            <p className="text-[14px] leading-relaxed text-white/80">
              <span className="font-semibold text-white">Agora: {phase.title}.</span> {phase.detail}{" "}
              <span className="text-white/50">{left === 0 ? "Hoje é o último dia." : `${left} dia${left === 1 ? "" : "s"} até ao fim.`}</span>
            </p>
          </div>
        )}
        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-white">Os teus projetos</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {o.projects.map((x) => (
              <ProjectCard key={x.slug} id={p.id} x={x} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export default async function PassagemPage() {
  const me = await getCurrentEmployee();
  if (!me) return null;
  if (me.isAdmin) redirect("/admin/passagens");

  const today = todayLisbonISO();
  const [mineEntry, incomingEntries] =
    me.viewerOf || me.docsOnly ? [null, []] : await Promise.all([activePassagemOf(me.username), incomingPassagensOf(me.username)]);

  const mine = mineEntry ? await getPassagem(mineEntry.id) : null;
  const mineOverview = mine ? await passagemOverview(mine) : null;
  const incoming = (
    await Promise.all(
      incomingEntries.map(async (e) => {
        const p = await getPassagem(e.id);
        if (!p) return null;
        const slugs = p.projects.filter((x) => x.incoming?.username === me.username).map((x) => x.slug);
        return slugs.length ? passagemOverview(p, slugs) : null;
      }),
    )
  ).filter((x): x is PassagemOverview => x !== null);

  const firstName = me.name.split(" ")[0] ?? me.name;

  return (
    <PageShell backHref="/" backLabel="workspace" backPrefix="Voltar a">
      {mineOverview && <OutgoingView o={mineOverview} today={today} firstName={firstName} />}

      {incoming.length > 0 && (
        <>
          {!mineOverview && (
            <PageHeader
              eyebrow="Passagem"
              title="Projetos que vais receber"
              lead="Cada projeto vem com uma ficha escrita por quem sai. Lê, pergunta o que não estiver claro e assina «Li e assumo». Depois a direção passa-o para ti no SEO DPT."
            />
          )}
          <div className={`space-y-8 pb-14 ${mineOverview ? "" : "mt-8"}`}>
            {incoming.map((o) => (
              <section key={o.passagem.id}>
                <h2 className="mb-3 flex items-center gap-2.5 text-[18px] font-semibold text-white">
                  <PersonAvatar name={o.passagem.outgoing.name} avatar={getTeamAvatar(o.passagem.outgoing.username)} size={28} />
                  De {o.passagem.outgoing.name}
                  <span className="text-[13px] font-normal text-white/45">· até {formatISODate(o.passagem.endDate)}</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {o.projects.map((x) => (
                    <ProjectCard key={x.slug} id={o.passagem.id} x={x} incomingSide />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {!mineOverview && incoming.length === 0 && (
        <PageHeader
          eyebrow="Passagem"
          title="Sem passagens a decorrer"
          lead="Quando a direção abrir a tua passagem, ou te escolher para receber projetos de um colega, aparece aqui e no menu do teu nome."
        />
      )}
    </PageShell>
  );
}
