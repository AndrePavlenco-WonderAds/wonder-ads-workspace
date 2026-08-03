// Hub da Formação — WonderAds Consultants University.
//
// Hero com o nome do consultor, o progresso global, linha de estatísticas, o
// cartão de "continuar onde ficaste" em destaque, e um cartão por módulo com a
// fita de capítulos que resume a jornada inteira num relance.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Clock,
  Film,
  GraduationCap,
  Lock,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import {
  LessonThumb,
  LessonTypeBadge,
  ProgressBar,
  ProgressRing,
  StatTile,
  TrackJourney,
} from "@/components/training/training-ui";
import { getTrainingContext, userTracks } from "@/lib/training/server";
import { overallPercent } from "@/lib/training/progress";
import type { TrackState } from "@/lib/training/progress";
import { championLine } from "@/lib/training/champion";
import { lessonMinutes } from "@/lib/training/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Formação · Wonder Ads Workspace",
};

export default async function FormacaoPage() {
  const ctx = await getTrainingContext();
  if (!ctx) redirect("/login?next=/formacao");

  const { employee, common, specializations } = ctx;
  const global = overallPercent(common, specializations);
  const tracks = userTracks(ctx);

  const watched = tracks.reduce((s, t) => s + t.watchedLessons, 0);
  // Denominador = programa inteiro, não só o que já está gravado. Enquanto os
  // vídeos não existem, "0/0 aulas" não dizia a ninguém quanto é o curso.
  const totalLessons = tracks.reduce((s, t) => s + t.allLessons, 0);
  const quizzesTotal = tracks.reduce(
    (s, t) => s + t.modules.filter((m) => m.quizRequired).length,
    0,
  );
  const quizzesPassed = tracks.reduce(
    (s, t) => s + t.modules.filter((m) => m.quizRequired && m.quizPassed).length,
    0,
  );
  const minutesLeft = tracks.reduce((s, t) => s + t.minutesLeft, 0);
  const missing = tracks.reduce((s, t) => s + t.missingVideos, 0);

  // O próximo passo real, seja aula ou teste, no primeiro módulo aberto.
  const active = tracks.find(
    (t) => !t.lockedReason && (t.nextLesson || t.nextQuizModule),
  );
  const nextLesson = active?.nextLesson ?? null;
  const nextQuiz = !nextLesson ? (active?.nextQuizModule ?? null) : null;
  const nextHref = nextLesson
    ? `/formacao/${active!.track.slug}/aula/${nextLesson.lesson.id}`
    : nextQuiz
      ? `/formacao/${active!.track.slug}/teste/${nextQuiz.id}`
      : null;

  return (
    <PageShell backHref="/" backLabel="Workspace">
      {/* ===== Hero ===== */}
      <section className="animate-fade-up relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md sm:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--brand-gradient)" }}
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
              <GraduationCap className="h-3 w-3 text-[color:var(--brand-purple)]" />
              Consultants University
            </span>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-[2.6rem]">
              <span className="text-white/70">Bem-vindo, </span>
              <span className="brand-gradient-text">{employee.name}</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">
              {championLine(employee.username, Date.now())}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-5">
            <ProgressRing percent={global} label="global" size={132} />
          </div>
        </div>

        {tracks.length > 0 && (
          <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Aulas vistas"
              value={`${watched}/${totalLessons}`}
              icon={<Film className="h-3 w-3" />}
            />
            <StatTile
              label="Testes passados"
              value={`${quizzesPassed}/${quizzesTotal}`}
              icon={<ClipboardCheck className="h-3 w-3" />}
            />
            <StatTile
              label="Módulos"
              value={tracks.length}
              hint={
                specializations.length > 0
                  ? `comum + ${specializations.length} especializaç${specializations.length === 1 ? "ão" : "ões"}`
                  : "só o comum"
              }
              icon={<BookOpen className="h-3 w-3" />}
            />
            {missing > 0 ? (
              <StatTile
                label="Brevemente"
                value={missing}
                hint="aulas por publicar"
                tone="warn"
                icon={<Clock className="h-3 w-3" />}
              />
            ) : (
              <StatTile
                label="Tempo restante"
                value={
                  minutesLeft >= 60
                    ? `${Math.floor(minutesLeft / 60)}h${minutesLeft % 60 ? ` ${minutesLeft % 60}m` : ""}`
                    : `${minutesLeft} min`
                }
                icon={<Clock className="h-3 w-3" />}
              />
            )}
          </div>
        )}
      </section>

      {/* ===== Continuar onde ficaste ===== */}
      {nextHref && active && (
        <Link
          href={nextHref}
          className="animate-fade-up group mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-[#783DF5]/35 bg-[#783DF5]/[0.07] p-4 transition hover:border-[#783DF5]/60 hover:bg-[#783DF5]/[0.12]"
        >
          {nextLesson ? (
            <LessonThumb type={nextLesson.lesson.type} />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#783DF5]/30 bg-[#783DF5]/10 text-[#c3aaff]">
              <ClipboardCheck className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#A9834F]">
              <Sparkles className="h-2.5 w-2.5" />
              {watched === 0 && quizzesPassed === 0
                ? "Começa por aqui"
                : "Continuar onde ficaste"}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-white">
              {nextLesson ? nextLesson.lesson.title : nextQuiz?.quiz.title}
              {nextLesson && <LessonTypeBadge type={nextLesson.lesson.type} />}
            </p>
            <p className="mt-0.5 text-[11.5px] text-white/45">
              {active.track.name} ·{" "}
              {nextLesson
                ? `${nextLesson.module.title} · ~${lessonMinutes(nextLesson.lesson)} min`
                : `${nextQuiz?.title} · ${nextQuiz?.quiz.questions.length} perguntas`}
            </p>
          </div>
          <span className="brand-gradient-bg inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition group-hover:brightness-110">
            Retomar
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      {/* ===== Módulos ===== */}
      {tracks.length === 0 ? (
        <div className="animate-fade-up mt-10 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
          Ainda não tens nenhum módulo atribuído. Fala com o Andre, o Alex ou a
          Alice.
        </div>
      ) : (
        <section className="animate-fade-up mt-6 grid gap-5 lg:grid-cols-2">
          {tracks.map((t) => (
            <TrackCard key={t.track.slug} state={t} />
          ))}
        </section>
      )}

      {common && !common.completed && specializations.length > 0 && (
        <p className="animate-fade-up mt-6 inline-flex items-center gap-2 text-[12px] text-white/45">
          <Lock className="h-3.5 w-3.5" />
          {specializations.length === 1
            ? `A tua especialização (${specializations[0].track.name}) desbloqueia`
            : `As tuas especializações (${specializations.map((s) => s.track.name).join(", ")}) desbloqueiam`}{" "}
          quando a Categoria Comum estiver 100% concluída — vídeos vistos e
          testes passados.
        </p>
      )}
    </PageShell>
  );
}

function TrackCard({ state }: { state: TrackState }) {
  const locked = state.lockedReason !== null;
  const href = `/formacao/${state.track.slug}`;
  const modulesDone = state.modules.filter(
    (m) => m.status === "completed" && m.hasContent,
  ).length;

  return (
    <div
      className={`brand-gradient-border relative flex flex-col overflow-hidden rounded-2xl bg-white/[0.035] p-6 backdrop-blur-md transition-all duration-300 ${
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
                Obrigatório
              </span>
            )}
            {state.completed && state.hasContent && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] ${
                  state.missingVideos === 0
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200/85"
                    : "border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-200/70"
                }`}
              >
                <PartyPopper className="h-3 w-3" />
                {state.missingVideos === 0 ? "Concluído" : "Em dia"}
              </span>
            )}
            {!state.hasContent && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/[0.08] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-amber-200/80">
                <Clock className="h-3 w-3" />
                Em preparação
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-white/50">
            {state.track.description}
          </p>
        </div>
        <span className="shrink-0 text-2xl font-bold text-white/85">
          {state.percent}%
        </span>
      </div>

      {/* Fita da jornada — um segmento por capítulo. */}
      <div className="relative mt-5">
        <TrackJourney modules={state.modules} />
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-white/45">
          <span>
            {modulesDone}/{state.modules.length} capítulos
          </span>
          <span>·</span>
          <span>
            {state.watchedLessons}/{state.allLessons} aulas
          </span>
          {state.missingVideos > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-200/70">
                {state.missingVideos} brevemente
              </span>
            </>
          )}
        </div>
      </div>

      <div className="relative mt-4">
        <ProgressBar percent={state.percent} />
      </div>

      {locked ? (
        <p className="relative mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/50">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          {state.lockedReason}
        </p>
      ) : (
        // Um único destino: a sequência do módulo. O atalho para retomar a
        // aula exata vive no cartão "Continuar onde ficaste", no topo — ter
        // aqui dois links para sítios diferentes só obrigava a escolher.
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={href}
            className="brand-gradient-bg group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(120,61,245,0.7)] transition hover:brightness-110"
          >
            Estudar Módulo
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
