// WonderAds Consultants Onboarding University — catálogo da formação interna.
//
// Estrutura: track → módulos → aulas (+ 1 teste por módulo). Módulo puro (sem
// KV, sem React) para que o hub do consultor, o overview do admin e o CMS
// importem exatamente a mesma verdade.
//
// PORQUÊ CONTEÚDO EM CÓDIGO: o workspace não tem base de dados relacional —
// a persistência é Vercel KV. Seguimos o padrão já provado no curso de
// onboarding de clientes (`onboarding-lessons.ts` + `onboarding-content-store`):
// o default vive aqui, o CMS grava um override em KV, e um override inválido
// nunca consegue brickar a formação (cai-se sempre para este ficheiro).
//
// ⚠️ OS `id` SÃO SLUGS FIXOS, NUNCA DERIVADOS DO ÍNDICE. O progresso de cada
// consultor é guardado por id de aula; se os ids mudassem ao reordenar ou
// renomear uma aula no CMS, o progresso de toda a gente evaporava-se.
//
// Vídeos ainda por gravar ficam com `videoUrl: null` — aparecem como
// "Brevemente" ao consultor, não bloqueiam a progressão, e saltam à vista no
// checklist de gravação do admin.

/** Tipo de vídeo de uma aula. */
export const LESSON_TYPES = ["formacao", "scenario", "call_real"] as const;
export type TrainingLessonType = (typeof LESSON_TYPES)[number];

export const LESSON_TYPE_LABEL: Record<TrainingLessonType, string> = {
  formacao: "Formação",
  scenario: "Scenario",
  call_real: "Call real",
};

/** Minutos assumidos por tipo quando a aula não traz `estMinutes`. */
const DEFAULT_MINUTES: Record<TrainingLessonType, number> = {
  formacao: 12,
  scenario: 8,
  call_real: 15,
};

export const VIDEO_PROVIDERS = ["youtube", "vimeo", "loom", "file"] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export const QUESTION_TYPES = [
  "multiple_choice",
  "multi_select",
  "true_false",
  "open_text",
] as const;
export type TrainingQuestionType = (typeof QUESTION_TYPES)[number];

export type TrainingQuestionOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type TrainingQuestion = {
  id: string;
  prompt: string;
  type: TrainingQuestionType;
  order: number;
  points: number;
  /** Vazio para `open_text`. */
  options: TrainingQuestionOption[];
  /** Explicação mostrada na correção, depois de submeter. */
  explanation?: string | null;
};

export type TrainingQuiz = {
  id: string;
  title: string;
  /** Percentagem mínima para passar. Default 80. */
  passingScore: number;
  /** null = tentativas ilimitadas. */
  maxAttempts: number | null;
  shuffleQuestions: boolean;
  questions: TrainingQuestion[];
};

export type TrainingLesson = {
  id: string;
  title: string;
  description: string;
  order: number;
  type: TrainingLessonType;
  /** Quem grava e aparece no vídeo. null = por atribuir. */
  presenter: string | null;
  /** URL de embed. null enquanto não estiver gravado. */
  videoUrl: string | null;
  videoProvider: VideoProvider | null;
  /** Estimativa em minutos; ausente → default por tipo. */
  estMinutes?: number;
  isPublished: boolean;
};

export type TrainingModule = {
  id: string;
  title: string;
  description: string;
  order: number;
  /** Agrupador opcional (ex.: "Service Delivery" nos módulos de ADS). */
  section: string | null;
  lessons: TrainingLesson[];
  quiz: TrainingQuiz;
};

export type TrainingTrack = {
  slug: string;
  name: string;
  description: string;
  order: number;
  /** A track comum é obrigatória para toda a gente e desbloqueia as outras. */
  isCommon: boolean;
  modules: TrainingModule[];
};

/** Slugs das tracks de especialização, pela ordem em que aparecem no admin. */
export const SPECIALIZATION_SLUGS = [
  "seo-geo",
  "ads",
  "web",
  "comercial",
] as const;
export type SpecializationSlug = (typeof SPECIALIZATION_SLUGS)[number];

export const COMMON_TRACK_SLUG = "comum";

// ---------------------------------------------------------------------------
// Helpers de construção do seed — mantêm o ficheiro legível sem abdicar dos
// ids explícitos (cada aula recebe o seu id à mão).
// ---------------------------------------------------------------------------

type LessonSeed = {
  id: string;
  title: string;
  description: string;
  type?: TrainingLessonType;
  presenter?: string | null;
  estMinutes?: number;
};

