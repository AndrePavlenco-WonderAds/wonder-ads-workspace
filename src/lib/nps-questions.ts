// Catalogue + scoring for the client SEO satisfaction survey ("NPS quiz").
//
// This module is PURE (no KV, no React) so it can be imported by both the
// public quiz form (client component) and the server-side store/scoring.
// The question `name`s mirror the original standalone HTML form so any
// historical export stays comparable.
//
// Scoring model:
//   • Every 1–5 question is normalised to 0–10 via (v - 1) / 4 * 10, so a
//     "3" (neutral) maps to 5.0 and a "5" maps to 10.
//   • The NPS question is already 0–10 and is used verbatim.
//   • `overall` is the mean of all 13 normalised answers (0–10, 1 dp).
//   • Each section also gets its own mean so we can flag the weakest area.

import type { PublicLang } from "@/lib/public-i18n";

export type NpsScaleKind = "five" | "nps";

type Bilingual = { pt: string; en: string };

export type NpsQuestion = {
  /** Form field name — stable, matches the source HTML. */
  name: string;
  scale: NpsScaleKind;
  q: Bilingual;
  capLow: Bilingual;
  capHigh: Bilingual;
};

export type NpsSectionDef = {
  key: string;
  /** "01".."06" — shown as a mono tag in the quiz. */
  tag: string;
  title: Bilingual;
  questions: NpsQuestion[];
};

export const NPS_SECTIONS: NpsSectionDef[] = [
  {
    key: "servico",
    tag: "01",
    title: { pt: "Serviço", en: "Service" },
    questions: [
      {
        name: "servico_qualidade",
        scale: "five",
        q: {
          pt: "Como avalia a qualidade geral do serviço de SEO prestado?",
          en: "How would you rate the overall quality of the SEO service provided?",
        },
        capLow: { pt: "Fraco", en: "Poor" },
        capHigh: { pt: "Excelente", en: "Excellent" },
      },
      {
        name: "servico_expectativa",
        scale: "five",
        q: {
          pt: "A estratégia de SEO proposta correspondeu ao que foi prometido inicialmente?",
          en: "Did the proposed SEO strategy match what was initially promised?",
        },
        capLow: { pt: "Ficou aquém", en: "Fell short" },
        capHigh: { pt: "Superou", en: "Exceeded" },
      },
      {
        name: "servico_clareza",
        scale: "five",
        q: {
          pt: "As recomendações e a estratégia apresentadas foram claras e fáceis de entender?",
          en: "Were the recommendations and strategy clear and easy to understand?",
        },
        capLow: { pt: "Confusas", en: "Confusing" },
        capHigh: { pt: "Muito claras", en: "Very clear" },
      },
    ],
  },
  {
    key: "resultados",
    tag: "02",
    title: { pt: "Resultados", en: "Results" },
    questions: [
      {
        name: "resultados_objetivos",
        scale: "five",
        q: {
          pt: "O tráfego orgânico e as posições no motor de busca evoluíram como esperado?",
          en: "Did organic traffic and search rankings evolve as expected?",
        },
        capLow: { pt: "Não evoluiu", en: "No progress" },
        capHigh: { pt: "Muito acima do esperado", en: "Well above expectations" },
      },
      {
        name: "resultados_retorno",
        scale: "five",
        q: {
          pt: "Sente que o investimento em SEO teve retorno claro (leads, vendas ou visibilidade)?",
          en: "Do you feel the SEO investment had a clear return (leads, sales or visibility)?",
        },
        capLow: { pt: "Nenhum", en: "None" },
        capHigh: { pt: "Muito claro", en: "Very clear" },
      },
    ],
  },
  {
    key: "comunicacao",
    tag: "03",
    title: { pt: "Comunicação", en: "Communication" },
    questions: [
      {
        name: "comunicacao_clareza",
        scale: "five",
        q: {
          pt: "Os relatórios de rankings e tráfego foram claros e partilhados com a frequência adequada?",
          en: "Were the ranking and traffic reports clear and shared at an adequate frequency?",
        },
        capLow: { pt: "Confusos/raros", en: "Confusing/rare" },
        capHigh: { pt: "Muito claros e regulares", en: "Very clear and regular" },
      },
      {
        name: "comunicacao_rapidez",
        scale: "five",
        q: {
          pt: "A equipa esteve disponível e respondeu às suas dúvidas com rapidez?",
          en: "Was the team available and quick to answer your questions?",
        },
        capLow: { pt: "Lenta", en: "Slow" },
        capHigh: { pt: "Muito rápida", en: "Very fast" },
      },
    ],
  },
  {
    key: "consultor",
    tag: "04",
    title: { pt: "Consultor", en: "Consultant" },
    questions: [
      {
        name: "consultor_profissionalismo",
        scale: "five",
        q: {
          pt: "Como avalia o profissionalismo do consultor de SEO?",
          en: "How would you rate the professionalism of the SEO consultant?",
        },
        capLow: { pt: "Fraco", en: "Poor" },
        capHigh: { pt: "Excelente", en: "Excellent" },
      },
      {
        name: "consultor_conhecimento",
        scale: "five",
        q: {
          pt: "O consultor demonstrou domínio técnico de SEO (on-page, técnico, conteúdo, backlinks)?",
          en: "Did the consultant show technical SEO mastery (on-page, technical, content, backlinks)?",
        },
        capLow: { pt: "Insuficiente", en: "Insufficient" },
        capHigh: { pt: "Muito sólido", en: "Very solid" },
      },
      {
        name: "consultor_interesse",
        scale: "five",
        q: {
          pt: "O consultor demonstrou interesse genuíno em compreender as necessidades do seu negócio?",
          en: "Did the consultant show genuine interest in understanding your business needs?",
        },
        capLow: { pt: "Nenhum", en: "None" },
        capHigh: { pt: "Muito genuíno", en: "Very genuine" },
      },
    ],
  },
  {
    key: "execucao",
    tag: "05",
    title: { pt: "Execução do trabalho", en: "Execution" },
    questions: [
      {
        name: "execucao_prazos",
        scale: "five",
        q: {
          pt: "As tarefas combinadas (auditorias, otimizações, conteúdo, backlinks) foram entregues nos prazos?",
          en: "Were the agreed tasks (audits, optimisations, content, backlinks) delivered on time?",
        },
        capLow: { pt: "Nunca", en: "Never" },
        capHigh: { pt: "Sempre", en: "Always" },
      },
      {
        name: "execucao_qualidade",
        scale: "five",
        q: {
          pt: "A qualidade do conteúdo e das otimizações técnicas foi consistente?",
          en: "Was the quality of the content and technical optimisations consistent?",
        },
        capLow: { pt: "Inconsistente", en: "Inconsistent" },
        capHigh: { pt: "Muito consistente", en: "Very consistent" },
      },
    ],
  },
  {
    key: "global",
    tag: "06",
    title: { pt: "Avaliação global", en: "Overall" },
    questions: [
      {
        name: "nps",
        scale: "nps",
        q: {
          pt: "Numa escala de 0 a 10, qual a probabilidade de nos recomendar como consultor de SEO?",
          en: "On a scale of 0 to 10, how likely are you to recommend us as an SEO consultant?",
        },
        capLow: { pt: "Nada provável", en: "Not at all likely" },
        capHigh: { pt: "Extremamente provável", en: "Extremely likely" },
      },
    ],
  },
];

