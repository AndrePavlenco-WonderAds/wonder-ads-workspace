// Regras de progressão da Formação — módulo PURO (sem KV, sem React).
//
// Existe uma única implementação destas regras porque a UI do consultor e o
// overview do admin têm de concordar sempre: se o consultor vê "módulo 3
// bloqueado" e o admin vê "em curso", uma das duas está a mentir.
//
// Regras:
//  1. O módulo comum tem de estar 100% concluído (aulas vistas + testes
//     passados) antes de as especializações abrirem.
//  2. Dentro de um módulo os capítulos abrem em sequência: o capítulo N+1 só
//     abre depois de todas as aulas do N estarem vistas E o teste do N passado.
//  3. Uma aula conta como vista com percent >= 90 (WATCHED_THRESHOLD).
//  4. CONTEÚDO EM FALTA NÃO BLOQUEIA NINGUÉM. Aula sem vídeo (ou despublicada)
//     sai do denominador; teste sem perguntas dá-se por cumprido. Sem isto, a
//     formação inteira ficaria presa no primeiro módulo até tudo estar gravado
//     — e ninguém começava. O que falta aparece sinalizado no admin.

import {
  availableLessons,
  lessonMinutes,
  type TrainingLesson,
  type TrainingModule,
  type TrainingTrack,
} from "@/lib/training/catalog";
import {
  WATCHED_THRESHOLD,
  type UserTrainingProgress,
} from "@/lib/training/progress-store";
import { bestScore, hasPassedQuiz, type QuizAttempt } from "@/lib/training/attempts-store";

export type ModuleStatus = "locked" | "in_progress" | "completed";

export type LessonState = {
  lesson: TrainingLesson;
  /** Sem vídeo → "brevemente": abre-se, mas não conta para o desbloqueio. */
  comingSoon: boolean;
  percent: number;
  watched: boolean;
  completedAt: number | null;
  manual: boolean;
};

export type ModuleState = {
  module: TrainingModule;
  status: ModuleStatus;
  lessons: LessonState[];
  /** Aulas com vídeo disponível. */
  totalLessons: number;
  watchedLessons: number;
  /** Aulas sem vídeo — o que falta gravar neste módulo. */
  missingVideos: number;
  /** 0–100, só sobre as aulas disponíveis. */
  percent: number;
  quizRequired: boolean;
  quizPassed: boolean;
  quizBestScore: number | null;
  quizAttempts: number;
  /** Tudo visto E teste resolvido. Um módulo sem nada disponível também conta
   *  como resolvido — é o que impede o conteúdo por gravar de trancar toda a
   *  gente. Para SABER se há alguma coisa, usa-se `hasContent`. */
  completed: boolean;
  /** False quando o módulo ainda não tem uma única aula com vídeo nem teste
   *  com perguntas. "Sem conteúdo" e "concluído" são estados diferentes e a
   *  UI não os pode mostrar da mesma maneira. */
  hasContent: boolean;
  /** Minutos estimados que faltam neste módulo. */
  minutesLeft: number;
};

export type TrackState = {
  track: TrainingTrack;
  modules: ModuleState[];
  /** 0–100 sobre a track inteira (aulas disponíveis + testes com perguntas). */
  percent: number;
  totalLessons: number;
  watchedLessons: number;
  missingVideos: number;
  completed: boolean;
  /** False quando o módulo ainda não tem nenhum conteúdo disponível. */
  hasContent: boolean;
  /** Próxima aula sugerida ("Continuar onde ficaste"). */
  nextLesson: { module: TrainingModule; lesson: TrainingLesson } | null;
  /** Próximo teste a fazer, quando as aulas do módulo atual já estão vistas. */
  nextQuizModule: TrainingModule | null;
  minutesLeft: number;
  /** Preenchido quando a track está fechada por a Comum não estar concluída. */
  lockedReason: string | null;
};

function lessonState(
  lesson: TrainingLesson,
  progress: UserTrainingProgress,
): LessonState {
  const entry = progress.lessons[lesson.id];
  const comingSoon = !lesson.videoUrl || !lesson.isPublished;
  const percent = entry?.percent ?? 0;
  return {
    lesson,
    comingSoon,
    percent,
    // Uma aula sem vídeo nunca é "vista" — é neutra: sai do denominador.
    watched: !comingSoon && percent >= WATCHED_THRESHOLD,
    completedAt: entry?.completedAt ?? null,
    manual: entry?.manual ?? false,
  };
}

