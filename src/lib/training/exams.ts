// Exames de fase — a régua dura da Consultants University. Módulo PURO
// (sem KV, sem React), tal como `progress.ts`, para que o hub do consultor e
// o Superadmin cheguem sempre à mesma conclusão sobre quem passou o quê.
//
// DESENHO — OS QUIZZES ENSINAM, OS EXAMES DECIDEM.
//
// Cada capítulo tem um quiz: repete-se à vontade, serve para fixar a matéria e
// não tem consequência. Os seis EXAMES são outra coisa. Abrem por RELÓGIO (não
// por progresso): semana 1, 2, 3, 4, dia 60 e dia 90 contados a partir da data
// de entrada da pessoa. Têm nota mínima alta, poucas tentativas, e cada um
// decide a passagem à fase seguinte. O dos 90 dias decide a efetividade.
//
// Duas trancas, ambas necessárias:
//   1. TEMPO — não se faz o exame da semana 3 no terceiro dia. A pessoa vê-o
//      no sítio, bloqueado, com a data em que abre. Ver o caminho todo desde
//      o dia 1 é metade do efeito.
//   2. SEQUÊNCIA — o exame N só abre com o N-1 passado. Sem isto, quem
//      chumbasse a semana 1 saltava para o dos 90 dias e a régua não valia
//      nada.
//
// As tentativas são guardadas no MESMO sítio que as dos quizzes
// (`training-attempts:<username>`), distinguidas pelo prefixo do `quizId`.
// Uma chave KV a menos, e o drill-down do admin já sabe ler o formato.

import type { QuizAttempt } from "@/lib/training/attempts-store";
import type { TrainingQuiz } from "@/lib/training/catalog";
import { EXAM_QUESTIONS } from "@/lib/training/exam-questions";

/** Prefixo dos ids de exame. É o que separa uma tentativa de exame de uma
 *  tentativa de quiz dentro da mesma lista guardada em KV. */
export const EXAM_ID_PREFIX = "exame-";

export function isExamQuizId(quizId: string): boolean {
  return quizId.startsWith(EXAM_ID_PREFIX);
}

export type ExamPhase = {
  /** `exame-s1` … `exame-d90`. Entra no id da tentativa — nunca mudar. */
  id: string;
  order: number;
  /** Etiqueta curta do cartão: "Semana 1". */
  label: string;
  /** Marco em dias, como se lê: "7 dias". */
  milestone: string;
  /** Dias desde a data de entrada até o exame abrir. */
  unlockDays: number;
  title: string;
  description: string;
  /** Nota mínima. Sobe ao longo das fases. */
  passingScore: number;
  /** null = ilimitadas. Nos exames é sempre um número — é o que os torna
   *  exames. */
  maxAttempts: number | null;
  /** O que este exame decide, em uma frase. */
  gate: string;
  /** O último: passa a pessoa a efetiva. */
  final?: boolean;
};

