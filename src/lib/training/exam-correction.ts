// A correção de uma tentativa de exame, reconstruída a partir do que ficou
// gravado (v78.63) — módulo puro, sem KV.
//
// PORQUE É QUE ISTO EXISTE: até aqui a correção só vivia na resposta da
// entrega. Quem passava o exame via-a um ou dois segundos — a página
// atualizava, o exame passava a «passado» e o ecrã da correção desaparecia
// com ele. A tentativa guarda pergunta a pergunta o que foi escolhido e se
// estava certo; com o banco de perguntas, isso chega para a mostrar outra vez
// quando a pessoa quiser.
//
// A nota de cada pergunta é a que ficou gravada no dia (`isCorrect`); as
// opções e a resposta certa vêm do banco atual. Uma pergunta apagada do banco
// entretanto continua na lista, sem enunciado, para a contagem bater certo.

import type { QuizAttempt } from "@/lib/training/attempts-store";
import type { TrainingQuestion, TrainingTrack } from "@/lib/training/catalog";
import { questionIndex, shuffleOptions } from "@/lib/training/exam-draw";
import { RETIRED_EXAM_QUESTIONS } from "@/lib/training/exam-questions-retired";
import type { ExamPhase } from "@/lib/training/exams";
import type { QuestionTopic } from "@/lib/training/grading";
import { reviewFor, type StudyLink, type StudyLinks } from "@/lib/training/study-links";

/** Uma linha da correção — a mesma forma que a entrega devolve. */
export type CorrectionRow = {
  questionId: string;
  prompt: string;
  isCorrect: boolean;
  manualReview: boolean;
  chosenOptionIds: string[];
  correctOptionIds: string[];
  explanation: string | null;
  /** Pela ordem em que a pessoa as viu. */
  options: { id: string; text: string }[];
  topic?: QuestionTopic | null;
  /** A aula que a pergunta avalia (ou o capítulo) — onde voltar se errou. */
  review?: StudyLink | null;
  /** A pergunta saiu do banco depois da tentativa — sem enunciado. */
  missing?: boolean;
};

/** A correção de uma tentativa, pela ordem da folha. `seed` é a semente da
 *  folha (a da tentativa, ou a da sessão quando a tentativa é anterior a
 *  guardar-se a semente); sem ela as opções vêm pela ordem do banco. */
export function attemptCorrection(
  exam: ExamPhase,
  tracks: TrainingTrack[],
  attempt: QuizAttempt,
  seed: string | null,
  links: StudyLinks,
): CorrectionRow[] {
  const index = questionIndex(exam, tracks);
  const retired = new Map(RETIRED_EXAM_QUESTIONS.map((q) => [q.id, q] as const));
  return attempt.answers.map((ans) => {
    const hit = index.get(ans.questionId);
    const base: TrainingQuestion | undefined = hit?.question ?? retired.get(ans.questionId);
    if (!base) {
      return {
        questionId: ans.questionId,
        prompt: "",
        isCorrect: ans.isCorrect,
        manualReview: false,
        chosenOptionIds: ans.optionIds,
        correctOptionIds: [],
        explanation: null,
        options: [],
        topic: null,
        missing: true,
      };
    }
    const q = seed ? shuffleOptions(base, seed) : base;
    return {
      questionId: q.id,
      prompt: q.prompt,
      isCorrect: ans.isCorrect,
      manualReview: q.type === "open_text",
      chosenOptionIds: ans.optionIds,
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      explanation: q.explanation ?? null,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      topic: hit?.topic ?? null,
      review: reviewFor(links, q.lessonId ?? null, hit?.topic.key ?? null),
    };
  });
}
