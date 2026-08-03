// Ponte server-only entre a sessão e a Formação: uma chamada devolve tudo o
// que uma página do consultor precisa (catálogo + inscrição + progresso +
// tentativas, já reduzidos a estado). Evita que cada página volte a montar a
// mesma sequência de leituras — e que uma delas se esqueça de uma regra.

import { getCurrentEmployee } from "@/lib/auth/server";
import { getTrainingCatalog } from "@/lib/training/content-store";
import {
  getEnrollments,
  resolveTrackSlugs,
} from "@/lib/training/enrollments-store";
import { getTrainingProgress } from "@/lib/training/progress-store";
import { getQuizAttempts } from "@/lib/training/attempts-store";
import {
  getStartDates,
  resolveStartDate,
} from "@/lib/training/start-dates-store";
import { computeExamJourney, type ExamJourney } from "@/lib/training/exams";
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
  specializationSlugs: string[];
  progress: UserTrainingProgress;
  attempts: QuizAttempt[];
  common: TrackState | null;
  /** Pode ser mais do que uma — quem faz SEO e Comercial tem as duas. */
  specializations: TrackState[];
  /** Os seis exames de fase, já com o relógio da pessoa aplicado. */
  exams: ExamJourney;
};

/** Contexto de formação do utilizador com sessão. null quando não há sessão
 *  (o middleware já redireciona, mas as páginas não assumem isso às cegas). */
export async function getTrainingContext(): Promise<TrainingContext | null> {
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  const [tracks, enrollments, progress, attempts, startDates] =
    await Promise.all([
      getTrainingCatalog(),
      getEnrollments(),
      getTrainingProgress(employee.username),
      getQuizAttempts(employee.username),
      getStartDates(),
    ]);

  const specializationSlugs = resolveTrackSlugs(
    employee.username,
    employee.dept,
    enrollments,
  );

  const { common, specializations } = computeUserTraining(
    tracks,
    specializationSlugs,
    progress,
    attempts,
  );

  return {
    employee,
    tracks,
    specializationSlugs,
    progress,
    attempts,
    common,
    specializations,
    exams: computeExamJourney(
      resolveStartDate(employee.username, startDates),
      attempts,
    ),
  };
}

/** Todos os módulos do utilizador pela ordem de leitura: o Comum primeiro,
 *  depois as especializações. */
export function userTracks(ctx: TrainingContext): TrackState[] {
  return [ctx.common, ...ctx.specializations].filter(
    (t): t is TrackState => t !== null,
  );
}

/** Estado de um módulo específico para o utilizador atual, ou null quando ele
 *  não está inscrito nele. Usado pelas páginas /formacao/[track]/… para não
 *  deixarem ninguém abrir um módulo que não é seu. */
export function trackStateFor(
  ctx: TrainingContext,
  slug: string,
): TrackState | null {
  return userTracks(ctx).find((t) => t.track.slug === slug) ?? null;
}
