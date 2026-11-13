// Novidades na Formação (v78.93) — uma aula nova chega ao sino de quem a
// tem de ver, com o link para a aula. Mesmo desenho dos avisos da
// Documentação (documentacao/updates.ts):
//
//   • «app» — a direção acrescenta (ou grava finalmente o vídeo de) uma aula
//     no CMS. Ao gravar, o servidor compara com o catálogo de antes e
//     regista sozinho as aulas que PASSARAM A ESTAR DISPONÍVEIS (vídeo +
//     publicada) — ver `newlyAvailable` e content-store.ts;
//   • «codigo» — uma aula nova entra numa versão da app (catalog.ts). Quem
//     mexe no código acrescenta uma entrada a `TRAINING_CODE_UPDATES` (em
//     baixo) na mesma versão, e põe `availableSince` no seed da aula.
//
// Quem recebe: quem tem a especialização (inscrição ou departamento) e JÁ
// PASSOU pelo capítulo da aula — viu alguma aula desse capítulo ou dos
// seguintes. Quem ainda vai atrás chega à aula pela ordem normal; avisá-lo
// era deixar-lhe uma notificação aberta durante semanas. O aviso sai sozinho
// quando as aulas ficam vistas (ou quando a pessoa o marca como lido).
//
// Módulo puro: sem servidor.

import {
  DEFAULT_TRAINING_TRACKS,
  availableLessons,
  type TrainingLesson,
  type TrainingTrack,
} from "@/lib/training/catalog";

export type TrainingUpdateLesson = {
  id: string;
  title: string;
  /** «2.9» — capítulo.aula, pela ordem do catálogo. */
  ref: string;
  presenter: string | null;
};

export type TrainingUpdate = {
  /** Id estável — é o id do aviso (mudá-lo faz o aviso voltar por ler). */
  id: string;
  /** Slug da especialização («seo-geo»). */
  track: string;
  lessons: TrainingUpdateLesson[];
  /** Linhas a mais no aviso («9 perguntas novas no quiz do Capítulo 2»). */
  extra: string[];
  /** Aulas que dizem que a pessoa já passou por ali: as do capítulo da aula
   *  nova e as dos seguintes (sem as novas). Basta uma vista. */
  reachIds: string[];
  at: number;
  source: "app" | "codigo";
  version?: string;
};

/** Quanto tempo um aviso fica no sino. */
export const TRAINING_UPDATE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

/** Quanto tempo a aula mostra o chip «Nova» na página da especialização. */
export const NEW_LESSON_BADGE_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Registo das aulas novas feitas em CÓDIGO
// ---------------------------------------------------------------------------
//
// REGRA: aula nova em catalog.ts (ou vídeo gravado de uma aula que estava
// «Brevemente») → entrada AQUI, à cabeça, na mesma versão, e
// `availableSince` no seed da aula com a mesma data. Mudanças de texto,
// perguntas corrigidas ou anexos não levam entrada.
//
//   id         único e estável («v78.93-seo-nps-resposta»)
//   track      slug da especialização
//   lessonIds  as aulas novas (ids do catálogo)
//   extra      linhas a mais, opcional
//   at         data e hora da versão, ISO com fuso
//   version    versão da app

type CodeTrainingUpdate = {
  id: string;
  track: string;
  lessonIds: string[];
  extra?: string[];
  at: string;
  version: string;
};

export const TRAINING_CODE_UPDATES: CodeTrainingUpdate[] = [
  {
    id: "v78.93-seo-nps-resposta",
    track: "seo-geo",
    lessonIds: ["seo-com-nps-resposta"],
    extra: ["9 perguntas novas no quiz do capítulo 2"],
    at: "2026-11-13T15:00:00+00:00",
    version: "78.93",
  },
];

// ---------------------------------------------------------------------------

function sortedModules(track: TrainingTrack) {
  return [...track.modules].sort((a, b) => a.order - b.order);
}

/** Referência «capítulo.aula» e o resto do que o aviso mostra. */
function describeLesson(track: TrainingTrack, lessonId: string): TrainingUpdateLesson | null {
  for (const m of sortedModules(track)) {
    const lessons = [...m.lessons].sort((a, b) => a.order - b.order);
    const i = lessons.findIndex((l) => l.id === lessonId);
    if (i >= 0) {
      const l = lessons[i];
      return { id: l.id, title: l.title, ref: `${m.order}.${i + 1}`, presenter: l.presenter };
    }
  }
  return null;
}

/** As aulas do capítulo da primeira aula nova e dos seguintes, sem as novas. */
function reachIdsFor(track: TrainingTrack, lessonIds: string[]): string[] {
  const fresh = new Set(lessonIds);
  const modules = sortedModules(track);
  const first = modules.findIndex((m) => m.lessons.some((l) => fresh.has(l.id)));
  if (first < 0) return [];
  return modules
    .slice(first)
    .flatMap((m) => m.lessons)
    .map((l) => l.id)
    .filter((id) => !fresh.has(id));
}