function lessons(seeds: LessonSeed[]): TrainingLesson[] {
  return seeds.map((s, i) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    order: i + 1,
    type: s.type ?? "formacao",
    presenter: s.presenter ?? null,
    videoUrl: null,
    videoProvider: null,
    ...(s.estMinutes ? { estMinutes: s.estMinutes } : {}),
    isPublished: true,
  }));
}

/** Teste vazio de um módulo — as perguntas chegam na Fase 2 e são editáveis
 *  no CMS. Um teste sem perguntas não bloqueia a progressão (mesma regra dos
 *  vídeos por gravar) e aparece sinalizado no admin. */
function emptyQuiz(moduleId: string, title: string): TrainingQuiz {
  return {
    id: `${moduleId}-quiz`,
    title,
    passingScore: 80,
    maxAttempts: null,
    shuffleQuestions: false,
    questions: [],
  };
}

// ---------------------------------------------------------------------------
// 1 · CATEGORIA COMUM — obrigatória para toda a equipa
// ---------------------------------------------------------------------------

const COMMON_TRACK: TrainingTrack = {
  slug: COMMON_TRACK_SLUG,
  name: "Fundações WonderAds",
  description:
    "Obrigatória para toda a equipa, independentemente do departamento. O propósito da empresa, como nasceu, o mindset que se espera de quem cá trabalha, o objetivo e como lá queremos chegar.",
  order: 1,
  isCommon: true,
  modules: [
    {
      id: "comum-m1",
      title: "A WonderAds: origem, visão e mindset",
      description:
        "De onde viemos, para onde vamos e o nível de exigência que isso implica no dia a dia.",
      order: 1,
      section: null,
      lessons: lessons([
        {
          id: "comum-m1-a1",
          title: "Porque é que começámos a WonderAds",
          description:
            "Vídeo de boas-vindas: a origem da empresa, os princípios core e os valores que nos guiam. O que nos fez começar e o que continuamos a recusar fazer.",
          presenter: "Alice / Alex",
        },
        {
          id: "comum-m1-a2",
          title: "Visão, Missão e Valores",
          description:
            "Os objetivos da empresa e como pretendemos lá chegar. O que significa cada valor traduzido em comportamento concreto — não em poster de parede.",
          presenter: "Alice / Alex",
        },
        {
          id: "comum-m1-a3",
          title: "Mindset / Cultura de Excelência",
          description:
            "O mindset diário e o profissionalismo perante clientes. O padrão é ser o melhor consultor que aquele cliente já teve — este vídeo explica o que isso exige de ti.",
          presenter: "Alice",
        },
      ]),
      quiz: emptyQuiz("comum-m1", "Teste — Origem, visão e mindset"),
    },
    {
      id: "comum-m2",
      title: "Como nos organizamos",
      description:
        "Organograma, quem desbloqueia o quê, as ferramentas que usamos e como se dá feedback dentro da equipa.",
      order: 2,
      section: null,
      lessons: lessons([
        {
          id: "comum-m2-a1",
          title: "Quem Contactar para Cada Assunto",
          description:
            "Organograma, departamentos e quem desbloqueia o quê. Saber a quem perguntar é metade da velocidade de execução.",
          presenter: "André",
        },
        {
          id: "comum-m2-a2",
          title: "Tecnologia (todos os softwares que utilizamos)",
          description:
            "Tour por todas as ferramentas da casa: workspace, comunicação, gestão de projeto e as plataformas de cada departamento.",
          presenter: "Alice / Alex / André",
        },
        {
          id: "comum-m2-a3",
          title: "Como dar feedback aos diferentes membros da equipa",
          description:
            "Como se dá e como se recebe feedback aqui dentro, consoante a pessoa e o contexto. Feedback que não se diz é um problema que fica.",
          presenter: "André",
        },
      ]),
      quiz: emptyQuiz("comum-m2", "Teste — Organização e ferramentas"),
    },
    {
      id: "comum-m3",
      title: "Cliente e oportunidades",
      description:
        "Como se comunica com um cliente em qualquer momento da parceria e como se identifica e encaminha uma oportunidade.",
      order: 3,
      section: null,
      lessons: lessons([
        {
          id: "comum-m3-a1",
          title: "Comunicação geral com o cliente",
          description:
            "Tom, tempos e canais de resposta. Como dar más notícias sem perder a relação, como escalar e a quem.",
          presenter: "Alex",
        },
        {
          id: "comum-m3-a2",
          title: "Deteção de oportunidades",
          description:
            "Todos os consultores devem saber identificar upsell e passá-lo ao Comercial ou ao superior in charge. SEO, WEB e ADS passam ao responsável; comerciais que vejam outras portas passam aos C-Level.",
          presenter: "Alex",
        },
      ]),
      quiz: emptyQuiz("comum-m3", "Teste — Cliente e oportunidades"),
    },
  ],
};