function moduleState(
  module: TrainingModule,
  progress: UserTrainingProgress,
  attempts: QuizAttempt[],
): Omit<ModuleState, "status"> {
  const lessons = module.lessons.map((l) => lessonState(l, progress));
  const available = availableLessons(module);
  const totalLessons = available.length;
  const watchedLessons = lessons.filter((l) => l.watched).length;
  const missingVideos = lessons.filter((l) => l.comingSoon).length;

  // Um teste só é exigível quando há matéria para o estudar. Perguntas
  // escritas sobre um módulo cujos vídeos ainda não existem não podem ser o
  // "próximo passo" de ninguém — seria mandar alguém a exame sem aulas.
  const quizRequired = module.quiz.questions.length > 0 && totalLessons > 0;
  const quizPassed = quizRequired
    ? hasPassedQuiz(attempts, module.quiz.id)
    : true; // teste sem perguntas (ou sem aulas gravadas) → não trava
  const attemptsCount = attempts.filter(
    (a) => a.quizId === module.quiz.id,
  ).length;

  const allWatched = totalLessons === 0 || watchedLessons >= totalLessons;
  const completed = allWatched && quizPassed;

  // A percentagem inclui o teste como um "passo" a mais, quando existe —
  // senão um módulo com todas as aulas vistas e o teste por fazer mostrava
  // 100% e continuava bloqueado, o que só confunde.
  const steps = totalLessons + (quizRequired ? 1 : 0);
  const doneSteps = watchedLessons + (quizRequired && quizPassed ? 1 : 0);
  // Sem nada disponível a barra fica a 0, não a 100: um módulo por gravar não
  // é um módulo cumprido. Quem decide o desbloqueio é `completed`, não isto.
  const percent = steps === 0 ? 0 : Math.round((doneSteps / steps) * 100);

  const minutesLeft = lessons
    .filter((l) => !l.comingSoon && !l.watched)
    .reduce((sum, l) => sum + lessonMinutes(l.lesson), 0);

  return {
    module,
    lessons,
    totalLessons,
    watchedLessons,
    missingVideos,
    percent,
    quizRequired,
    quizPassed,
    quizBestScore: quizRequired ? bestScore(attempts, module.quiz.id) : null,
    quizAttempts: attemptsCount,
    completed,
    hasContent: totalLessons > 0 || quizRequired,
    minutesLeft,
  };
}

/** Estado completo de uma track para um utilizador.
 *  `unlocked = false` marca a track como fechada (Comum por concluir). */
export function computeTrackState(
  track: TrainingTrack,
  progress: UserTrainingProgress,
  attempts: QuizAttempt[],
  options: { unlocked?: boolean; lockedReason?: string } = {},
): TrackState {
  const unlocked = options.unlocked !== false;
  const modules: ModuleState[] = [];
  let previousCompleted = true;

  for (const m of [...track.modules].sort((a, b) => a.order - b.order)) {
    const base = moduleState(m, progress, attempts);
    const status: ModuleStatus = !unlocked
      ? "locked"
      : base.completed
        ? "completed"
        : previousCompleted
          ? "in_progress"
          : "locked";
    modules.push({ ...base, status });
    // Só o módulo imediatamente a seguir ao último concluído fica aberto.
    previousCompleted = previousCompleted && base.completed;
  }

  const totalLessons = modules.reduce((s, m) => s + m.totalLessons, 0);
  const watchedLessons = modules.reduce((s, m) => s + m.watchedLessons, 0);
  const missingVideos = modules.reduce((s, m) => s + m.missingVideos, 0);
  const quizzes = modules.filter((m) => m.quizRequired);
  const passedQuizzes = quizzes.filter((m) => m.quizPassed).length;

  const steps = totalLessons + quizzes.length;
  const doneSteps = watchedLessons + passedQuizzes;
  const percent = steps === 0 ? 0 : Math.round((doneSteps / steps) * 100);
  // "Nada por fazer" — inclui o caso de o módulo ainda não ter conteúdo
  // nenhum. É deliberado: enquanto os vídeos não estão gravados, a Categoria
  // Comum não pode manter a especialização de toda a gente trancada. Quem
  // precisa de distinguir os dois casos usa `hasContent`.
  const completed = modules.every((m) => m.completed);

  // Próximo passo: a primeira aula por ver de um módulo aberto; se as aulas
  // desse módulo já estão vistas, é o teste que falta.
  let nextLesson: TrackState["nextLesson"] = null;
  let nextQuizModule: TrainingModule | null = null;
  if (unlocked) {
    for (const m of modules) {
      if (m.status === "locked") break;
      if (m.status === "completed") continue;
      const pending = m.lessons.find((l) => !l.comingSoon && !l.watched);
      if (pending) {
        nextLesson = { module: m.module, lesson: pending.lesson };
        break;
      }
      if (m.quizRequired && !m.quizPassed) {
        nextQuizModule = m.module;
        break;
      }
    }
  }

  const minutesLeft = modules
    .filter((m) => m.status !== "locked")
    .reduce((s, m) => s + m.minutesLeft, 0);

  return {
    track,
    modules,
    percent,
    totalLessons,
    watchedLessons,
    missingVideos,
    completed,
    hasContent: steps > 0,
    nextLesson,
    nextQuizModule,
    minutesLeft,
    lockedReason: unlocked ? null : (options.lockedReason ?? null),
  };
}

