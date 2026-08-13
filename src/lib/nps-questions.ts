// Catalogue + scoring for the client satisfaction survey ("NPS quiz").
//
// This module is PURE (no KV, no React) so it can be imported by both the
// public quiz form (client component) and the server-side store/scoring.
//
// v3 (2026-07): the client first picks which Wonder Ads service(s) they're
// on, then which team members accompanied them, then rates each of those
// people individually (dynamic 0–10 per person). The three headline ratings
// (overall satisfaction, team performance, continuity) are 0–10.
//
// Scoring model:
//   • overall satisfaction (P1) and continuity (P7) are 0–10 and feed the
//     score directly.
//   • "team performance" = the mean of the per-person 0–10 ratings.
//   • the progress question (P3) is single-choice but scored (option carries
//     a 0–10 `score`).
//   • `overall` = mean of those four scored values (0–10, 1 dp).
//   • `nps` (headline) = continuity (P7), bucketed into NPS categories.
//   • everything else (multi-select, open text) is qualitative.

import type { PublicLang } from "@/lib/public-i18n";

type Bilingual = { pt: string; en: string };

/** Condição de visibilidade de uma pergunta: só aparece quando a pergunta
 *  `question` (multi ou single) tem pelo menos uma das opções `anyOf`.
 *
 *  Serve para o inquérito falar do que é DELE: quem só tem Ads não devia ser
 *  interrogado sobre indicadores de SEO orgânico, e quem só tem SEO não tem
 *  campanhas para avaliar. Perguntar na mesma dá respostas inventadas — que
 *  é pior do que não perguntar. */
export type NpsVisibleIf = { question: string; anyOf: string[] };

/** Campos comuns a todas as perguntas. */
type NpsCommon = {
  /** Ver NpsVisibleIf. Sem isto, a pergunta aparece sempre. */
  visibleIf?: NpsVisibleIf;
  /** REFORMADA: sai do formulário mas fica no catálogo.
   *
   *  Uma pergunta apagada leva consigo as respostas que já foram dadas — a
   *  página de resultados percorre este catálogo, e o que não está aqui
   *  deixa de ser mostrado ao consultor, mesmo estando gravado. Reformar em
   *  vez de apagar tira-a de quem responde a partir de hoje e mantém legível
   *  o que os clientes já responderam. */
  retired?: boolean;
};

/** O vocabulário que a etiqueta da escala usa a cada nota.
 *
 *  A escala 0–10 serve perguntas de naturezas diferentes, e a palavra tem de
 *  ser da natureza da pergunta: um 10 de CONTINUIDADE é «Certeza», não
 *  «Excecional» — a pergunta é sobre probabilidade, não sobre qualidade. */
export type NpsScaleWordSet = "quality" | "satisfaction" | "likelihood";

/** 0–10 rated question — feeds the score. */
export type NpsScale10Question = NpsCommon & {
  kind: "scale10";
  name: string;
  q: Bilingual;
  capLow: Bilingual;
  capHigh: Bilingual;
  /** Defaults to "quality". */
  words?: NpsScaleWordSet;
};

/** A dynamic 0–10 rating rendered once per person selected in `source`
 *  (a multi question). Answers are stored as `${name}__${personValue}`. */
export type NpsPersonScaleQuestion = NpsCommon & {
  kind: "personScale";
  name: string;
  /** Name of the multi question whose selected options are the people. */
  source: string;
  q: Bilingual;
  capLow: Bilingual;
  capHigh: Bilingual;
};

/** Uma caixa de texto POR PESSOA escolhida em `source`, com o nome dela
 *  dentro da pergunta.
 *
 *  Uma caixa só para toda a gente obrigava o cliente a escrever um parágrafo
 *  sobre três pessoas ao mesmo tempo — e o que saía era um elogio genérico
 *  que não servia a nenhuma delas. Com o nome na pergunta, o comentário fica
 *  colado à pessoa a quem diz respeito.
 *
 *  `{name}` no texto é substituído pelo nome. Respostas guardadas como
 *  `${name}__${personValue}` no mapa de textos. */
