// Sessões de exame em curso — `training-exam-sessions:<username>`.
//
// PORQUE É QUE ISTO EXISTE: um exame com cronómetro no browser não é um exame.
// Quem quisesse mais tempo bastava-lhe recarregar a página, mudar o relógio do
// sistema ou fechar o separador e voltar amanhã. O prazo tem de ser carimbado
// pelo SERVIDOR no momento em que a pessoa carrega em "Começar", e a partir daí
// a única coisa que conta é `deadlineAt`.
//
// AS TRÊS REGRAS QUE FAZEM ISTO SER UM EXAME:
//
//  1. O RELÓGIO ARRANCA UMA VEZ. Recarregar a página devolve a MESMA sessão com
//     o MESMO `deadlineAt`. Não há como reiniciar os 60 minutos.
//  2. SAIR NÃO PAUSA NADA. Fechar o separador, ir ao Instagram, desligar o
//     portátil — o relógio continua. Voltar mostra o tempo que sobrou, não o
//     tempo que faltava quando se saiu.
//  3. ACABAR O TEMPO É DEFINITIVO. Passado o prazo a sessão fica `expired` e
//     NUNCA mais se reabre: a tentativa é consumida e corrigida com o progresso
//     que estava guardado. Não é uma tentativa perdida por bug — é o resultado.
//
// O progresso é gravado periodicamente pelo cliente (`answers`) para que a
// regra 3 tenha alguma coisa para corrigir quando o browser morre a meio. Sem
// esse snapshot, um crash aos 55 minutos dava zero em vez de dar o que a pessoa
// tinha mesmo feito.

import { kv } from "@vercel/kv";
import type { SubmittedAnswer } from "@/lib/training/grading";

const KEY_PREFIX = "training-exam-sessions:";

/** Duração de qualquer exame de fase. Um número, um sítio. */
export const EXAM_DURATION_MINUTES = 60;
export const EXAM_DURATION_MS = EXAM_DURATION_MINUTES * 60 * 1000;

/** Depois de expirar, a sessão fica guardada mais uns dias para o admin poder
 *  ver o que aconteceu; passado isso é lixo e sai na próxima escrita. */
const KEEP_FINISHED_MS = 30 * 24 * 60 * 60 * 1000;

export type ExamSessionStatus = "running" | "submitted" | "expired";

export type ExamSession = {
  examId: string;
  attemptNumber: number;
  /** Carimbo do servidor no momento do "Começar". */
  startedAt: number;
  /** `startedAt + EXAM_DURATION_MS`. É a única fonte de verdade do tempo. */
  deadlineAt: number;
  status: ExamSessionStatus;
  /** Quando foi submetido/expirado. null enquanto corre. */
  finishedAt: number | null;
  /** Último snapshot de respostas gravado pelo cliente. */
  answers: SubmittedAnswer[];
  /** Quantas vezes a pessoa saiu do separador durante o exame. Não bloqueia
   *  nada — fica no registo, que é o que um invigilador faria. */
  focusLossCount: number;
};

export type ExamSessionMap = Record<string, ExamSession>;

export const examSessionsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function key(username: string): string {
  return `${KEY_PREFIX}${username}`;
}

function normalizeAnswers(raw: unknown): SubmittedAnswer[] {
  if (!Array.isArray(raw)) return [];
  const out: SubmittedAnswer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.questionId !== "string") continue;
    out.push({
      questionId: o.questionId,
      optionIds: Array.isArray(o.optionIds)
        ? o.optionIds.filter((x): x is string => typeof x === "string")
        : [],
      text: typeof o.text === "string" ? o.text : null,
    });
  }
  return out;
}

function normalizeSession(raw: unknown): ExamSession | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.examId !== "string") return null;
  if (typeof o.startedAt !== "number" || typeof o.deadlineAt !== "number") {
    return null;
  }
  const status: ExamSessionStatus =
    o.status === "submitted" || o.status === "expired" ? o.status : "running";
  return {
    examId: o.examId,
    attemptNumber:
      typeof o.attemptNumber === "number" ? Math.max(1, o.attemptNumber) : 1,
    startedAt: o.startedAt,
    deadlineAt: o.deadlineAt,
    status,
    finishedAt: typeof o.finishedAt === "number" ? o.finishedAt : null,
    answers: normalizeAnswers(o.answers),
    focusLossCount:
      typeof o.focusLossCount === "number" && Number.isFinite(o.focusLossCount)
        ? Math.max(0, Math.floor(o.focusLossCount))
        : 0,
  };
}

function normalize(raw: unknown): ExamSessionMap {
  if (!raw || typeof raw !== "object") return {};
  const out: ExamSessionMap = {};
  for (const [examId, value] of Object.entries(raw as Record<string, unknown>)) {
    const session = normalizeSession(value);
    if (session) out[examId] = session;
  }
  return out;
}

/** Uma sessão que já passou do prazo mas ainda está marcada como a correr.
 *  Materializa-se em `expired` na primeira escrita — a leitura só a reconhece. */
export function isPastDeadline(session: ExamSession, nowMs: number): boolean {
  return session.status === "running" && nowMs > session.deadlineAt;
}

/** Estado efetivo, já com o relógio aplicado. É isto que a UI deve usar —
 *  nunca `session.status` diretamente, que pode estar desatualizado em KV. */
