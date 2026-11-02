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
//   • Até 8 do NÚCLEO da fase — só as que o André aprovou (v78.58:
//     `APPROVED_CORE_IDS`; sem nenhuma aprovada, 0) — e o resto, até 35, dos
//     CAPÍTULOS da especialização DONA DO EXAME
//     (v78.54: só dela — nem Comum de reserva, nem outra especialização).
//     TODOS os capítulos entram — à proporção das perguntas que cada um tem,
//     com pelo menos uma de cada — para que o exame cubra a formação inteira e
//     não só o tema da semana.
//   • v78.64: NÃO REPETE. Sai primeiro o que a pessoa nunca viu nos exames
//     anteriores (e nas tentativas anteriores); 279 perguntas chegam para os
//     seis exames sem repetir nenhuma. Só com muitas tentativas falhadas é
//     que voltam perguntas — as que saíram menos vezes.
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
import { APPROVED_CORE_IDS, EXAM_QUESTIONS } from "@/lib/training/exam-questions";
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
  /** Um estrato por capítulo da especialização dona do exame. */
  chapters: Stratum[];
  /** Vazio desde a v78.54: as especializações não se misturam, e o Comum já
   *  não enche folhas de exame. Fica no tipo para o sorteio não mudar. */
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

/** De onde sai a folha: o núcleo da fase + os capítulos da especialização
 *  dona do exame — e só dela (v78.54). Até aí entravam os capítulos de todas
 *  as especializações da pessoa e o Comum de reserva. */
