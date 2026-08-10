// Feedback dos consultores sobre o PROCESSO de formação — o formador, o
// vídeo daquela aula, e o percurso até ali.
//
// PORQUE EXISTE: a formação é escrita uma vez e vista por toda a gente que
// entra depois. Quem a está a fazer agora é a única pessoa que sabe onde ela
// falha — e essa informação evapora-se assim que a pessoa acaba o curso e
// deixa de se lembrar do que a confundiu. Recolher isto DURANTE, aula a aula,
// é o que permite arranjar a formação para o próximo consultor em vez de para
// o próximo ano.
//
// DUAS CHAVES, DE PROPÓSITO:
//   `training-feedback:log`            → lista global, a mais recente à frente.
//                                        É o que o C-Level lê.
//   `training-feedback:user:<username>`→ o que ESTA pessoa já submeteu.
//                                        É o que responde à pergunta «já deste
//                                        feedback?» sem varrer o log inteiro,
//                                        e essa pergunta é feita em TODAS as
//                                        páginas de aula.
//
// A segunda chave é redundante em conteúdo e não em custo: sem ela, cada aula
// aberta por cada consultor obrigava a ler e filtrar o log de toda a casa.

import { kv } from "@vercel/kv";

const LOG_KEY = "training-feedback:log";
const USER_PREFIX = "training-feedback:user:";

/** Teto do log. Muito acima de qualquer volume real (13 pessoas × algumas
 *  submissões cada), só para uma escrita em ciclo não crescer sem fim. */
const MAX_LOG = 500;

/** Quantas aulas se podem ver sem dar feedback antes de a zona começar a
 *  piscar. Quinze é o ponto em que já se viu formação suficiente para ter
 *  opinião fundamentada e ainda falta curso que dê para melhorar. */
export const FEEDBACK_NUDGE_AFTER_LESSONS = 15;

export type TrainingFeedbackRatings = {
  /** 1–5 — o formador desta aula. */
  instructor: number;
  /** 1–5 — o vídeo/aula em si (clareza, ritmo, imagem, som). */
  video: number;
  /** 1–5 — o processo de formação até este momento. */
  process: number;
};

export type TrainingFeedbackEntry = {
  id: string;
  username: string;
  /** Nome de quem respondeu, congelado no momento da submissão — o cargo de
   *  uma pessoa muda e o feedback dela continua a ser daquela altura. */
  name: string;
  role: string;
  dept: string;
  /** Onde estava quando respondeu. */
  trackSlug: string;
  lessonId: string;
  lessonTitle: string;
  /** Formador daquela aula, tal como escrito no catálogo. */
  presenter: string | null;
  ratings: TrainingFeedbackRatings;
  /** O que correu bem. */
  whatWorked: string;
  /** O que falta ou está mal explicado. */
  whatMissing: string;
  /** Campo livre para o resto. */
  suggestions: string;
  /** Quantas aulas tinha visto quando respondeu — dá peso à resposta. */
  lessonsWatchedAtTime: number;
  createdAt: number;
};

export const trainingFeedbackConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function userKey(username: string): string {
  return `${USER_PREFIX}${username}`;
}

function clampRating(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.min(5, Math.max(1, Math.round(v)));
}

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function sanitizeEntry(raw: unknown): TrainingFeedbackEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string" || typeof e.username !== "string") return null;
  const r = (e.ratings ?? {}) as Record<string, unknown>;
  return {
    id: e.id,
    username: e.username,
    name: text(e.name, 120) || e.username,
    role: text(e.role, 120),
    dept: text(e.dept, 60),
    trackSlug: text(e.trackSlug, 80),
    lessonId: text(e.lessonId, 120),
    lessonTitle: text(e.lessonTitle, 200),
    presenter: typeof e.presenter === "string" ? e.presenter.slice(0, 120) : null,
    ratings: {
      instructor: clampRating(r.instructor),
      video: clampRating(r.video),
      process: clampRating(r.process),
    },
    whatWorked: text(e.whatWorked, 2000),
    whatMissing: text(e.whatMissing, 2000),
    suggestions: text(e.suggestions, 2000),
    lessonsWatchedAtTime:
      typeof e.lessonsWatchedAtTime === "number" &&
      Number.isFinite(e.lessonsWatchedAtTime)
        ? Math.max(0, Math.round(e.lessonsWatchedAtTime))
        : 0,
    createdAt: typeof e.createdAt === "number" ? e.createdAt : 0,
  };
}