export function effectiveStatus(
  session: ExamSession,
  nowMs: number,
): ExamSessionStatus {
  return isPastDeadline(session, nowMs) ? "expired" : session.status;
}

export async function getExamSessions(
  username: string,
): Promise<ExamSessionMap> {
  if (!examSessionsStorageConfigured) return {};
  try {
    return normalize(await kv.get<unknown>(key(username)));
  } catch (err) {
    console.error("KV training-exam-sessions read failed:", err);
    return {};
  }
}

export async function getExamSession(
  username: string,
  examId: string,
): Promise<ExamSession | null> {
  const all = await getExamSessions(username);
  return all[examId] ?? null;
}

/** Escreve o mapa inteiro, aproveitando para deitar fora sessões terminadas
 *  há muito tempo. Uma leitura + uma escrita por operação, sempre. */
async function writeSessions(
  username: string,
  next: ExamSessionMap,
  nowMs: number,
): Promise<ExamSessionMap> {
  const pruned: ExamSessionMap = {};
  for (const [examId, session] of Object.entries(next)) {
    if (
      session.status !== "running" &&
      session.finishedAt !== null &&
      nowMs - session.finishedAt > KEEP_FINISHED_MS
    ) {
      continue;
    }
    pruned[examId] = session;
  }
  await kv.set(key(username), pruned);
  return pruned;
}

export type StartExamOutcome =
  | { kind: "started"; session: ExamSession }
  | { kind: "resumed"; session: ExamSession }
  /** O prazo acabou enquanto a pessoa estava fora. A tentativa foi gasta. */
  | { kind: "expired"; session: ExamSession }
  /** Já submeteu esta tentativa — não se reabre. */
  | { kind: "already_submitted"; session: ExamSession };

/** Abre (ou retoma) a sessão de exame. NUNCA reinicia o relógio de uma sessão
 *  que já existe — é essa a diferença entre um exame e um quiz. */
export async function startExamSession(
  username: string,
  examId: string,
  attemptNumber: number,
  nowMs: number,
): Promise<StartExamOutcome> {
  if (!examSessionsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const all = await getExamSessions(username);
  const existing = all[examId];

  if (existing) {
    // Uma sessão de uma tentativa ANTERIOR já terminada não bloqueia a
    // seguinte: o gate das tentativas vive em `exams.ts`, não aqui.
    const sameAttempt = existing.attemptNumber === attemptNumber;
    if (sameAttempt) {
      if (existing.status === "submitted") {
        return { kind: "already_submitted", session: existing };
      }
      if (isPastDeadline(existing, nowMs) || existing.status === "expired") {
        const expired: ExamSession = {
          ...existing,
          status: "expired",
          finishedAt: existing.finishedAt ?? existing.deadlineAt,
        };
        await writeSessions(username, { ...all, [examId]: expired }, nowMs);
        return { kind: "expired", session: expired };
      }
      // A correr e dentro do prazo — retoma com o MESMO deadline.
      return { kind: "resumed", session: existing };
    }
  }

  const session: ExamSession = {
    examId,
    attemptNumber,
    startedAt: nowMs,
    deadlineAt: nowMs + EXAM_DURATION_MS,
    status: "running",
    finishedAt: null,
    answers: [],
    focusLossCount: 0,
  };
  await writeSessions(username, { ...all, [examId]: session }, nowMs);
  return { kind: "started", session };
}

/** Grava o snapshot de respostas de uma sessão a correr. Silenciosamente
 *  ignorado depois do prazo — é isso que faz o "fica como está o progresso":
 *  o último snapshot dentro do tempo é o que conta. */
export async function saveExamProgress(
  username: string,
  examId: string,
  answers: SubmittedAnswer[],
  focusLossCount: number,
  nowMs: number,
): Promise<ExamSession | null> {
  if (!examSessionsStorageConfigured) return null;
  const all = await getExamSessions(username);
  const existing = all[examId];
  if (!existing || existing.status !== "running") return existing ?? null;
  if (nowMs > existing.deadlineAt) {
    const expired: ExamSession = {
      ...existing,
      status: "expired",
      finishedAt: existing.deadlineAt,
    };
    await writeSessions(username, { ...all, [examId]: expired }, nowMs);
    return expired;
  }
  const next: ExamSession = {
    ...existing,
    answers,
    focusLossCount: Math.max(existing.focusLossCount, focusLossCount),
  };
  await writeSessions(username, { ...all, [examId]: next }, nowMs);
  return next;
}

/** Fecha a sessão. `reason` distingue quem entregou de quem ficou sem tempo —
 *  os dois geram tentativa, mas só um deles é uma escolha. */
export async function finishExamSession(
  username: string,
  examId: string,
  reason: "submitted" | "expired",
  nowMs: number,
): Promise<void> {
  if (!examSessionsStorageConfigured) return;
  const all = await getExamSessions(username);
  const existing = all[examId];
  if (!existing) return;
  const next: ExamSession = {
    ...existing,
    status: reason,
    finishedAt: reason === "expired" ? existing.deadlineAt : nowMs,
  };
  await writeSessions(username, { ...all, [examId]: next }, nowMs);
}

/** Milissegundos que faltam, nunca negativo. */
export function msRemaining(session: ExamSession, nowMs: number): number {
  return Math.max(0, session.deadlineAt - nowMs);
}