export type NpsPersonOpenQuestion = NpsCommon & {
  kind: "personOpen";
  name: string;
  source: string;
  /** Usa `{name}` como marcador do nome da pessoa. */
  q: Bilingual;
  placeholder?: Bilingual;
  /** Defaults to true — uma caixa por pessoa, todas obrigatórias. */
  required?: boolean;
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
 *  optionally `lettered` (A/B/C… badges). */
export type NpsSingleQuestion = NpsCommon & {
  kind: "single";
  name: string;
  q: Bilingual;
  options: NpsSingleOption[];
  scored?: boolean;
  lettered?: boolean;
  /** Defaults to true. */
  required?: boolean;
};

export type NpsMultiOption = {
  value: string;
  label: Bilingual;
  /** When true, selecting this option reveals a free-text "other" field. */
  other?: boolean;
  /** Retrato em `public/team/avatar/`, quando a pessoa tem foto publicada
   *  na página de equipa do wonder-ads.com. Sem foto fica a inicial — o
   *  site tem silhuetas genéricas para quem ainda não posou, e a mesma
   *  silhueta em duas pessoas diferentes confunde mais do que uma letra. */
  photo?: string;
};

/** "Select all that apply" question. NOT scored — qualitative only. */
export type NpsMultiQuestion = NpsCommon & {
  kind: "multi";
  name: string;
  q: Bilingual;
  hint?: Bilingual;
  options: NpsMultiOption[];
  /** Optional cap on how many options can be picked. */
  max?: number;
  /** When true, at least one option must be selected. */
  required?: boolean;
  /** When true, options show A/B/C… badges instead of check squares. */
  lettered?: boolean;
};

/** Free-text question. */
export type NpsOpenQuestion = NpsCommon & {
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
  | NpsPersonScaleQuestion
  | NpsPersonOpenQuestion
  | NpsSingleQuestion
  | NpsMultiQuestion
  | NpsOpenQuestion;

export const isScale10 = (q: NpsQuestion): q is NpsScale10Question =>
  q.kind === "scale10";
export const isPersonScale = (q: NpsQuestion): q is NpsPersonScaleQuestion =>
  q.kind === "personScale";
export const isPersonOpen = (q: NpsQuestion): q is NpsPersonOpenQuestion =>
  q.kind === "personOpen";
export const isSingle = (q: NpsQuestion): q is NpsSingleQuestion =>
  q.kind === "single";
export const isMulti = (q: NpsQuestion): q is NpsMultiQuestion =>
  q.kind === "multi";
export const isOpen = (q: NpsQuestion): q is NpsOpenQuestion =>
  q.kind === "open";

export type NpsSectionDef = {
  key: string;
  /** "01".."10" — shown as a mono tag in the quiz. */
  tag: string;
  title: Bilingual;
  questions: NpsQuestion[];
  /** Optional informational note for sections with no answerable questions. */
  note?: Bilingual;
  /** Nota alternativa para quem NÃO qualifica para o pedido de review
   *  (ver `qualifiesForGoogleReview`). Sem isto, a secção do testemunho
   *  prometia uma Google Review a um cliente insatisfeito. */
  noteAlt?: Bilingual;
};

// Quem o cliente pode dizer que o acompanhou. Escrita à mão de propósito:
// este módulo é importado pelo formulário que o CLIENTE abre, e
// credentials.ts leva hashes de password que não podem chegar ao bundle do
// browser.
//
// NEM TODA A GENTE DAQUI TEM LOGIN no workspace — a lista é de quem aparece
// à frente do cliente, e isso é mais gente do que quem tem conta. Manter a
// par da equipa quando alguém entra ou sai.
//
// NOME COMPLETO, SEMPRE. Do outro lado está um cliente que conhece as
// pessoas pelo nome por que se apresentaram, não pelo diminutivo interno:
// «Alex» ou «Germano C.» obriga-o a adivinhar de quem se trata.
//
// ⚠️ OS `value` SÃO A CHAVE DAS RESPOSTAS JÁ GRAVADAS. Os rótulos resolvem-se
// aqui a cada leitura (`personLabel`), por isso mudar um label acerta também
// o histórico; mudar um `value` deixava as respostas antigas órfãs.
const TEAM_OPTIONS: NpsMultiOption[] = [
  { value: "andre-pereira", label: { pt: "André Pereira", en: "André Pereira" } },
  { value: "manuel-s", label: { pt: "Manuel Silva", en: "Manuel Silva" } },
  { value: "fran-r", label: { pt: "Fran. Rosa", en: "Fran. Rosa" } },
  { value: "joao-b", label: { pt: "João Batista", en: "João Batista" } },
  {
    value: "germano-c",
    label: { pt: "Germano Cunha", en: "Germano Cunha" },
    photo: "/team/avatar/germano-c.jpg",
  },
  {
    value: "mike",
    label: { pt: "Mike Nobre", en: "Mike Nobre" },
    photo: "/team/avatar/mike.jpg",
  },
  {
    value: "gustavo",
    label: { pt: "Gustavo Rotini", en: "Gustavo Rotini" },
    photo: "/team/avatar/gustavo.jpg",
  },
  {
    value: "renan",
    label: { pt: "Renan Alves", en: "Renan Alves" },
    photo: "/team/avatar/renan.jpg",
  },
  {
    value: "cylas",
    label: { pt: "Cylas Tee", en: "Cylas Tee" },
    photo: "/team/avatar/cylas.jpg",
  },
  {
    value: "vasco-m",
    label: { pt: "Vasco Montez", en: "Vasco Montez" },
    photo: "/team/avatar/vasco-m.jpg",
  },
  { value: "joao-c", label: { pt: "João Có", en: "João Có" } },
  {
    value: "tiago-s",
    label: { pt: "Tiago Silveira", en: "Tiago Silveira" },
    photo: "/team/avatar/tiago-s.jpg",
  },
  {
    value: "andre",
    label: { pt: "André Pavlenco", en: "André Pavlenco" },
    photo: "/team/avatar/andre.jpg",
  },
  {
    value: "alex",
    label: { pt: "Alex Pavlenco", en: "Alex Pavlenco" },
    photo: "/team/avatar/alex.jpg",
  },
  {
    value: "alice",
    label: { pt: "Alice Santos", en: "Alice Santos" },
    photo: "/team/avatar/alice.jpg",
  },
];

/** Retrato de uma pessoa da equipa, ou null quando não tem foto publicada. */
export function personPhoto(source: string, value: string): string | null {
  return (
    getMultiQuestion(source)?.options.find((o) => o.value === value)?.photo ??
    null
  );
}

export const NPS_SECTIONS: NpsSectionDef[] = [
  {
    key: "servico",
    tag: "01",
    title: { pt: "Serviço", en: "Service" },
    questions: [
      {
        kind: "multi",
        name: "p0_servico",
        required: true,
        q: {
          pt: "Que serviço(s) da Wonder Ads estás a acompanhar connosco?",
          en: "Which Wonder Ads service(s) are you working with us on?",
        },
        hint: {
          pt: "Seleciona todas as opções aplicáveis.",
          en: "Select all that apply.",
        },
        options: [
          { value: "seo_geo", label: { pt: "Consultoria de SEO / GEO (orgânico e IAs)", en: "SEO / GEO consulting (organic & AI)" } },
          { value: "google_ads", label: { pt: "Consultoria de Google Ads", en: "Google Ads consulting" } },
          { value: "meta_ads", label: { pt: "Consultoria de Meta Ads (Facebook / Instagram)", en: "Meta Ads consulting (Facebook / Instagram)" } },
          { value: "crm", label: { pt: "Consultoria de CRM", en: "CRM consulting" } },
          { value: "web", label: { pt: "Consultoria de Web Design & Desenvolvimento", en: "Web Design & Development consulting" } },
          { value: "outro", label: { pt: "Outro", en: "Other" }, other: true },
        ],
      },
    ],
  },
  {
    key: "equipa",
    tag: "02",
    title: { pt: "Equipa", en: "Team" },
    questions: [
      {
        kind: "multi",
        name: "p_equipa",
        required: true,
        lettered: true,
        q: {
          pt: "Seleciona quem te acompanhou neste último período de 60 dias:",
          en: "Select who accompanied you over this last 60-day period:",
        },
        hint: {
          pt: "Podes escolher todas as pessoas que quiseres.",
          en: "Pick everyone who applies.",
        },
        options: TEAM_OPTIONS,
      },
    ],
  },
  {
    key: "desempenho",
    tag: "03",
    title: { pt: "Desempenho", en: "Performance" },
    questions: [
      {
        kind: "personScale",
        name: "p_desempenho",
        source: "p_equipa",
        q: {
          pt: "Qual foi o desempenho de cada pessoa que selecionaste?",
          en: "How would you rate each person you selected?",
        },
        capLow: { pt: "Fraco", en: "Poor" },
        capHigh: { pt: "Excelente", en: "Excellent" },
      },
      {
        kind: "personOpen",
        name: "p6_pessoa_feedback",
        source: "p_equipa",
        required: true,
        q: {
          pt: "O que mais valorizaste neste acompanhamento e o que poderia ser melhorado pelo/a {name}?",
          en: "What did you value most in this follow-up, and what could {name} improve?",
        },
        placeholder: { pt: "Escreve aqui…", en: "Write here…" },
      },
      {
        // Reformada em v76.68 — substituída pela caixa por pessoa acima. Fica
        // no catálogo para os inquéritos já respondidos continuarem legíveis
        // na ficha do cliente.
        kind: "open",
        name: "p6_consultor_feedback",
        retired: true,
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
    key: "satisfacao",
    tag: "04",
    title: { pt: "Satisfação", en: "Satisfaction" },
    questions: [
      {
        kind: "scale10",
        name: "p1_satisfacao",
        words: "satisfaction",
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
          { value: "outro", label: { pt: "Outro", en: "Other" }, other: true },
        ],
      },
    ],
  },
  {
    key: "progresso",
    tag: "05",
    title: { pt: "Progresso", en: "Progress" },
    questions: [
      {
        kind: "single",
        name: "p3_progresso",
        scored: true,
        q: {
          pt: "Sentes que houve progresso nos objetivos definidos no início da parceria?",
          en: "Do you feel there was progress on the goals set at the start of the partnership?",
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
    key: "resultados",
    tag: "06",
    title: { pt: "Resultados", en: "Results" },
    questions: [
      {
        // Só para quem tem campanhas connosco. Uma escala de satisfação com
        // Ads mostrada a um cliente só de SEO seria respondida à sorte.
        kind: "scale10",
        name: "p_ads_resultados",
        words: "satisfaction",
        visibleIf: { question: "p0_servico", anyOf: ["google_ads", "meta_ads"] },
        q: {
          pt: "Qual é o teu grau de satisfação com os resultados das campanhas de Ads da Wonder Ads?",
          en: "How satisfied are you with the results of Wonder Ads' ad campaigns?",
        },
        capLow: { pt: "Nada satisfeito", en: "Not at all satisfied" },
        capHigh: { pt: "Totalmente satisfeito", en: "Completely satisfied" },
      },
      {
        kind: "multi",
        name: "p8_indicadores",
        visibleIf: { question: "p0_servico", anyOf: ["seo_geo"] },
        q: {
          pt: "Que indicadores utilizas para avaliar o sucesso do nosso trabalho orgânico de SEO/GEO?",
          en: "Which indicators do you use to measure the success of our organic SEO/GEO work?",
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
          { value: "nao_uso", label: { pt: "Não uso indicadores infelizmente", en: "I don't track any indicators, unfortunately" } },
        ],
      },
      {
        // Reformada em v76.68 — sai do formulário, fica para o histórico.
        kind: "multi",
        name: "p9_acoes",
        retired: true,
        max: 5,
        q: {
          pt: "Das ações que fizemos por ti, quais sentes que tiveram maior impacto na tua faturação e na entrada de contactos/leads?",
          en: "Of the work we did for you, which do you feel had the biggest impact on your revenue and incoming leads/enquiries?",
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
    ],
  },
  {
    key: "continuidade",
    tag: "07",
    title: { pt: "Continuidade", en: "Continuity" },
    questions: [
      {
        kind: "scale10",
        name: "p7_continuidade",
        words: "likelihood",
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
    key: "servicos",
    tag: "08",
    title: { pt: "Serviços & acompanhamento", en: "Services & support" },
    questions: [
      {
        kind: "multi",
        name: "p11_apoio_adicional",
        q: {
          pt: "Há algum serviço ou apoio que sentes que te falta?",
          en: "Is there any service or support you feel you're missing?",
        },
        hint: { pt: "Seleciona todas as opções aplicáveis.", en: "Select all that apply." },
        options: [
          { value: "formacao_seo", label: { pt: "Formação adaptada à tua equipa", en: "Training for your team" } },
          { value: "consultoria_complementar", label: { pt: "Consultoria complementar (Ads, CRO, redes sociais)", en: "Complementary consulting (Ads, CRO, social)" } },
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
              pt: "Para clientes de Cascais e Grande Lisboa",
              en: "For clients in Cascais and Greater Lisbon",
            },
          },
        ],
      },
    ],
  },
  {
    key: "recomendacao",
    tag: "09",
    title: { pt: "Recomendação", en: "Recommendation" },
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
          { value: "conhecimento_tecnico", label: { pt: "Conhecimento técnico / especializado", en: "Technical / specialised knowledge" } },
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
          pt: "Que temas não abordámos mas gostarias que tivéssemos falado mais nos últimos tempos?",
          en: "Which topics did we not cover but you'd have liked us to discuss more lately?",
        },
        placeholder: { pt: "Escreve aqui…", en: "Write here…" },
      },
    ],
  },
  {
    key: "testemunho",
    tag: "10",
    title: { pt: "Testemunho", en: "Testimonial" },
    questions: [],
    note: {
      pt: "Estás quase a terminar! Depois de submeteres, no ecrã seguinte vais ter o link para deixares a tua Google Review — ajuda imenso quem está a considerar trabalhar connosco.",
      en: "Almost done! After you submit, the next screen will give you the link to leave your Google Review — it helps others considering working with us.",
    },
    noteAlt: {
      pt: "Estás quase a terminar! O que escreveste vai direto para a equipa que acompanha a tua conta — e o que apontaste como menos bom é exatamente por onde vamos começar.",
      en: "Almost done! What you wrote goes straight to the team looking after your account — and what you flagged as falling short is exactly where we'll start.",
    },
  },
];

/** Satisfação mínima (P1, 0–10) a partir da qual se pede a Google Review.
 *
 *  Pedir uma review pública a quem acabou de dar 4/10 é pedir uma review
 *  má — e, pior, soa a que não se leu o que a pessoa escreveu. Abaixo do
 *  limiar o formulário agradece e encaminha para a equipa em vez de pedir. */
export const GOOGLE_REVIEW_MIN_SATISFACTION = 7;

/** True quando o inquérito qualifica para o pedido de Google Review. */
export function qualifiesForGoogleReview(
  answers: Record<string, number>,
): boolean {
  const v = Number(answers["p1_satisfacao"]);
  return Number.isFinite(v) && v >= GOOGLE_REVIEW_MIN_SATISFACTION;
}

/** True quando a pergunta deve aparecer, dadas as escolhas até agora.
 *  Perguntas reformadas nunca aparecem. */
export function isQuestionVisible(
  q: NpsQuestion,
  choices: Record<string, string[]>,
): boolean {
  if (q.retired) return false;
  if (!q.visibleIf) return true;
  const picked = choices[q.visibleIf.question] ?? [];
  return q.visibleIf.anyOf.some((v) => picked.includes(v));
}

/** As secções que o cliente vai mesmo percorrer, dadas as escolhas dele.
 *  Uma secção cujas perguntas ficaram todas escondidas desaparece — um
 *  cartão vazio a dizer «Secção 6 de 10» é um beco sem saída. */
export function visibleSections(
  choices: Record<string, string[]>,
): NpsSectionDef[] {
  return NPS_SECTIONS.filter((s) => {
    const qs = s.questions.filter((q) => isQuestionVisible(q, choices));
    return qs.length > 0 || Boolean(s.note);
  });
}

/** O texto de uma pergunta por-pessoa, com `{name}` já substituído. */
export function personQuestionText(
  q: NpsPersonOpenQuestion,
  personName: string,
  lang: PublicLang,
): string {
  return q.q[lang].replace("{name}", personName);
}

/** A forma mínima de uma submissão — o suficiente para saber o que mostrar.
 *  Estrutural de propósito: assim este módulo continua sem importar o store
 *  (que puxa o KV) e serve tanto a ficha do cliente como o PDF. */
export type NpsAnswerBundle = {
  answers?: Record<string, number>;
  choices?: Record<string, string[]>;
  texts?: Record<string, string>;
};

/** True quando ESTA submissão traz alguma coisa para esta pergunta. */
export function hasAnswerFor(q: NpsQuestion, sub: NpsAnswerBundle): boolean {
  if (isScale10(q)) return typeof sub.answers?.[q.name] === "number";
  if (isPersonScale(q) || isPersonOpen(q)) {
    const prefix = `${q.name}__`;
    const pool = isPersonScale(q) ? sub.answers : sub.texts;
    return Object.keys(pool ?? {}).some((k) => k.startsWith(prefix));
  }
  if (isSingle(q) || isMulti(q)) return (sub.choices?.[q.name]?.length ?? 0) > 0;
  return Boolean(sub.texts?.[q.name]);
}

/** As perguntas de uma secção que fazem sentido mostrar sobre ESTA resposta.
 *
 *  Duas exclusões, por razões opostas:
 *   • REFORMADAS só aparecem se aquele cliente chegou a respondê-las — é
 *     exatamente para isso que continuam no catálogo. Numa resposta nova
 *     seriam uma linha «Sem resposta» a uma pergunta que já ninguém faz.
 *   • CONDICIONAIS que não se aplicavam ao serviço daquele cliente também
 *     saem: «Sem resposta» na satisfação com Ads, a um cliente só de SEO,
 *     lê-se como falha dele — quando a pergunta nunca lhe foi feita. */
export function questionsForSubmission(
  section: NpsSectionDef,
  sub: NpsAnswerBundle,
): NpsQuestion[] {
  return section.questions.filter((q) => {
    if (q.retired) return hasAnswerFor(q, sub);
    if (q.visibleIf) {
      return isQuestionVisible(q, sub.choices ?? {}) || hasAnswerFor(q, sub);
    }
    return true;
  });
}

// AS LISTAS ABAIXO SÃO O CONTRATO DE ESCRITA: alimentam a validação da
// submissão. Excluem as perguntas reformadas de propósito — uma pergunta que
// já ninguém vê não pode ser exigida a quem responde hoje (e uma reformada
// obrigatória bloquearia todas as submissões novas). O catálogo completo,
// esse, continua a servir a LEITURA na ficha do cliente.
const LIVE_QUESTIONS: NpsQuestion[] = NPS_SECTIONS.flatMap((s) =>
  s.questions.filter((q) => !q.retired),
);

/** 0–10 rated question names, in order (fixed scales only). */
export const NPS_SCALE_NAMES: string[] = LIVE_QUESTIONS.filter(isScale10).map(
  (q) => q.name,
);

/** Single-choice question names, in order. */
export const NPS_SINGLE_NAMES: string[] = LIVE_QUESTIONS.filter(isSingle).map(
  (q) => q.name,
);

/** Multi-select question names, in order. */
export const NPS_MULTI_NAMES: string[] = LIVE_QUESTIONS.filter(isMulti).map(
  (q) => q.name,
);

/** Open (free-text) question names, in order. */
export const NPS_OPEN_NAMES: string[] = LIVE_QUESTIONS.filter(isOpen).map(
  (q) => q.name,
);

/** Person-scale questions, in order. */
export const NPS_PERSON_SCALES: NpsPersonScaleQuestion[] =
  LIVE_QUESTIONS.filter(isPersonScale);

/** Person-open questions (uma caixa por pessoa), in order. */
export const NPS_PERSON_OPENS: NpsPersonOpenQuestion[] =
  LIVE_QUESTIONS.filter(isPersonOpen);

/** Every question a submission MUST carry to be complete (for progress +
 *  validation). Non-required multi-select is optional. */
export const NPS_REQUIRED_NAMES: string[] = LIVE_QUESTIONS.filter(
  (q) =>
    isScale10(q) ||
    isPersonScale(q) ||
    (isPersonOpen(q) && (q.required ?? true)) ||
    (isSingle(q) && (q.required ?? true)) ||
    (isOpen(q) && Boolean(q.required)) ||
    (isMulti(q) && Boolean(q.required)),
).map((q) => q.name);

/** Key under which a multi-select option's free-text "other" answer is
 *  stored, in the submission `texts` map. */
export function otherTextKey(questionName: string, optionValue: string): string {
  return `${questionName}__${optionValue}`;
}

/** Key under which a per-person 0–10 rating is stored, in `answers`. */
export function personScaleKey(questionName: string, personValue: string): string {
  return `${questionName}__${personValue}`;
}

/** All valid "other" text keys, derived from multi options flagged `other`. */
export const NPS_OTHER_KEYS: string[] = NPS_SECTIONS.flatMap((s) =>
  s.questions
    .filter(isMulti)
    .flatMap((q) =>
      q.options
        .filter((o) => o.other)
        .map((o) => otherTextKey(q.name, o.value)),
    ),
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

/** Display label for a person option value (from the source multi question). */
export function personLabel(
  source: string,
  value: string,
  lang: PublicLang,
): string {
  const src = getMultiQuestion(source);
  return src?.options.find((o) => o.value === value)?.label[lang] ?? value;
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
  /** Mean of the four scored values (satisfaction, team, continuity, progress). */
  overall: number;
  /** Continuity / loyalty answer (P7), 0–10 — the headline. */
  nps: number;
  category: NpsCategory;
  /** Overall satisfaction (P1), 0–10. */
  satisfaction: number;
  /** Team performance = mean of per-person ratings, 0–10. */
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
  const continuity = num("p7_continuidade");

  // Team performance = mean of every per-person rating.
  let team: number | null = null;
  const teamVals: number[] = [];
  for (const pq of NPS_PERSON_SCALES) {
    const prefix = `${pq.name}__`;
    for (const [k, v] of Object.entries(answers)) {
      if (k.startsWith(prefix) && Number.isFinite(Number(v))) {
        teamVals.push(clamp(Number(v), 0, 10));
      }
    }
  }
  if (teamVals.length) team = round1(mean(teamVals));

  // Progress: single-choice with a scored option.
  let progress: number | null = null;
  const progressPick = choices["p3_progresso"]?.[0];
  if (progressPick) {
    const opt = getSingleQuestion("p3_progresso")?.options.find(
      (o) => o.value === progressPick,
    );
    if (opt && typeof opt.score === "number") progress = clamp(opt.score, 0, 10);
  }

  const scored = [satisfaction, team, continuity, progress].filter(
    (v): v is number => v !== null,
  );
  const overall = scored.length ? round1(mean(scored)) : 0;
  const nps = continuity ?? 0;

  return {
    overall,
    nps,
    category: npsCategory(nps),
    satisfaction: satisfaction ?? 0,
    consultant: team ?? 0,
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
