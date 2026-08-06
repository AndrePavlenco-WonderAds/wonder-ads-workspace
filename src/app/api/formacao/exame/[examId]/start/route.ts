// Abertura de um EXAME DE FASE — o momento em que o cronómetro arranca.
//   POST /api/formacao/exame/<examId>/start
//   → { startedAt, deadlineAt, serverNow, attemptNumber, resumed }
//
// PORQUE É QUE ISTO É UMA ROTA E NÃO UM `useState`: o prazo tem de ser
// carimbado pelo SERVIDOR. Se os 60 minutos nascessem no browser, recarregar a
// página dava 60 minutos novos, e o exame passava a ser um quiz com uma
// animação. Aqui o relógio arranca UMA vez; a partir daí `deadlineAt` é a
// única coisa que decide.
//
// Chamar isto duas vezes é seguro e é suposto: a segunda chamada RETOMA a
// mesma sessão com o mesmo prazo (é o que acontece a quem recarrega a página a
// meio). O que nunca acontece é o relógio voltar atrás.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getQuizAttempts } from "@/lib/training/attempts-store";
import {
  getStartDates,
  resolveStartDate,
} from "@/lib/training/start-dates-store";
import { computeExamJourney, examQuiz, findExam } from "@/lib/training/exams";
import { reconcileExpiredExams } from "@/lib/training/exam-proctor";
import {
  EXAM_DURATION_MINUTES,
  startExamSession,
} from "@/lib/training/exam-sessions-store";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
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
  if (examQuiz(exam).questions.length === 0) {
    return NextResponse.json(
      { error: "Este exame ainda não tem perguntas." },
      { status: 409 },
    );
  }

  const now = Date.now();

  // Primeiro fecham-se as sessões que rebentaram o prazo enquanto a pessoa
  // esteve fora — senão alguém que abandonou o exame há dois dias voltava aqui
  // e o gate ainda lhe contava a tentativa como por usar.
  const initialAttempts = await getQuizAttempts(employee.username);
  const burnt = await reconcileExpiredExams(
    employee.username,
    initialAttempts,
    now,
  );
  const attempts = burnt.length ? [...initialAttempts, ...burnt] : initialAttempts;

  const startDates = await getStartDates();
  const journey = computeExamJourney(
    resolveStartDate(employee.username, startDates),
    attempts,
    new Date(now),
  );
  const state = journey.exams.find((e) => e.exam.id === examId);
  if (!state) {
    return NextResponse.json({ error: "Exame desconhecido." }, { status: 404 });
  }

  // O mesmo gate da página e da submissão. Repetido de propósito: quem chega
  // aqui por pedido direto não passou pela página nenhuma.
  const denial: Record<string, { message: string; status: number }> = {
    passed: { message: "Já passaste este exame.", status: 409 },
    no_start: {
      message:
        "A tua data de entrada ainda não está definida — fala com o Andre, o Alex ou a Alice.",
      status: 403,
    },
    no_questions: {
      message: "Este exame ainda não tem perguntas.",
      status: 409,
    },
    locked_time: { message: "Este exame ainda não abriu.", status: 403 },
    locked_prev: {
      message: "Passa o exame anterior antes de fazeres este.",
      status: 403,
    },
    exhausted: {
      message:
        "Já usaste todas as tentativas deste exame. A decisão passa para o C-Level.",
      status: 409,
    },
  };
  const blocked = denial[state.status];
  if (blocked) {
    return NextResponse.json(
      { error: blocked.message },
      { status: blocked.status },
    );
  }

  try {
    const outcome = await startExamSession(
      employee.username,
      examId,
      state.attemptsUsed + 1,
      now,
    );

    if (outcome.kind === "already_submitted") {
      return NextResponse.json(
        { error: "Esta tentativa já foi entregue." },
        { status: 409 },
      );
    }
    if (outcome.kind === "expired") {
      return NextResponse.json(
        {
          error:
            "O tempo desta tentativa acabou. A folha foi recolhida como estava.",
          expired: true,
        },
        { status: 409 },
      );
    }

    const { session } = outcome;
    return NextResponse.json({
      ok: true,
      resumed: outcome.kind === "resumed",
      attemptNumber: session.attemptNumber,
      startedAt: session.startedAt,
      deadlineAt: session.deadlineAt,
      durationMinutes: EXAM_DURATION_MINUTES,
      answers: session.answers,
      // O cliente compara com o seu próprio relógio para corrigir o desvio —
      // é o que impede alguém de ganhar tempo mudando a hora do sistema.
      serverNow: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