/** Estado dos módulos de um utilizador: o Comum e as suas especializações
 *  (podem ser mais do que uma), já com a regra "o Comum desbloqueia as
 *  especializações" aplicada. */
export function computeUserTraining(
  tracks: TrainingTrack[],
  specializationSlugs: readonly string[],
  progress: UserTrainingProgress,
  attempts: QuizAttempt[],
): { common: TrackState | null; specializations: TrackState[] } {
  const commonTrackDef = tracks.find((t) => t.isCommon) ?? null;
  const common = commonTrackDef
    ? computeTrackState(commonTrackDef, progress, attempts)
    : null;

  // Percorre-se o catálogo (e não a lista de slugs) para que a ordem seja
  // sempre a canónica, independentemente da ordem de atribuição.
  const specializations = tracks
    .filter((t) => !t.isCommon && specializationSlugs.includes(t.slug))
    .map((t) =>
      computeTrackState(t, progress, attempts, {
        unlocked: common ? common.completed : true,
        lockedReason:
          "Conclui a Categoria Comum para desbloqueares as tuas especializações.",
      }),
    );

  return { common, specializations };
}

/** Percentagem global do utilizador (Comum + especializações), a métrica que
 *  encabeça a tabela do Superadmin. */
export function overallPercent(
  common: TrackState | null,
  specializations: TrackState[],
): number {
  const parts = [common, ...specializations].filter(
    (t): t is TrackState => t !== null,
  );
  if (!parts.length) return 0;
  const steps = parts.reduce(
    (s, t) => s + t.totalLessons + t.modules.filter((m) => m.quizRequired).length,
    0,
  );
  if (!steps) return 0;
  const done = parts.reduce(
    (s, t) =>
      s +
      t.watchedLessons +
      t.modules.filter((m) => m.quizRequired && m.quizPassed).length,
    0,
  );
  return Math.round((done / steps) * 100);
}

/** Capítulo em que o utilizador está neste momento, para a coluna "capítulo
 *  atual" do Superadmin. */
export function currentModuleLabel(
  common: TrackState | null,
  specializations: TrackState[],
): string {
  // Nada gravado ainda em lado nenhum — dizer "Concluído" seria mentira.
  if (!common?.hasContent && !specializations.some((s) => s.hasContent)) {
    return "Sem conteúdo ainda";
  }
  if (common && !common.completed) {
    const active = common.modules.find((m) => m.status === "in_progress");
    return active ? `Comum · ${active.module.title}` : "Comum";
  }
  // Com várias especializações, a que interessa é a primeira por acabar.
  const pending = specializations.find((s) => !s.completed);
  if (pending) {
    const active = pending.modules.find((m) => m.status === "in_progress");
    return active
      ? `${pending.track.name} · ${active.module.title}`
      : pending.track.name;
  }
  if (specializations.length > 0) return "Concluído";
  return common?.completed ? "Comum concluída" : "—";
}
