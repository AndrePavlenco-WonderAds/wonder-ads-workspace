// Catalogue + scoring for the client SEO satisfaction survey ("NPS quiz").
//
// This module is PURE (no KV, no React) so it can be imported by both the
// public quiz form (client component) and the server-side store/scoring.
//
// v2 (2026-07): reworked to a richer, competitor-inspired survey. The three
// headline ratings are now a real 0–10 scale (NPS-style). The rest is a mix
// of single-choice, multi-select and open questions that colour the review
// without necessarily feeding the score.
//
// Scoring model:
//   • Three 0–10 ratings feed the score directly: overall satisfaction (P1),
//     consultant performance (P5) and continuity/loyalty (P7).
//   • The progress question (P3) is single-choice but scored: its option
//     carries a 0–10 `score` that also feeds the average.
//   • `overall` = mean of those four scored answers (0–10, 1 dp).
//   • `nps` (headline) = the continuity answer P7, bucketed into the classic
//     NPS categories (Promoter 9–10 · Passive 7–8 · Detractor 0–6).
//   • Everything else (multi-select, open text) is qualitative and never
//     moves the score.

import type { PublicLang } from "@/lib/public-i18n";

type Bilingual = { pt: string; en: string };

/** 0–10 rated question — feeds the score. */
export type NpsScale10Question = {
  kind: "scale10";
  name: string;
  q: Bilingual;
  capLow: Bilingual;
  capHigh: Bilingual;
};

export type NpsSingleOption = {
  value: string;
  label: Bilingual;
  /** 0–10 contribution when the parent question is `scored`. */
  score?: number;
  /** Small muted note shown under the option label. */
  note?: Bilingual;
};

/** Single-choice question. Optionally `scored` (via option.score) and
 *  optionally `lettered` (A/B/C… badges, like the competitor's A–E list). */
export type NpsSingleQuestion = {
  kind: "single";
  name: string;
  q: Bilingual;
  options: NpsSingleOption[];
  scored?: boolean;
  lettered?: boolean;
  /** Defaults to true. */
  required?: boolean;
};

export type NpsMultiOption = { value: string; label: Bilingual };

/** "Select all that apply" question. NOT scored — qualitative only. */
export type NpsMultiQuestion = {
  kind: "multi";
  name: string;
  q: Bilingual;
  hint?: Bilingual;
  options: NpsMultiOption[];
  /** Optional cap on how many options can be picked. */
  max?: number;
};

/** Free-text question. */
export type NpsOpenQuestion = {
  kind: "open";
  name: string;
  q: Bilingual;
  hint?: Bilingual;
  placeholder?: Bilingual;
  /** Defaults to false. */
  required?: boolean;
};

export type NpsQuestion =
  | NpsScale10Question
  | NpsSingleQuestion
  | NpsMultiQuestion
  | NpsOpenQuestion;

export const isScale10 = (q: NpsQuestion): q is NpsScale10Question =>
  q.kind === "scale10";
export const isSingle = (q: NpsQuestion): q is NpsSingleQuestion =>
  q.kind === "single";
export const isMulti = (q: NpsQuestion): q is NpsMultiQuestion =>
  q.kind === "multi";
export const isOpen = (q: NpsQuestion): q is NpsOpenQuestion =>
  q.kind === "open";

export type NpsSectionDef = {
  key: string;
  /** "01".."08" — shown as a mono tag in the quiz. */
  tag: string;
  title: Bilingual;
  questions: NpsQuestion[];
  /** Optional informational note for sections with no answerable questions
   *  (e.g. the closing testimonial step). */
  note?: Bilingual;
};