// ---------------------------------------------------------------------------
// 2a · SEO/GEO
// ---------------------------------------------------------------------------

const SEO_TRACK: TrainingTrack = {
  slug: "seo-geo",
  name: "Consultor SEO/GEO",
  description:
    "Protocolos SEO, ferramentas, comunicação, gestão de tempo, registo de horas e reuniões-tipo. No fim desta trilha sabes comunicar com o cliente em qualquer momento da parceria e conduzir uma conta do onboarding ao relatório mensal.",
  order: 2,
  isCommon: false,
  modules: [
    {
      id: "seo-m1",
      title: "Como trabalhamos internamente",
      description:
        "Protocolos SEO da casa, gestão de tempo, registo de horas e as reuniões-tipo de um consultor.",
      order: 1,
      section: null,
      lessons: lessons([
        {
          id: "seo-m1-a1",
          title: "Como trabalhamos internamente",
          description:
            "Os protocolos internos do departamento de SEO: o que se faz, por que ordem, em quanto tempo e onde fica registado.",
          presenter: "André",
        },
      ]),
      quiz: emptyQuiz("seo-m1", "Teste — Trabalho interno SEO"),
    },
    {
      id: "seo-m2",
      title: "Comunicação com o cliente",
      description:
        "Como se fala com o cliente em cada momento da parceria — com calls reais e roleplays para ouvires o padrão.",
      order: 2,
      section: null,
      lessons: lessons([
        {
          id: "seo-m2-a1",
          title: "Comunicação com o cliente",
          description:
            "O consultor tem de saber comunicar com o cliente em qualquer momento da parceria. Tom, cadência, o que se diz e o que nunca se promete.",
          presenter: "André",
        },
        {
          id: "seo-m2-a2",
          title: "Call real — onboarding pendente, sem sessão de estratégia",
          description:
            "Gravação real do André a ligar a um cliente que tinha o onboarding pendente e ainda não tinha feito a sessão de estratégia para contar como dia 1.",
          type: "call_real",
          presenter: "André",
        },
        {
          id: "seo-m2-a3",
          title: "Call real — documentos pendentes na tabela de aprovações",
          description:
            "Gravação real do André a ligar a um cliente sobre documentos pendentes na tabela de aprovações.",
          type: "call_real",
          presenter: "André",
        },
        {
          id: "seo-m2-a4",
          title: "Roleplays de chamadas telefónicas",
          description:
            "Gravação do André e de outros consultores a fazer roleplays de chamadas telefónicas — os cenários que mais se repetem na carteira.",
          type: "scenario",
          presenter: "André",
        },
      ]),
      quiz: emptyQuiz("seo-m2", "Teste — Comunicação com o cliente"),
    },
    {
      id: "seo-m3",
      title: "Overview das Ferramentas",
      description:
        "As ferramentas do consultor SEO e como se usam ao vivo num roadmap e num artigo.",
      order: 3,
      section: null,
      lessons: lessons([
        {
          id: "seo-m3-a1",
          title: "Overview das Ferramentas",
          description:
            "Tour pelas ferramentas de SEO da casa e pelo que cada uma resolve.",
          presenter: "André",
        },
        {
          id: "seo-m3-a2",
          title: "Roleplay com as ferramentas — roadmap e artigo ao vivo",
          description:
            "Gravação real do André em roleplay com as ferramentas: fazer ao vivo um roadmap e um artigo de blog.",
          type: "scenario",
          presenter: "André",
        },
      ]),
      quiz: emptyQuiz("seo-m3", "Teste — Ferramentas"),
    },
    {
      id: "seo-m4",
      title: "Onboarding de um cliente novo",
      description:
        "O pré-onboarding, a reunião de onboarding e o que é entregue depois.",
      order: 4,
      section: null,
      lessons: lessons([
        {
          id: "seo-m4-a1",
          title: "O que preparar quando um novo cliente dá onboard",
          description:
            "O pré-onboarding, a reunião de onboarding e o que é entregue ao cliente depois. Chegar a uma reunião de onboarding sem isto preparado custa a confiança dos primeiros 30 dias.",
          presenter: "André",
        },
        {
          id: "seo-m4-a2",
          title: "Reunião real de onboarding com um cliente novo",
          description:
            "Vídeo de exemplo de uma reunião real de onboarding com um cliente novo, do início ao fim.",
          type: "call_real",
          presenter: "André",
        },
      ]),
      quiz: emptyQuiz("seo-m4", "Teste — Onboarding de cliente"),
    },
    {
      id: "seo-m5",
      title: "Reporting e reunião mensal",
      description:
        "Como se constrói o relatório e como se apresenta um mês bom — e um mês mau.",
      order: 5,
      section: null,
      lessons: lessons([
        {
          id: "seo-m5-a1",
          title: "Reporting e reunião mensal",
          description:
            "Como se constrói o relatório mensal e como se apresenta. Inclui o caso difícil: apresentar um mês mau sem perder a conta.",
          presenter: "André",
        },
        {
          id: "seo-m5-a2",
          title: "Reunião mensal real — dados e trabalho apresentados ao cliente",
          description:
            "Gravação de uma reunião mensal com apresentação de dados e do trabalho feito ao cliente.",
          type: "call_real",
          presenter: "André",
        },
      ]),
      quiz: emptyQuiz("seo-m5", "Teste — Reporting e reunião mensal"),
    },
  ],
};

