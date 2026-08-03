// Agregações do overview de admin — server-only.
//
// Uma única função monta a fotografia da equipa inteira: catálogo + inscrições
// + progresso + tentativas, tudo reduzido a linhas de tabela. As leituras por
// utilizador vão em `mget` (uma operação KV, não uma por pessoa).

import { getTrainingCatalog } from "@/lib/training/content-store";
import {
  getEnrollments,
  rosterWithTracks,
  type TrainingUser,
} from "@/lib/training/enrollments-store";
import { getTrainingProgressMany } from "@/lib/training/progress-store";
import {
  getQuizAttemptsMany,
  type QuizAttempt,
} from "@/lib/training/attempts-store";
import {
  computeUserTraining,
  currentModuleLabel,
  overallPercent,
  type TrackState,
} from "@/lib/training/progress";
import type { TrainingTrack } from "@/lib/training/catalog";
import type { UserTrainingProgress } from "@/lib/training/progress-store";

export type RosterRow = {
  user: TrainingUser;
  percent: number;
  currentLabel: string;
  watched: number;
  totalLessons: number;
  quizzesPassed: number;
  quizzesTotal: number;
  attempts: QuizAttempt[];
  failedAttempts: number;
  lastActivity: number;
  common: TrackState | null;
  specialization: TrackState | null;
  progress: UserTrainingProgress;
};

export type TrainingOverview = {
  tracks: TrainingTrack[];
  rows: RosterRow[];
  /** Média de progresso da equipa. */
  averagePercent: number;
  /** Quantos já concluíram tudo o que lhes está atribuído. */
  completedCount: number;
  /** Quantos ainda não começaram. */
  notStartedCount: number;
  /** Aulas sem vídeo em todo o catálogo. */
  missingVideos: number;
  /** Aulas sem presenter atribuído. */
  unassignedPresenters: number;
  /** Módulos cujo teste ainda não tem perguntas. */
  quizzesMissing: number;
};

function buildRow(
  user: TrainingUser,
  tracks: TrainingTrack[],
  progress: UserTrainingProgress,
  attempts: QuizAttempt[],
): RosterRow {
  const { common, specialization } = computeUserTraining(
    tracks,
    user.trackSlug,
    progress,
    attempts,
  );
  const parts = [common, specialization].filter(
    (t): t is TrackState => t !== null,
  );
  const quizzesTotal = parts.reduce(
    (s, t) => s + t.modules.filter((m) => m.quizRequired).length,
    0,
  );
  const quizzesPassed = parts.reduce(
    (s, t) => s + t.modules.filter((m) => m.quizRequired && m.quizPassed).length,
    0,
  );
  return {
    user,
    percent: overallPercent(common, specialization),
    currentLabel: currentModuleLabel(common, specialization),
    watched: parts.reduce((s, t) => s + t.watchedLessons, 0),
    totalLessons: parts.reduce((s, t) => s + t.totalLessons, 0),
    quizzesPassed,
    quizzesTotal,
    attempts,
    failedAttempts: attempts.filter((a) => !a.passed).length,
    lastActivity: Math.max(
      progress.updatedAt,
      ...attempts.map((a) => a.submittedAt),
      0,
    ),
    common,
    specialization,
    progress,
  };
}

/** Estado de produção do conteúdo — o que falta gravar e quem o vai gravar. */
export function contentStats(tracks: TrainingTrack[]) {
  let missingVideos = 0;
  let unassignedPresenters = 0;
  let quizzesMissing = 0;
  for (const t of tracks) {
    for (const m of t.modules) {
      if (m.quiz.questions.length === 0) quizzesMissing += 1;
      for (const l of m.lessons) {
        if (!l.videoUrl) missingVideos += 1;
        if (!l.presenter) unassignedPresenters += 1;
      }
    }
  }
  return { missingVideos, unassignedPresenters, quizzesMissing };
}

export async function getTrainingOverview(): Promise<TrainingOverview> {
  const [tracks, enrollments] = await Promise.all([
    getTrainingCatalog(),
    getEnrollments(),
  ]);
  const roster = rosterWithTracks(enrollments);
  const usernames = roster.map((r) => r.username);
  const [progressMap, attemptsMap] = await Promise.all([
    getTrainingProgressMany(usernames),
    getQuizAttemptsMany(usernames),
  ]);

  const rows = roster
    .map((user) =>
      buildRow(
        user,
        tracks,
        progressMap[user.username] ?? { lessons: {}, updatedAt: 0 },
        attemptsMap[user.username] ?? [],
      ),
    )
    .sort(
      (a, b) =>
        b.percent - a.percent || a.user.name.localeCompare(b.user.name, "pt"),
    );

  const withContent = rows.filter((r) => r.totalLessons + r.quizzesTotal > 0);
  const averagePercent = withContent.length
    ? Math.round(
        withContent.reduce((s, r) => s + r.percent, 0) / withContent.length,
      )
    : 0;

  return {
    tracks,
    rows,
    averagePercent,
    completedCount: withContent.filter((r) => r.percent === 100).length,
    notStartedCount: rows.filter((r) => r.lastActivity === 0).length,
    ...contentStats(tracks),
  };
}

/** Linha de um único utilizador — para o drill-down. */
export async function getRosterRow(
  username: string,
): Promise<RosterRow | null> {
  const overview = await getTrainingOverview();
  return overview.rows.find((r) => r.user.username === username) ?? null;
}
