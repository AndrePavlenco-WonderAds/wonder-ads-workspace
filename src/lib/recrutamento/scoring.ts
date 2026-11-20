// Recrutamento (v80.13) — as contas da entrevista. Puro: corre no browser
// (nota ao vivo enquanto o André pontua) e no servidor (a ficha).
//
// Regras do guião:
// - nota de uma pergunta = soma dos ✓, menos 3 por red flag, mínimo 0 e
//   máximo 10; os «tetos» das Perguntas do candidato limitam a nota;
// - Média Hard Skills e Média Soft Skills = médias das perguntas pontuadas;
// - Fit Cultural e Capacidade Técnica (o «Calculado» do guião), com a fórmula
//   escolhida pelo André a 20/11/2026:
//     Técnica = média de [Média Hard Skills, Atenção ao detalhe]
//     Fit     = média de [Média Soft Skills, Coachability, Perguntas do candidato]
//   A «minha nota» do entrevistador, quando existe, ganha ao calculado;
// - zonas 0–4 Baixo, 5–7 Médio, 8–10 Alto (pela nota arredondada);
// - grade D–A = Fit × Técnica (a grelha do guião). Fit baixo = não contratar,
//   mesmo com técnica alta.

import type { InterviewTemplate, Question, SectionId } from "./templates";

export type Answer = {
  /** Ids dos critérios com ✓. */
  checked: string[];
  /** Ids das penalidades ativas (red flag, tetos). */
  flags: string[];
  notes: string;
  /** Nota posta à mão pelo entrevistador (0–10), em vez da calculada. */
  override: number | null;
  /** Tempo passado nesta pergunta, em ms (soma de todas as visitas). */
  timeMs: number;
};

export function emptyAnswer(): Answer {
  return { checked: [], flags: [], notes: "", override: null, timeMs: 0 };
}

