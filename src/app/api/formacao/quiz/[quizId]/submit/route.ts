// Submissão de um teste da Formação.
//   POST /api/formacao/quiz/<quizId>/submit
//   { answers: [{ questionId, optionIds?, text? }], startedAt? }
//
// O utilizador vem da sessão, o teste vem do catálogo em vigor e a correção é
// feita aqui — nunca no cliente. Guarda-se a tentativa inteira, com todas as
// respostas dadas, para o admin poder ver exatamente o que a pessoa escolheu.
//
// Não há endpoint separado de "start": o `startedAt` é informativo e chega no
// payload (validado contra valores absurdos). Uma escrita a menos por
// tentativa é uma operação KV a menos, e nada de importante depende dele.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getTrainingCatalog } from "@/lib/training/content-store";
import { getEnrollments, resolveTrackSlug } from "@/lib/training/enrollments-store";
import { getTrainingProgress } from "@/lib/training/progress-store";
import {
  appendQuizAttempt,
  attemptsForQuiz,
  getQuizAttempts,
  type QuizAttempt,
} from "@/lib/training/attempts-store";
import { computeUserTraining } from "@/lib/training/progress";
import { gradeQuiz, type SubmittedAnswer } from "@/lib/training/grading";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  const { quizId } = await params;
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { answers: rawAnswers, startedAt: rawStartedAt } = (body ?? {}) as {
    answers?: unknown;
    startedAt?: unknown;
  };
  if (!Array.isArray(rawAnswers)) {
    return NextResponse.json({ error: "answers em falta" }, { status: 400 });
  }
  const answers: SubmittedAnswer[] = rawAnswers
    .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === "object")
    .filter((a) => typeof a.questionId === "string")
    .map((a) => ({
      questionId: a.questionId as string,
      optionIds: Array.isArray(a.optionIds)
        ? a.optionIds.filter((x): x is string => typeof x === "string")
        : [],
      text: typeof a.text === "string" ? a.text : null,
    }));

  const [tracks, enrollments, progress, previousAttempts] = await Promise.all([
    getTrainingCatalog(),
    getEnrollments(),
    getTrainingProgress(employee.username),
    getQuizAttempts(employee.username),
  ]);

  // Localizar o teste e a track a que pertence.
  let found: { trackSlug: string; moduleId: string; quiz: (typeof tracks)[number]["modules"][number]["quiz"] } | null =
    null;
  for (const t of tracks) {
    for (const m of t.modules) {
      if (m.quiz.id === quizId) {
        found = { trackSlug: t.slug, moduleId: m.id, quiz: m.quiz };
        break;
      }
    }
    if (found) break;
  }
  if (!found) {
    return NextResponse.json({ error: "Teste desconhecido." }, { status: 404 });
  }
  if (found.quiz.questions.length === 0) {
    return NextResponse.json(
      { error: "Este teste ainda não tem perguntas." },
      { status: 409 },
    );
  }

  // O utilizador tem de estar inscrito na track E ter o módulo aberto. Sem
  // isto, bastava conhecer o id do teste para passar por cima da sequência.
  const specializationSlug = resolveTrackSlug(
    employee.username,
    employee.dept,
    enrollments,
  );
  const { common, specialization } = computeUserTraining(
    tracks,
    specializationSlug,
    progress,
    previousAttempts,
  );
  const state =
    common?.track.slug === found.trackSlug
      ? common
      : specialization?.track.slug === found.trackSlug
        ? specialization
        : null;
  if (!state) {
    return NextResponse.json(
      { error: "Não estás inscrito nesta trilha." },
      { status: 403 },
    );
  }
  const moduleState = state.modules.find((m) => m.module.id === found.moduleId);
  if (!moduleState || moduleState.status === "locked") {
    return NextResponse.json(
      { error: "Este módulo ainda está bloqueado." },
      { status: 403 },
    );
  }
  if (!moduleState.quizRequired) {
    return NextResponse.json(
      {
        error:
          "Este módulo ainda não tem aulas gravadas — o teste só abre quando houver matéria.",
      },
      { status: 409 },
    );
  }
  if (moduleState.watchedLessons < moduleState.totalLessons) {
    return NextResponse.json(
      { error: "Vê todas as aulas do módulo antes de fazer o teste." },
      { status: 403 },
    );
  }

  const attemptsSoFar = attemptsForQuiz(previousAttempts, quizId);
  if (
    found.quiz.maxAttempts !== null &&
    attemptsSoFar.length >= found.quiz.maxAttempts
  ) {
    return NextResponse.json(
      { error: "Atingiste o número máximo de tentativas deste teste." },
      { status: 409 },
    );
  }

  const now = Date.now();
  const startedAt =
    typeof rawStartedAt === "number" &&
    Number.isFinite(rawStartedAt) &&
    rawStartedAt <= now &&
    now - rawStartedAt < 24 * 60 * 60 * 1000
      ? rawStartedAt
      : now;

  const result = gradeQuiz(found.quiz, answers);
  const attempt: QuizAttempt = {
    id: `${quizId}-${now}`,
    quizId,
    moduleId: found.moduleId,
    trackSlug: found.trackSlug,
    attemptNumber: attemptsSoFar.length + 1,
    score: result.score,
    passed: result.passed,
    startedAt,
    submittedAt: now,
    answers: result.answers,
  };

  try {
    await appendQuizAttempt(employee.username, attempt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // A correção só sai daqui — depois de a tentativa estar guardada.
  return NextResponse.json({
    ok: true,
    attemptNumber: attempt.attemptNumber,
    score: result.score,
    passed: result.passed,
    passingScore: found.quiz.passingScore,
    pendingReview: result.pendingReview,
    attemptsLeft:
      found.quiz.maxAttempts === null
        ? null
        : Math.max(0, found.quiz.maxAttempts - attempt.attemptNumber),
    correction: result.graded.map((g) => ({
      questionId: g.question.id,
      prompt: g.question.prompt,
      isCorrect: g.answer.isCorrect,
      manualReview: g.manualReview,
      chosenOptionIds: g.answer.optionIds,
      correctOptionIds: g.correctOptionIds,
      explanation: g.question.explanation ?? null,
      options: g.question.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  });
}
