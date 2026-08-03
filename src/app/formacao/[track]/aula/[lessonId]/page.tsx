// Página de aula: player com tracking, descrição, badge do tipo, presenter e
// navegação anterior/seguinte dentro da track.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  UserRound,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { TrainingPlayer } from "@/components/training/training-player";
import { LessonTypeBadge } from "@/components/training/training-ui";
import { getTrainingContext, trackStateFor } from "@/lib/training/server";
import {
  detectProvider,
  lessonMinutes,
  type TrainingLesson,
} from "@/lib/training/catalog";
import type { TrackState } from "@/lib/training/progress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string; lessonId: string }>;
}): Promise<Metadata> {
  const { track, lessonId } = await params;
  const ctx = await getTrainingContext();
  const state = ctx ? trackStateFor(ctx, track) : null;
  const lesson = state
    ? state.modules
        .flatMap((m) => m.lessons)
        .find((l) => l.lesson.id === lessonId)
    : null;
  return {
    title: lesson
      ? `${lesson.lesson.title} · Formação · Wonder Ads`
      : "Formação · Wonder Ads",
  };
}

/** Aulas da track por ordem de leitura, para o anterior/seguinte. */
function flatLessons(
  state: TrackState,
): { lesson: TrainingLesson; moduleId: string; locked: boolean }[] {
  return state.modules.flatMap((m) =>
    m.lessons.map((l) => ({
      lesson: l.lesson,
      moduleId: m.module.id,
      locked: m.status === "locked",
    })),
  );
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ track: string; lessonId: string }>;
}) {
  const { track: slug, lessonId } = await params;
  const ctx = await getTrainingContext();
  if (!ctx) redirect(`/login?next=/formacao/${slug}/aula/${lessonId}`);

  const state = trackStateFor(ctx, slug);
  if (!state) notFound();

  const moduleState = state.modules.find((m) =>
    m.lessons.some((l) => l.lesson.id === lessonId),
  );
  const lessonState = moduleState?.lessons.find(
    (l) => l.lesson.id === lessonId,
  );
  if (!moduleState || !lessonState) notFound();

  // Módulo bloqueado → mostra-se o motivo em vez do vídeo. Sem isto, um link
  // partilhado dava acesso a conteúdo que a sequência ainda não abriu.
  const locked = moduleState.status === "locked" || state.lockedReason !== null;

  const flat = flatLessons(state);
  const idx = flat.findIndex((l) => l.lesson.id === lessonId);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  const { lesson } = lessonState;
  const provider =
    lesson.videoProvider ??
    (lesson.videoUrl ? detectProvider(lesson.videoUrl) : null);

  // Última aula do módulo com tudo visto → aponta-se ao teste.
  const allWatchedInModule =
    moduleState.totalLessons > 0 &&
    moduleState.watchedLessons >= moduleState.totalLessons;

  return (
    <PageShell backHref={`/formacao/${slug}`} backLabel={state.track.name}>
      <nav className="animate-fade-up flex flex-wrap items-center gap-1.5 text-[12px] text-white/40">
        <Link href="/formacao" className="transition hover:text-white/70">
          Formação
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/formacao/${slug}`}
          className="transition hover:text-white/70"
        >
          {state.track.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-white/55">{moduleState.module.title}</span>
      </nav>

      {locked ? (
        <div className="animate-fade-up mt-8 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-5 py-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-100/90">
            <Lock className="h-4 w-4" />
            Esta aula ainda está bloqueada
          </p>
          <p className="mt-2 text-[13px] text-amber-100/70">
            {state.lockedReason ??
              "Conclui as aulas e o teste do módulo anterior para abrires este módulo."}
          </p>
          <Link
            href={`/formacao/${slug}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/75 transition hover:border-[#783DF5]/40 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar aos módulos
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="animate-fade-up">
            <TrainingPlayer
              lessonId={lesson.id}
              title={lesson.title}
              videoUrl={lesson.videoUrl}
              provider={provider}
              initialPercent={lessonState.percent}
              initialCompleted={lessonState.completedAt !== null}
              estMinutes={lessonMinutes(lesson)}
            />

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {lesson.title}
              </h1>
              <LessonTypeBadge type={lesson.type} />
              {lessonState.watched && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200/85">
                  <CheckCircle2 className="h-3 w-3" />
                  Visto
                </span>
              )}
            </div>

            {lesson.presenter && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-white/45">
                <UserRound className="h-3.5 w-3.5" />
                Apresentado por{" "}
                <span className="text-white/70">{lesson.presenter}</span>
              </p>
            )}

            {lesson.description && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#A9834F]">
                  Sobre esta aula
                </h2>
                <p className="text-[13.5px] leading-relaxed text-white/70">
                  {lesson.description}
                </p>
              </div>
            )}

            {/* Navegação */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              {prev ? (
                <Link
                  href={`/formacao/${slug}/aula/${prev.lesson.id}`}
                  className="group inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/12 px-3.5 py-2.5 text-[12.5px] text-white/70 transition hover:border-[#783DF5]/40 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                  <span className="truncate">{prev.lesson.title}</span>
                </Link>
              ) : (
                <span />
              )}
              {next && !next.locked ? (
                <Link
                  href={`/formacao/${slug}/aula/${next.lesson.id}`}
                  className="brand-gradient-bg group inline-flex min-w-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:brightness-110"
                >
                  <span className="truncate">{next.lesson.title}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : moduleState.quizRequired && allWatchedInModule ? (
                <Link
                  href={`/formacao/${slug}/teste/${moduleState.module.id}`}
                  className="brand-gradient-bg group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:brightness-110"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Fazer o teste do módulo
                </Link>
              ) : null}
            </div>
          </div>

          {/* Sidebar: aulas do módulo */}
          <aside className="animate-fade-up lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/40">
                {moduleState.module.title}
              </p>
              <ol className="mt-3 space-y-1">
                {moduleState.lessons.map((l, i) => {
                  const active = l.lesson.id === lesson.id;
                  return (
                    <li key={l.lesson.id}>
                      <Link
                        href={`/formacao/${slug}/aula/${l.lesson.id}`}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition ${
                          active
                            ? "bg-[#783DF5]/15 text-white"
                            : "text-white/60 hover:bg-white/[0.05] hover:text-white/85"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            l.watched
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-white/[0.06] text-white/45"
                          }`}
                        >
                          {l.watched ? "✓" : i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {l.lesson.title}
                        </span>
                        {l.comingSoon && (
                          <span className="shrink-0 text-[9.5px] uppercase tracking-wide text-white/35">
                            breve
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
                {moduleState.quizRequired && (
                  <li>
                    <Link
                      href={`/formacao/${slug}/teste/${moduleState.module.id}`}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-white/60 transition hover:bg-white/[0.05] hover:text-white/85"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          moduleState.quizPassed
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-white/[0.06] text-white/45"
                        }`}
                      >
                        <ClipboardCheck className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {moduleState.module.quiz.title}
                      </span>
                    </Link>
                  </li>
                )}
              </ol>
            </div>
          </aside>
        </div>
      )}
    </PageShell>
  );
}
