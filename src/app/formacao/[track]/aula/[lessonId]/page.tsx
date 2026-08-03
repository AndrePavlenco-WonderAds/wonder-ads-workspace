// Página de aula.
//
// DESENHO — continuação da "consola de sequência" do roadmap. Duas ideias:
//
//  1. VIEWPORT. O vídeo não leva moldura contínua: leva quatro cantos e um
//     bloom por trás. Enquadra sem roubar contraste ao próprio vídeo, que é a
//     única coisa nesta página que a pessoa veio ver.
//  2. ESPINHA DO CAPÍTULO. A barra lateral repete o condutor vertical do
//     roadmap — nó cheio nas aulas vistas, nó aceso na atual. As duas páginas
//     leem-se como o mesmo sistema, e sabe-se onde se está sem voltar atrás.
//
// A faixa de leitura por baixo do vídeo (aula N de M · tipo · duração ·
// apresentador) substitui os metadados que antes estavam espalhados.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
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

/** Aulas do módulo por ordem de leitura, para o anterior/seguinte. */
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

/** Os quatro cantos do viewport. Ficam por cima do vídeo, sem o intercetar. */
function ViewportBrackets() {
  return (
    <>
      <span className="viewport-bracket -left-px -top-px rounded-tl-lg border-l-2 border-t-2" />
      <span className="viewport-bracket -right-px -top-px rounded-tr-lg border-r-2 border-t-2" />
      <span className="viewport-bracket -bottom-px -left-px rounded-bl-lg border-b-2 border-l-2" />
      <span className="viewport-bracket -bottom-px -right-px rounded-br-lg border-b-2 border-r-2" />
    </>
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

  // Capítulo bloqueado → mostra-se o motivo em vez do vídeo. Sem isto, um link
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

  // Posição dentro do capítulo — a leitura "aula 2 de 5" que aparece na faixa.
  const posInModule =
    moduleState.lessons.findIndex((l) => l.lesson.id === lessonId) + 1;
  const chapterIndex =
    state.modules.findIndex((m) => m.module.id === moduleState.module.id) + 1;

  // Última aula do capítulo com tudo visto → aponta-se ao teste.
  const allWatchedInModule =
    moduleState.totalLessons > 0 &&
    moduleState.watchedLessons >= moduleState.totalLessons;

  return (
    <PageShell backHref={`/formacao/${slug}`} backLabel={state.track.name}>
      <nav className="animate-fade-up flex flex-wrap items-center gap-1.5 text-[12px] text-white/35">
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
              "Conclui as aulas e o teste do capítulo anterior para abrires este capítulo."}
          </p>
          <Link
            href={`/formacao/${slug}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/75 transition hover:border-[#783DF5]/40 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar à sequência
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_310px]">
          <div className="animate-fade-up min-w-0">
            {/* ---------- Viewport ---------- */}
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-x-10 -bottom-6 -top-10 rounded-[2rem] opacity-[0.16] blur-3xl"
                style={{ background: "var(--brand-gradient)" }}
              />
              <div className="relative">
                <TrainingPlayer
                  lessonId={lesson.id}
                  title={lesson.title}
                  videoUrl={lesson.videoUrl}
                  provider={provider}
                  initialPercent={lessonState.percent}
                  initialCompleted={lessonState.completedAt !== null}
                  estMinutes={lessonMinutes(lesson)}
                />
                <ViewportBrackets />
              </div>
            </div>

            {/* ---------- Faixa de leitura ---------- */}
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-white/[0.07] py-2.5">
              <span className="readout tabular text-white/30">
                Cap {chapterIndex.toString().padStart(2, "0")} · Aula{" "}
                {posInModule.toString().padStart(2, "0")} de{" "}
                {moduleState.lessons.length.toString().padStart(2, "0")}
              </span>
              <span className="h-3 w-px bg-white/10" />
              <LessonTypeBadge type={lesson.type} />
              <span className="tabular inline-flex items-center gap-1.5 text-[11.5px] text-white/40">
                <Clock className="h-3 w-3" />~{lessonMinutes(lesson)} min
              </span>
              {lesson.presenter && (
                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-white/40">
                  <UserRound className="h-3 w-3" />
                  {lesson.presenter}
                </span>
              )}
              {lessonState.watched && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Visto
                </span>
              )}
            </div>

            <h1 className="mt-5 text-[1.65rem] font-bold leading-[1.15] tracking-[-0.02em] text-white sm:text-[2.1rem]">
              {lesson.title}
            </h1>

            {lesson.description && (
              <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5">
                <h2 className="readout mb-3 text-[#d8b98a]">Sobre esta aula</h2>
                <p className="text-[13.5px] leading-relaxed text-white/65">
                  {lesson.description}
                </p>
              </div>
            )}

            {/* ---------- Navegação ---------- */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              {prev ? (
                <Link
                  href={`/formacao/${slug}/aula/${prev.lesson.id}`}
                  className="group inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-white/[0.09] px-3.5 py-2.5 text-[12.5px] text-white/60 transition hover:border-[#783DF5]/40 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                  <span className="truncate">{prev.lesson.title}</span>
                </Link>
              ) : (
                <span />
              )}
              {next && !next.locked ? (
                <Link
                  href={`/formacao/${slug}/aula/${next.lesson.id}`}
                  className="brand-gradient-bg group inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:brightness-110"
                >
                  <span className="truncate">{next.lesson.title}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : moduleState.quizRequired && allWatchedInModule ? (
                <Link
                  href={`/formacao/${slug}/teste/${moduleState.module.id}`}
                  className="brand-gradient-bg group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:brightness-110"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Fazer o teste do capítulo
                </Link>
              ) : null}
            </div>
          </div>

          {/* ---------- Espinha do capítulo ---------- */}
          <aside className="animate-fade-up lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.018]">
              <div className="h-[3px] w-full bg-white/[0.05]">
                <div
                  className="brand-gradient-bg h-[3px] transition-all duration-700"
                  style={{ width: `${moduleState.percent}%` }}
                />
              </div>
              <div className="p-4">
                <p className="readout text-white/28">
                  Capítulo {chapterIndex.toString().padStart(2, "0")}
                </p>
                <p className="mt-1 text-[13.5px] font-semibold leading-snug text-white/85">
                  {moduleState.module.title}
                </p>
                <p className="tabular mt-1 text-[11px] text-white/35">
                  {moduleState.watchedLessons}/{moduleState.totalLessons} aulas
                  vistas
                </p>

                <ol className="relative mt-4">
                  {/* O condutor da barra lateral — o mesmo fio do roadmap. */}
                  <span
                    aria-hidden
                    className="absolute bottom-3 left-[9px] top-3 w-px bg-white/[0.07]"
                  />
                  {moduleState.lessons.map((l, i) => {
                    const active = l.lesson.id === lesson.id;
                    return (
                      <li key={l.lesson.id} className="relative">
                        <Link
                          href={`/formacao/${slug}/aula/${l.lesson.id}`}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-start gap-3 rounded-lg py-2 pl-0 pr-2 text-[12.5px] transition ${
                            active
                              ? "text-white"
                              : "text-white/55 hover:text-white/85"
                          }`}
                        >
                          <span
                            className={`tabular relative z-10 mt-px flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                              l.watched
                                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30"
                                : active
                                  ? "brand-gradient-bg text-white"
                                  : "bg-[color:var(--background)] text-white/35 ring-1 ring-white/10"
                            }`}
                          >
                            {l.watched ? "✓" : i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block leading-snug">
                              {l.lesson.title}
                            </span>
                            {l.comingSoon && (
                              <span className="readout mt-0.5 block text-amber-200/50">
                                Brevemente
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}

                  {moduleState.quizRequired && (
                    <li className="relative">
                      <Link
                        href={`/formacao/${slug}/teste/${moduleState.module.id}`}
                        className="flex items-center gap-3 rounded-lg py-2 pr-2 text-[12.5px] text-white/55 transition hover:text-white/85"
                      >
                        <span
                          className={`relative z-10 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full ${
                            moduleState.quizPassed
                              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30"
                              : "bg-[color:var(--background)] text-white/40 ring-1 ring-[#783DF5]/35"
                          }`}
                        >
                          <ClipboardCheck className="h-2.5 w-2.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {moduleState.module.quiz.title}
                        </span>
                      </Link>
                    </li>
                  )}
                </ol>
              </div>
            </div>
          </aside>
        </div>
      )}
    </PageShell>
  );
}