// ---------------------------------------------------------------------------
// 2b · ADS
// ---------------------------------------------------------------------------

const ADS_TRACK: TrainingTrack = {
  slug: "ads",
  name: "Consultor ADS",
  description:
    "Protocolos Ads, ferramentas, comunicação, gestão de tempo, registo de horas e reuniões-tipo, mais o currículo completo de Service Delivery — dos fundamentos às estratégias avançadas.",
  order: 3,
  isCommon: false,
  modules: [
    {
      id: "ads-m1",
      title: "Ads Department Overview",
      description:
        "Como funciona o departamento de Ads: responsabilidades, cadência e o que se espera de um consultor.",
      order: 1,
      section: null,
      lessons: lessons([
        {
          id: "ads-m1-a1",
          title: "Ads Department Overview",
          description:
            "Visão geral do departamento de Ads — protocolos, ferramentas, comunicação, gestão de tempo, registo de horas e reuniões-tipo.",
          presenter: "Alice",
        },
      ]),
      quiz: emptyQuiz("ads-m1", "Teste — Ads Department Overview"),
    },
    {
      id: "ads-m2",
      title: "Fundamentals",
      description:
        "As bases da entrega: onboarding, fundamentos de Facebook Ads, tracking, funis, criativos, estrutura de campanha e reporting.",
      order: 2,
      section: "Service Delivery",
      lessons: lessons([
        {
          id: "ads-m2-a1",
          title: "Kick Off & Onboarding Call",
          description: "A primeira call com o cliente e o que sai dela.",
        },
        {
          id: "ads-m2-a2",
          title: "Facebook Ad Fundamentals",
          description: "Os fundamentos da plataforma antes de tocar em budget.",
        },
        {
          id: "ads-m2-a3",
          title: "Facebook Hygiene & Avoiding Bans",
          description:
            "Higiene de conta e como evitar bans — o que custa uma conta bloqueada a meio de uma campanha.",
        },
        {
          id: "ads-m2-a4",
          title: "All About Tracking",
          description: "Tracking de ponta a ponta: sem isto, nada do resto é medível.",
        },
        {
          id: "ads-m2-a5",
          title: "Funnels & Offer Fundamentals",
          description: "Funis e oferta — porque é que a oferta ganha à criatividade.",
        },
        {
          id: "ads-m2-a6",
          title: "Crafting That Converts",
          description: "Como se constrói o que converte, do copy ao formato.",
        },
        {
          id: "ads-m2-a7",
          title: "VAULT — Over The Shoulder Creation",
          description: "Criação ao vivo, por cima do ombro, do início ao fim.",
        },
        {
          id: "ads-m2-a8",
          title: "Science Behind Creatives That Sell",
          description: "A ciência por trás dos criativos que vendem.",
        },
        {
          id: "ads-m2-a9",
          title: "How Many Things: Campaign Structure",
          description: "Estrutura de campanha — quantas coisas, e porquê.",
        },
        {
          id: "ads-m2-a10",
          title: "Reporting 101",
          description: "O reporting mínimo que qualquer conta tem de ter.",
        },
        {
          id: "ads-m2-a11",
          title: "Communication Schedule & Keeping Clients In The Loop",
          description:
            "Cadência de comunicação e como manter o cliente no loop sem o afogar em detalhe.",
        },
      ]),
      quiz: emptyQuiz("ads-m2", "Teste — Fundamentals"),
    },
    {
      id: "ads-m3",
      title: "How To Advertise",
      description:
        "Audiências, lançamento, testes, budgets e leitura de dashboard.",
      order: 3,
      section: "Service Delivery",
      lessons: lessons([
        {
          id: "ads-m3-a1",
          title: "Traffic Warmth",
          description: "Frio, morno e quente — e o que muda em cada um.",
        },
        {
          id: "ads-m3-a2",
          title: "Interests — Sizes and How To Find The Best Ones For Your Case",
          description: "Interesses: tamanhos e como encontrar os melhores para o caso.",
        },
        {
          id: "ads-m3-a3",
          title:
            "Custom Audiences, Exclusions and Combinations — What Is Worth It?",
          description: "Audiências personalizadas, exclusões e combinações que valem a pena.",
        },
        {
          id: "ads-m3-a4",
          title: "Lookalike Audiences — How To And The Best Ones You Can Create",
          description: "Lookalikes: como se criam e quais compensam.",
        },
        {
          id: "ads-m3-a5",
          title: "Launching Your First Ad",
          description: "O lançamento do primeiro anúncio, passo a passo.",
        },
        {
          id: "ads-m3-a6",
          title: "How To Test Audiences & Find Winners",
          description: "Como testar audiências e encontrar vencedores.",
        },
        {
          id: "ads-m3-a7",
          title: "Load Balancing Budgets",
          description: "Balanceamento de budgets entre conjuntos.",
        },
        {
          id: "ads-m3-a8",
          title: "Utilising CBOs",
          description: "Quando e como usar CBOs.",
        },
        {
          id: "ads-m3-a9",
          title: "The Two King Metrics And Their Math",
          description: "As duas métricas-rei e a matemática por trás delas.",
        },
        {
          id: "ads-m3-a10",
          title: "How To Read Your Dashboard For Cold",
          description: "Como ler o dashboard em tráfego frio.",
        },
        {
          id: "ads-m3-a11",
          title: "Re-targeting 101",
          description: "As bases do retargeting.",
        },
      ]),
      quiz: emptyQuiz("ads-m3", "Teste — How To Advertise"),
    },
    {
      id: "ads-m4",
      title: "Local Businesses or Lead Gen",
      description:
        "Negócios locais e geração de leads: funis, conteúdo, automação e casos por indústria.",
      order: 4,
      section: "Service Delivery",
      lessons: lessons([
        {
          id: "ads-m4-a1",
          title: "Core Concepts To Keep In Mind",
          description: "Os conceitos que não se largam em lead gen.",
        },
        {
          id: "ads-m4-a2",
          title: "9 Funnels For Lead Gen & How To Set Them Up",
          description: "Nove funis de lead gen e como montá-los.",
        },
        {
          id: "ads-m4-a3",
          title: "Facebook Native Vs Funnel Lead Gen",
          description: "Formulário nativo vs funil próprio — o trade-off real.",
        },
        {
          id: "ads-m4-a4",
          title: "Content & Creatives",
          description: "Conteúdo e criativos para negócios locais.",
        },
        {
          id: "ads-m4-a5",
          title: "Automate Lead Flow For The Client",
          description: "Automatizar o fluxo de leads do lado do cliente.",
        },
        {
          id: "ads-m4-a6",
          title: "Industry Specific — Gyms",
          description: "Caso específico: ginásios.",
        },
        {
          id: "ads-m4-a7",
          title: "Industry Specific — Chiropractors",
          description: "Caso específico: quiropraxia.",
        },
      ]),
      quiz: emptyQuiz("ads-m4", "Teste — Local Businesses & Lead Gen"),
    },
    {
      id: "ads-m5",
      title: "Advanced Strategies",
      description:
        "O interior da plataforma, automações, escalar e Google Ads.",
      order: 5,
      section: "Service Delivery",
      lessons: lessons([
        {
          id: "ads-m5-a1",
          title: "How Facebook Works On The Inside",
          description: "Como o Facebook funciona por dentro.",
        },
        {
          id: "ads-m5-a2",
          title: "Facebook Rules, Automations & Naming Conventions",
          description: "Regras, automações e convenções de nomenclatura.",
        },
        {
          id: "ads-m5-a3",
          title: "Scaling Horizontally vs Scaling Vertically",
          description: "Escalar na horizontal vs na vertical.",
        },
        {
          id: "ads-m5-a4",
          title: "Google Ads Training",
          description: "Formação de Google Ads.",
        },
      ]),
      quiz: emptyQuiz("ads-m5", "Teste — Advanced Strategies"),
    },
  ],
};