export const EXAM_PHASES: ExamPhase[] = [
  {
    id: "exame-s1",
    order: 1,
    label: "Semana 1",
    milestone: "7 dias",
    unlockDays: 7,
    title: "Exame 1 — Fundações e padrão da casa",
    description:
      "O que a WonderAds é, o que recusa fazer, e o padrão de exigência que se espera de quem cá trabalha a partir do dia 1.",
    passingScore: 85,
    maxAttempts: 2,
    gate: "Passa para a fase de comunicação.",
  },
  {
    id: "exame-s2",
    order: 2,
    label: "Semana 2",
    milestone: "14 dias",
    unlockDays: 14,
    title: "Exame 2 — Comunicação e responsabilidade",
    description:
      "Como se fala com um cliente em qualquer momento da parceria, como se dá uma má notícia, e de quem é a responsabilidade quando algo fica parado.",
    passingScore: 85,
    maxAttempts: 2,
    gate: "Passa para a fase de execução.",
  },
  {
    id: "exame-s3",
    order: 3,
    label: "Semana 3",
    milestone: "21 dias",
    unlockDays: 21,
    title: "Exame 3 — Execução e protocolos",
    description:
      "Os protocolos do departamento, o registo de horas, o roadmap e as ferramentas — o que se faz, por que ordem e onde fica registado.",
    passingScore: 88,
    maxAttempts: 2,
    gate: "Passa para a fase de conta própria.",
  },
  {
    id: "exame-s4",
    order: 4,
    label: "Semana 4",
    milestone: "28 dias",
    unlockDays: 28,
    title: "Exame 4 — Onboarding e primeiros 30 dias",
    description:
      "Receber um cliente novo: o que se prepara antes, o que se faz na reunião e o que se entrega depois. Os primeiros 30 dias definem a confiança do ano inteiro.",
    passingScore: 88,
    maxAttempts: 2,
    gate: "Passa para a fase de carteira.",
  },
  {
    id: "exame-d60",
    order: 5,
    label: "60 dias",
    milestone: "60 dias",
    unlockDays: 60,
    title: "Exame 5 — Reporting e gestão de carteira",
    description:
      "Construir e apresentar o relatório mensal, incluindo o caso difícil: um mês mau apresentado sem perder a conta. E gerir uma carteira inteira sem deixar nada cair.",
    passingScore: 90,
    maxAttempts: 2,
    gate: "Passa para a fase final.",
  },
  {
    id: "exame-d90",
    order: 6,
    label: "90 dias",
    milestone: "90 dias",
    unlockDays: 90,
    title: "Exame 6 — Julgamento sob pressão",
    description:
      "O exame final. Casos reais sem resposta óbvia: escalar ou resolver, insistir ou recuar, o que se promete e o que nunca se promete. Decide a efetividade.",
    passingScore: 90,
    maxAttempts: 2,
    gate: "Decide a efetividade.",
    final: true,
  },
];

export function findExam(examId: string): ExamPhase | null {
  return EXAM_PHASES.find((e) => e.id === examId) ?? null;
}

/** O exame na forma de `TrainingQuiz`, para reaproveitar o motor de correção
 *  dos quizzes sem lhe tocar. As perguntas vivem em `exam-questions.ts`. */
