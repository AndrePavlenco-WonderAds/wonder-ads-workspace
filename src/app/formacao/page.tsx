// Hub da Formação — WonderAds Consultants Onboarding University.
//
// Cartões das tracks em que o utilizador está inscrito (Comum + a sua
// especialização), com progresso, próxima aula e tempo estimado restante.
// Mesmo espírito do hub de onboarding de clientes, no tema do workspace.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Clock,
  GraduationCap,
  LayoutDashboard,
  Lock,
  PartyPopper,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import {
  MinutesLeft,
  ProgressBar,
  ProgressRing,
} from "@/components/training/training-ui";
import { getTrainingContext } from "@/lib/training/server";
import { overallPercent } from "@/lib/training/progress";
import type { TrackState } from "@/lib/training/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Formação · Wonder Ads Workspace",
};

export default async function FormacaoPage() {
  const ctx = await getTrainingContext();
  if (!ctx) redirect("/login?next=/formacao");

  const { employee, common, specialization } = ctx;
  const global = overallPercent(common, specialization);
  const tracks = [common, specialization].filter(
    (t): t is TrackState => t !== null,
  );
  // "Tudo concluído" exige que exista mesmo conteúdo concluído — no dia 1,
  // com os vídeos ainda por gravar, ninguém pode ser felicitado por nada.
  const allDone =
    tracks.length > 0 && tracks.every((t) => t.completed && t.hasContent);
  const nothingRecorded = tracks.length > 0 && tracks.every((t) => !t.hasContent);

  return (
    <PageShell backHref="/" backLabel="Workspace">
      <div className="animate-fade-up flex flex-wrap items-start justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/60">
            <GraduationCap className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
            Consultants Onboarding University
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">Formação</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/55">
            {allDone
              ? `Concluíste toda a tua formação, ${employee.name}. Revê o que quiseres sempre que precisares.`
              : nothingRecorded
                ? `Bem-vindo, ${employee.name}. O programa já está definido — as aulas vão aparecendo aqui à medida que forem gravadas.`
                : `Bem-vindo, ${employee.name}. A Categoria Comum é obrigatória para toda a equipa; a tua especialização abre assim que a concluíres.`}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <ProgressRing percent={global} label="global" />
          {employee.isAdmin && (
            <Link
              href="/formacao/admin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3.5 py-2 text-[13px] font-medium text-white/70 transition hover:border-[#783DF5]/40 hover:text-white"
            >
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </Link>
          )}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="animate-fade-up mt-10 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
          Ainda não tens nenhuma trilha atribuída. Fala com o Andre, o Alex ou a
          Alice.
        </div>
      ) : (
        <section className="animate-fade-up mt-10 grid gap-5 lg:grid-cols-2">
          {tracks.map((t) => (
            <TrackCard key={t.track.slug} state={t} />
          ))}
        </section>
      )}

      {common && !common.completed && specialization && (
        <p className="animate-fade-up mt-6 inline-flex items-center gap-2 text-[12px] text-white/45">
          <Lock className="h-3.5 w-3.5" />
          A tua especialização ({specialization.track.name}) desbloqueia quando
          a Categoria Comum estiver 100% concluída — vídeos vistos e testes
          passados.
        </p>
      )}
    </PageShell>
  );
}

function TrackCard({ state }: { state: TrackState }) {
  const locked = state.lockedReason !== null;
  const href = `/formacao/${state.track.slug}`;
  const next = state.nextLesson;

  return (
    <div
      className={`brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-6 backdrop-blur-md transition-all duration-300 ${
        locked ? "opacity-70" : "hover:-translate-y-0.5 hover:bg-white/[0.06]"
      }`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-white">
              {state.track.name}
            </h2>
            {state.track.isCommon && (
              <span className="rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/60">
                Obrigatória
              </span>
            )}
            {/* "Concluída" só quando há mesmo conteúdo concluído — uma trilha
                ainda sem vídeos gravados leva o aviso honesto. */}
            {state.completed && state.hasContent && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-emerald-200/85">
                <PartyPopper className="h-3 w-3" />
                Concluída
              </span>
            )}
            {!state.hasContent && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/[0.08] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-amber-200/80">
                <Clock className="h-3 w-3" />
                Em preparação
              </span>
            )}
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-white/50">
            {state.track.description}
          </p>
        </div>
        <span className="shrink-0 text-2xl font-bold text-white/85">
          {state.percent}%
        </span>
      </div>

      <div className="relative mt-4">
        <ProgressBar percent={state.percent} />
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-white/45">
          <span>
            {state.watchedLessons}/{state.totalLessons} aulas
          </span>
          <span>·</span>
          <span>{state.modules.length} módulos</span>
          {state.missingVideos > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-200/70">
                {state.missingVideos} por gravar
              </span>
            </>
          )}
          <MinutesLeft minutes={state.minutesLeft} />
        </div>
      </div>

      {locked ? (
        <p className="relative mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/50">
          <Lock className="h-3.5 w-3.5" />
          {state.lockedReason}
        </p>
      ) : (
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={
              next
                ? `/formacao/${state.track.slug}/aula/${next.lesson.id}`
                : href
            }
            className="brand-gradient-bg group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(120,61,245,0.7)] transition hover:brightness-110"
          >
            {!state.hasContent
              ? "Ver programa"
              : state.completed
                ? "Rever trilha"
                : state.watchedLessons === 0
                  ? "Começar agora"
                  : "Continuar onde ficaste"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={href}
            className="text-[12px] font-medium text-white/55 underline-offset-4 transition hover:text-white hover:underline"
          >
            Ver módulos
          </Link>
        </div>
      )}

      {!locked && next && (
        <p className="relative mt-3 truncate text-[11.5px] text-white/40">
          A seguir: <span className="text-white/65">{next.lesson.title}</span>
        </p>
      )}
      {!locked && !next && state.nextQuizModule && (
        <p className="relative mt-3 truncate text-[11.5px] text-white/40">
          A seguir:{" "}
          <span className="text-white/65">
            Teste — {state.nextQuizModule.title}
          </span>
        </p>
      )}
    </div>
  );
}
