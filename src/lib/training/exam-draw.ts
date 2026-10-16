// Sorteio da folha de um EXAME DE FASE — módulo puro (sem KV, sem React).
//
// PORQUE É QUE O EXAME DEIXOU DE SER UMA FOLHA FIXA: com 12 perguntas iguais
// para toda a gente, o exame da semana 3 de um consultor era o da semana 3 do
// colega do lado — bastava perguntar. E só media o tema da fase, não a
// formação.
//
// AGORA CADA TENTATIVA É UMA FOLHA ÚNICA, sorteada no servidor no instante do
// «Começar»:
//   • 35 perguntas em 60 minutos — ~1,7 min por pergunta.
//   • 8 do NÚCLEO da fase (os casos escritos para aquele exame, em
//     `exam-questions.ts`) e 27 dos CAPÍTULOS da especialização da pessoa.
//     TODOS os capítulos entram — duas voltas completas e uma terceira parcial,
//     por ordem baralhada a cada volta, por isso 2 ou 3 de cada — para que o
//     exame cubra a formação inteira e não só o tema da semana.
//   • A ordem salta de capítulo em capítulo: nunca duas seguidas do mesmo,
//     sempre que as contas o permitem.
//   • As opções também são baralhadas — «a resposta é a B» deixa de passar de
//     um consultor para o outro.
//
// O sorteio fica guardado na sessão (`seed` + `questionIds`): um F5 devolve a
// mesma folha, pela mesma ordem, e a correção usa exatamente as perguntas que
// a pessoa viu — mesmo que alguém edite o CMS a meio do exame.
//
// Ficam FORA do sorteio as perguntas de resposta aberta (não têm correção
// automática) e as «a confirmar» do CMS: num exame que decide a fase, uma
// chave de resposta por confirmar não pode chumbar ninguém.

import type { TrainingQuestion, TrainingTrack } from "@/lib/training/catalog";
import { EXAM_QUESTIONS } from "@/lib/training/exam-questions";
import type { ExamPhase } from "@/lib/training/exams";
import {
  seededShuffle,
  toPublicQuestions,
  type PublicQuestion,
  type QuestionTopic,
} from "@/lib/training/grading";

/** Tamanho de uma folha de exame. Um número, um sítio. */
export const EXAM_QUESTION_COUNT = 35;
/** Quantas perguntas vêm do núcleo da fase; as restantes vêm dos capítulos. */
export const EXAM_CORE_COUNT = 8;

type Stratum = { topic: QuestionTopic; questions: TrainingQuestion[] };

export type ExamPool = {
  /** Os casos escritos para esta fase. */
  core: Stratum;
  /** Um estrato por capítulo da especialização da pessoa. */
  chapters: Stratum[];
  /** Só entra quando a especialização não chega para encher a folha. */
  reserve: Stratum[];
};

export type ExamPaper = {
  /** Pela ordem da folha, já com as opções baralhadas. */
  questions: TrainingQuestion[];
  topics: Record<string, QuestionTopic>;
};

export type ExamDraw = { seed: string; questionIds: string[] };

function coreTopic(exam: ExamPhase): QuestionTopic {
  return { key: "core", no: null, title: `Núcleo · ${exam.label}` };
}

function examEligible(q: TrainingQuestion): boolean {
  return (
    q.type !== "open_text" &&
    !q.needsReview &&
    q.options.some((o) => o.isCorrect)
  );
}

function trackStrata(track: TrainingTrack): Stratum[] {
  return [...track.modules]
    .sort((a, b) => a.order - b.order)
    .map((m, i) => ({
      topic: { key: m.id, no: i + 1, title: m.title },
      questions: m.quiz.questions.filter(examEligible),
    }))
    .filter((s) => s.questions.length > 0);
}

/** De onde sai a folha desta pessoa: o núcleo da fase + os capítulos das
 *  especializações dela. Sem especialização (C-Level), os capítulos são os do
 *  Comum — que, para os outros, só serve de reserva. */