export function examQuiz(exam: ExamPhase): TrainingQuiz {
  return {
    id: exam.id,
    title: exam.title,
    passingScore: exam.passingScore,
    maxAttempts: exam.maxAttempts,
    shuffleQuestions: true,
    questions: EXAM_QUESTIONS[exam.id] ?? [],
  };
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export type ExamStatus =
  /** Sem data de entrada definida — o relógio nem sequer arrancou. */
  | "no_start"
  /** A data ainda não chegou. */
  | "locked_time"
  /** A data chegou, mas o exame anterior está por passar. */
  | "locked_prev"
  /** Pode ser feito agora. */
  | "available"
  /** Passado. */
  | "passed"
  /** Chumbado e sem tentativas — decisão do C-Level. */
  | "exhausted"
  /** Escrito mas ainda sem perguntas — não pode ser exigido a ninguém. */
  | "no_questions";

export type ExamState = {
  exam: ExamPhase;
  status: ExamStatus;
  /** Quando abre (ms). null sem data de entrada. */
  unlockAt: number | null;
  /** Dias inteiros até abrir. Negativo/0 = já abriu. null sem data. */
  daysUntil: number | null;
  attempts: QuizAttempt[];
  attemptsUsed: number;
  attemptsLeft: number | null;
  bestScore: number | null;
  passed: boolean;
  passedAt: number | null;
  questionCount: number;
};

export type ExamJourney = {
  /** Data de entrada em vigor (ISO), já resolvida. */
  startedAt: string | null;
  exams: ExamState[];
  passedCount: number;
  /** O próximo exame que interessa: o primeiro por passar (aberto ou à
   *  espera do relógio). null quando estão todos passados. */
  next: ExamState | null;
  /** Passou o exame dos 90 dias. */
  effective: boolean;
  effectiveAt: number | null;
  /** Chumbou definitivamente algum exame — precisa de decisão do C-Level. */
  blocked: boolean;
};

/** Meia-noite local do dia `days` depois de `startISO`. */
export function examUnlockAt(
  startISO: string | null,
  exam: ExamPhase,
): number | null {
  if (!startISO) return null;
  const start = new Date(`${startISO}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const at = new Date(start);
  at.setDate(at.getDate() + exam.unlockDays);
  return at.getTime();
}

/** Dias inteiros de hoje até `at`. 0 = abre hoje, negativo = já abriu. */
function daysBetween(at: number, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((at - today.getTime()) / 86_400_000);
}

export function computeExamJourney(
  startISO: string | null,
  attempts: QuizAttempt[],
  now: Date = new Date(),
): ExamJourney {
  const exams: ExamState[] = [];
  let previousPassed = true;

  for (const exam of EXAM_PHASES) {
    const mine = attempts
      .filter((a) => a.quizId === exam.id)
      .sort((a, b) => b.submittedAt - a.submittedAt);
    const passedAttempt = mine.find((a) => a.passed) ?? null;
    const passed = passedAttempt !== null;
    const attemptsUsed = mine.length;
    const attemptsLeft =
      exam.maxAttempts === null
        ? null
        : Math.max(0, exam.maxAttempts - attemptsUsed);
    const bestScore = mine.length ? Math.max(...mine.map((a) => a.score)) : null;
    const questionCount = (EXAM_QUESTIONS[exam.id] ?? []).length;

    const unlockAt = examUnlockAt(startISO, exam);
    const daysUntil = unlockAt === null ? null : daysBetween(unlockAt, now);

    // A ordem das perguntas importa: "passado" ganha a tudo, porque uma
    // pessoa que já passou não pode voltar a ficar bloqueada por causa do
    // relógio nem de uma regra nova.
    const status: ExamStatus = passed
      ? "passed"
      : startISO === null
        ? "no_start"
        : questionCount === 0
          ? "no_questions"
          : unlockAt !== null && unlockAt > now.getTime()
            ? "locked_time"
            : !previousPassed
              ? "locked_prev"
              : attemptsLeft === 0
                ? "exhausted"
                : "available";

    exams.push({
      exam,
      status,
      unlockAt,
      daysUntil,
      attempts: mine,
      attemptsUsed,
      attemptsLeft,
      bestScore,
      passed,
      passedAt: passedAttempt?.submittedAt ?? null,
      questionCount,
    });

    previousPassed = previousPassed && passed;
  }

  const finalState = exams.find((e) => e.exam.final) ?? null;
  return {
    startedAt: startISO,
    exams,
    passedCount: exams.filter((e) => e.passed).length,
    next: exams.find((e) => !e.passed) ?? null,
    effective: Boolean(finalState?.passed),
    effectiveAt: finalState?.passedAt ?? null,
    blocked: exams.some((e) => e.status === "exhausted"),
  };
}

/** Uma linha para o cartão "próximo exame" — a mesma frase no hub do
 *  consultor e no drill-down do admin, para não divergirem. */
export function nextExamLine(journey: ExamJourney): string {
  if (journey.effective) return "Efetivo — passou os seis exames.";
  const next = journey.next;
  if (!next) return "Sem exames por fazer.";
  switch (next.status) {
    case "no_start":
      return "Data de entrada por definir — o relógio dos exames ainda não arrancou.";
    case "no_questions":
      return `${next.exam.label} — exame ainda por escrever.`;
    case "locked_time":
      return next.daysUntil === 1
        ? `${next.exam.label} — abre amanhã.`
        : `${next.exam.label} — abre daqui a ${next.daysUntil} dias.`;
    case "locked_prev":
      return `${next.exam.label} — à espera de passar o exame anterior.`;
    case "exhausted":
      return `${next.exam.label} — sem tentativas. Decisão do C-Level.`;
    default:
      return `${next.exam.label} — disponível agora.`;
  }
}
