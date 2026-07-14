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

/** A 1–5 rated question — the default, and the only kind that feeds the
 *  scoring averages. */
export type NpsScaleQuestion = {
  kind?: "scale";
  /** Form field name — stable, matches the source HTML. */
  name: string;
  scale: NpsScaleKind;
  q: Bilingual;
  capLow: Bilingual;
  capHigh: Bilingual;
};

export type NpsMultiOption = { value: string; label: Bilingual };

/** A qualitative "select all that apply" question. NOT scored — it colours
 *  the review with what the client attributes impact to, but never moves
 *  the satisfaction average. */
export type NpsMultiQuestion = {
  kind: "multi";
  name: string;
  q: Bilingual;
  /** Helper line under the question (e.g. "select all that apply"). */
  hint?: Bilingual;
  options: NpsMultiOption[];
};

export type NpsQuestion = NpsScaleQuestion | NpsMultiQuestion;

export function isMultiQuestion(q: NpsQuestion): q is NpsMultiQuestion {
  return (q as NpsMultiQuestion).kind === "multi";
}

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
      {
        kind: "multi",
        name: "resultados_impacto",
        q: {
          pt: "Diria que o investimento em SEO teve impacto direto em:",
          en: "Would you say the SEO investment had a direct impact on:",
        },
        hint: {
          pt: "Selecione todas as opções que se aplicam.",
          en: "Select all that apply.",
        },
        options: [
          {
            value: "leads_quality",
            label: { pt: "Melhor qualidade de leads", en: "Better lead quality" },
          },
          {
            value: "visibility",
            label: { pt: "Mais visibilidade", en: "More visibility" },
          },
          {
            value: "market_position",
            label: {
              pt: "Melhor posicionamento no mercado",
              en: "Better market positioning",
            },
          },
          {
            value: "sales",
            label: {
              pt: "Mais vendas / conversões",
              en: "More sales / conversions",
            },
          },
          {
            value: "no_impact",
            label: { pt: "Ainda sem impacto claro", en: "No clear impact yet" },
          },
        ],
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
    title: { pt: "O seu consultor", en: "Your consultant" },
    questions: [
      {
        name: "consultor_profissionalismo",
        scale: "five",
        q: {
          pt: "Como avalia o profissionalismo do seu consultor dedicado?",
          en: "How would you rate the professionalism of your dedicated consultant?",
        },
        capLow: { pt: "Fraco", en: "Poor" },
        capHigh: { pt: "Excelente", en: "Excellent" },
      },
      {
        name: "consultor_conhecimento",
        scale: "five",
        q: {
          pt: "O seu consultor demonstrou domínio técnico de SEO (on-page, técnico, conteúdo, backlinks)?",
          en: "Did your consultant show technical SEO mastery (on-page, technical, content, backlinks)?",
        },
        capLow: { pt: "Insuficiente", en: "Insufficient" },
        capHigh: { pt: "Muito sólido", en: "Very solid" },
      },
      {
        name: "consultor_interesse",
        scale: "five",
        q: {
          pt: "O seu consultor demonstrou interesse genuíno em compreender as necessidades do seu negócio?",
          en: "Did your consultant show genuine interest in understanding your business needs?",
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
        scale: "five",
        q: {
          pt: "De 1 a 5, qual a probabilidade de recomendar a nossa agência a um colega ou parceiro de negócio?",
          en: "From 1 to 5, how likely are you to recommend our agency to a colleague or business partner?",
        },
        capLow: { pt: "Nada provável", en: "Not at all likely" },
        capHigh: { pt: "Extremamente provável", en: "Extremely likely" },
      },
    ],
  },
];

/** Rated (1–5) question names, in order — the answers a submission must
 *  carry. Multi-select questions are excluded (they're optional + qualitative). */
export const NPS_QUESTION_NAMES: string[] = NPS_SECTIONS.flatMap((s) =>
  s.questions.filter((q) => !isMultiQuestion(q)).map((q) => q.name),
);

/** Multi-select (qualitative) question names. */
export const NPS_MULTI_NAMES: string[] = NPS_SECTIONS.flatMap((s) =>
  s.questions.filter(isMultiQuestion).map((q) => q.name),
);

/** Look up a multi-select question definition by name. */
export function getMultiQuestion(name: string): NpsMultiQuestion | null {
  for (const s of NPS_SECTIONS) {
    for (const q of s.questions) {
      if (q.name === name && isMultiQuestion(q)) return q;
    }
  }
  return null;
}

/** Every answer sits on the same 1–5 scale the client actually marks —
 *  there is no rescaling to 0–10. All derived scores are shown out of 5. */
export const NPS_MAX = 5;

/** Shared colour bucket for a 0–5 score (green ≥4 · amber ≥3 · red <3). */
export function npsScoreColor(v: number): string {
  if (v >= 4) return "#34d399";
  if (v >= 3) return "#fbbf24";
  return "#fb7185";
}

export type NpsCategory = "promoter" | "passive" | "detractor";

/** Recommendation category off the 1–5 "would you recommend" answer:
 *  5 = Promoter, 4 = Passive, ≤3 = Detractor. */
export function npsCategory(recommend: number): NpsCategory {
  if (recommend >= 4.5) return "promoter";
  if (recommend >= 3.5) return "passive";
  return "detractor";
}

export type NpsScores = {
  /** Mean of all 13 answers, 0–5, 1 dp. */
  overall: number;
  /** The 1–5 "would you recommend" answer (headline recommendation). */
  nps: number;
  category: NpsCategory;
  /** Per-section mean (0–5, 1 dp), keyed by section key. */
  sectionScores: Record<string, number>;
};

/** Compute all derived scores from a full answer map. All values are the
 *  raw 1–5 marks the client made, averaged — nothing is rescaled. */
export function computeNpsScores(answers: Record<string, number>): NpsScores {
  const sectionScores: Record<string, number> = {};
  const all: number[] = [];
  for (const section of NPS_SECTIONS) {
    const vals: number[] = [];
    for (const q of section.questions) {
      if (isMultiQuestion(q)) continue; // qualitative — never scored
      const raw = answers[q.name];
      if (typeof raw !== "number" || Number.isNaN(raw)) continue;
      const v = clamp(raw, 1, 5);
      vals.push(v);
      all.push(v);
    }
    if (vals.length) sectionScores[section.key] = round1(mean(vals));
  }
  const nps = clamp(Number(answers.nps) || 0, 1, 5);
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
