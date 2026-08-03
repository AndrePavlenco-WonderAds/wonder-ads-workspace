// Ponte server-only entre a sessão e a Formação: uma chamada devolve tudo o
// que uma página do consultor precisa (catálogo + inscrição + progresso +
// tentativas, já reduzidos a estado). Evita que cada página volte a montar a
// mesma sequência de leituras — e que uma delas se esqueça de uma regra.

import { getCurrentEmployee } from "@/lib/auth/server";
import { getTrainingCatalog } from "@/lib/training/content-store";
import {
  getEnrollments,
  resolveTrackSlug,
} from "@/lib/training/enrollments-store";
import { getTrainingProgress } from "@/lib/training/progress-store";
import { getQuizAttempts } from "@/lib/training/attempts-store";
import { computeUserTraining, type TrackState } from "@/lib/training/progress";
import type { TrainingTrack } from "@/lib/training/catalog";
import type { UserTrainingProgress } from "@/lib/training/progress-store";
import type { QuizAttempt } from "@/lib/training/attempts-store";

export type TrainingContext = {
  employee: {
    username: string;
    name: string;
    role: string;
    dept: string;
    isAdmin: boolean;
  };
  tracks: TrainingTrack[];
  specializationSlug: string | null;
  progress: UserTrainingProgress;
  attempts: QuizAttempt[];
  common: TrackState | null;
  specialization: TrackState | null;
};

/** Contexto de formação do utilizador com sessão. null quando não há sessão
 *  (o middleware já redireciona, mas as páginas não assumem isso às cegas). */
export async function getTrainingContext(): Promise<TrainingContext | null> {
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  const [tracks, enrollments, progress, attempts] = await Promise.all([
    getTrainingCatalog(),
    getEnrollments(),
    getTrainingProgress(employee.username),
    getQuizAttempts(employee.username),
  ]);

  const specializationSlug = resolveTrackSlug(
    employee.username,
    employee.dept,
    enrollments,
  );

  const { common, specialization } = computeUserTraining(
    tracks,
    specializationSlug,
    progress,
    attempts,
  );

  return {
    employee,
    tracks,
    specializationSlug,
    progress,
    attempts,
    common,
    specialization,
  };
}

/** Estado de uma track específica para o utilizador atual, ou null quando ele
 *  não está inscrito nela. Usado pelas páginas /formacao/[track]/… para não
 *  deixarem ninguém abrir uma trilha que não é sua. */
export function trackStateFor(
  ctx: TrainingContext,
  slug: string,
): TrackState | null {
  if (ctx.common?.track.slug === slug) return ctx.common;
  if (ctx.specialization?.track.slug === slug) return ctx.specialization;
  return null;
}