export function examPool(exam: ExamPhase, tracks: TrainingTrack[]): ExamPool {
  // v78.58: o núcleo foi escrito pelo Claude, não pelo André — só entram as
  // perguntas que ele aprovar.
  const core: Stratum = {
    topic: coreTopic(exam),
    questions: (EXAM_QUESTIONS[exam.id] ?? []).filter((q) => examEligible(q) && APPROVED_CORE_IDS.has(q.id)),
  };
  const chapters = tracks.filter((t) => t.slug === exam.trackSlug).flatMap(trackStrata);
  return { core, chapters, reserve: [] };
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

// ---------------------------------------------------------------------------
// O que a pessoa já viu (v78.64)
//
// PORQUE: até aqui cada exame era sorteado às cegas, sem saber dos anteriores.
// O Manuel fez os seis e no exame dos 90 dias 23 das 35 perguntas já lhe
// tinham saído antes — com 279 perguntas elegíveis, que chegam para os seis
// exames (210) sem repetir nenhuma. Agora o sorteio recebe o histórico: o que
// nunca saiu vem primeiro, e uma pergunta só volta quando já não há novas
// (muitas tentativas falhadas) — e aí volta a que saiu menos vezes.
// ---------------------------------------------------------------------------

/** Quantas vezes cada pergunta já saiu à pessoa nos exames da especialização. */
export type ExamHistory = ReadonlyMap<string, number>;

/** Conta as perguntas de todas as folhas que a pessoa já recebeu nos exames
 *  `examIds` — as entregues ou recolhidas (tentativas: cada uma grava todas as
 *  perguntas da folha, respondidas ou não) e alguma que ainda esteja a correr
 *  noutro exame (sessão sem tentativa). */
export function examHistory(
  examIds: ReadonlySet<string>,
  attempts: ReadonlyArray<{
    quizId: string;
    attemptNumber: number;
    answers: ReadonlyArray<{ questionId: string }>;
  }>,
  sessions: Readonly<
    Record<string, { examId: string; attemptNumber: number; questionIds?: string[] }>
  >,
): Map<string, number> {
  const papers: string[][] = [];
  const recorded = new Set<string>();
  for (const a of attempts) {
    if (!examIds.has(a.quizId)) continue;
    recorded.add(`${a.quizId}#${a.attemptNumber}`);
    papers.push(a.answers.map((x) => x.questionId));
  }
  for (const s of Object.values(sessions)) {
    if (!examIds.has(s.examId) || !s.questionIds?.length) continue;
    if (recorded.has(`${s.examId}#${s.attemptNumber}`)) continue;
    papers.push(s.questionIds);
  }
  const seen = new Map<string, number>();
  for (const ids of papers) {
    for (const id of new Set(ids)) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  return seen;
}

/** Reparte `total` lugares pelos capítulos, à proporção das perguntas NOVAS
 *  que cada um ainda tem — com pelo menos uma de cada. Assim os capítulos
 *  pequenos (o 2 tem 12 perguntas) não se esgotam nos primeiros exames: todos
 *  gastam ao mesmo ritmo e todos continuam a entrar até ao exame final.
 *  Pressupõe `total` < soma das novas (senão entram todas). */
function quotas(
  sizes: { key: string; n: number }[],
  total: number,
  rand: () => number,
): Map<string, number> {
  const open = shuffle(
    sizes.filter((s) => s.n > 0),
    rand,
  );
  const out = new Map<string, number>();
  if (total <= 0 || open.length === 0) return out;
  if (total < open.length) {
    for (const s of open.slice(0, total)) out.set(s.key, 1);
    return out;
  }
  // Uma de cada; o resto à proporção do que sobra a cada capítulo (maiores
  // restos primeiro — empates resolvidos pela ordem baralhada).
  const rest = total - open.length;
  const spare = open.reduce((n, s) => n + (s.n - 1), 0);
  const shares = open.map((s) => {
    const exact = spare > 0 ? (rest * (s.n - 1)) / spare : 0;
    return { key: s.key, n: s.n, base: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let given = shares.reduce((n, s) => n + s.base, 0);
  for (const s of [...shares].sort((a, b) => b.frac - a.frac)) {
    if (given >= rest) break;
    if (s.base + 1 <= s.n - 1) {
      s.base += 1;
      given += 1;
    }
  }
  for (const s of shares) out.set(s.key, 1 + s.base);
  return out;
}

/** Escolhe as perguntas e a ordem. Devolve só ids — a sessão guarda isto e a
 *  folha reconstrói-se a partir daqui sempre que é preciso. `history` é o que
 *  a pessoa já viu nos exames da especialização (`examHistory`). */
export function drawExamQuestionIds(
  pool: ExamPool,
  seed: string,
  history: ExamHistory = new Map(),
): string[] {
  const rand = rng(seed);
  const timesSeen = (q: TrainingQuestion) => history.get(q.id) ?? 0;
  const strata = [pool.core, ...pool.chapters, ...pool.reserve];
  // Por estrato: as novas (baralhadas) e as já vistas, das que saíram menos
  // vezes para as que saíram mais (baralhadas dentro de cada contagem).
  const fresh = new Map<string, TrainingQuestion[]>();
  const stale = new Map<string, TrainingQuestion[]>();
  for (const s of strata) {
    const deck = shuffle(s.questions, rand);
    fresh.set(s.topic.key, deck.filter((q) => timesSeen(q) === 0));
    stale.set(
      s.topic.key,
      deck.filter((q) => timesSeen(q) > 0).sort((a, b) => timesSeen(a) - timesSeen(b)),
    );
  }
  const picked = new Map<string, string[]>();
  let left = EXAM_QUESTION_COUNT;

  const take = (decks: Map<string, TrainingQuestion[]>, key: string, n: number) => {
    const deck = decks.get(key) ?? [];
    const got = deck.splice(0, Math.max(0, Math.min(n, left)));
    left -= got.length;
    if (got.length) {
      picked.set(key, [...(picked.get(key) ?? []), ...got.map((q) => q.id)]);
    }
  };

  // Perguntas novas dos capítulos: à proporção do que cada um ainda tem por
  // sair; se já não chegam para encher a folha, entram todas.
  const freshChapters = (list: Stratum[]) => {
    const sizes = list.map((s) => ({
      key: s.topic.key,
      n: fresh.get(s.topic.key)?.length ?? 0,
    }));
    const available = sizes.reduce((n, s) => n + s.n, 0);
    if (available <= left) {
      for (const s of sizes) take(fresh, s.key, s.n);
      return;
    }
    for (const [key, n] of quotas(sizes, left, rand)) take(fresh, key, n);
  };

  // Só quando já não há novas: uma de cada capítulo por volta (ordem
  // baralhada a cada volta), das que saíram menos vezes primeiro.
  const roundRobin = (list: Stratum[]) => {
    while (left > 0) {
      const open = list.filter((s) => (stale.get(s.topic.key) ?? []).length > 0);
      if (open.length === 0) return;
      const lowest = Math.min(...open.map((s) => timesSeen(stale.get(s.topic.key)![0])));
      const tier = shuffle(
        open.filter((s) => timesSeen(stale.get(s.topic.key)![0]) === lowest),
        rand,
      );
      for (const s of tier) {
        if (left === 0) return;
        take(stale, s.topic.key, 1);
      }
    }
  };

  take(fresh, pool.core.topic.key, EXAM_CORE_COUNT);
  freshChapters(pool.chapters);
  // Especialização pequena demais para 35: o resto do núcleo, depois o Comum.
  take(fresh, pool.core.topic.key, left);
  freshChapters(pool.reserve);
  // Já saíram todas as novas — repete o mínimo possível.
  roundRobin([pool.core, ...pool.chapters, ...pool.reserve]);

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
 *  perguntas as opções ficam como foram escritas. Também usado pelos quizzes
 *  dos capítulos (v78.35). */
const REFERS_TO_OTHERS = /\banteriores?\b|\bnenhuma d[ao]s\b/i;

export function shuffleOptions(q: TrainingQuestion, seed: string): TrainingQuestion {
  if (q.type === "true_false") return q;
  if (q.options.some((o) => REFERS_TO_OTHERS.test(o.text))) return q;
  return { ...q, options: shuffle(q.options, rng(`${seed}:${q.id}`)) };
}

/** Todas as perguntas que uma folha pode conter, com o capítulo de cada uma.
 *  Usa TODAS as tracks, não só as da pessoa: se a inscrição mudar a meio de
 *  um exame, a folha já sorteada não perde perguntas. Também lido pela
 *  correção guardada (`exam-correction.ts`). */
export function questionIndex(
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