// ---------------------------------------------------------------------------
// 2c · WEB
// ---------------------------------------------------------------------------

const WEB_TRACK: TrainingTrack = {
  slug: "web",
  name: "Consultor WEB",
  description:
    "Protocolos Web, ferramentas, comunicação, gestão de tempo, registo de horas e reuniões-tipo — do trabalho interno à entrega e aprovação do site com o cliente.",
  order: 4,
  isCommon: false,
  modules: [
    {
      id: "web-m1",
      title: "Como trabalhamos internamente no WEB",
      description:
        "Protocolos do departamento Web, ferramentas, gestão de tempo e registo de horas.",
      order: 1,
      section: null,
      lessons: lessons([
        {
          id: "web-m1-a1",
          title: "Como trabalhamos internamente no WEB",
          description:
            "Os protocolos internos do departamento Web: fluxo de trabalho, ferramentas, gestão de tempo, registo de horas e reuniões-tipo.",
          presenter: "André",
        },
      ]),
      quiz: emptyQuiz("web-m1", "Teste — Trabalho interno WEB"),
    },
    {
      id: "web-m2",
      title: "Como o website deve ser entregue",
      description: "O padrão de entrega de um site — o que sai daqui e em que estado.",
      order: 2,
      section: null,
      lessons: lessons([
        {
          id: "web-m2-a1",
          title: "Como o website deve ser entregue",
          description:
            "O standard de entrega: o que tem de estar feito, testado e documentado antes de um site ir para o cliente.",
          presenter: "André",
        },
      ]),
      quiz: emptyQuiz("web-m2", "Teste — Entrega do website"),
    },
    {
      id: "web-m3",
      title: "Aprovação de designs",
      description:
        "Como se pede aprovação e como se conduz uma call de feedback de design.",
      order: 3,
      section: null,
      lessons: lessons([
        {
          id: "web-m3-a1",
          title: "Como pedimos ao cliente para aprovar designs",
          description:
            "O processo de aprovação de designs: o que se envia, como se enquadra e como se fecha a decisão.",
          presenter: "André",
        },
        {
          id: "web-m3-a2",
          title: "Call real — aprovação de design e feedback com cliente web",
          description:
            "Gravação real do André numa chamada de aprovação de design/feedback com um cliente web.",
          type: "call_real",
          presenter: "André",
        },
      ]),
      quiz: emptyQuiz("web-m3", "Teste — Aprovação de designs"),
    },
  ],
};

