// WonderAds Consultants University — catálogo da formação interna.
//
// Estrutura: módulo (track) → capítulos → aulas (+ 1 quiz por capítulo).
// Ficheiro puro (sem
// KV, sem React) para que o hub do consultor, o Superadmin e o CMS
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
//
// A Especialização SEO/GEO segue um documento de especificação
// (docs/formacao/especializacao-seo-geo.md): 11 módulos, 54 aulas e 272
// perguntas. O banco de perguntas é gerado desse documento por
// scripts/formacao/build-seo-geo-questions.mjs; os ids de módulo e de aula
// daqui têm de bater com os do script.

import { TRAINING_QUESTIONS } from "@/lib/training/questions";

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

/** Ficheiro ou link que acompanha a aula («anexar por baixo do vídeo»). Um
 *  `url` relativo (/ficheiro.pdf) é um ficheiro nosso e descarrega-se; um URL
 *  externo abre noutro separador. */
export type TrainingAttachment = {
  label: string;
  url: string;
};

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
  /** Aula que a pergunta avalia (id de uma aula do mesmo módulo). É
   *  informativo — o CMS e o admin mostram-no; a correção não depende dele. */
  lessonId?: string | null;
  /** True quando a resposta marcada é a mais provável mas ainda não foi
   *  confirmada pelo C-Level (o documento original não a tinha marcada). O
   *  CMS mostra o badge «a confirmar»; a pergunta conta na mesma para a nota.
   *  Confirmar = desligar isto no CMS. */
  needsReview?: boolean;
  /** O porquê da dúvida e a resposta assumida — acompanha `needsReview`. */
  reviewNote?: string | null;
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
  /** "Remember" — o que tem de ficar da aula, em frases curtas. Aparece ao
   *  lado do vídeo e é o que a pessoa relê antes do teste. Lista vazia é um
   *  estado legítimo (a aula ainda não foi destilada), não um erro. */
  keyPoints: string[];
  /** Documentos, ficheiros e links da aula. Ausente = sem anexos. */
  attachments?: TrainingAttachment[];
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
  /** O módulo comum é obrigatório para toda a gente e desbloqueia os outros. */
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
  videoUrl?: string;
  /** Pontos do "Remember". Omitir enquanto a aula não estiver destilada — a
   *  página mostra o estado vazio em vez de inventar conteúdo. */
  keyPoints?: string[];
  attachments?: TrainingAttachment[];
};

function lessons(seeds: LessonSeed[]): TrainingLesson[] {
  return seeds.map((s, i) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    order: i + 1,
    type: s.type ?? "formacao",
    presenter: s.presenter ?? null,
    videoUrl: s.videoUrl ?? null,
    videoProvider: s.videoUrl ? detectProvider(s.videoUrl) : null,
    ...(s.estMinutes ? { estMinutes: s.estMinutes } : {}),
    keyPoints: s.keyPoints ?? [],
    ...(s.attachments?.length ? { attachments: s.attachments } : {}),
    isPublished: true,
  }));
}

/** Teste de um módulo. As perguntas vivem em `questions.ts` (rascunhos a
 *  afinar quando os vídeos existirem) e são editáveis no CMS. Um módulo sem
 *  perguntas fica com o teste vazio — que não bloqueia a progressão, mesma
 *  regra dos vídeos por gravar, e aparece sinalizado no admin. */
function quizFor(moduleId: string, title: string): TrainingQuiz {
  return {
    id: `${moduleId}-quiz`,
    title,
    passingScore: 80,
    maxAttempts: null,
    shuffleQuestions: true,
    questions: TRAINING_QUESTIONS[moduleId] ?? [],
  };
}

// ---------------------------------------------------------------------------
// 1 · CATEGORIA COMUM — obrigatório para toda a equipa
// ---------------------------------------------------------------------------

const COMMON_TRACK: TrainingTrack = {
  slug: COMMON_TRACK_SLUG,
  name: "Cultura e Mindset WonderAds",
  description:
    "Obrigatório para toda a equipa, independentemente do departamento. O propósito da empresa, como nasceu, o mindset que se espera de quem cá trabalha, o objetivo e como lá queremos chegar.",
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
          keyPoints: [
            "A WonderAds nasceu de um problema concreto: agências que vendem relatórios em vez de resultados.",
            "O que recusamos fazer é tão definidor como o que fazemos — prometer posições, inflacionar métricas ou esconder um mês mau.",
            "O cliente contrata uma pessoa, não uma plataforma. O nome que ele associa ao serviço é o teu.",
          ],
        },
        {
          id: "comum-m1-a2",
          title: "Visão, Missão e Valores",
          description:
            "Os objetivos da empresa e como pretendemos lá chegar. O que significa cada valor traduzido em comportamento concreto — não em poster de parede.",
          presenter: "Alice / Alex",
          keyPoints: [
            "Um valor só existe se mudar uma decisão tua num dia difícil — se não muda, é decoração.",
            "A missão mede-se no resultado do cliente, não no volume de trabalho entregue.",
            "Crescer sem baixar o padrão: preferimos recusar um cliente a servir mal os que já temos.",
          ],
        },
        {
          id: "comum-m1-a3",
          title: "Mindset / Cultura de Excelência",
          description:
            "O mindset diário e o profissionalismo perante clientes. O padrão é ser o melhor consultor que aquele cliente já teve — este vídeo explica o que isso exige de ti.",
          presenter: "Alice",
          keyPoints: [
            "O padrão é simples de dizer e exigente de cumprir: ser o melhor consultor que aquele cliente já teve.",
            "Antecipar vale mais do que reagir — o cliente não devia ser o primeiro a notar um problema na conta dele.",
            "Erro assumido cedo é um contratempo; erro descoberto pelo cliente é uma quebra de confiança.",
          ],
        },
      ]),
      quiz: quizFor("comum-m1", "Quiz — Origem, visão e mindset"),
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
          keyPoints: [
            "Cada assunto tem um dono. Perguntar à pessoa certa à primeira poupa dias, não minutos.",
            "Escalar não é queixar-se: é passar um bloqueio a quem o pode desbloquear, com contexto suficiente para decidir.",
            "Ficar parado à espera é uma escolha — e é sempre a pior das disponíveis.",
          ],
        },
        {
          id: "comum-m2-a2",
          title: "Tecnologia (todos os softwares que utilizamos)",
          description:
            "Tour por todas as ferramentas da casa: workspace, comunicação, gestão de projeto e as plataformas de cada departamento.",
          presenter: "Alice / Alex / André",
          keyPoints: [
            "O Workspace é a fonte da verdade da conta: se não está lá registado, para a empresa não aconteceu.",
            "Cada ferramenta tem um propósito único — duplicar registos em sítios diferentes cria versões concorrentes da mesma verdade.",
            "Acessos de cliente pedem-se e guardam-se no sítio certo; nunca em mensagens soltas.",
          ],
        },
        {
          id: "comum-m2-a3",
          title: "Como dar feedback aos diferentes membros da equipa",
          description:
            "Como se dá e como se recebe feedback aqui dentro, consoante a pessoa e o contexto. Feedback que não se diz é um problema que fica.",
          presenter: "André",
          keyPoints: [
            "Feedback que não se diz não desaparece — acumula e sai pior mais tarde.",
            "Descreve o comportamento e o efeito concreto, não a pessoa.",
            "Elogia em público, corrige em privado, e nunca guardes uma correção para a avaliação seguinte.",
          ],
        },
      ]),
      quiz: quizFor("comum-m2", "Quiz — Organização e ferramentas"),
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
          keyPoints: [
            "Responder depressa vale mais do que responder completo: um «recebi, respondo até amanhã» fecha a ansiedade do cliente.",
            "Má notícia dá-se cedo, com o plano já ao lado — nunca só o problema.",
            "Não prometas o que não controlas. Compromete-te com o trabalho, não com o resultado do Google.",
          ],
        },
        {
          id: "comum-m3-a2",
          title: "Deteção de oportunidades",
          description:
            "Todos os consultores devem saber identificar upsell e passá-lo ao Comercial ou ao superior in charge. SEO, WEB e ADS passam ao responsável; comerciais que vejam outras portas passam aos C-Level.",
          presenter: "Alex",
          keyPoints: [
            "Uma oportunidade detetada e não passada é receita perdida — e um problema do cliente que fica por resolver.",
            "SEO, WEB e ADS passam ao responsável do departamento; o Comercial passa aos C-Level.",
            "Quem vende não és tu: o teu trabalho é sinalizar com contexto (o que viste e porque interessa ao cliente).",
          ],
        },
      ]),
      quiz: quizFor("comum-m3", "Quiz — Cliente e oportunidades"),
    },
  ],
};