function sanitizeList(raw: unknown): TrainingFeedbackEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: TrainingFeedbackEntry[] = [];
  for (const item of raw) {
    const e = sanitizeEntry(item);
    if (e) out.push(e);
    if (out.length >= MAX_LOG) break;
  }
  return out;
}

/** Todo o feedback submetido, do mais recente para o mais antigo. */
export async function listTrainingFeedback(): Promise<TrainingFeedbackEntry[]> {
  if (!trainingFeedbackConfigured) return [];
  try {
    return sanitizeList(await kv.get<unknown>(LOG_KEY));
  } catch (err) {
    console.error("training feedback: leitura do log falhou:", err);
    return [];
  }
}

/** O que uma pessoa já submeteu — leitura barata, é a que corre em cada
 *  página de aula. */
export async function listUserTrainingFeedback(
  username: string,
): Promise<TrainingFeedbackEntry[]> {
  if (!trainingFeedbackConfigured) return [];
  try {
    return sanitizeList(await kv.get<unknown>(userKey(username)));
  } catch (err) {
    console.error("training feedback: leitura por utilizador falhou:", err);
    return [];
  }
}

/** Grava uma submissão nas duas chaves. Devolve a entrada normalizada. */
export async function saveTrainingFeedback(
  entry: Omit<TrainingFeedbackEntry, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  },
): Promise<TrainingFeedbackEntry> {
  if (!trainingFeedbackConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const createdAt = entry.createdAt ?? Date.now();
  const full = sanitizeEntry({
    ...entry,
    id: entry.id ?? `tf_${createdAt.toString(36)}_${entry.username}`,
    createdAt,
  });
  if (!full) throw new Error("Feedback inválido.");

  const [log, mine] = await Promise.all([
    listTrainingFeedback(),
    listUserTrainingFeedback(full.username),
  ]);
  await Promise.all([
    kv.set(LOG_KEY, [full, ...log].slice(0, MAX_LOG)),
    kv.set(userKey(full.username), [full, ...mine].slice(0, 50)),
  ]);
  return full;
}

/** O estado do lembrete para uma pessoa: já deu feedback? viu aulas que
 *  cheguem para lhe pedirmos? A UI da aula só precisa disto. */
export type FeedbackNudge = {
  submissions: number;
  lastAt: number | null;
  lessonsWatched: number;
  /** Viu ≥15 aulas desde a última vez que deu feedback (ou desde sempre, se
   *  nunca deu) — é isto que põe a zona a piscar. */
  shouldNudge: boolean;
  /** Quantas aulas viu desde o último feedback. */
  watchedSinceFeedback: number;
};

export function computeNudge(
  mine: TrainingFeedbackEntry[],
  lessonsWatched: number,
): FeedbackNudge {
  const last = mine[0] ?? null;
  // O contador não reinicia a zero depois de responder: conta as aulas vistas
  // DESDE a última resposta. Assim, quem deu feedback à 15.ª aula volta a ser
  // chamado à 30.ª — a formação continua e a opinião dela também muda —
  // mas não é chamado outra vez na aula seguinte.
  const watchedSinceFeedback = last
    ? Math.max(0, lessonsWatched - last.lessonsWatchedAtTime)
    : lessonsWatched;
  return {
    submissions: mine.length,
    lastAt: last?.createdAt ?? null,
    lessonsWatched,
    watchedSinceFeedback,
    shouldNudge: watchedSinceFeedback >= FEEDBACK_NUDGE_AFTER_LESSONS,
  };
}