// ---------------------------------------------------------------------------
// 2d · COMERCIAL
// ---------------------------------------------------------------------------

const COMMERCIAL_TRACK: TrainingTrack = {
  slug: "comercial",
  name: "Comercial",
  description:
    "Protocolos comerciais, ferramentas, comunicação, gestão de tempo, registo de horas e reuniões-tipo — da prospeção à assinatura e ao follow-up.",
  order: 5,
  isCommon: false,
  modules: [
    {
      id: "com-m1",
      title: "Sales Department Overview",
      description:
        "Como funciona o departamento comercial: responsabilidades, cadência e o que se espera de um comercial.",
      order: 1,
      section: null,
      lessons: lessons([
        {
          id: "com-m1-a1",
          title: "Sales Department Overview",
          description:
            "Visão geral do departamento comercial — protocolos, ferramentas, comunicação, gestão de tempo, registo de horas e reuniões-tipo.",
          presenter: "Alex",
        },
      ]),
      quiz: emptyQuiz("com-m1", "Teste — Sales Department Overview"),
    },
    {
      id: "com-m2",
      title: "Finding Leads & Setting Meetings",
      description: "Prospeção, qualificação e organização do pipeline.",
      order: 2,
      section: null,
      lessons: lessons([
        {
          id: "com-m2-a1",
          title: "Laws Of Outreach",
          description: "As leis do outreach — o que funciona e o que queima listas.",
        },
        {
          id: "com-m2-a2",
          title: "Finding Leads & Qualifying",
          description: "Encontrar leads e qualificá-las antes de gastar tempo.",
        },
        {
          id: "com-m2-a3",
          title: "Storing & Organising Leads",
          description: "Onde ficam as leads e como se mantêm organizadas.",
        },
      ]),
      quiz: emptyQuiz("com-m2", "Teste — Leads e reuniões"),
    },
    {
      id: "com-m3",
      title: "Sales & Follow-Up",
      description:
        "Frameworks de venda, scripts, objeções e afinação contínua da abordagem.",
      order: 3,
      section: null,
      lessons: lessons([
        {
          id: "com-m3-a1",
          title: "The Cardinal Sins of Sales",
          description: "Os pecados capitais da venda.",
        },
        {
          id: "com-m3-a2",
          title: "Sales Sub-Communication",
          description: "Sub-comunicação: o que se diz sem dizer.",
        },
        {
          id: "com-m3-a3",
          title: "1 Call vs 2 Call Frameworks",
          description: "Fechar numa call ou em duas — quando usar cada um.",
        },
        {
          id: "com-m3-a4",
          title: "1CC Sales Script",
          description: "O script de venda de uma call.",
        },
        {
          id: "com-m3-a5",
          title: "2CC Sales Script",
          description: "O script de venda de duas calls.",
        },
        {
          id: "com-m3-a6",
          title: "The Objection Obscenity",
          description: "Objeções: como se tratam sem entrar em combate.",
        },
        {
          id: "com-m3-a7",
          title: "Refining Approach & Sharpening Saw",
          description: "Afinar a abordagem e manter a serra afiada.",
        },
      ]),
      quiz: emptyQuiz("com-m3", "Teste — Venda e follow-up"),
    },
  ],
};