export function examPool(
  exam: ExamPhase,
  tracks: TrainingTrack[],
  specializationSlugs: readonly string[],
): ExamPool {
  const core: Stratum = {
    topic: coreTopic(exam),
    questions: (EXAM_QUESTIONS[exam.id] ?? []).filter(examEligible),
  };
  const own = tracks
    .filter((t) => !t.isCommon && specializationSlugs.includes(t.slug))
    .flatMap(trackStrata);
  const common = tracks.filter((t) => t.isCommon).flatMap(trackStrata);
  return own.length
    ? { core, chapters: own, reserve: common }
    : { core, chapters: common, reserve: [] };
}

/** Quantas perguntas a folha vai ter — 35, salvo especialização pequena. */
export function examPaperSize(pool: ExamPool): number {
  const available = [pool.core, ...pool.chapters, ...pool.reserve].reduce(
    (n, s) => n + s.questions.length,
    0,
  );
  return Math.min(EXAM_QUESTION_COUNT, available);
}

// ---------------------------------------------------------------------------
// Aleatoriedade com semente — a semente vem de `crypto.randomUUID()` no
// arranque e fica na sessão, por isso a folha é imprevisível mas reproduzível.
// ---------------------------------------------------------------------------

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — pequeno, rápido e com boa distribuição para isto. */
function rng(seed: string): () => number {
  let a = hashSeed(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// O sorteio
// ---------------------------------------------------------------------------

/** Escolhe as perguntas e a ordem. Devolve só ids — a sessão guarda isto e a
 *  folha reconstrói-se a partir daqui sempre que é preciso. */
export function drawExamQuestionIds(pool: ExamPool, seed: string): string[] {
  const rand = rng(seed);
  const decks = new Map<string, TrainingQuestion[]>();
  for (const s of [pool.core, ...pool.chapters, ...pool.reserve]) {
    decks.set(s.topic.key, shuffle(s.questions, rand));
  }
  const picked = new Map<string, string[]>();
  let left = EXAM_QUESTION_COUNT;

  const take = (key: string, n: number) => {
    const deck = decks.get(key) ?? [];
    const got = deck.splice(0, Math.max(0, Math.min(n, left)));
    left -= got.length;
    if (got.length) {
      picked.set(key, [...(picked.get(key) ?? []), ...got.map((q) => q.id)]);
    }
  };

  // Uma pergunta de cada capítulo por volta, com a ordem dos capítulos
  // baralhada em cada volta: é o que garante que todos entram e que a
  // terceira pergunta extra calha a capítulos diferentes de pessoa para pessoa.
  const roundRobin = (strata: Stratum[]) => {
    while (left > 0) {
      const open = shuffle(
        strata.filter((s) => (decks.get(s.topic.key) ?? []).length > 0),
        rand,
      );
      if (open.length === 0) return;
      for (const s of open) {
        if (left === 0) return;
        take(s.topic.key, 1);
      }
    }
  };

  take(pool.core.topic.key, EXAM_CORE_COUNT);
  roundRobin(pool.chapters);
  // Especialização pequena demais para 35: o resto do núcleo, depois o Comum.
  take(pool.core.topic.key, left);
  roundRobin(pool.reserve);

  return interleave(picked, rand);
}

/** Baralha a folha de forma a que nunca venham duas perguntas seguidas do
 *  mesmo capítulo. Em cada passo escolhe um capítulo diferente do anterior —
 *  ao calhas, com peso pelo que lhe resta — mas só entre os que ainda deixam
 *  o resto da folha arrumável. Se as contas não o permitirem (um capítulo com
 *  mais de metade da folha), aceita a repetição em vez de falhar. */
function interleave(
  groups: Map<string, string[]>,
  rand: () => number,
): string[] {
  const remaining = new Map<string, string[]>();
  for (const [key, ids] of groups) {
    if (ids.length) remaining.set(key, shuffle(ids, rand));
  }
  let total = [...remaining.values()].reduce((n, ids) => n + ids.length, 0);
  const out: string[] = [];
  let last: string | null = null;

  while (total > 0) {
    const counts = [...remaining.entries()]
      .filter(([, ids]) => ids.length > 0)
      .map(([key, ids]) => ({ key, n: ids.length }));
    const after = total - 1;
    // Depois de escolher `k`, sobram `after` lugares e o primeiro não pode ser
    // `k`: cabe se `k` não passar de metade (arredondada para baixo) e nenhum
    // outro passar de metade (arredondada para cima).
    const feasible = (k: string) =>
      counts.every(({ key, n }) => {
        const left = key === k ? n - 1 : n;
        return key === k
          ? left <= Math.floor(after / 2)
          : left <= Math.ceil(after / 2);
      });
    const notLast = counts.filter((c) => c.key !== last);
    const safe = notLast.filter((c) => feasible(c.key));
    const pool = safe.length ? safe : notLast.length ? notLast : counts;

    const weight = pool.reduce((n, c) => n + c.n, 0);
    let roll = rand() * weight;
    let chosen = pool[pool.length - 1].key;
    for (const c of pool) {
      roll -= c.n;
      if (roll < 0) {
        chosen = c.key;
        break;
      }
    }

    out.push(remaining.get(chosen)!.shift()!);
    last = chosen;
    total -= 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// A folha
// ---------------------------------------------------------------------------

/** Opções que apontam para as de cima («Ambas as anteriores», «Todas as
 *  opções anteriores») deixam de fazer sentido se a ordem mudar — nessas
 *  perguntas as opções ficam como foram escritas. */
const REFERS_TO_OTHERS = /\banteriores?\b|\bnenhuma d[ao]s\b/i;

function shuffleOptions(q: TrainingQuestion, seed: string): TrainingQuestion {
  if (q.type === "true_false") return q;
  if (q.options.some((o) => REFERS_TO_OTHERS.test(o.text))) return q;
  return { ...q, options: shuffle(q.options, rng(`${seed}:${q.id}`)) };
}

/** Todas as perguntas que uma folha pode conter, com o capítulo de cada uma.
 *  Usa TODAS as tracks, não só as da pessoa: se a inscrição mudar a meio de
 *  um exame, a folha já sorteada não perde perguntas. */
function questionIndex(
  exam: ExamPhase,
  tracks: TrainingTrack[],
): Map<string, { question: TrainingQuestion; topic: QuestionTopic }> {
  const map = new Map<
    string,
    { question: TrainingQuestion; topic: QuestionTopic }
  >();
  for (const track of tracks) {
    const modules = [...track.modules].sort((a, b) => a.order - b.order);
    modules.forEach((m, i) => {
      const topic = { key: m.id, no: i + 1, title: m.title };
      for (const q of m.quiz.questions) map.set(q.id, { question: q, topic });
    });
  }
  const core = coreTopic(exam);
  for (const q of EXAM_QUESTIONS[exam.id] ?? []) {
    map.set(q.id, { question: q, topic: core });
  }
  return map;
}

/** A folha de uma sessão. Sessões abertas antes do sorteio (sem
 *  `questionIds`) continuam com a folha fixa de 12, pela ordem de sempre — um
 *  exame a decorrer no momento do deploy não muda de perguntas a meio. */
export function examPaperFor(
  exam: ExamPhase,
  tracks: TrainingTrack[],
  session: { seed?: string; questionIds?: string[]; attemptNumber: number },
  username: string,
): ExamPaper {
  if (session.seed && session.questionIds?.length) {
    const index = questionIndex(exam, tracks);
    const questions: TrainingQuestion[] = [];
    const topics: Record<string, QuestionTopic> = {};
    for (const id of session.questionIds) {
      const hit = index.get(id);
      if (!hit) continue; // apagada do CMS a meio — não se inventa nada
      questions.push(shuffleOptions(hit.question, session.seed));
      topics[id] = hit.topic;
    }
    return { questions, topics };
  }

  const fixed = seededShuffle(
    EXAM_QUESTIONS[exam.id] ?? [],
    `${username}:${exam.id}:${session.attemptNumber}`,
  );
  const core = coreTopic(exam);
  return {
    questions: fixed,
    topics: Object.fromEntries(fixed.map((q) => [q.id, core])),
  };
}

/** A folha pronta a enviar ao browser: sem respostas certas, com o capítulo
 *  de cada pergunta. */
export function publicExamPaper(paper: ExamPaper): PublicQuestion[] {
  return toPublicQuestions(paper.questions).map((q) => ({
    ...q,
    topic: paper.topics[q.id] ?? null,
  }));
}