/** As entradas de código na forma comum (títulos e capítulos do catálogo
 *  em código). Uma entrada cujas aulas já não existem é ignorada. */
export function codeTrainingUpdates(): TrainingUpdate[] {
  const out: TrainingUpdate[] = [];
  for (const c of TRAINING_CODE_UPDATES) {
    const track = DEFAULT_TRAINING_TRACKS.find((t) => t.slug === c.track);
    const at = Date.parse(c.at);
    if (!track || !Number.isFinite(at)) continue;
    const lessons = c.lessonIds
      .map((id) => describeLesson(track, id))
      .filter((l): l is TrainingUpdateLesson => l !== null);
    if (lessons.length === 0) continue;
    out.push({
      id: c.id,
      track: c.track,
      lessons,
      extra: c.extra ?? [],
      reachIds: reachIdsFor(track, c.lessonIds),
      at,
      source: "codigo",
      version: c.version,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// O que o CMS acrescentou — diferença entre o catálogo de antes e o novo
// ---------------------------------------------------------------------------

function availableIds(tracks: TrainingTrack[]): Set<string> {
  const ids = new Set<string>();
  for (const t of tracks) for (const m of t.modules) for (const l of availableLessons(m)) ids.add(l.id);
  return ids;
}

/** Carimba `availableSince` nas aulas que passam a estar disponíveis nesta
 *  gravação e mantém o das que já estavam (o CMS pode não o devolver).
 *  Devolve um catálogo novo; não muda o que recebe. */
export function stampAvailability(
  before: TrainingTrack[],
  after: TrainingTrack[],
  now: number,
): TrainingTrack[] {
  const wasAvailable = availableIds(before);
  const previous = new Map<string, TrainingLesson>();
  for (const t of before) for (const m of t.modules) for (const l of m.lessons) previous.set(l.id, l);

  return after.map((t) => ({
    ...t,
    modules: t.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => {
        const available = l.isPublished && Boolean(l.videoUrl);
        const { availableSince: _drop, ...rest } = l;
        void _drop;
        if (!available) return rest;
        if (!wasAvailable.has(l.id)) return { ...rest, availableSince: now };
        const since = previous.get(l.id)?.availableSince ?? l.availableSince;
        return since ? { ...rest, availableSince: since } : rest;
      }),
    })),
  }));
}

/** Uma entrada por especialização com as aulas que passaram a estar
 *  disponíveis (as do Comum ficam de fora — o Comum não tem aviso). */
export function newlyAvailable(
  before: TrainingTrack[],
  after: TrainingTrack[],
  now: number,
): TrainingUpdate[] {
  const wasAvailable = availableIds(before);
  const oldQuestions = new Set<string>();
  for (const t of before) for (const m of t.modules) for (const q of m.quiz.questions) oldQuestions.add(q.id);

  const out: TrainingUpdate[] = [];
  for (const t of after) {
    if (t.isCommon) continue;
    const freshIds: string[] = [];
    const extra: string[] = [];
    for (const m of sortedModules(t)) {
      const fresh = availableLessons(m).filter((l) => !wasAvailable.has(l.id));
      if (fresh.length === 0) continue;
      freshIds.push(...fresh.map((l) => l.id));
      const newQuestions = m.quiz.questions.filter((q) => !oldQuestions.has(q.id)).length;
      if (newQuestions > 0) {
        extra.push(
          `${newQuestions} ${newQuestions === 1 ? "pergunta nova" : "perguntas novas"} no quiz do capítulo ${m.order}`,
        );
      }
    }
    if (freshIds.length === 0) continue;
    out.push({
      id: `app-${t.slug}-${now}`,
      track: t.slug,
      lessons: freshIds
        .map((id) => describeLesson(t, id))
        .filter((l): l is TrainingUpdateLesson => l !== null),
      extra,
      reachIds: reachIdsFor(t, freshIds),
      at: now,
      source: "app",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Quem recebe e quando sai
// ---------------------------------------------------------------------------

/** Esta pessoa recebe o aviso? `watched(id)` diz se viu uma aula. */
export function trainingUpdateReaches(
  u: Pick<TrainingUpdate, "track" | "reachIds">,
  reader: { trackSlugs: readonly string[]; viewerOf: string | null },
  watched: (lessonId: string) => boolean,
): boolean {
  if (reader.viewerOf) return false;
  if (!reader.trackSlugs.includes(u.track)) return false;
  return u.reachIds.some(watched);
}

/** O aviso está cumprido quando todas as aulas novas estão vistas. */
export function trainingUpdateDone(
  u: Pick<TrainingUpdate, "lessons">,
  watched: (lessonId: string) => boolean,
): boolean {
  return u.lessons.length > 0 && u.lessons.every((l) => watched(l.id));
}

/** Chip «Nova» na página da especialização. */
export function isNewLesson(lesson: Pick<TrainingLesson, "availableSince">, now: number): boolean {
  return Boolean(lesson.availableSince && now - lesson.availableSince <= NEW_LESSON_BADGE_MS);
}