/** Catálogo por defeito — a verdade quando não há override em KV. */
export const DEFAULT_TRAINING_TRACKS: TrainingTrack[] = [
  COMMON_TRACK,
  SEO_TRACK,
  ADS_TRACK,
  WEB_TRACK,
  COMMERCIAL_TRACK,
];

// ---------------------------------------------------------------------------
// Helpers de leitura
// ---------------------------------------------------------------------------

export function lessonMinutes(lesson: TrainingLesson): number {
  return lesson.estMinutes ?? DEFAULT_MINUTES[lesson.type] ?? 10;
}

export function findTrack(
  tracks: TrainingTrack[],
  slug: string,
): TrainingTrack | null {
  return tracks.find((t) => t.slug === slug) ?? null;
}

export function commonTrack(tracks: TrainingTrack[]): TrainingTrack | null {
  return tracks.find((t) => t.isCommon) ?? null;
}

export function allLessons(track: TrainingTrack): TrainingLesson[] {
  return track.modules.flatMap((m) => m.lessons);
}

/** Aulas efetivamente disponíveis — as que já têm vídeo e estão publicadas.
 *  São estas (e só estas) que contam para desbloquear o módulo seguinte. */
export function availableLessons(module: TrainingModule): TrainingLesson[] {
  return module.lessons.filter((l) => l.isPublished && Boolean(l.videoUrl));
}

export function findLessonInTrack(
  track: TrainingTrack,
  lessonId: string,
): { module: TrainingModule; lesson: TrainingLesson } | null {
  for (const m of track.modules) {
    const lesson = m.lessons.find((l) => l.id === lessonId);
    if (lesson) return { module: m, lesson };
  }
  return null;
}

export function findModuleInTrack(
  track: TrainingTrack,
  moduleId: string,
): TrainingModule | null {
  return track.modules.find((m) => m.id === moduleId) ?? null;
}

/** Aula → track, procurando em todo o catálogo. Usado pelo endpoint de
 *  progresso para validar que o id existe mesmo antes de gravar. */
export function locateLesson(
  tracks: TrainingTrack[],
  lessonId: string,
): { track: TrainingTrack; module: TrainingModule; lesson: TrainingLesson } | null {
  for (const track of tracks) {
    const hit = findLessonInTrack(track, lessonId);
    if (hit) return { track, ...hit };
  }
  return null;
}

/** Todas as pessoas que aparecem como presenter no catálogo (para filtros do
 *  checklist de gravação no admin). */
export function presentersInCatalog(tracks: TrainingTrack[]): string[] {
  const set = new Set<string>();
  for (const t of tracks) {
    for (const m of t.modules) {
      for (const l of m.lessons) {
        if (l.presenter) set.add(l.presenter);
      }
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt"));
}

// ---------------------------------------------------------------------------
// Normalização — o override de KV nunca é confiado às cegas. Qualquer
// estrutura inválida devolve null e o chamador cai para o default.
// ---------------------------------------------------------------------------

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
const bool = (v: unknown, fallback = false): boolean =>
  typeof v === "boolean" ? v : fallback;
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

function normalizeOption(raw: unknown, i: number): TrainingQuestionOption | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const text = str(o.text).trim();
  if (!text) return null;
  return {
    id: str(o.id) || `opt-${i + 1}`,
    text,
    isCorrect: bool(o.isCorrect),
  };
}

function normalizeQuestion(raw: unknown, i: number): TrainingQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const prompt = str(o.prompt).trim();
  if (!prompt) return null;
  const type = (QUESTION_TYPES as readonly string[]).includes(str(o.type))
    ? (o.type as TrainingQuestionType)
    : "multiple_choice";
  const options =
    type === "open_text"
      ? []
      : (Array.isArray(o.options) ? o.options : [])
          .map(normalizeOption)
          .filter((x): x is TrainingQuestionOption => x !== null);
  // Uma pergunta de escolha sem opções — ou sem nenhuma correta — não é
  // corrigível; descartá-la é melhor do que deixá-la reprovar toda a gente.
  if (type !== "open_text" && !options.some((op) => op.isCorrect)) return null;
  return {
    id: str(o.id) || `q-${i + 1}`,
    prompt,
    type,
    order: num(o.order, i + 1),
    points: Math.max(1, num(o.points, 1)),
    options,
    explanation: typeof o.explanation === "string" ? o.explanation : null,
  };
}

