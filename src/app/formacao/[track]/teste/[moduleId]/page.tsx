// Quiz de um capítulo. Server component: valida a sequência (capítulo aberto +
// aulas vistas), prepara as perguntas já baralhadas e sem as respostas
// certas, e mostra o histórico de tentativas.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, ClipboardCheck, Lock, PlayCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { QuizRunner } from "@/components/training/quiz-runner";
import { getTrainingContext, trackStateFor } from "@/lib/training/server";
import { attemptsForQuiz } from "@/lib/training/attempts-store";
import { seededShuffle, toPublicQuestions } from "@/lib/training/grading";
import { formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string; moduleId: string }>;
}): Promise<Metadata> {
  const { track, moduleId } = await params;
  const ctx = await getTrainingContext();
  const state = ctx ? trackStateFor(ctx, track) : null;
  const mod = state?.modules.find((m) => m.module.id === moduleId);
  return {
    title: mod
      ? `${mod.module.quiz.title} · Formação · Wonder Ads`
      : "Quiz · Formação · Wonder Ads",
  };
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ track: string; moduleId: string }>;
}) {
  const { track: slug, moduleId } = await params;
  const ctx = await getTrainingContext();
  if (!ctx) redirect(`/login?next=/formacao/${slug}/teste/${moduleId}`);

  const state = trackStateFor(ctx, slug);
  if (!state) notFound();
  const moduleState = state.modules.find((m) => m.module.id === moduleId);
  if (!moduleState) notFound();

  const { module } = moduleState;
  const quiz = module.quiz;
  const attempts = attemptsForQuiz(ctx.attempts, quiz.id);
  const attemptNumber = attempts.length + 1;
  const attemptsLeft =
    quiz.maxAttempts === null
      ? null
      : Math.max(0, quiz.maxAttempts - attempts.length);

  const locked = moduleState.status === "locked" || state.lockedReason !== null;
  const lessonsPending =
    moduleState.watchedLessons < moduleState.totalLessons;
  const noQuestions = quiz.questions.length === 0;
  const noLessonsYet = moduleState.totalLessons === 0;
  const exhausted = attemptsLeft === 0;

  // Ordem baralhada mas estável: o mesmo utilizador, na mesma tentativa, vê
  // sempre a mesma sequência — um refresh não reordena o quiz a meio.
  const ordered = quiz.shuffleQuestions
    ? seededShuffle(
        quiz.questions,
        `${ctx.employee.username}:${quiz.id}:${attemptNumber}`,
      )
    : [...quiz.questions].sort((a, b) => a.order - b.order);

  // Onde continuar depois de passar: o capítulo seguinte, se existir.
  const idx = state.modules.findIndex((m) => m.module.id === moduleId);
  const nextModule = idx >= 0 ? state.modules[idx + 1] : undefined;
  const nextLesson = nextModule?.lessons.find((l) => !l.comingSoon);
  const nextHref = nextLesson
    ? `/formacao/${slug}/aula/${nextLesson.lesson.id}`
    : `/formacao/${slug}`;

  const blocker = locked
    ? {
        title: "Capítulo bloqueado",
        text:
          state.lockedReason ??
          "Conclui o capítulo anterior para chegares a este quiz.",
      }
    : noQuestions
      ? {
          title: "Quiz ainda por escrever",
          text: "Este capítulo ainda não tem perguntas. Não bloqueia a tua progressão — podes seguir para o capítulo seguinte.",
        }
      : noLessonsYet
        ? {
            title: "Aulas ainda por publicar",
            text: "O quiz deste capítulo já está escrito, mas as aulas ainda não foram gravadas. Abre assim que houver matéria — e não bloqueia a tua progressão.",
          }
        : lessonsPending
          ? {
              title: "Faltam aulas por ver",
              text: `Vê as ${moduleState.totalLessons - moduleState.watchedLessons} aula(s) que faltam neste capítulo antes de fazeres o quiz.`,
            }
          : exhausted
            ? {
                title: "Sem tentativas disponíveis",
                text: "Já usaste todas as tentativas deste quiz. Fala com o Andre, o Alex ou a Alice.",
              }
            : null;

  return (
    <PageShell backHref={`/formacao/${slug}`} backLabel={state.track.name}>
      <nav className="animate-fade-up flex flex-wrap items-center gap-1.5 text-[12px] text-white/40">
        <Link href="/formacao" className="transition hover:text-white/70">
          Formação
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/formacao/${slug}`} className="transition hover:text-white/70">
          {state.track.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-white/55">{module.title}</span>
      </nav>

      <header className="animate-fade-up mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/60">
            <ClipboardCheck className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
            Quiz do capítulo
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {quiz.title}
          </h1>
          <p className="mt-2 text-[13px] text-white/50">
            {quiz.questions.length} pergunta(s) · mínimo {quiz.passingScore}%
            {quiz.maxAttempts === null
              ? " · tentativas ilimitadas"
              : ` · máximo ${quiz.maxAttempts} tentativas`}
          </p>
        </div>
        {moduleState.quizPassed && moduleState.quizBestScore !== null && (
          <span className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-[13px] font-semibold text-emerald-200">
            Já passado · melhor nota {moduleState.quizBestScore}%
          </span>
        )}
      </header>

      {blocker ? (
        <div className="animate-fade-up mt-8 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-5 py-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-100/90">
            <Lock className="h-4 w-4" />
            {blocker.title}
          </p>
          <p className="mt-2 max-w-xl text-[13px] text-amber-100/70">
            {blocker.text}
          </p>
          <Link
            href={`/formacao/${slug}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/75 transition hover:border-[#783DF5]/40 hover:text-white"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Voltar à sequência
          </Link>
        </div>
      ) : (
        <div className="animate-fade-up mt-8">
          <QuizRunner
            quizId={quiz.id}
            questions={toPublicQuestions(ordered)}
            passingScore={quiz.passingScore}
            attemptNumber={attemptNumber}
            attemptsLeft={attemptsLeft}
            trackHref={`/formacao/${slug}`}
            nextHref={nextHref}
          />
        </div>
      )}

      {attempts.length > 0 && (
        <section className="animate-fade-up mt-10">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
            As tuas tentativas
          </h2>
          <ul className="space-y-2">
            {attempts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-[12.5px]"
              >
                <span className="font-medium text-white/70">
                  Tentativa {a.attemptNumber}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    a.passed
                      ? "bg-emerald-500/12 text-emerald-300"
                      : "bg-rose-500/12 text-rose-300"
                  }`}
                >
                  {a.score}% · {a.passed ? "passou" : "chumbou"}
                </span>
                <span className="ml-auto text-white/40">
                  {formatDateTime(a.submittedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