/** Uma resposta conta como pontuada quando o entrevistador mexeu nela. */
export function isScored(a: Answer | null | undefined): boolean {
  if (!a) return false;
  return a.checked.length > 0 || a.flags.length > 0 || a.override !== null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** A nota calculada pelos ✓ e pelas penalidades (sem a nota à mão). */
export function computedScore(q: Question, a: Answer | null | undefined): number {
  if (!a) return 0;
  let sum = 0;
  for (const c of q.criteria) if (a.checked.includes(c.id)) sum += c.pts;
  for (const p of q.penalties) {
    if (p.kind === "minus" && a.flags.includes(p.id)) sum -= p.pts;
  }
  sum = clamp(sum, 0, 10);
  for (const p of q.penalties) {
    if (p.kind === "cap" && a.flags.includes(p.id)) sum = Math.min(sum, p.max);
  }
  return sum;
}

/** A nota que conta: a posta à mão, senão a calculada. */
export function questionScore(q: Question, a: Answer | null | undefined): number {
  if (a && a.override !== null && Number.isFinite(a.override)) return clamp(a.override, 0, 10);
  return computedScore(q, a);
}

export function maxPoints(q: Question): number {
  return q.criteria.reduce((s, c) => s + c.pts, 0);
}

function avg(list: number[]): number | null {
  return list.length ? round1(list.reduce((s, n) => s + n, 0) / list.length) : null;
}

/** Média de uma secção — só das perguntas pontuadas. null = nada pontuado. */
export function sectionScore(
  t: InterviewTemplate,
  answers: Record<string, Answer>,
  section: SectionId,
): number | null {
  const qs = t.questions.filter((q) => q.section === section && isScored(answers[q.id]));
  return avg(qs.map((q) => questionScore(q, answers[q.id])));
}

export type Zone = "low" | "mid" | "high";

export function zoneOf(score: number | null): Zone | null {
  if (score === null) return null;
  const r = Math.round(score);
  if (r <= 4) return "low";
  if (r <= 7) return "mid";
  return "high";
}

export type GradeCell = {
  grade: "A Player" | "B+ Player" | "B Player" | "B- em formação" | "C Player" | "D Player";
  /** Letra curta para os selos (A, B+, B, B−, C, D). */
  letter: string;
  line: string;
  decision: string;
  tone: "emerald" | "sky" | "teal" | "rose" | "amber";
  hire: "yes" | "maybe" | "no";
};

/** A grelha do guião: GRID[fit][técnica]. */
export const GRADE_GRID: Record<Zone, Record<Zone, GradeCell>> = {
  high: {
    low: { grade: "B- em formação", letter: "B−", line: "Mentoria dos A-Players, prazo para chegar a B", decision: "Só com mentor e prazo", tone: "teal", hire: "maybe" },
    mid: { grade: "B+ Player", letter: "B+", line: "Bom potencial: desenvolver técnica até A", decision: "Contratar", tone: "sky", hire: "yes" },
    high: { grade: "A Player", letter: "A", line: "Promover e reconhecer em público", decision: "Contratar já", tone: "emerald", hire: "yes" },
  },
  mid: {
    low: { grade: "B- em formação", letter: "B−", line: "Prazo curto, reavaliar cedo", decision: "Só se não houver melhor", tone: "teal", hire: "maybe" },
    mid: { grade: "B Player", letter: "B", line: "Crescimento normal, sem intervenção", decision: "Contratar", tone: "sky", hire: "yes" },
    high: { grade: "B Player", letter: "B", line: "Desenvolver: focar no fit cultural", decision: "Validar fit antes", tone: "sky", hire: "maybe" },
  },
  low: {
    low: { grade: "D Player", letter: "D", line: "Erro de contratação fácil de detetar", decision: "Não contratar", tone: "amber", hire: "no" },
    mid: { grade: "C Player", letter: "C", line: "Fit baixo corrói a equipa", decision: "Não contratar", tone: "rose", hire: "no" },
    high: { grade: "C Player", letter: "C", line: "O mais perigoso: corrói os A-Players", decision: "Não contratar", tone: "rose", hire: "no" },
  },
};

export type Closing = {
  strengths: string[];
  weaknesses: string[];
  remember: string;
  quote: string;
  doubts: string;
  fitMine: number | null;
  techMine: number | null;
  nextStep: string;
};

export function emptyClosing(): Closing {
  return { strengths: ["", "", "", ""], weaknesses: ["", "", "", ""], remember: "", quote: "", doubts: "", fitMine: null, techMine: null, nextStep: "" };
}

export type InterviewSummary = {
  hard: number | null;
  coach: number | null;
  soft: number | null;
  detail: number | null;
  questions: number | null;
  techCalc: number | null;
  fitCalc: number | null;
  tech: number | null;
  fit: number | null;
  cell: GradeCell | null;
  scored: number;
  total: number;
};

export function summarize(
  t: InterviewTemplate,
  answers: Record<string, Answer>,
  closing: Closing,
): InterviewSummary {
  const hard = sectionScore(t, answers, "hard");
  const coach = sectionScore(t, answers, "coach");
  const soft = sectionScore(t, answers, "soft");
  const detail = sectionScore(t, answers, "detail");
  const questions = sectionScore(t, answers, "questions");
  const techCalc = avg([hard, detail].filter((n): n is number => n !== null));
  const fitCalc = avg([soft, coach, questions].filter((n): n is number => n !== null));
  const tech = closing.techMine ?? techCalc;
  const fit = closing.fitMine ?? fitCalc;
  const fz = zoneOf(fit);
  const tz = zoneOf(tech);
  return {
    hard,
    coach,
    soft,
    detail,
    questions,
    techCalc,
    fitCalc,
    tech,
    fit,
    cell: fz && tz ? GRADE_GRID[fz][tz] : null,
    // As perguntas sem pontos (secção Pessoal, v80.17) ficam fora da contagem.
    scored: t.questions.filter((q) => !q.unscored && isScored(answers[q.id])).length,
    total: t.questions.filter((q) => !q.unscored).length,
  };
}

export function fmtScore(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}