function normalizeQuiz(raw: unknown, moduleId: string): TrainingQuiz {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawMax = o.maxAttempts;
  return {
    id: str(o.id) || `${moduleId}-quiz`,
    title: str(o.title) || "Teste do módulo",
    passingScore: Math.min(100, Math.max(1, num(o.passingScore, 80))),
    maxAttempts:
      typeof rawMax === "number" && Number.isFinite(rawMax) && rawMax > 0
        ? Math.floor(rawMax)
        : null,
    shuffleQuestions: bool(o.shuffleQuestions),
    questions: (Array.isArray(o.questions) ? o.questions : [])
      .map(normalizeQuestion)
      .filter((x): x is TrainingQuestion => x !== null),
  };
}

function normalizeLesson(raw: unknown, i: number): TrainingLesson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id).trim();
  const title = str(o.title).trim();
  if (!id || !title) return null;
  const type = (LESSON_TYPES as readonly string[]).includes(str(o.type))
    ? (o.type as TrainingLessonType)
    : "formacao";
  const videoUrl = str(o.videoUrl).trim() || null;
  const provider = (VIDEO_PROVIDERS as readonly string[]).includes(
    str(o.videoProvider),
  )
    ? (o.videoProvider as VideoProvider)
    : null;
  const est = o.estMinutes;
  return {
    id,
    title,
    description: str(o.description),
    order: num(o.order, i + 1),
    type,
    presenter: str(o.presenter).trim() || null,
    videoUrl,
    videoProvider: videoUrl ? (provider ?? detectProvider(videoUrl)) : null,
    ...(typeof est === "number" && Number.isFinite(est) && est > 0
      ? { estMinutes: Math.round(est) }
      : {}),
    isPublished: bool(o.isPublished, true),
  };
}

function normalizeModule(raw: unknown, i: number): TrainingModule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id).trim();
  const title = str(o.title).trim();
  if (!id || !title) return null;
  return {
    id,
    title,
    description: str(o.description),
    order: num(o.order, i + 1),
    section: str(o.section).trim() || null,
    lessons: (Array.isArray(o.lessons) ? o.lessons : [])
      .map(normalizeLesson)
      .filter((x): x is TrainingLesson => x !== null),
    quiz: normalizeQuiz(o.quiz, id),
  };
}

function normalizeTrack(raw: unknown, i: number): TrainingTrack | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const slug = str(o.slug).trim();
  const name = str(o.name).trim();
  if (!slug || !name) return null;
  return {
    slug,
    name,
    description: str(o.description),
    order: num(o.order, i + 1),
    isCommon: bool(o.isCommon),
    modules: (Array.isArray(o.modules) ? o.modules : [])
      .map(normalizeModule)
      .filter((x): x is TrainingModule => x !== null),
  };
}

/** Valida um catálogo vindo de KV / do CMS. Devolve null quando é inutilizável
 *  (não é array, sem tracks válidas, ou sem track comum) — nesse caso o
 *  chamador usa DEFAULT_TRAINING_TRACKS. */
export function normalizeCatalog(raw: unknown): TrainingTrack[] | null {
  if (!Array.isArray(raw)) return null;
  const tracks = raw
    .map(normalizeTrack)
    .filter((x): x is TrainingTrack => x !== null);
  if (!tracks.length) return null;
  // Sem track comum não há regra de desbloqueio possível — recusar.
  if (!tracks.some((t) => t.isCommon)) return null;
  // Ids de aula duplicados partiriam o tracking de progresso (duas aulas a
  // partilhar a mesma entrada). Recusar em vez de guardar algo ambíguo.
  const seen = new Set<string>();
  for (const t of tracks) {
    for (const m of t.modules) {
      for (const l of m.lessons) {
        if (seen.has(l.id)) return null;
        seen.add(l.id);
      }
    }
  }
  return tracks.sort((a, b) => a.order - b.order);
}

/** Adivinha o provider a partir do URL — usado quando o CMS só recebe o link. */
export function detectProvider(url: string): VideoProvider | null {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("vimeo.com")) return "vimeo";
  if (u.includes("loom.com")) return "loom";
  if (/\.(mp4|webm|ogg|mov)(\?|$)/.test(u)) return "file";
  return null;
}
