// O estado de uma passagem, projeto a projeto (v80.39) — o que as páginas
// e o sino mostram. Leituras: fichas (1 mget), assinaturas (1 mget),
// perguntas (1 lrange + 1 mget) e os donos atuais (cache do pedido).

import "server-only";
import { currentOwners, getFichas, getSigns, listQuestions } from "./store";
import {
  fichaProgress,
  stageOf,
  type Ficha,
  type Passagem,
  type PassagemProjectRef,
  type ProjectStage,
  type Question,
  type Sign,
} from "./shared";

export type ProjectView = PassagemProjectRef & {
  ficha: Ficha;
  sign: Sign | null;
  /** O projeto já está com quem entra no SEO DPT. */
  transferred: boolean;
  /** Quem o tem hoje no SEO DPT. */
  owner: string;
  stage: ProjectStage;
  progress: ReturnType<typeof fichaProgress>;
  openQuestions: number;
  questions: number;
};

export type PassagemOverview = {
  passagem: Passagem;
  projects: ProjectView[];
  questions: Question[];
  totals: { projects: number; ready: number; assumed: number; transferred: number; risk: number; open: number; pct: number };
};

export async function passagemOverview(p: Passagem, onlySlugs?: string[]): Promise<PassagemOverview> {
  const refs = onlySlugs ? p.projects.filter((x) => onlySlugs.includes(x.slug)) : p.projects;
  const slugs = refs.map((x) => x.slug);
  const [fichas, signs, allQuestions, owners] = await Promise.all([
    getFichas(p.id, slugs),
    getSigns(p.id, slugs),
    listQuestions(p.id),
    currentOwners(slugs),
  ]);
  const questions = allQuestions.filter((q) => slugs.includes(q.slug));
  const projects: ProjectView[] = refs.map((ref) => {
    const ficha = fichas[ref.slug];
    const sign = signs[ref.slug] ?? null;
    const owner = owners[ref.slug] ?? "Unassigned";
    const transferred = Boolean(ref.incoming && owner === ref.incoming.name);
    const mine = questions.filter((q) => q.slug === ref.slug);
    return {
      ...ref,
      ficha,
      sign,
      transferred,
      owner,
      stage: stageOf(ficha, sign, transferred),
      progress: fichaProgress(ficha, sign),
      openQuestions: mine.filter((q) => !q.a).length,
      questions: mine.length,
    };
  });
  const n = projects.length || 1;
  return {
    passagem: p,
    projects,
    questions,
    totals: {
      projects: projects.length,
      ready: projects.filter((x) => x.ficha.readyAt).length,
      assumed: projects.filter((x) => x.sign).length,
      transferred: projects.filter((x) => x.transferred).length,
      risk: projects.filter((x) => x.ficha.health === "vermelho").length,
      open: questions.filter((q) => !q.a).length,
      pct: Math.round(projects.reduce((s, x) => s + x.progress.pct, 0) / n),
    },
  };
}