// ---------------------------------------------------------------------------
// 2a · SEO/GEO
// ---------------------------------------------------------------------------
//
// ESTRUTURA (v77.46) — onze módulos, pela ordem em que as coisas acontecem a
// um consultor novo: primeiro o que é preciso para «funcionar» na WonderAds,
// depois as rotinas com o cliente, depois as situações difíceis, depois o
// trabalho técnico de SEO pela ordem em que acontece num projeto (auditoria e
// research → roadmap e onboarding → on-page → conteúdo → local → backlinks) e,
// por fim, o crescimento de conta, que exige domínio de todo o resto.
//
// FONTE: docs/formacao/especializacao-seo-geo.md — Bibl. 1 (33 vídeos),
// Bibl. 2 (22 entradas) e EXAM_QUIZ_QUESTIONS (272 perguntas). Cada aula é um
// vídeo; o quiz de cada módulo só usa perguntas dos vídeos desse módulo (o
// banco vive em `seo-geo-questions.ts`, gerado a partir do documento).
//
// IDS PRESERVADOS. As aulas que já existiam na arrumação anterior (v76.44)
// mantêm o id — é por ele que o progresso está guardado, e trocá-lo apagava o
// que a equipa já viu. As aulas novas recebem slugs descritivos, nunca o
// número do documento (1.3, 4.2…), para uma reordenação não as desligar.
//
// Três aulas ainda não têm vídeo (2.5, 4.2, 4.3): ficam `videoUrl: null`,
// aparecem como «Brevemente», não bloqueiam ninguém e não contam para a
// percentagem — a regra geral do catálogo.
//
// O vídeo «Postar GMB Post» (qO-XAuRbl_E) estava nas duas bibliotecas; fica
// uma vez só, no módulo de Local SEO.
// ---------------------------------------------------------------------------

