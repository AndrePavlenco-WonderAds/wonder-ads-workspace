// Tentativas de teste por utilizador — `training-attempts:<username>`.
//
// GUARDA-SE TUDO O QUE FOI RESPONDIDO, não só a nota. O admin tem de conseguir
// abrir uma tentativa e ver, pergunta a pergunta, o que a pessoa escolheu e se
// acertou — é isso que torna o teste útil para corrigir o CONTEÚDO (uma
// pergunta que toda a gente erra costuma ser um vídeo mal explicado, não um
// consultor distraído).
//
// A escrita entra na Fase 2 (motor de quizzes); a leitura já é usada na Fase 1
// pelas regras de desbloqueio, que precisam de saber se o teste foi passado.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "training-attempts:";

/** Teto defensivo por utilizador — sem isto, um loop de submissões podia
 *  crescer a chave sem limite. */
const MAX_ATTEMPTS_STORED = 500;

export type QuizAnswer = {
  questionId: string;
  /** Opções escolhidas (escolha múltipla / múltipla seleção / V-F). */
  optionIds: string[];
  /** Resposta livre (open_text). */
  text: string | null;
  isCorrect: boolean;
  pointsAwarded: number;
};

export type QuizAttempt = {
  id: string;
  quizId: string;
  moduleId: string;
  trackSlug: string;
  attemptNumber: number;
  /** 0–100. */
  score: number;
  passed: boolean;
  startedAt: number;
  submittedAt: number;
  answers: QuizAnswer[];
};

export const attemptsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function key(username: string): string {
  return `${KEY_PREFIX}${username}`;
}

function normalizeAnswer(raw: unknown): QuizAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.questionId !== "string") return null;
  return {
    questionId: o.questionId,
    optionIds: Array.isArray(o.optionIds)
      ? o.optionIds.filter((x): x is string => typeof x === "string")
      : [],
    text: typeof o.text === "string" ? o.text : null,
    isCorrect: o.isCorrect === true,
    pointsAwarded:
      typeof o.pointsAwarded === "number" && Number.isFinite(o.pointsAwarded)
        ? o.pointsAwarded
        : 0,
  };
}

function normalizeAttempt(raw: unknown): QuizAttempt | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.quizId !== "string") return null;
  return {
    id: o.id,
    quizId: o.quizId,
    moduleId: typeof o.moduleId === "string" ? o.moduleId : "",
    trackSlug: typeof o.trackSlug === "string" ? o.trackSlug : "",
    attemptNumber:
      typeof o.attemptNumber === "number" ? Math.max(1, o.attemptNumber) : 1,
    score: typeof o.score === "number" ? Math.min(100, Math.max(0, o.score)) : 0,
    passed: o.passed === true,
    startedAt: typeof o.startedAt === "number" ? o.startedAt : 0,
    submittedAt: typeof o.submittedAt === "number" ? o.submittedAt : 0,
    answers: (Array.isArray(o.answers) ? o.answers : [])
      .map(normalizeAnswer)
      .filter((x): x is QuizAnswer => x !== null),
  };
}

function normalize(raw: unknown): QuizAttempt[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeAttempt)
    .filter((x): x is QuizAttempt => x !== null)
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

export async function getQuizAttempts(
  username: string,
): Promise<QuizAttempt[]> {
  if (!attemptsStorageConfigured) return [];
  try {
    return normalize(await kv.get<unknown>(key(username)));
  } catch (err) {
    console.error("KV training-attempts read failed:", err);
    return [];
  }
}

/** Tentativas de vários utilizadores numa só operação KV. */
export async function getQuizAttemptsMany(
  usernames: string[],
): Promise<Record<string, QuizAttempt[]>> {
  const out: Record<string, QuizAttempt[]> = {};
  if (!usernames.length) return out;
  if (!attemptsStorageConfigured) {
    for (const u of usernames) out[u] = [];
    return out;
  }
  try {
    const rows = await kv.mget<unknown[]>(...usernames.map(key));
    usernames.forEach((u, i) => {
      out[u] = normalize(rows?.[i]);
    });
  } catch (err) {
    console.error("KV training-attempts mget failed:", err);
    for (const u of usernames) out[u] = [];
  }
  return out;
}

/** Acrescenta uma tentativa concluída (Fase 2). */
export async function appendQuizAttempt(
  username: string,
  attempt: QuizAttempt,
): Promise<QuizAttempt[]> {
  if (!attemptsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getQuizAttempts(username);
  const next = [attempt, ...current].slice(0, MAX_ATTEMPTS_STORED);
  await kv.set(key(username), next);
  return next;
}

/** Tentativas de um teste específico, da mais recente para a mais antiga. */
export function attemptsForQuiz(
  attempts: QuizAttempt[],
  quizId: string,
): QuizAttempt[] {
  return attempts.filter((a) => a.quizId === quizId);
}

export function hasPassedQuiz(attempts: QuizAttempt[], quizId: string): boolean {
  return attempts.some((a) => a.quizId === quizId && a.passed);
}

/** Melhor nota alguma vez obtida num teste (null se nunca fez). */
export function bestScore(
  attempts: QuizAttempt[],
  quizId: string,
): number | null {
  const forQuiz = attemptsForQuiz(attempts, quizId);
  if (!forQuiz.length) return null;
  return Math.max(...forQuiz.map((a) => a.score));
}
