// Reconciliação de exames expirados — a peça que torna o "hard stop" real.
//
// O CASO QUE ISTO RESOLVE: alguém abre o exame, responde a metade e fecha o
// portátil. O cliente nunca submete. Sem esta peça, a tentativa ficava em
// aberto para sempre e a pessoa voltava no dia seguinte com o exame por fazer —
// o cronómetro não teria decidido nada.
//
// Aqui, qualquer leitura do estado dos exames (a página, a API, o hub) passa
// primeiro por `reconcileExpiredExams`. Se encontrar uma sessão cujo prazo
// passou sem submissão, CORRIGE o último snapshot gravado e grava a tentativa.
// A partir daí a pessoa vê o resultado, não o exame — que é exatamente o que
// acontece quando o invigilador recolhe a folha.
//
// A correção é a mesma dos quizzes (`gradeQuiz`) sobre as respostas guardadas:
// "fica como está o progresso" à letra. Quem não respondeu a nada leva 0, que é
// a nota certa para uma folha em branco.

import {
  appendQuizAttempt,
  type QuizAttempt,
} from "@/lib/training/attempts-store";
import {
  finishExamSession,
  getExamSessions,
  isPastDeadline,
  type ExamSession,
} from "@/lib/training/exam-sessions-store";
import { examQuiz, findExam } from "@/lib/training/exams";
import { gradeQuiz } from "@/lib/training/grading";

/** True quando a tentativa desta sessão já foi gravada. Sem isto, duas leituras
 *  simultâneas (a página e uma chamada à API) gravavam a mesma tentativa duas
 *  vezes e queimavam as duas oportunidades de uma só vez. */
function attemptAlreadyRecorded(
  attempts: QuizAttempt[],
  session: ExamSession,
): boolean {
  return attempts.some(
    (a) => a.quizId === session.examId && a.attemptNumber === session.attemptNumber,
  );
}

/** Corrige e grava uma sessão que passou do prazo. Devolve a tentativa criada,
 *  ou null se não havia nada a fazer. */
async function burnExpiredSession(
  username: string,
  session: ExamSession,
  attempts: QuizAttempt[],
  nowMs: number,
): Promise<QuizAttempt | null> {
  const exam = findExam(session.examId);
  if (!exam) return null;
  if (attemptAlreadyRecorded(attempts, session)) {
    await finishExamSession(username, session.examId, "expired", nowMs);
    return null;
  }

  const quiz = examQuiz(exam);
  if (quiz.questions.length === 0) {
    // Exame sem perguntas nunca devia ter aberto; fecha-se a sessão sem
    // inventar uma nota.
    await finishExamSession(username, session.examId, "expired", nowMs);
    return null;
  }

  const result = gradeQuiz(quiz, session.answers);
  const attempt: QuizAttempt = {
    id: `${session.examId}-${session.deadlineAt}`,
    quizId: session.examId,
    moduleId: session.examId,
    trackSlug: "exames",
    attemptNumber: session.attemptNumber,
    score: result.score,
    passed: result.passed,
    startedAt: session.startedAt,
    // Conta como entregue no instante em que o tempo acabou, não agora — senão
    // uma pessoa que só volta uma semana depois aparecia no registo do admin
    // como tendo submetido uma semana depois.
    submittedAt: session.deadlineAt,
    answers: result.answers,
  };

  await appendQuizAttempt(username, attempt);
  await finishExamSession(username, session.examId, "expired", nowMs);
  return attempt;
}

/** Passa por todas as sessões do utilizador e fecha as que rebentaram o prazo.
 *  Devolve as tentativas criadas (normalmente zero). Barato no caso comum: uma
 *  leitura KV e nada mais quando não há nada expirado. */
export async function reconcileExpiredExams(
  username: string,
  attempts: QuizAttempt[],
  nowMs: number = Date.now(),
): Promise<QuizAttempt[]> {
  let sessions: Record<string, ExamSession>;
  try {
    sessions = await getExamSessions(username);
  } catch (err) {
    console.error("exam reconcile: session read failed:", err);
    return [];
  }

  const stale = Object.values(sessions).filter(
    (s) => s.status === "running" && isPastDeadline(s, nowMs),
  );
  if (stale.length === 0) return [];

  const created: QuizAttempt[] = [];
  // Sequencial de propósito: `appendQuizAttempt` faz read-modify-write na mesma
  // chave, por isso duas em paralelo perdiam uma das tentativas.
  for (const session of stale) {
    try {
      const attempt = await burnExpiredSession(
        username,
        session,
        [...attempts, ...created],
        nowMs,
      );
      if (attempt) created.push(attempt);
    } catch (err) {
      console.error(`exam reconcile: ${session.examId} failed:`, err);
    }
  }
  return created;
}