export const NPS_SECTIONS: NpsSectionDef[] = [
  {
    key: "satisfacao",
    tag: "01",
    title: { pt: "Satisfação", en: "Satisfaction" },
    questions: [
      {
        kind: "scale10",
        name: "p1_satisfacao",
        q: {
          pt: "Numa escala de 0 a 10, qual é o teu nível de satisfação geral com a Wonder Ads neste último período desde o último formulário que preencheste?",
          en: "On a scale of 0 to 10, how satisfied are you overall with Wonder Ads over this last period since the last form you filled in?",
        },
        capLow: { pt: "Nada satisfeito", en: "Not at all satisfied" },
        capHigh: { pt: "Totalmente satisfeito", en: "Completely satisfied" },
      },
      {
        kind: "multi",
        name: "p2_correu_bem",
        q: {
          pt: "O que correu particularmente bem neste período?",
          en: "What went particularly well this period?",
        },
        hint: {
          pt: "Seleciona todas as opções aplicáveis.",
          en: "Select all that apply.",
        },
        options: [
          {
            value: "acompanhamento_consultor",
            label: { pt: "Acompanhamento do consultor", en: "Consultant follow-up" },
          },
          {
            value: "clareza_relatorios",
            label: { pt: "Clareza dos relatórios e da informação", en: "Clear reporting & information" },
          },
          {
            value: "implementacao_recomendacoes",
            label: { pt: "Implementação das recomendações", en: "Implementation of recommendations" },
          },
          {
            value: "progressao_rankings",
            label: { pt: "Progressão de rankings e tráfego", en: "Rankings & traffic progress" },
          },
          {
            value: "ritmo_execucao",
            label: { pt: "Ritmo de execução do trabalho", en: "Pace of execution" },
          },
          {
            value: "clareza_proximos_passos",
            label: { pt: "Clareza dos próximos passos", en: "Clear next steps" },
          },
          {
            value: "conteudos_materiais",
            label: { pt: "Conteúdos e materiais entregues", en: "Content & materials delivered" },
          },
          { value: "outro", label: { pt: "Outro", en: "Other" } },
        ],
      },
    ],
  },
  {
    key: "progresso",
    tag: "02",
    title: { pt: "Progresso", en: "Progress" },
    questions: [
      {
        kind: "single",
        name: "p3_progresso",
        scored: true,
        q: {
          pt: "Sentes que houve progresso nos objetivos de SEO definidos no início da parceria?",
          en: "Do you feel there was progress on the SEO goals set at the start of the partnership?",
        },
        options: [
          { value: "muito", label: { pt: "Muito progresso", en: "A lot of progress" }, score: 10 },
          { value: "algum", label: { pt: "Algum progresso", en: "Some progress" }, score: 6.7 },
          { value: "pouco", label: { pt: "Pouco progresso", en: "Little progress" }, score: 3.3 },
          { value: "nenhum", label: { pt: "Ainda não houve progresso", en: "No progress yet" }, score: 0 },
        ],
      },
      {
        kind: "open",
        name: "p4_justifica",
        required: true,
        q: { pt: "Justifica a tua resposta.", en: "Please justify your answer." },
        placeholder: { pt: "Escreve aqui…", en: "Write here…" },
      },
    ],
  },
  {
    key: "consultor",
    tag: "03",
    title: { pt: "O teu consultor", en: "Your consultant" },
    questions: [
      {
        kind: "scale10",
        name: "p5_consultor",
        q: {
          pt: "Como avalias o desempenho do teu consultor de SEO?",
          en: "How would you rate the performance of your SEO consultant?",
        },
        capLow: { pt: "Fraco", en: "Poor" },
        capHigh: { pt: "Excelente", en: "Excellent" },
      },
      {
        kind: "open",
        name: "p6_consultor_feedback",
        required: true,
        q: {
          pt: "O que mais valorizaste neste acompanhamento e o que poderia ser melhorado?",
          en: "What did you value most in this follow-up, and what could be improved?",
        },
        placeholder: { pt: "Escreve aqui…", en: "Write here…" },
      },
    ],
  },
  {
    key: "continuidade",
    tag: "04",
    title: { pt: "Continuidade", en: "Continuity" },
    questions: [
      {
        kind: "scale10",
        name: "p7_continuidade",
        q: {
          pt: "Qual é a probabilidade de continuares a trabalhar com a Wonder Ads após o término do contrato atual?",
          en: "How likely are you to keep working with Wonder Ads after the current contract ends?",
        },
        capLow: { pt: "Nada provável", en: "Not at all likely" },
        capHigh: { pt: "Extremamente provável", en: "Extremely likely" },
      },
    ],
  },
  {
    key: "resultados",
    tag: "05",
    title: { pt: "Resultados & impacto", en: "Results & impact" },
    questions: [
      {
        kind: "multi",
        name: "p8_indicadores",
        q: {
          pt: "Que indicadores utilizas para avaliar o sucesso do nosso trabalho em conjunto?",
          en: "Which indicators do you use to measure the success of our work together?",
        },
        hint: {
          pt: "Seleciona todas as opções aplicáveis.",
          en: "Select all that apply.",
        },
        options: [
          { value: "trafego_organico", label: { pt: "Aumento de tráfego orgânico", en: "Organic traffic growth" } },
          { value: "rankings", label: { pt: "Subida de posições no Google (rankings)", en: "Higher Google rankings" } },
          { value: "leads", label: { pt: "Mais leads / contactos / pedidos de orçamento", en: "More leads / enquiries" } },
          { value: "vendas", label: { pt: "Aumento de vendas / faturação", en: "More sales / revenue" } },
          { value: "visibilidade_marca", label: { pt: "Visibilidade da marca (incl. IAs / GEO)", en: "Brand visibility (incl. AI / GEO)" } },
          { value: "menos_ads_pagos", label: { pt: "Menor dependência de anúncios pagos", en: "Less reliance on paid ads" } },
        ],
      },
      {
        kind: "multi",
        name: "p9_acoes",
        max: 5,
        q: {
          pt: "Quais foram as ações de SEO com maior impacto no desenvolvimento do teu negócio?",
          en: "Which SEO actions had the biggest impact on your business?",
        },
        hint: { pt: "Seleciona até 5 opções.", en: "Select up to 5 options." },
        options: [
          { value: "auditoria_tecnica", label: { pt: "Auditoria e correções técnicas do site", en: "Technical audit & fixes" } },
          { value: "on_page", label: { pt: "Otimização on-page (títulos, meta, conteúdo)", en: "On-page optimisation" } },
          { value: "conteudos", label: { pt: "Estratégia de conteúdos / blog", en: "Content strategy / blog" } },
          { value: "keyword_research", label: { pt: "Keyword research e mapeamento de intenções", en: "Keyword research & intent mapping" } },
          { value: "link_building", label: { pt: "Link building / autoridade do domínio", en: "Link building / domain authority" } },
          { value: "geo_ia", label: { pt: "Otimização para IAs / GEO (ChatGPT, Gemini…)", en: "AI / GEO optimisation" } },
          { value: "seo_local", label: { pt: "Google Business Profile / SEO local", en: "Google Business / local SEO" } },
          { value: "cwv_velocidade", label: { pt: "Velocidade e experiência (Core Web Vitals)", en: "Speed & Core Web Vitals" } },
          { value: "arquitetura", label: { pt: "Arquitetura e estrutura do site", en: "Site architecture & structure" } },
          { value: "metricas_objetivos", label: { pt: "Definição de métricas e objetivos claros", en: "Clear metrics & goals" } },
        ],
      },
      {
        kind: "open",
        name: "p10_acao_top",
        required: true,
        q: {
          pt: "Das ações acima, qual teve maior impacto no teu negócio?",
          en: "Of the actions above, which had the biggest impact on your business?",
        },
        placeholder: { pt: "Escreve aqui…", en: "Write here…" },
      },
    ],
  },
  {
    key: "servicos",
    tag: "06",
    title: { pt: "Serviços & acompanhamento", en: "Services & support" },
    questions: [
      {
        kind: "multi",
        name: "p11_apoio_adicional",
        q: {
          pt: "Há algum serviço ou tipo de apoio adicional que gostarias que disponibilizássemos?",
          en: "Is there any additional service or support you'd like us to offer?",
        },
        hint: { pt: "Seleciona todas as opções aplicáveis.", en: "Select all that apply." },
        options: [
          { value: "formacao_seo", label: { pt: "Formação em SEO adaptada à tua equipa", en: "SEO training for your team" } },
          { value: "consultoria_complementar", label: { pt: "Consultoria complementar (Google/Meta Ads, CRO, redes sociais)", en: "Complementary consulting (Ads, CRO, social)" } },
          { value: "mentoria_individual", label: { pt: "Mentoria individual", en: "One-on-one mentoring" } },
          { value: "apoio_ia", label: { pt: "Apoio com ferramentas de IA", en: "Support with AI tools" } },
          { value: "sessoes_qa", label: { pt: "Sessões de Q&A para esclarecer dúvidas", en: "Q&A sessions" } },
          { value: "networking_clientes", label: { pt: "Rede de networking com outros clientes Wonder Ads", en: "Networking with other Wonder Ads clients" } },
          { value: "reunioes_presenciais", label: { pt: "Reuniões / consultoria presencial", en: "In-person meetings / consulting" } },
        ],
      },
      {
        kind: "single",
        name: "p12_presencial",
        lettered: true,
        q: {
          pt: "Consideras que momentos presenciais poderiam acrescentar mais valor à tua parceria com a Wonder Ads?",
          en: "Do you think in-person moments could add more value to your Wonder Ads partnership?",
        },
        options: [
          { value: "nao", label: { pt: "Não vejo necessidade de momentos presenciais", en: "No need for in-person moments" } },
          { value: "um_parceria", label: { pt: "Sim, 1 momento presencial durante a parceria", en: "Yes, 1 in-person moment during the partnership" } },
          { value: "dois_parceria", label: { pt: "Sim, 2 momentos presenciais durante a parceria", en: "Yes, 2 in-person moments during the partnership" } },
          { value: "um_mes", label: { pt: "Sim, 1 momento presencial por mês", en: "Yes, 1 in-person moment per month" } },
          {
            value: "um_semana",
            label: { pt: "Sim, 1 momento presencial por semana", en: "Yes, 1 in-person moment per week" },
            note: {
              pt: "Para clientes de Cascais e Lisboa",
              en: "For clients in Cascais and Lisbon",
            },
          },
        ],
      },
    ],
  },
  {
    key: "recomendacao",
    tag: "07",
    title: { pt: "Recomendação & valor", en: "Recommendation & value" },
    questions: [
      {
        kind: "multi",
        name: "p14_valor",
        q: {
          pt: "Se nos recomendasses a outra empresa, o que destacarias como o nosso principal valor?",
          en: "If you recommended us to another company, what would you highlight as our main value?",
        },
        hint: { pt: "Seleciona todas as opções aplicáveis.", en: "Select all that apply." },
        options: [
          { value: "conhecimento_tecnico", label: { pt: "Conhecimento técnico / especializado em SEO", en: "Technical / specialised SEO knowledge" } },
          { value: "personalizacao", label: { pt: "Personalização e adaptação da estratégia", en: "Personalised, tailored strategy" } },
          { value: "acompanhamento_disponibilidade", label: { pt: "Acompanhamento e disponibilidade dos consultores", en: "Consultant follow-up & availability" } },
          { value: "resultados_concretos", label: { pt: "Resultados concretos (tráfego, rankings, leads)", en: "Concrete results (traffic, rankings, leads)" } },
          { value: "suporte_implementacao", label: { pt: "Suporte na implementação de soluções", en: "Support implementing solutions" } },
        ],
      },
      {
        kind: "open",
        name: "p15_temas_essenciais",
        required: true,
        q: {
          pt: "Que temas consideras essenciais terem sido abordados durante a parceria?",
          en: "Which topics do you consider essential to have covered during the partnership?",
        },
        placeholder: { pt: "Escreve aqui…", en: "Write here…" },
      },
    ],
  },
  {
    key: "testemunho",
    tag: "08",
    title: { pt: "Testemunho", en: "Testimonial" },
    questions: [],
    note: {
      pt: "Estás quase a terminar! Depois de submeteres, no ecrã seguinte vais ter o link para deixares a tua Google Review — ajuda imenso quem está a considerar trabalhar connosco.",
      en: "Almost done! After you submit, the next screen will give you the link to leave your Google Review — it helps others considering working with us.",
    },
  },
];