const SEO_TRACK: TrainingTrack = {
  slug: "seo-geo",
  name: "Especialização SEO/GEO",
  description:
    "Onze módulos, do mindset e ferramentas internas até ao cross-sell e à renovação, pela ordem em que as coisas acontecem num projeto: o que é preciso para funcionar na WonderAds, as rotinas com o cliente, as situações difíceis, o trabalho técnico de SEO (auditoria → roadmap → on-page → conteúdo → local → backlinks) e, por fim, o crescimento de conta. Cada módulo termina com um quiz.",
  order: 2,
  isCommon: false,
  modules: [
    // -----------------------------------------------------------------------
    // 1 · Boas-vindas, Mindset e Ferramentas Internas
    // -----------------------------------------------------------------------
    {
      id: "seo-01-mindset",
      title: "Boas-vindas, Mindset e Ferramentas Internas",
      description:
        "O consultor percebe o que se espera dele, conhece os protocolos base e configura as ferramentas obrigatórias no primeiro dia.",
      order: 1,
      section: null,
      lessons: lessons([
        {
          // Era a aula de abertura do antigo capítulo «Mindset e primeira
          // reunião de parceria». Mesmo id, mesmo vídeo.
          id: "seo-m2-a1",
          title:
            "Bem-vindos ao Departamento de SEO e GEO │ Mindset de Consultor de SEO/GEO",
          description:
            "Como pensa quem é dono de uma conta: o que se assume, o que se pergunta, o que nunca se promete, e a diferença entre executar tarefas e responder pelo resultado do cliente.",
          presenter: "André",
          videoUrl: "https://youtu.be/rHyBzn8XUkE",
          keyPoints: [
            "Cadência combinada e cumprida vale mais do que contacto abundante e irregular.",
            "Traduz sempre o técnico para o negócio do cliente: não são impressões, são pessoas a encontrar-te.",
            "Nunca prometas posições nem prazos de indexação — compromete-te com o trabalho e com a data da próxima leitura.",
          ],
        },
        {
          id: "seo-cd-app",
          title: "Como utilizar a app interna",
          description:
            "A app do workspace de ponta a ponta: onde vive cada cliente, o que se regista, o que se gera e o que se envia para aprovação.",
          presenter: "André",
          videoUrl: "https://youtu.be/PIh_7uEJ-Sw",
        },
        {
          id: "seo-gmail-assinatura",
          title: "Como criar assinatura Gmail e aplicar",
          description:
            "A assinatura de email da casa, em português e em inglês, aplicada no Gmail da empresa desde o primeiro dia.",
          presenter: "André",
          videoUrl: "https://youtu.be/Dc5QNdWRCLc",
          attachments: [
            {
              label: "Borboleta Wonder Ads (imagem da assinatura)",
              url: "/wonder-ads-butterfly.png",
            },
          ],
          keyPoints: [
            "A assinatura existe em português E em inglês desde o primeiro dia — não é opcional, é responsabilidade tua.",
            "Leva email, nome, cargo, telefone, link de agendamento e logótipo; morada e dados empresariais ficam de fora.",
            "Não se inventa uma assinatura própria: usa-se o modelo da casa.",
          ],
        },
        {
          id: "seo-fathom",
          title: "Como instalar o Fathom e utilizar o mesmo",
          description:
            "Instalar o Fathom e gravar todas as reuniões — de equipa e com clientes — com a autorização certa.",
          presenter: "André",
          videoUrl: "https://youtu.be/0aJevETkcPc",
          keyPoints: [
            "O Fathom grava reuniões — todas, incluindo as de equipa e as de 15 minutos com clientes, e pede-se sempre autorização.",
            "É obrigatório para toda a gente: consultores, administração e web designers.",
            "Serve para nos proteger em caso de conflito e para formar colegas; a administração pode pedir gravações a qualquer momento.",
          ],
        },
        {
          id: "seo-agendar-reuniao",
          title:
            "Como agendar reunião com a equipa/André/Administração presente",
          description:
            "Onde se vê a disponibilidade de um colega e como se marca uma reunião sem atropelar a agenda de ninguém.",
          presenter: "André",
          videoUrl: "https://youtu.be/RDn6aFO_oiw",
          keyPoints: [
            "Antes de marcar, vê-se a agenda do colega no Google Calendar («Meet with…», do lado esquerdo) — mesmo quando é urgente.",
            "Evita-se a hora de almoço; nunca se marca às cegas.",
          ],
        },
        {
          id: "seo-pedido-ausencia",
          title: "Como fazer um pedido de ausência",
          description:
            "O protocolo de ausências: quando é preciso pedir, onde se pede e a partir de quando conta.",
          presenter: "André",
          videoUrl: "https://youtu.be/DcrZE67Lm80",
          keyPoints: [
            "Ausências acima de 30 minutos pedem-se na app, pelo protocolo — nunca pelo WhatsApp.",
            "O pedido só entra em efetivo depois de aceite por alguém da administração.",
            "Sem pedido aprovado, és responsável por estar disponível para reuniões, mensagens e chamadas no horário de trabalho.",
          ],
        },
      ]),
      quiz: quizFor("seo-01-mindset", "Quiz — Boas-vindas, mindset e ferramentas"),
    },

    // -----------------------------------------------------------------------
    // 2 · Rotinas de Reporting e Comunicação com o Cliente
    // -----------------------------------------------------------------------
    {
      id: "seo-02-reporting",
      title: "Rotinas de Reporting e Comunicação com o Cliente",
      description:
        "Dominar o ciclo diário → semanal → mensal de comunicação, o NPS e as surprise news.",
      order: 2,
      section: null,
      lessons: lessons([
        {
          id: "seo-cd-daily",
          title: "Como criar um Daily Update (interno)",
          description:
            "O update diário interno: o que entra, o que não entra, e para que serve a quem o lê depois.",
          presenter: "André",
          videoUrl: "https://youtu.be/53hU0LqoIhw",
        },
        {
          id: "seo-cd-weekly",
          title: "Como criar um Weekly Report (externo)",
          description:
            "O relatório semanal que vai para o cliente: o que se mostra, como se escreve e o que fica de fora.",
          presenter: "André",
          videoUrl: "https://youtu.be/btQ0c57SQV8",
        },
        {
          id: "seo-m5-a1",
          title: "Como criar um Monthly Report (pela app)",
          description:
            "Como se constrói o relatório mensal na app: que dados entram, o que é automático, o que é preenchido à mão e o que se revê antes de finalizar.",
          presenter: "André",
          videoUrl: "https://youtu.be/rxVJOnzqogg",
          keyPoints: [
            "O relatório sai no início do mês seguinte, sempre — a pontualidade é metade da credibilidade do número.",
            "Um mês mau apresenta-se com a leitura do porquê e o plano do mês seguinte já ao lado.",
            "Leads e receita primeiro; impressões e posições são a explicação, não o título.",
          ],
        },
        {
          id: "seo-com-mr-rp",
          title: "Roleplay: Como enviar um Monthly Report em vídeo",
          description:
            "Roleplay do envio do relatório mensal em vídeo — o que se pergunta ao cliente antes, o que se estuda antes de gravar e o que se diz.",
          type: "scenario",
          presenter: "André",
          videoUrl: "https://youtu.be/0OsdUmWc83M",
          keyPoints: [
            "Pergunta-se sempre ao cliente se prefere um vídeo de overview ou uma reunião de dúvidas sobre o relatório.",
            "Estuda-se o report antes de gravar; o vídeo não é um PowerPoint nem uma aula técnica.",
            "O cliente conta as leads do mês e pergunta-lhes de onde vieram (Google, AIs, Instagram…) — e nós sabemos sempre se a taxa de conversão está boa.",
          ],
        },
        {
          id: "seo-mr-ecommerce",
          title:
            "Como gerar o Monthly Report para cliente e-commerce (Shopify, etc.)",
          description:
            "O relatório mensal para lojas online. Depende de alterações à action Monthly Report na app antes de ser gravado.",
          presenter: "André Pereira",
        },
        {
          id: "seo-com-news-rp",
          title: "Roleplay: Como enviar Surprise News ao cliente",
          description:
            "Roleplay do envio de uma boa notícia fora da cadência combinada — o que conta como surprise news e como se escreve no grupo.",
          type: "scenario",
          presenter: "André",
          videoUrl: "https://youtu.be/v4BX2Z_8Fno",
          keyPoints: [
            "Surprise news é qualquer salto real: cliques orgânicos, posições de uma keyword importante, impressões.",
            "Na mensagem para o grupo identifica-se sempre o chefe máximo da empresa.",
          ],
        },
        {
          id: "seo-com-nps",
          title:
            "Como enviar NPS Form ao cliente (SMS, 1 semana de espera, 1 follow-up e 1 semana depois call)",
          description:
            "A sequência completa: SMS, uma semana de espera, um follow-up, e uma chamada uma semana depois. Cada passo tem uma razão e um prazo.",
          presenter: "André",
          videoUrl: "https://youtu.be/5WWjo9BsXbY",
          keyPoints: [
            "SMS → uma semana → follow-up → uma semana → chamada. Ao 14.º dia sem resposta, liga-se.",
            "O NPS form da WonderAds leva 5 a 10 minutos a preencher — diz-se isso ao cliente.",
          ],
        },
        {
          id: "seo-com-nps-rp",
          title:
            "Roleplay: Follow-up call de NPS Form a cliente que ainda não respondeu",
          description:
            "Roleplay da chamada final da sequência de NPS, com as respostas mais comuns do cliente.",
          type: "scenario",
          presenter: "André",
          videoUrl: "https://youtu.be/sJsGrgB-GcA",
        },
      ]),
      quiz: quizFor("seo-02-reporting", "Quiz — Reporting e comunicação"),
    },

    // -----------------------------------------------------------------------
    // 3 · Gestão de Situações com o Cliente
    // -----------------------------------------------------------------------
    {
      id: "seo-03-situacoes",
      title: "Gestão de Situações com o Cliente",
      description:
        "Reagir bem quando o cliente não aprova, tem dúvidas administrativas, reporta um problema técnico ou precisa de alterações web.",
      order: 3,
      section: null,
      lessons: lessons([
        {
          id: "seo-com-aprov",
          title:
            "Como reforçar a aprovação do cliente em materiais + follow-ups (1.º aviso na tabela, 2.º aviso 3 dias depois, 3.º aviso call 5 dias depois) c/ roleplay",
          description:
            "Os timings que o cliente tem de cumprir, como se dão os follow-ups sem parecer cobrança, e o momento em que se deixa de escrever e se liga.",
          presenter: "André",
          videoUrl: "https://youtu.be/BqvAx7cFKdk",
          keyPoints: [
            "Avisa-se o cliente mal se adiciona um documento à tabela de pending review; 3 dias depois vai o lembrete por mensagem; aos 5 dias liga-se.",
            "Na chamada explica-se que o atraso nas aprovações atrasa o roadmap e os frutos do SEO/faturação.",
            "Ligar é obrigatório quando o cliente não responde a mensagens nem a emails.",
          ],
        },
        {
          id: "seo-com-admin",
          title:
            "Como solucionar um problema administrativo (ex.: dúvida sobre preço da Wikipedia page)",
          description:
            "O cliente tem dúvidas sobre o processo. Como se responde a uma dúvida administrativa sem a transformar numa negociação — e a quem se pergunta quando não se sabe.",
          presenter: "André",
          videoUrl: "https://youtu.be/4-KCE7JJ2Js",
          keyPoints: [
            "Diz-se ao cliente que respondemos no máximo em 24 horas — um problema administrativo tem sempre resposta.",
            "Se não sabes: mantém a calma, informa que voltas com resposta, pergunta primeiro à equipa do DPT no grupo e só depois ao André.",
          ],
        },
        {
          id: "seo-cd-tecnico",
          title: "Como solucionar um problema técnico",
          description:
            "O caminho de diagnóstico de um problema técnico no site do cliente — o que se verifica primeiro, o que se escreve ao cliente e quando se escala.",
          presenter: "André",
          videoUrl: "https://youtu.be/5a9lbODTF8c",
          keyPoints: [
            "Primeiro passo: perceber se sabemos a solução a 100% antes de responder. Se sim: «a solução é X, estamos a resolver enquanto falamos».",
            "Estancar → perceber o problema em detalhe → Web + bug: ticket com urgência máxima e Slack; Não Web: Claude + Net e suporte da plataforma, avisando o cliente.",
            "Recorrer à equipa não é o primeiro passo; quando acontece, resolve-se por WhatsApp ou em reunião com um colega.",
          ],
        },
        {
          id: "seo-cd-ticket",
          title: "Como criar um ticket de alterações WEB corretamente",
          description:
            "Como se pede uma alteração ao departamento Web: a quem se atribui, o que tem de estar no ticket para não voltar, e onde ficam os acessos do cliente.",
          presenter: "André",
          videoUrl: "https://youtu.be/u0euxplXZro",
          keyPoints: [
            "Atribui-se ao designer com menos tasks Not Started e In Progress; em equilíbrio, ao que está mais habituado ao cliente.",
            "Explica-se e numera-se ao máximo as secções que a página deve ter; o nome do cliente não vai no título.",
            "Os acessos do cliente ficam todos no fundo da página do cliente na app.",
          ],
        },
      ]),
      quiz: quizFor("seo-03-situacoes", "Quiz — Situações com o cliente"),
    },

    // -----------------------------------------------------------------------
    // 4 · Auditoria Técnica e Keyword Research
    // -----------------------------------------------------------------------
    {
      id: "seo-04-auditoria",
      title: "Auditoria Técnica e Keyword Research",
      description:
        "Saber diagnosticar um site (app WonderAds, ScreamingFrog) e construir a lista de keywords de um projeto com Semrush.",
      order: 4,
      section: null,
      lessons: lessons([
        {
          id: "seo-audit-1",
          title:
            "Website SEO Audit para boas práticas de SEO (APP WA) — Parte 1",
          description:
            "Detalhes de design, técnicos, on-page, off-page e velocidade — o primeiro diagnóstico de um site, gerado na app.",
          presenter: "André Pereira",
          videoUrl: "https://youtu.be/EmAfTeK96lM",
          keyPoints: [
            "O onboarding form tem de estar preenchido antes de gerar o audit; verifica-se também se as Live Tools (Data for SEO) estão a funcionar.",
            "Primeiro audit de um cliente novo: profundidade «All» + focus «Everything». Os comentários servem para sinalizar contexto que não está no onboarding.",
            "O overview vem em inglês — usa-se «Adjust Result» para o reescrever em português de Portugal.",
          ],
        },
        {
          id: "seo-audit-2",
          title: "Website SEO Audit para boas práticas de SEO — Parte 2",
          description:
            "Continuação da auditoria na app. Consultor por atribuir.",
        },
        {
          id: "seo-screamingfrog",
          title: "ScreamingFrog",
          description:
            "O crawler de secretária: o que se vê nele que a app não mostra, e como se lê o resultado.",
          presenter: "Fran R",
        },
        {
          id: "seo-kw-1",
          title: "Keyword Research │ Parte 1",
          description:
            "A keyword research na app: o que lê do onboarding form, o que se acrescenta, e como se validam as sugestões no Semrush.",
          presenter: "João B",
          videoUrl: "https://youtu.be/Z8OSZPVtHPE",
          keyPoints: [
            "Overall SEO > Keyword Research lê o onboarding form; em «Comments or Additions» acrescenta-se o que surgiu depois, em conversas com o cliente.",
            "Cada sugestão do Claude passa pelo Semrush (volume real, dificuldade, localização); selecionam-se 30 a 40 antes da revisão final, para chegar às 25.",
            "Nos projetos com garantia entram 5-6 quick wins (top 8-15). Aprovar envia para a Pending Review do cliente; o documento guarda-se sempre.",
          ],
        },
        {
          id: "seo-kw-2",
          title: "Keyword Research │ Parte 2",
          description:
            "Quantas keywords por tipo de projeto, como se preenche o foco e o geotarget, e o que acontece depois da aprovação do cliente.",
          presenter: "André Pereira",
          videoUrl: "https://youtu.be/iBw6ZmZSZ4M",
          keyPoints: [
            "Keywords de foco por tipo de projeto: Light 15 · Core 20 · Growth 25 — alinhado com as horas de cada projeto.",
            "Reforça-se o que o cliente pediu no Additional Focus, define-se o Geotarget e mantêm-se todas as intenções de pesquisa ativas.",
            "Depois da aprovação do cliente: selecionar as keywords e «Send it to Track». A seleção revisita-se ao longo do contrato.",
          ],
        },
        {
          id: "seo-kw-3",
          title: "Keyword Research │ Parte 3 — Semrush para a keyword research",
          description:
            "As três ferramentas do Semrush que servem a keyword research e o que se lê em cada uma.",
          presenter: "André Pereira",
          videoUrl: "https://youtu.be/-Y_232vvfhQ",
          keyPoints: [
            "Antes de olhar para dados, define-se o país do cliente no Semrush.",
            "Domain Overview → Organic Rankings > Positions mostra o histórico; filtrar posições 11-20 revela quick wins; a estrela de quatro pontas marca respostas em IA.",
            "Keyword Magic Tool com Phrase Match dá long tail com intenção clara. As três ferramentas: Keyword Magic Tool, Domain Overview e Organic Rankings.",
          ],
        },
      ]),
      quiz: quizFor("seo-04-auditoria", "Quiz — Auditoria e keyword research"),
    },

    // -----------------------------------------------------------------------
    // 5 · Roadmap e Onboarding de Cliente Novo
    // -----------------------------------------------------------------------
    {
      id: "seo-05-roadmap",
      title: "Roadmap e Onboarding de Cliente Novo",
      description:
        "Transformar auditoria e research num roadmap, preparar e conduzir a onboarding call, e deixar o cliente configurado (Searchable, GA4).",
      order: 5,
      section: null,
      lessons: lessons([
        {
          id: "seo-cd-roadmap",
          title: "Como fazer um SEO Roadmap inicial e checklists",
          description:
            "O roadmap inicial de uma conta nova e as checklists que garantem que nada do essencial fica por fazer nas primeiras semanas. Tem documentos a anexar por baixo do vídeo.",
          presenter: "André",
          videoUrl: "https://youtu.be/zdL3DcOkpCM",
          keyPoints: [
            "Todos os projetos têm um projeto no Claude da empresa (seo@wonder-ads.com) com o onboarding form em memória e os DO's, DONT's e NOTES preenchidos.",
            "Um roadmap com qualidade leva no mínimo 2 horas, está pronto 24 horas antes da reunião e segue para aprovação de um superior ou colega.",
            "Quick wins primeiro (páginas existentes, GMB, técnico); o roadmap de GEO não é opcional; o roadmap muda com o projeto.",
          ],
        },
        {
          id: "seo-m4-a1",
          title:
            "Como fazer uma primeira reunião de parceria (onboarding) e gerir expectativas de timings/aprovações",
          description:
            "O que trazer para a reunião de onboarding de um cliente, como se conduz a primeira reunião de parceria e como se deixam alinhados desde o dia 1 os prazos de aprovação que dependem dele.",
          presenter: "André",
          videoUrl: "https://youtu.be/IUoZxz4RRg0",
          attachments: [
            {
              label: "Guidelines Pré-Onboarding Call │ WonderAds SEO/GEO DPT",
              url: "https://docs.google.com/document/d/1tA3u3ir4N1hKYRwwi1MrIdj4dZVM5qcFtkoyxIDddO8/edit?usp=sharing",
            },
          ],
          keyPoints: [
            "Materiais prontos para rever na reunião: Do's/Dont's/Notes, Site Audit, Keyword Research e Roadmap Client — nada fica para «o primeiro mês».",
            "Acessos a pedir e registar na app: site, GMB, GA4, GSC e fotos/materiais. Pedem-se antes, não durante.",
            "Protocolos a dizer sem falta: WhatsApp ativo, aprovações pelo menos semanais, Weekly Updates à sexta-feira, Monthly Report + pelo menos uma call por mês.",
          ],
        },
        {
          id: "seo-m4-a2",
          title:
            "Actual Call: Onboarding call de um cliente novo por um consultor",
          description:
            "Gravação real de uma reunião de onboarding com um cliente novo, do início ao fim.",
          type: "call_real",
          presenter: "André",
          videoUrl: "https://youtu.be/T97p9o6m9JE",
          keyPoints: [
            "Começa-se pelo negócio do cliente, nunca pelo SEO: o que vende, a quem, e o que é uma lead boa para ele.",
            "Alinha-se expectativa de tempo logo no dia 1 — SEO tem curva, e é melhor dizê-lo antes de o cliente perguntar.",
            "A reunião fecha com próximos passos datados e com quem faz o quê.",
          ],
        },
        {
          id: "seo-searchable-setup",
          title:
            "Como dar setup de um cliente novo no searchable.com (Searchable Parte 1)",
          description:
            "O setup do Searchable para um cliente novo: os campos obrigatórios, a ordem certa e o que acontece quando fica mal feito.",
          presenter: "André",
          videoUrl: "https://youtu.be/kzbSFY35bUk",
          keyPoints: [
            "Campos obrigatórios: Tom de Voz, Memória, Onboarding Form carregado, Competidores e Zona Regional do negócio.",
            "Sem onboarding form não há setup; os competidores validam-se com o cliente antes de guardar.",
            "O Searchable é obrigatório em todos os projetos — mal configurado, o output falha no tom, nos concorrentes e na região.",
          ],
        },
        {
          id: "seo-cd-ga4",
          title:
            "Como criar os eventos no GA4 do cliente para tracking correto",
          description:
            "Os eventos que têm de existir no GA4 para o relatório mensal contar leads a sério — como se criam e como se confirma que disparam.",
          presenter: "André",
          videoUrl: "https://youtu.be/7SX3As-Uwy8",
        },
      ]),
      quiz: quizFor("seo-05-roadmap", "Quiz — Roadmap e onboarding"),
    },

    // -----------------------------------------------------------------------
    // 6 · On-Page SEO
    // -----------------------------------------------------------------------
    {
      id: "seo-06-onpage",
      title: "On-Page SEO",
      description:
        "Otimizar uma página existente ponto a ponto com as actions da app WonderAds.",
      order: 6,
      section: null,
      lessons: lessons([
        {
          id: "seo-header-tags",
          title:
            "Header Tags — Como estruturar H1/H2/H3 e gerar com a action da app",
          description:
            "A hierarquia de headers de uma página, os tamanhos certos e a action da app que os gera.",
          presenter: "Manuel S",
          videoUrl: "https://youtu.be/rm-xN5LqnJA",
          keyPoints: [
            "Um único H1 por página, com keywords, entre 60 e 70 caracteres; nunca se saltam níveis (H2 → H4 não existe).",
            "H2 com 50-60 caracteres, com ou sem keyword; H3 a H5 diretos ao ponto, 30-40 caracteres.",
            "A estrutura gera-se com a action da app, não à mão; a extensão Detailed SEO confirma a contagem.",
          ],
        },
        {
          id: "seo-meta-tags",
          title: "Meta Titles & Descriptions — boas práticas + action da app",
          description:
            "O que são os meta tags, onde vivem, os limites de caracteres e a action da app que os gera para várias páginas de uma vez.",
          presenter: "Manuel S",
          videoUrl: "https://youtu.be/DKdcn0N9sWY",
          keyPoints: [
            "Meta title até 60 caracteres com a keyword principal no início; meta description entre 150 e 160, com as keywords a rankear.",
            "Vivem no <head>, não no corpo da página — o Google e o utilizador leem-nos antes de clicar.",
            "Na app: cliente → click actions → «MetaTitles e MetaDescriptions», URL, n.º de páginas (10/25/50) e focus word.",
          ],
        },
        {
          id: "seo-alt-text",
          title:
            "Image Alt Text — como gerar alt text SEO-friendly + action da app",
          description:
            "Para que serve o alt text, como se escreve bem e como se verifica numa página.",
          presenter: "André Pereira",
          videoUrl: "https://youtu.be/bl5KVi8IKaA",
          keyPoints: [
            "O alt text não é visível: serve acessibilidade, Google Imagens e contexto da imagem para o Google.",
            "Descreve a imagem com a keyword quando faz sentido — nunca só a keyword, nunca forçada em imagens decorativas.",
            "Verifica-se com botão direito → Inspecionar → atributo alt.",
          ],
        },
        {
          id: "seo-internal-linking",
          title:
            "Internal Linking — estratégia de linking interno + action da app",
          description:
            "O que é um link interno, para que serve e como se decide o que ligar a quê numa página de serviço.",
          presenter: "André Pereira",
          videoUrl: "https://youtu.be/1ku2t6Sp5sQ",
          keyPoints: [
            "Link interno = link entre páginas do mesmo site; distribui autoridade, ajuda os bots a ler o site e o utilizador a navegar.",
            "Liga-se a serviços relacionados e à página de agendamento, em botão ou dentro do texto — não a políticas de privacidade.",
            "Não substitui backlinks e não é só da homepage para dentro.",
          ],
        },
        {
          id: "seo-schema",
          title: "Schema Markup com boas práticas SEO",
          description:
            "O bloco JSON-LD que descreve a página aos motores de busca e aos sistemas de IA: para que serve, como se gera na app, onde se cola e como se valida.",
          presenter: "Fran R",
          videoUrl: "https://youtu.be/uvW5_gObUN4",
          keyPoints: [
            "JSON-LD invisível ao utilizador: resultados enriquecidos, definir a entidade e ser lido por sistemas de IA.",
            "Regra de ouro: só descreve o que está visível na página. Na app o default é «auto @graph»; Market e Language ficam em Autodetected.",
            "Cola-se no widget HTML (nunca no editor de texto) e valida-se com Rich Results Test E Schema Markup Validator.",
          ],
        },
      ]),
      quiz: quizFor("seo-06-onpage", "Quiz — On-Page SEO"),
    },

    // -----------------------------------------------------------------------
    // 7 · Estratégia de Conteúdo
    // -----------------------------------------------------------------------
    {
      id: "seo-07-estrategia",
      title: "Estratégia de Conteúdo",
      description:
        "Decidir o que escrever e quando, com base em dados (Searchable, Content Gap, Content Calendar).",
      order: 7,
      section: null,
      lessons: lessons([
        {
          id: "seo-searchable-topics",
          title:
            "Como encontrar tópicos e prompts atualizados para dar target num cliente (Searchable Parte 2)",
          description:
            "Usar o Searchable para encontrar tópicos e prompts relevantes para as target keywords do cliente — e o que fazer com eles.",
          presenter: "André",
          videoUrl: "https://youtu.be/8POIya1_KtI",
          keyPoints: [
            "Seed Keywords no Searchable dá prompts para artigos, FAQs, landing pages e blocos de conteúdo.",
            "O setup faz-se nos primeiros dias do cliente, em todos os projetos; os prompts validam-se com o cliente.",
            "Se o Searchable atingir o limite, pergunta-se à equipa se é geral e passa-se ao André.",
          ],
        },
        {
          id: "seo-content-gap",
          title:
            "Content Gap Analysis — identificar gaps vs concorrência e transformar em backlog editorial",
          description:
            "O que os concorrentes têm no site e o cliente não tem — como se gera a análise na app e como se transforma em plano de conteúdo.",
          presenter: "João B",
          videoUrl: "https://youtu.be/lTg5D-zgnIA",
          keyPoints: [
            "Antes de gerar, os Do's, Dont's e Notes têm de estar preenchidos; na app: Departamento SEO > On-Page SEO > Content Gap Analysis.",
            "Dos tópicos devolvidos escolhem-se os que chamam a atenção, analisa-se a página do concorrente e lança-se algo 10x melhor.",
            "Equilíbrio entre transacional, informacional, navegacional e local; o report analisado vai ao cliente para aprovação.",
          ],
        },
        {
          id: "seo-content-calendar",
          title:
            "Content Calendar — como construir um calendário de postagens GMB/Blog",
          description:
            "Planear a postagem de conteúdo (blog e GMB) ao longo do tempo na app: frequência, dias e o que se faz com o output.",
          presenter: "João B",
          videoUrl: "https://youtu.be/7mxDOE8f4BI",
          keyPoints: [
            "Do's, Dont's e Notes primeiro; depois timeframe (1, 3 ou 6 meses), temas cluster e frequência.",
            "Site sem conteúdo: pelo menos bi-weekly; cliente com centenas de posts e foco em qualidade: monthly. Dias constantes.",
            "Revê-se o output à mão, envia-se para approval via docs e, aprovado, criam-se tasks específicas no roadmap.",
          ],
        },
      ]),
      quiz: quizFor("seo-07-estrategia", "Quiz — Estratégia de conteúdo"),
    },

    // -----------------------------------------------------------------------
    // 8 · Produção e Otimização de Conteúdo
    // -----------------------------------------------------------------------
    {
      id: "seo-08-conteudo",
      title: "Produção e Otimização de Conteúdo",
      description:
        "Escrever, publicar e renovar conteúdo com qualidade SEO/GEO usando a app.",
      order: 8,
      section: null,
      lessons: lessons([
        {
          id: "seo-cd-artigo",
          title:
            "Como criar um artigo otimizado SEO-wise na APP Central da WonderAds — Parte 1 (APP)",
          description:
            "Da intenção de pesquisa ao artigo gerado na app: keyword primária, secundárias, word count, links internos e CTA.",
          presenter: "André",
          videoUrl: "https://youtu.be/-bdNcJ-lJJo",
          keyPoints: [
            "Quick Actions > Write Blog Article: o tópico é a keyword primária; secundárias uma por linha, escolhidas das target keywords do projeto.",
            "Word count decide-se pelo que já está rankeado — não são sempre 1.200 palavras. Internal links e CTA são responsabilidade do consultor.",
            "Depois de gerar: transformar em HTML e reforçar os pontos de SEO antes de sair.",
          ],
        },
        {
          id: "seo-publicar-html",
          title:
            "Como publicar os artigos blog da app e páginas SEO em HTML (UX 10/10) — Parte 2",
          description:
            "Como se publica o artigo em HTML com a UX certa — assinatura, CTA, FAQs e links. Ficheiros e copy box a anexar por baixo do vídeo.",
          presenter: "André",
          videoUrl: "https://youtu.be/6B_u_9zBqvY",
          keyPoints: [
            "Todos os artigos levam assinatura, CTA, FAQs com schema e internal linking.",
            "As target keywords ficam em negrito.",
            "Assina a maior referência do cliente/clínica.",
          ],
        },
        {
          id: "seo-faq",
          title: "FAQ Section Generator — como criar FAQ com Google e IA",
          description:
            "De onde vêm as perguntas de um FAQ, como se escolhem as melhores com o Claude e como se implementam na página.",
          presenter: "Fran R",
          videoUrl: "https://youtu.be/lLGlEIKMKV4",
          keyPoints: [
            "As perguntas vêm de dados (People Also Ask do Google, GSC, People Also Asked, atendimento do cliente), nunca da nossa cabeça.",
            "A resposta vem sempre no início — é isso que os AIs leem. Perguntas em H3, respostas em texto normal.",
            "O Claude tira as já respondidas, junta duplicadas e devolve as 6 melhores; as respostas completam-se com dados reais (preço, duração, processo).",
          ],
        },
        {
          id: "seo-content-refresh",
          title:
            "Content Refresh — como otimizar e renovar páginas existentes do site do cliente",
          description:
            "Porque é que refrescar uma página costuma render mais do que criar uma nova, o que se avalia e como se faz a análise do concorrente antes do Claude.",
          presenter: "Manuel S",
          videoUrl: "https://youtu.be/q322H3Eq81w",
          keyPoints: [
            "Refrescar uma página existente costuma render mais do que criar do zero; é processo contínuo, no roadmap.",
            "Pilares: links internos quebrados, meta tags, conteúdo parado sem keywords, páginas de serviços em falta ou a mais. Serviço bem otimizado: 1.200 a 2.000 palavras.",
            "Análise manual do concorrente primeiro (keywords, blocos, imagens, FAQs) antes de pedir ao Claude; o conteúdo vai para doc live e Pending Review.",
          ],
        },
      ]),
      quiz: quizFor("seo-08-conteudo", "Quiz — Produção de conteúdo"),
    },

    // -----------------------------------------------------------------------
    // 9 · Local SEO — Google Business Profile
    // -----------------------------------------------------------------------
    {
      id: "seo-09-local",
      title: "Local SEO — Google Business Profile",
      description:
        "Auditar, alimentar e gerir a reputação do perfil GMB de um cliente.",
      order: 9,
      section: null,
      lessons: lessons([
        {
          id: "seo-gmb-audit",
          title:
            "GMB Profile Audit — checklist completa (categorias, NAP, fotos, produtos, atributos, Q&A)",
          description:
            "A auditoria ao perfil de Google Business na app e o que se faz com o que ela devolve.",
          presenter: "João B",
          videoUrl: "https://youtu.be/yj8N3apW6hg",
          keyPoints: [
            "O report pede o link de partilha do perfil e notas sobre o estado atual.",
            "NAP = Nome, Morada e Telefone iguais, carácter a carácter, no GMB e na página da loja no site.",
            "Até 9 categorias secundárias com keywords do projeto; a execução (site + GMB + calendário) é do consultor.",
          ],
        },
        {
          id: "seo-gmb-posts",
          title:
            "Criar GMB Posts — o que é, para que serve, que fotos usar, e se o cliente não tiver fotos",
          description:
            "O que é um GMB post, que imagens e textos leva, e o que se faz quando o cliente não tem fotos.",
          presenter: "Manuel S",
          videoUrl: "https://youtu.be/IEPBz1JbXh8",
          keyPoints: [
            "Imagens de qualidade do cliente em primeiro lugar; nunca geradas por defeito com ChatGPT.",
            "Todos os textos adaptados com target keywords.",
            "Cliente sem imagens: fala-se com a equipa e o team leader sobre um cross-sell de sessão fotográfica.",
          ],
        },
        {
          id: "seo-gmb-publicar",
          title: "Publicar um GMB Post no GMB Profile",
          description:
            "Publicar o post no perfil de Google Business do cliente, passo a passo.",
          presenter: "André",
          videoUrl: "https://youtu.be/qO-XAuRbl_E",
        },
        {
          id: "seo-gmb-reviews",
          title:
            "GMB Reviews Responder — como responder a reviews positivas e negativas + action para drafts",
          description:
            "Prazos, tamanhos e tom das respostas a reviews, e a action da app que gera os rascunhos.",
          presenter: "André Pereira",
          videoUrl: "https://youtu.be/GzmUAU36CCI",
          keyPoints: [
            "Negativa: menos de 24 horas, até 100 palavras, sem detalhes do caso em público — direciona-se para contacto particular.",
            "Positiva: 24 a 48 horas, 40 a 60 palavras, específica; 5 estrelas sem texto pode ser mais simples.",
            "Cada resposta é diferente, com keywords quando faz sentido, e passa pela aprovação do cliente.",
          ],
        },
      ]),
      quiz: quizFor("seo-09-local", "Quiz — Local SEO"),
    },

    // -----------------------------------------------------------------------
    // 10 · Off-Page SEO — Backlinks
    // -----------------------------------------------------------------------
    {
      id: "seo-10-backlinks",
      title: "Off-Page SEO — Backlinks",
      description:
        "Perceber o que é um bom backlink, criar backlinks, analisar a concorrência e corrigir links quebrados.",
      order: 10,
      section: null,
      lessons: lessons([
        {
          id: "seo-backlinks-1",
          title: "Como fazer a gestão de backlinks — Parte 1",
          description:
            "O que é um backlink, o que distingue um bom de um mau, e o que prejudica mesmo o SEO do cliente.",
          presenter: "André",
          videoUrl: "https://youtu.be/9PylOS6OZFY",
          keyPoints: [
            "Backlink = link de um site externo para o site do cliente. Mais não é sempre melhor; comprar em massa é o mais prejudicial.",
            "Vale a relevância temática + tráfego real + perfil do site, não só o DA/DR.",
            "Anchor text sempre igual não ajuda — varia-se.",
          ],
        },
        {
          id: "seo-backlinks-2",
          title:
            "Como fazer a gestão de backlinks e o que são — Parte 2 (call c/ equipa)",
          description:
            "Continuação da gestão de backlinks, em call com a equipa.",
          presenter: "André",
          videoUrl: "https://youtu.be/1M9MD0hXnRg",
        },
        {
          id: "seo-backlink-doctoralia",
          title: "Roleplay: Criação de 1 backlink live para um cliente (Doctoralia)",
          description:
            "Criação ao vivo de um backlink num diretório clínico, do perfil ao link.",
          type: "scenario",
          presenter: "André",
          videoUrl: "https://youtu.be/Z3LNfnoAhlU",
          keyPoints: [
            "Autoridade e relevância decidem onde se cria o backlink.",
            "Um perfil só é backlink quando tem o website do cliente — sem link não conta.",
          ],
        },
        {
          id: "seo-backlink-gap",
          title:
            "Competitor Backlink Gap — ler o gap vs concorrência e priorizar oportunidades",
          description:
            "Encontrar os backlinks que os concorrentes têm e o cliente não, escolher os que valem a pena e gerar o estudo na app.",
          presenter: "André Pereira",
          videoUrl: "https://youtu.be/1R86p-A0R8o",
          keyPoints: [
            "Concorrentes = onboarding form + Semrush (Domain Overview / Competitive Positioning Map), validados serviço a serviço.",
            "Milhares de links de um site sem relação temática são comprados — ignoram-se.",
            "Na app: action Backlink Competitor Gap com concorrentes + tópicos foco; o output organiza por tipo de fonte (imprensa, diretórios, blogs…).",
          ],
        },
        {
          id: "seo-broken-links",
          title:
            "Broken-Link Building — encontrar e resolver links com erros 4xx e links com defeito",
          description:
            "Do Site Audit no Ahrefs ao redirect no WordPress: encontrar, agrupar, decidir e confirmar.",
          presenter: "Fran R",
          videoUrl: "https://youtu.be/hMicZK0NQRg",
          keyPoints: [
            "Site Audit no Ahrefs → filtrar 4xx → exportar CSV → Claude com o sitemap agrupa e sugere destinos; valida-se caso a caso.",
            "301 é permanente e passa autoridade; 302 não. Nunca tudo para a homepage; sem equivalente, recria-se a página.",
            "Redirects no plugin Redirection; volta-se a correr o crawl para confirmar (sem cadeias A → B → C) e agenda-se semanalmente.",
          ],
        },
      ]),
      quiz: quizFor("seo-10-backlinks", "Quiz — Backlinks"),
    },

    // -----------------------------------------------------------------------
    // 11 · Crescimento de Conta: Cross-sell, Up-sell e Renovação
    // -----------------------------------------------------------------------
    {
      id: "seo-11-crescimento",
      title: "Crescimento de Conta: Cross-sell, Up-sell e Renovação",
      description:
        "Identificar oportunidades de crescimento no cliente, registá-las internamente e preparar renovações. Último módulo porque exige domínio de todos os anteriores.",
      order: 11,
      section: null,
      lessons: lessons([
        {
          id: "seo-com-upsell",
          title: "Como encontrar/considerar um up-sell e cross-sell — Parte 1",
          description:
            "Quando é que a conta está pronta para mais serviço, como se identifica a necessidade real e como se juntam os argumentos.",
          presenter: "André",
          videoUrl: "https://youtu.be/EKLoRs7oUk4",
          keyPoints: [
            "Fase 1: perceber se há oportunidades — a falar com o cliente E a visitar o site (tempo na página, bounce rate).",
            "Juntam-se argumentos que falem ao dono: faturação perdida, concorrentes com sites melhores, análise de como a concorrência faz esse serviço.",
            "A WonderAds vende internamente CRM, Web Design, Email Marketing, META Ads e sessões fotográficas.",
          ],
        },
        {
          id: "seo-com-upsell-rp",
          title:
            "Roleplay: Como considerar um up-sell ou cross-sell para web design de site completo — Parte 2",
          description:
            "Roleplay da conversa de cross-sell para um site novo, com as objeções que aparecem sempre.",
          type: "scenario",
          presenter: "André",
          videoUrl: "https://youtu.be/IwNmucpVg0Y",
        },
        {
          id: "seo-registar-cross",
          title:
            "Como registar um cross-sell ou uma proposta de renovação internamente",
          description:
            "Onde e como se regista internamente uma oportunidade de cross-sell ou uma proposta de renovação.",
          presenter: "André",
          videoUrl: "https://youtu.be/AGqu9w37GOU",
        },
        {
          id: "seo-renovacao",
          title:
            "Protocolo de preparar uma renovação (5% de comissão ao consultor por renovação ganha)",
          description:
            "O que se leva à reunião de renovação: o documento de 7 pontos dos últimos 6 meses, a proposta de roadmap para os próximos 6 e as plataformas abertas.",
          presenter: "André",
          videoUrl: "https://youtu.be/WuR4iMTerBo",
          attachments: [
            {
              label: "HDS Learning — Renewal Review (exemplo)",
              url: "https://docs.google.com/document/d/1LDYepNTQ8Q3L6bm2Ij-g6DQvsmjmcNvc/edit",
            },
            {
              label: "HDS Roadmap — 6 meses (exemplo)",
              url: "https://docs.google.com/document/d/1hyo9_2hBHnnL8IIrGSN-a_47vGKUTLYn/edit?usp=sharing",
            },
          ],
          keyPoints: [
            "Leva-se à reunião o documento de 7 pontos dos últimos 6 meses, a proposta de roadmap para os próximos 6 e as abas de analytics abertas.",
            "O documento: resumo executivo, keywords e Authority Score, GA/GSC, AI Visibility (Searchable), GMB, próximos passos e sources.",
            "A conversa é sobre como correram os 6 meses e o que propomos para os próximos 6.",
          ],
        },
      ]),
      quiz: quizFor("seo-11-crescimento", "Quiz — Crescimento de conta"),
    },
  ],
};

