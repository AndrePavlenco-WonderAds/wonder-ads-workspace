// Correção dos testes — módulo puro, usado pelo endpoint de submissão e pelo
// drill-down do admin.
//
// A CORREÇÃO É SEMPRE NO SERVIDOR. O cliente nunca recebe quais são as opções
// certas antes de submeter: a página do teste envia as opções já despidas do
// `isCorrect`, e só a resposta da submissão traz a correção. Caso contrário
// bastava abrir o inspetor para passar qualquer teste.
//
// Perguntas de resposta aberta ficam FORA da nota automática (guardadas e
// sinalizadas para revisão manual). Dar 0 automático a uma resposta escrita
// chumbaria gente por uma limitação nossa, não por desconhecimento.

import type { TrainingQuestion, TrainingQuiz } from "@/lib/training/catalog";
import type { QuizAnswer } from "@/lib/training/attempts-store";

export type SubmittedAnswer = {
  questionId: string;
  optionIds?: string[];
  text?: string | null;
};

export type GradedQuestion = {
  question: TrainingQuestion;
  answer: QuizAnswer;
  /** Ids das opções corretas — só revelados depois de submeter. */
  correctOptionIds: string[];
  /** True quando a pergunta não entra na nota (resposta aberta). */
  manualReview: boolean;
};

export type GradedAttempt = {
  score: number;
  passed: boolean;
  answers: QuizAnswer[];
  graded: GradedQuestion[];
  totalPoints: number;
  awardedPoints: number;
  /** Perguntas de resposta aberta a aguardar leitura do admin. */
  pendingReview: number;
};

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/** Corrige um conjunto de respostas contra o teste. */
export function gradeQuiz(
  quiz: TrainingQuiz,
  submitted: SubmittedAnswer[],
): GradedAttempt {
  const byId = new Map(submitted.map((s) => [s.questionId, s]));
  const graded: GradedQuestion[] = [];
  let totalPoints = 0;
  let awardedPoints = 0;
  let pendingReview = 0;

  for (const question of quiz.questions) {
    const given = byId.get(question.id);
    const correctOptionIds = question.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id);

    if (question.type === "open_text") {
      const text = (given?.text ?? "").trim();
      pendingReview += 1;
      const answer: QuizAnswer = {
        questionId: question.id,
        optionIds: [],
        text: text || null,
        isCorrect: false,
        pointsAwarded: 0,
      };
      graded.push({ question, answer, correctOptionIds, manualReview: true });
      continue;
    }

    // Só se aceitam ids de opções que existem mesmo nesta pergunta — um
    // payload forjado não consegue inventar uma opção correta.
    const valid = new Set(question.options.map((o) => o.id));
    const chosen = (given?.optionIds ?? []).filter((id) => valid.has(id));
    const isCorrect = sameSet(chosen, correctOptionIds);

    totalPoints += question.points;
    if (isCorrect) awardedPoints += question.points;

    graded.push({
      question,
      answer: {
        questionId: question.id,
        optionIds: chosen,
        text: null,
        isCorrect,
        pointsAwarded: isCorrect ? question.points : 0,
      },
      correctOptionIds,
      manualReview: false,
    });
  }

  const score =
    totalPoints === 0 ? 0 : Math.round((awardedPoints / totalPoints) * 100);

  return {
    score,
    passed: totalPoints > 0 && score >= quiz.passingScore,
    answers: graded.map((g) => g.answer),
    graded,
    totalPoints,
    awardedPoints,
    pendingReview,
  };
}

/** Versão do teste segura para enviar ao cliente: sem `isCorrect` e sem as
 *  explicações (que muitas vezes denunciam a resposta). */
export type PublicQuestion = {
  id: string;
  prompt: string;
  type: TrainingQuestion["type"];
  points: number;
  options: { id: string; text: string }[];
};

export function toPublicQuestions(
  questions: TrainingQuestion[],
): PublicQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    points: q.points,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  }));
}

// ---------------------------------------------------------------------------
// Baralhar de forma determinística
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Baralha com semente — a MESMA tentativa vê sempre a mesma ordem (um F5 não
 *  reordena as perguntas a meio), mas tentativas diferentes veem ordens
 *  diferentes. Nada de Math.random: a ordem tem de ser reproduzível. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const out = items.slice();
  let state = hashString(seed) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