/** 0–10 rated question names, in order. */
export const NPS_SCALE_NAMES: string[] = NPS_SECTIONS.flatMap((s) =>
  s.questions.filter(isScale10).map((q) => q.name),
);

/** Single-choice question names, in order. */
export const NPS_SINGLE_NAMES: string[] = NPS_SECTIONS.flatMap((s) =>
  s.questions.filter(isSingle).map((q) => q.name),
);

/** Multi-select question names, in order. */
export const NPS_MULTI_NAMES: string[] = NPS_SECTIONS.flatMap((s) =>
  s.questions.filter(isMulti).map((q) => q.name),
);

/** Open (free-text) question names, in order. */
export const NPS_OPEN_NAMES: string[] = NPS_SECTIONS.flatMap((s) =>
  s.questions.filter(isOpen).map((q) => q.name),
);

/** Every question a submission MUST carry to be complete (for progress +
 *  validation): all 0–10 ratings, all single-choice, and required opens.
 *  Multi-select is always optional. */
export const NPS_REQUIRED_NAMES: string[] = NPS_SECTIONS.flatMap((s) =>
  s.questions
    .filter(
      (q) =>
        isScale10(q) ||
        (isSingle(q) && (q.required ?? true)) ||
        (isOpen(q) && Boolean(q.required)),
    )
    .map((q) => q.name),
);

