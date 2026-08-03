// Progresso de visualização por utilizador — uma chave KV por consultor,
// `training-progress:<username>`, com uma entrada por aula.
//
// Decisões deliberadas:
//  • GUARDA-SE O `percent` REAL, não só um booleano de "visto". O admin precisa
//    de distinguir quem viu 92% de quem viu 12% e desistiu.
//  • O PERCENT NUNCA DESCE. Rever um vídeo do início não pode desfazer o
//    progresso já conquistado (o player reporta a posição atual, que começa
//    em 0 a cada nova sessão).
//  • `completedAt` FIXA-SE NA PRIMEIRA VEZ que se atinge o limiar — assim a
//    timeline do admin mostra quando a pessoa concluiu, não a última visita.
//  • `manual: true` marca as conclusões que NÃO vieram de eventos reais do
//    player (Loom não expõe progresso de reprodução). O admin vê a diferença
//    em vez de ler um número inventado como se fosse medido.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "training-progress:";

/** Percentagem a partir da qual uma aula conta como vista. */
export const WATCHED_THRESHOLD = 90;

export type LessonProgress = {
  watchedSeconds: number;
  /** 0–100, o máximo alguma vez atingido. */
  percent: number;
  completedAt: number | null;
  /** Conclusão confirmada à mão (provider sem eventos de progresso). */
  manual: boolean;
  updatedAt: number;
};

export type UserTrainingProgress = {
  lessons: Record<string, LessonProgress>;
  updatedAt: number;
};

export const trainingProgressStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

const EMPTY: UserTrainingProgress = { lessons: {}, updatedAt: 0 };

function key(username: string): string {
  return `${KEY_PREFIX}${username}`;
}

function clampPercent(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

function normalize(raw: unknown): UserTrainingProgress {
  if (!raw || typeof raw !== "object") return { lessons: {}, updatedAt: 0 };
  const o = raw as Record<string, unknown>;
  const lessons: Record<string, LessonProgress> = {};
  const rawLessons =
    o.lessons && typeof o.lessons === "object"
      ? (o.lessons as Record<string, unknown>)
      : {};
  for (const [lessonId, value] of Object.entries(rawLessons)) {
    if (!value || typeof value !== "object") continue;
    const p = value as Record<string, unknown>;
    lessons[lessonId] = {
      watchedSeconds:
        typeof p.watchedSeconds === "number" && Number.isFinite(p.watchedSeconds)
          ? Math.max(0, Math.round(p.watchedSeconds))
          : 0,
      percent: clampPercent(p.percent),
      completedAt: typeof p.completedAt === "number" ? p.completedAt : null,
      manual: p.manual === true,
      updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0,
    };
  }
  return {
    lessons,
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : 0,
  };
}

export async function getTrainingProgress(
  username: string,
): Promise<UserTrainingProgress> {
  if (!trainingProgressStorageConfigured) return EMPTY;
  try {
    return normalize(await kv.get<unknown>(key(username)));
  } catch (err) {
    console.error("KV training-progress read failed:", err);
    return EMPTY;
  }
}

/** Progresso de vários utilizadores numa só operação — o overview de admin
 *  lê o roster inteiro, e 13 `get` seriam 13 operações KV. */
export async function getTrainingProgressMany(
  usernames: string[],
): Promise<Record<string, UserTrainingProgress>> {
  const out: Record<string, UserTrainingProgress> = {};
  if (!usernames.length) return out;
  if (!trainingProgressStorageConfigured) {
    for (const u of usernames) out[u] = EMPTY;
    return out;
  }
  try {
    const rows = await kv.mget<unknown[]>(...usernames.map(key));
    usernames.forEach((u, i) => {
      out[u] = normalize(rows?.[i]);
    });
  } catch (err) {
    console.error("KV training-progress mget failed:", err);
    for (const u of usernames) out[u] = EMPTY;
  }
  return out;
}

/** Regista uma amostra de reprodução. Devolve a entrada resultante. */
export async function recordLessonProgress(
  username: string,
  lessonId: string,
  sample: { watchedSeconds: number; percent: number; manual?: boolean },
  nowMs: number,
): Promise<LessonProgress> {
  if (!trainingProgressStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getTrainingProgress(username);
  const prev = current.lessons[lessonId];
  const percent = Math.max(prev?.percent ?? 0, clampPercent(sample.percent));
  const watchedSeconds = Math.max(
    prev?.watchedSeconds ?? 0,
    Number.isFinite(sample.watchedSeconds)
      ? Math.max(0, Math.round(sample.watchedSeconds))
      : 0,
  );
  const entry: LessonProgress = {
    watchedSeconds,
    percent,
    completedAt:
      prev?.completedAt ?? (percent >= WATCHED_THRESHOLD ? nowMs : null),
    manual: prev?.manual || sample.manual === true,
    updatedAt: nowMs,
  };
  const next: UserTrainingProgress = {
    lessons: { ...current.lessons, [lessonId]: entry },
    updatedAt: nowMs,
  };
  await kv.set(key(username), next);
  return entry;
}

/** Última atividade do utilizador na formação (epoch ms, 0 = nunca). */
export function lastActivity(progress: UserTrainingProgress): number {
  return progress.updatedAt;
}