/** All rated question names, in order — the 13 answers a submission needs. */
export const NPS_QUESTION_NAMES: string[] = NPS_SECTIONS.flatMap((s) =>
  s.questions.map((q) => q.name),
);

const QUESTION_BY_NAME: Record<string, NpsQuestion> = Object.fromEntries(
  NPS_SECTIONS.flatMap((s) => s.questions).map((q) => [q.name, q]),
);

/** Normalise a single answer to the 0–10 scale. */
export function normalizeAnswer(name: string, value: number): number {
  const q = QUESTION_BY_NAME[name];
  if (!q) return 0;
  if (q.scale === "nps") return clamp(value, 0, 10);
  // five-point → 0..10
  return (clamp(value, 1, 5) - 1) / 4 * 10;
}

export type NpsCategory = "promoter" | "passive" | "detractor";

export function npsCategory(nps: number): NpsCategory {
  if (nps >= 9) return "promoter";
  if (nps >= 7) return "passive";
  return "detractor";
}

export type NpsScores = {
  /** Mean of all 13 normalised answers, 0–10, 1 dp. */
  overall: number;
  /** Raw 0–10 "would you recommend" answer. */
  nps: number;
  category: NpsCategory;
  /** Per-section mean (0–10, 1 dp), keyed by section key. */
  sectionScores: Record<string, number>;
};

/** Compute all derived scores from a full answer map. */
export function computeNpsScores(answers: Record<string, number>): NpsScores {
  const sectionScores: Record<string, number> = {};
  const all: number[] = [];
  for (const section of NPS_SECTIONS) {
    const vals: number[] = [];
    for (const q of section.questions) {
      const raw = answers[q.name];
      if (typeof raw !== "number" || Number.isNaN(raw)) continue;
      const norm = normalizeAnswer(q.name, raw);
      vals.push(norm);
      all.push(norm);
    }
    if (vals.length) sectionScores[section.key] = round1(mean(vals));
  }
  const nps = clamp(Number(answers.nps) || 0, 0, 10);
  return {
    overall: all.length ? round1(mean(all)) : 0,
    nps,
    category: npsCategory(nps),
    sectionScores,
  };
}

/** Section title in the given language, keyed by section key. */
export function sectionTitle(key: string, lang: PublicLang): string {
  const s = NPS_SECTIONS.find((x) => x.key === key);
  return s ? s.title[lang] : key;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