function findQuestion(name: string): NpsQuestion | null {
  for (const s of NPS_SECTIONS) {
    for (const q of s.questions) if (q.name === name) return q;
  }
  return null;
}

export function getMultiQuestion(name: string): NpsMultiQuestion | null {
  const q = findQuestion(name);
  return q && isMulti(q) ? q : null;
}

export function getSingleQuestion(name: string): NpsSingleQuestion | null {
  const q = findQuestion(name);
  return q && isSingle(q) ? q : null;
}

export function getQuestion(name: string): NpsQuestion | null {
  return findQuestion(name);
}

/** Headline / score maximum — everything is out of 10. */
export const NPS_MAX = 10;

/** Colour bucket for a 0–10 score (green ≥8 · amber ≥6 · red <6). */
export function npsScoreColor(v: number): string {
  if (v >= 8) return "#34d399";
  if (v >= 6) return "#fbbf24";
  return "#fb7185";
}

export type NpsCategory = "promoter" | "passive" | "detractor";

/** Classic NPS bucket off the 0–10 continuity answer:
 *  Promoter 9–10 · Passive 7–8 · Detractor 0–6. */
export function npsCategory(score: number): NpsCategory {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

export type NpsScores = {
  /** Mean of the four scored answers (P1, P5, P7, P3), 0–10, 1 dp. */
  overall: number;
  /** Continuity / loyalty answer (P7), 0–10 — the headline. */
  nps: number;
  category: NpsCategory;
  /** Overall satisfaction (P1), 0–10. */
  satisfaction: number;
  /** Consultant performance (P5), 0–10. */
  consultant: number;
  /** Progress (P3) mapped to 0–10, or null if unanswered. */
  progress: number | null;
};

export type ScoreInput = {
  answers: Record<string, number>;
  choices?: Record<string, string[]>;
};

/** Compute derived scores from a submission's answers + choices. */
export function computeNpsScores(input: ScoreInput): NpsScores {
  const { answers, choices = {} } = input;
  const num = (name: string): number | null => {
    const v = Number(answers[name]);
    return Number.isFinite(v) ? clamp(v, 0, 10) : null;
  };

  const satisfaction = num("p1_satisfacao");
  const consultant = num("p5_consultor");
  const continuity = num("p7_continuidade");

  // Progress: single-choice with a scored option.
  let progress: number | null = null;
  const progressPick = choices["p3_progresso"]?.[0];
  if (progressPick) {
    const opt = getSingleQuestion("p3_progresso")?.options.find(
      (o) => o.value === progressPick,
    );
    if (opt && typeof opt.score === "number") progress = clamp(opt.score, 0, 10);
  }

  const scored = [satisfaction, consultant, continuity, progress].filter(
    (v): v is number => v !== null,
  );
  const overall = scored.length ? round1(mean(scored)) : 0;
  const nps = continuity ?? 0;

  return {
    overall,
    nps,
    category: npsCategory(nps),
    satisfaction: satisfaction ?? 0,
    consultant: consultant ?? 0,
    progress,
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