// ---------------------------------------------------------------------------
// 2b · ADS
// ---------------------------------------------------------------------------

const ADS_TRACK: TrainingTrack = {
  slug: "ads",
  name: "Especialização ADS",
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
      quiz: quizFor("ads-m1", "Quiz — Ads Department Overview"),
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
      quiz: quizFor("ads-m2", "Quiz — Fundamentals"),
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
      quiz: quizFor("ads-m3", "Quiz — How To Advertise"),
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
      quiz: quizFor("ads-m4", "Quiz — Local Businesses & Lead Gen"),
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
      quiz: quizFor("ads-m5", "Quiz — Advanced Strategies"),
    },
  ],
};

// ---------------------------------------------------------------------------
// 2c · WEB
// ---------------------------------------------------------------------------

const WEB_TRACK: TrainingTrack = {
  slug: "web",
  name: "Especialização WEB",
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
      quiz: quizFor("web-m1", "Quiz — Trabalho interno WEB"),
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
      quiz: quizFor("web-m2", "Quiz — Entrega do website"),
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
      quiz: quizFor("web-m3", "Quiz — Aprovação de designs"),
    },
  ],
};

// ---------------------------------------------------------------------------
// 2d · COMERCIAL
// ---------------------------------------------------------------------------

const COMMERCIAL_TRACK: TrainingTrack = {
  slug: "comercial",
  name: "Especialização Comercial",
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
      quiz: quizFor("com-m1", "Quiz — Sales Department Overview"),
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
      quiz: quizFor("com-m2", "Quiz — Leads e reuniões"),
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
      quiz: quizFor("com-m3", "Quiz — Venda e follow-up"),
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
  const lessonId = str(o.lessonId).trim();
  const needsReview = bool(o.needsReview);
  return {
    id: str(o.id) || `q-${i + 1}`,
    prompt,
    type,
    order: num(o.order, i + 1),
    points: Math.max(1, num(o.points, 1)),
    options,
    explanation: typeof o.explanation === "string" ? o.explanation : null,
    ...(lessonId ? { lessonId } : {}),
    // Confirmada → a nota vai com ela; não há razão para a guardar.
    ...(needsReview
      ? { needsReview: true, reviewNote: str(o.reviewNote).trim() || null }
      : {}),
  };
}

function normalizeQuiz(raw: unknown, moduleId: string): TrainingQuiz {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawMax = o.maxAttempts;
  return {
    id: str(o.id) || `${moduleId}-quiz`,
    title: str(o.title) || "Quiz do capítulo",
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

function normalizeAttachment(raw: unknown): TrainingAttachment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const url = str(o.url).trim();
  if (!url) return null;
  // Sem rótulo, o URL serve de rótulo — um anexo sem link é que não é anexo.
  return { label: str(o.label).trim() || url, url };
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
  const attachments = (Array.isArray(o.attachments) ? o.attachments : [])
    .map(normalizeAttachment)
    .filter((x): x is TrainingAttachment => x !== null);
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
    keyPoints: (Array.isArray(o.keyPoints) ? o.keyPoints : [])
      .map((k) => str(k).trim())
      .filter((k) => k.length > 0),
    ...(attachments.length ? { attachments } : {}),
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
