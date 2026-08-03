// Submissão de um EXAME DE FASE.
//   POST /api/formacao/exame/<examId>/submit
//   { answers: [{ questionId, optionIds?, text? }], startedAt? }
//
// Mesma correção server-side dos quizzes (`gradeQuiz`), mas com o gate dos
// exames a ser re-verificado AQUI e não só na página: relógio da pessoa,
// exame anterior passado e tentativas restantes. Um exame que se pudesse
// submeter por pedido direto não decidia nada — bastava conhecer o id.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  appendQuizAttempt,
  getQuizAttempts,
  type QuizAttempt,
} from "@/lib/training/attempts-store";
import {
  getStartDates,
  resolveStartDate,
} from "@/lib/training/start-dates-store";
import { computeExamJourney, examQuiz, findExam } from "@/lib/training/exams";
import { gradeQuiz, type SubmittedAnswer } from "@/lib/training/grading";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string }> },
) {
  const { examId } = await params;
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const exam = findExam(examId);
  if (!exam) {
    return NextResponse.json({ error: "Exame desconhecido." }, { status: 404 });
  }
  const quiz = examQuiz(exam);
  if (quiz.questions.length === 0) {
    return NextResponse.json(
      { error: "Este exame ainda não tem perguntas." },
      { status: 409 },
    );
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
    .filter(
      (a): a is Record<string, unknown> => Boolean(a) && typeof a === "object",
    )
    .filter((a) => typeof a.questionId === "string")
    .map((a) => ({
      questionId: a.questionId as string,
      optionIds: Array.isArray(a.optionIds)
        ? a.optionIds.filter((x): x is string => typeof x === "string")
        : [],
      text: typeof a.text === "string" ? a.text : null,
    }));

  const [previousAttempts, startDates] = await Promise.all([
    getQuizAttempts(employee.username),
    getStartDates(),
  ]);
  const journey = computeExamJourney(
    resolveStartDate(employee.username, startDates),
    previousAttempts,
  );
  const state = journey.exams.find((e) => e.exam.id === examId);
  if (!state) {
    return NextResponse.json({ error: "Exame desconhecido." }, { status: 404 });
  }

  // O gate, outra vez. A página já o aplicou; isto é para quem não passou
  // pela página.
  switch (state.status) {
    case "passed":
      return NextResponse.json(
        { error: "Já passaste este exame." },
        { status: 409 },
      );
    case "no_start":
      return NextResponse.json(
        {
          error:
            "A tua data de entrada ainda não está definida — fala com o Andre, o Alex ou a Alice.",
        },
        { status: 403 },
      );
    case "locked_time":
      return NextResponse.json(
        { error: "Este exame ainda não abriu." },
        { status: 403 },
      );
    case "locked_prev":
      return NextResponse.json(
        { error: "Passa o exame anterior antes de fazeres este." },
        { status: 403 },
      );
    case "exhausted":
      return NextResponse.json(
        {
          error:
            "Já usaste todas as tentativas deste exame. A decisão passa para o C-Level.",
        },
        { status: 409 },
      );
    default:
      break;
  }

  const now = Date.now();
  const startedAt =
    typeof rawStartedAt === "number" &&
    Number.isFinite(rawStartedAt) &&
    rawStartedAt <= now &&
    now - rawStartedAt < 24 * 60 * 60 * 1000
      ? rawStartedAt
      : now;

  const result = gradeQuiz(quiz, answers);
  const attempt: QuizAttempt = {
    id: `${examId}-${now}`,
    quizId: examId,
    moduleId: examId,
    // Marca a tentativa como sendo de exame também no `trackSlug`, para o
    // drill-down do admin conseguir agrupar sem depender só do prefixo do id.
    trackSlug: "exames",
    attemptNumber: state.attemptsUsed + 1,
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

  revalidatePath("/formacao");
  revalidatePath(`/formacao/exame/${examId}`);

  const attemptsLeft =
    exam.maxAttempts === null
      ? null
      : Math.max(0, exam.maxAttempts - attempt.attemptNumber);

  return NextResponse.json({
    ok: true,
    attemptNumber: attempt.attemptNumber,
    score: result.score,
    passed: result.passed,
    passingScore: quiz.passingScore,
    pendingReview: result.pendingReview,
    attemptsLeft,
    /** O que este resultado decide — é isto que a página mostra a seguir. */
    outcome: result.passed
      ? exam.final
        ? "effective"
        : "advance"
      : attemptsLeft === 0
        ? "blocked"
        : "retry",
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
