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
  /** "Remember" — o que tem de ficar da aula, em frases curtas. Aparece ao
   *  lado do vídeo e é o que a pessoa relê antes do teste. Lista vazia é um
   *  estado legítimo (a aula ainda não foi destilada), não um erro. */
  keyPoints: string[];
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

/** Quiz de um módulo que ABSORVEU outros. Quando dois capítulos se fundem num
 *  (a reorganização do SEO na v76.43), o banco de perguntas dos capítulos que
 *  desapareceram não se deita fora: junta-se ao do que ficou. Perguntas
 *  escritas à mão são das coisas mais caras da formação — perdê-las numa
 *  mudança de arrumação seria pagá-las duas vezes.
 *
 *  Dedupe por id, porque a mesma pergunta podia existir em dois bancos. */
function quizFrom(
  moduleId: string,
  title: string,
  sourceModuleIds: string[],
): TrainingQuiz {
  const seen = new Set<string>();
  const questions = sourceModuleIds
    .flatMap((id) => TRAINING_QUESTIONS[id] ?? [])
    .filter((q) => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
  return {
    id: `${moduleId}-quiz`,
    title,
    passingScore: 80,
    maxAttempts: null,
    shuffleQuestions: true,
    questions,
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

const SEO_TRACK: TrainingTrack = {
  slug: "seo-geo",
  name: "Especialização SEO/GEO",
  description:
    "Dois sub-módulos: COMUNICAÇÃO (o que se diz ao cliente em cada momento da parceria, com roleplay para cada situação) e CLIENT DELIVERY (o que se produz e onde fica registado). No fim sabes conduzir uma conta do onboarding ao upsell, e entregar o trabalho pela app sem depender de ninguém.",
  order: 2,
  isCommon: false,
  modules: [
    // -----------------------------------------------------------------------
    // ARRUMAÇÃO (v76.44) — NOVE capítulos temáticos, agrupados nos dois
    // sub-módulos que o C-Level escreveu.
    //
    // PORQUÊ NOVE E NÃO DOIS: um capítulo tem um quiz no fim, e um quiz só
    // significa alguma coisa se as aulas antes dele falarem todas do MESMO
    // assunto. Um teste no fim de dezassete aulas que vão do mindset ao
    // upsell não mede compreensão — mede memória de curto prazo. Cada
    // capítulo aqui é um tema fechado: entra-se, treina-se com o roleplay do
    // próprio tema, e responde-se sobre ele.
    //
    // O AGRUPADOR `section` mantém os dois sub-módulos à vista, para não se
    // perder a leitura de alto nível («isto é comunicação, aquilo é
    // entrega») ao ganhar granularidade.
    //
    // IDs PRESERVADOS. As onze aulas que já existiam mantêm o id — trocá-lo
    // apagava o progresso de quem já as viu e desligava o vídeo que lá está.
    // O mesmo para os dois capítulos que guardam os maiores bancos de
    // perguntas (`seo-m2` e `seo-m3`): mudam de título e de lugar, mas o id
    // fica, e com ele as tentativas de quiz já feitas.
    // -----------------------------------------------------------------------
    {
      id: "seo-com-1",
      title: "Mindset e primeira reunião de parceria",
      description:
        "Como pensa quem é dono de uma conta, e como se conduz a primeira reunião — a que alinha expectativas de prazos para o resto do ano.",
      order: 1,
      section: "Comunicação",
      lessons: lessons([
        {
          // Era "Comunicação com o cliente" (a aula de abertura genérica do
          // capítulo). Mesmo lugar, mesmo id, o título do documento.
          id: "seo-m2-a1",
          title: "Mindset de Consultor de SEO/GEO e de DPT de SEO/GEO",
          description:
            "Como pensa quem é dono de uma conta: o que se assume, o que se pergunta, o que nunca se promete, e a diferença entre executar tarefas e responder pelo resultado do cliente.",
          presenter: "André",
          keyPoints: [
            "Cadência combinada e cumprida vale mais do que contacto abundante e irregular.",
            "Traduz sempre o técnico para o negócio do cliente: não são impressões, são pessoas a encontrar-te.",
            "Nunca prometas posições nem prazos de indexação — compromete-te com o trabalho e com a data da próxima leitura.",
          ],
        },
        {
          // Era "O que preparar quando um novo cliente dá onboard".
          id: "seo-m4-a1",
          title:
            "Como fazer uma primeira reunião de parceria (onboarding) e gerir expectativas de timings de aprovações do cliente",
          description:
            "O que trazer para a reunião de onboarding de um cliente, como se conduz a primeira reunião de parceria e como se deixam alinhados desde o dia 1 os prazos de aprovação que dependem dele.",
          presenter: "André",
          keyPoints: [
            "Chega-se à reunião de onboarding com o trabalho de casa feito: site visto, concorrentes vistos, perguntas preparadas.",
            "Acessos e formulário pedem-se antes, não durante — a reunião é para estratégia, não para logística.",
            "Os primeiros 30 dias definem a confiança do ano inteiro da conta.",
          ],
        },
        {
          id: "seo-m4-a2",
          title: "Reunião real de onboarding com um cliente novo",
          description:
            "Vídeo de exemplo de uma reunião real de onboarding com um cliente novo, do início ao fim.",
          type: "call_real",
          presenter: "André",
          keyPoints: [
            "Começa-se pelo negócio do cliente, nunca pelo SEO: o que vende, a quem, e o que é uma lead boa para ele.",
            "Alinha-se expectativa de tempo logo no dia 1 — SEO tem curva, e é melhor dizê-lo antes de o cliente perguntar.",
            "A reunião fecha com próximos passos datados e com quem faz o quê.",
          ],
        },
        {
          id: "seo-m2-a2",
          title: "Call real — onboarding pendente, sem sessão de estratégia",
          description:
            "Gravação real do André a ligar a um cliente que tinha o onboarding pendente e ainda não tinha feito a sessão de estratégia para contar como dia 1.",
          type: "call_real",
          presenter: "André",
          keyPoints: [
            "O relógio do serviço só arranca na sessão de estratégia — e é responsabilidade do consultor explicar isso sem soar a desculpa.",
            "Ligar é mais rápido do que escrever quando o assunto já ficou parado uma vez.",
            "Sai da chamada com data marcada, não com «depois combinamos».",
          ],
        },
      ]),
      // Herdou o banco de perguntas do antigo capítulo de onboarding.
      quiz: quizFrom("seo-com-1", "Quiz — Mindset e onboarding", ["seo-m4"]),
    },
    {
      id: "seo-com-2",
      title: "NPS e Surprise News",
      description:
        "As duas comunicações que se fazem fora da cadência do relatório: pedir a opinião do cliente e dar-lhe uma boa notícia. Cada uma com o seu roleplay.",
      order: 2,
      section: "Comunicação",
      lessons: lessons([
        {
          id: "seo-com-nps",
          title: "Como Enviar NPS Form ao Cliente",
          description:
            "A sequência completa: SMS, uma semana de espera, um follow up, e uma chamada uma semana depois. Cada passo tem uma razão e um prazo.",
          presenter: "André",
        },
        {
          id: "seo-com-nps-rp",
          title: "Roleplay: Como Enviar NPS Form ao Cliente",
          description:
            "Roleplay da sequência de NPS — o SMS, o follow up e a chamada final, com as respostas mais comuns do cliente.",
          type: "scenario",
          presenter: "André",
        },
        {
          id: "seo-com-news",
          title: "Como Enviar Surprise News ao Cliente",
          description:
            "Quando e como se dá uma boa notícia fora da cadência combinada — o que conta como surprise news e o que é só ruído.",
          presenter: "André",
        },
        {
          id: "seo-com-news-rp",
          title: "Roleplay: Como Enviar Surprise News ao Cliente",
          description:
            "Roleplay do envio de uma surprise news, com o enquadramento que a transforma em confiança em vez de mais uma mensagem.",
          type: "scenario",
          presenter: "André",
        },
      ]),
      quiz: quizFor("seo-com-2", "Quiz — NPS e Surprise News"),
    },
    {
      id: "seo-com-3",
      title: "Entrega do relatório mensal ao cliente",
      description:
        "O momento mais visível da parceria: como se envia o relatório com Loom e como se conduz a reunião mensal — incluindo o mês mau.",
      order: 3,
      section: "Comunicação",
      lessons: lessons([
        {
          id: "seo-com-mr",
          title: "Como Enviar um Monthly Report c/ Loom Video",
          description:
            "O envio do relatório mensal acompanhado de um Loom: o que se grava, por que ordem, e o que se escreve na mensagem que o acompanha.",
          presenter: "André",
        },
        {
          id: "seo-com-mr-rp",
          title: "Roleplay: Como Enviar um Monthly Report",
          description:
            "Roleplay do envio do relatório mensal, incluindo o caso difícil: apresentar um mês mau sem perder a conta.",
          type: "scenario",
          presenter: "André",
        },
        {
          id: "seo-m5-a2",
          title: "Reunião mensal real — dados e trabalho apresentados ao cliente",
          description:
            "Gravação de uma reunião mensal com apresentação de dados e do trabalho feito ao cliente.",
          type: "call_real",
          presenter: "André",
          keyPoints: [
            "Mostra-se o que foi feito e o que isso produziu — trabalho sem efeito medido é só atividade.",
            "O cliente tem de sair da reunião a saber o que vem a seguir e o que precisa de aprovar.",
            "Números que o cliente não percebe não são impressionantes: são ruído.",
          ],
        },
      ]),
      // Herdou o banco do antigo capítulo de reporting.
      quiz: quizFrom("seo-com-3", "Quiz — Relatório mensal com o cliente", ["seo-m5"]),
    },
    {
      id: "seo-com-4",
      title: "Upsell e cross sell",
      description:
        "Quando a conta está pronta para mais serviço, como se identifica a necessidade real e como se propõe sem queimar a relação.",
      order: 4,
      section: "Comunicação",
      lessons: lessons([
        {
          id: "seo-com-upsell",
          title: "Como Considerar um Upsell e Cross Sell",
          description:
            "Quando é que a conta está pronta para mais serviço, como se identifica a necessidade real e como se propõe sem queimar a relação.",
          presenter: "André",
        },
        {
          id: "seo-com-upsell-rp",
          title: "Roleplay: Como Considerar um Up-sell ou Cross Sell",
          description:
            "Roleplay da conversa de upsell e cross sell, com as objeções que aparecem sempre.",
          type: "scenario",
          presenter: "André",
        },
      ]),
      quiz: quizFor("seo-com-4", "Quiz — Upsell e cross sell"),
    },
    {
      id: "seo-m2",
      title: "Aprovações, follow ups e problemas do dia a dia",
      description:
        "O que desbloqueia contas paradas: cobrar aprovações sem parecer cobrança, dar follow ups, responder a dúvidas administrativas e saber quando se deixa de escrever e se liga.",
      order: 5,
      section: "Comunicação",
      lessons: lessons([
        {
          id: "seo-com-aprov",
          title:
            "Como reforçar a aprovação do cliente em materiais, dar follow ups e ligar quando é necessário",
          description:
            "Os timings que o cliente tem de cumprir, como se dão os follow ups sem parecer cobrança, e o momento em que se deixa de escrever e se liga.",
          presenter: "André",
        },
        {
          id: "seo-m2-a3",
          title: "Call real — documentos pendentes na tabela de aprovações",
          description:
            "Gravação real do André a ligar a um cliente sobre documentos pendentes na tabela de aprovações.",
          type: "call_real",
          presenter: "André",
          keyPoints: [
            "Aprovação pendente é trabalho já pago que não está a produzir efeito — trata-se como urgência, não como recordatório.",
            "Cobra-se o pendente pelo impacto para o cliente, nunca pelo incómodo para nós.",
            "Se o cliente não responde há três dias, a responsabilidade de desbloquear é tua.",
          ],
        },
        {
          id: "seo-com-admin",
          title: "Como solucionar um problema administrativo",
          description:
            "O cliente tem dúvidas sobre o processo — por exemplo o preço de uma página de Wikipédia. Como se responde a uma dúvida administrativa sem a transformar numa negociação.",
          presenter: "André",
        },
        {
          id: "seo-m2-a4",
          title: "Roleplays de chamadas telefónicas",
          description:
            "Gravação do André e de outros consultores a fazer roleplays de chamadas telefónicas — os cenários que mais se repetem na carteira.",
          type: "scenario",
          presenter: "André",
          keyPoints: [
            "Os cenários repetem-se: quem os treina antes não improvisa ao telefone com o cliente.",
            "Silêncio depois de uma pergunta é ferramenta — deixa o cliente responder.",
            "Fecha sempre com o resumo do que ficou combinado e por escrito a seguir.",
          ],
        },
      ]),
      // Mantém o id `seo-m2` — e com ele o banco e as tentativas já feitas.
      quiz: quizFrom("seo-m2", "Quiz — Acompanhamento do cliente", ["seo-m2"]),
    },
    {
      id: "seo-m3",
      title: "A app e as ferramentas",
      description:
        "Onde vive o trabalho: os protocolos internos, a app do workspace e as ferramentas de SEO da casa.",
      order: 6,
      section: "Client Delivery",
      lessons: lessons([
        {
          id: "seo-m1-a1",
          title: "Como trabalhamos internamente",
          description:
            "Os protocolos internos do departamento de SEO: o que se faz, por que ordem, em quanto tempo e onde fica registado.",
          presenter: "André",
          keyPoints: [
            "A ordem dos protocolos não é sugestão: cada passo assume que o anterior está feito e registado.",
            "Horas registadas fora do dia em que aconteceram deixam de servir para gerir carteira.",
            "O roadmap do cliente é o contrato de trabalho da semana — se mudou, muda-se lá primeiro.",
          ],
        },
        {
          id: "seo-cd-app",
          title: "Como utilizar app interna",
          description:
            "A app do workspace de ponta a ponta: onde vive cada cliente, o que se regista, o que se gera e o que se envia para aprovação.",
          presenter: "André",
        },
        {
          id: "seo-m3-a1",
          title: "Overview das Ferramentas",
          description:
            "Tour pelas ferramentas de SEO da casa e pelo que cada uma resolve.",
          presenter: "André",
          keyPoints: [
            "Cada ferramenta responde a uma pergunta diferente — usar a errada dá uma resposta certa à pergunta que ninguém fez.",
            "Os dados de GA4 e GSC são a base do relatório: se não confias no número, resolve-se antes do relatório, não durante.",
            "O output da ferramenta é matéria-prima; a decisão continua a ser do consultor.",
          ],
        },
      ]),
      // Mantém o id `seo-m3` e absorveu o banco do antigo trabalho interno.
      quiz: quizFrom("seo-m3", "Quiz — App e ferramentas", ["seo-m3", "seo-m1"]),
    },
    {
      id: "seo-cd-2",
      title: "Updates e relatórios",
      description:
        "O que se escreve e com que frequência: o update diário interno, o relatório semanal do cliente e a construção do relatório mensal na app.",
      order: 7,
      section: "Client Delivery",
      lessons: lessons([
        {
          id: "seo-cd-daily",
          title: "Como criar um Daily Update (interno)",
          description:
            "O update diário interno: o que entra, o que não entra, e para que serve a quem o lê depois.",
          presenter: "André",
        },
        {
          id: "seo-cd-weekly",
          title: "Como criar um Weekly Report (externo)",
          description:
            "O relatório semanal que vai para o cliente: o que se mostra, como se escreve e o que fica de fora.",
          presenter: "André",
        },
        {
          id: "seo-cd-weekly-rp",
          title: "Como criar um Weekly Report — Exemplos e Roleplay",
          description:
            "Exemplos reais de relatórios semanais e roleplay da sua construção, do dado em bruto à frase que o cliente lê.",
          type: "scenario",
          presenter: "André",
        },
        {
          // Era "Reporting e reunião mensal" — a parte de CONSTRUIR o
          // relatório. A parte de o APRESENTAR vive agora em Comunicação.
          id: "seo-m5-a1",
          title: "Como criar um Monthly Report (app)",
          description:
            "Como se constrói o relatório mensal na app: que dados entram, o que é automático, o que é preenchido à mão e o que se revê antes de finalizar.",
          presenter: "André",
          keyPoints: [
            "O relatório sai no início do mês seguinte, sempre — a pontualidade é metade da credibilidade do número.",
            "Um mês mau apresenta-se com a leitura do porquê e o plano do mês seguinte já ao lado.",
            "Leads e receita primeiro; impressões e posições são a explicação, não o título.",
          ],
        },
      ]),
      quiz: quizFor("seo-cd-2", "Quiz — Updates e relatórios"),
    },
    {
      id: "seo-cd-3",
      title: "Roadmap e produção de conteúdo",
      description:
        "O plano da conta e o que dele sai: roadmap inicial, checklists e o artigo otimizado, do briefing à publicação.",
      order: 8,
      section: "Client Delivery",
      lessons: lessons([
        {
          id: "seo-cd-roadmap",
          title: "Como fazer um SEO Roadmap Inicial e Checklists",
          description:
            "O roadmap inicial de uma conta nova e as checklists que garantem que nada do essencial fica por fazer nas primeiras semanas.",
          presenter: "André",
        },
        {
          id: "seo-m3-a2",
          title: "Roleplay com as ferramentas — roadmap e artigo ao vivo",
          description:
            "Gravação real do André em roleplay com as ferramentas: fazer ao vivo um roadmap e um artigo de blog.",
          type: "scenario",
          presenter: "André",
          keyPoints: [
            "Um roadmap faz-se a partir do negócio do cliente e só depois a partir das keywords.",
            "Artigo gerado não é artigo entregue: revê-se intenção, factos e tom antes de sair.",
            "O tempo que ganhas na ferramenta é para gastar no que ela não faz — critério e contexto do cliente.",
          ],
        },
        {
          id: "seo-cd-artigo",
          title: "Como criar um artigo otimizado e corretamente seo-wise",
          description:
            "Da intenção de pesquisa ao artigo publicado: estrutura, keywords, links internos e o que se revê antes de sair.",
          presenter: "André",
        },
      ]),
      quiz: quizFor("seo-cd-3", "Quiz — Roadmap e conteúdo"),
    },
    {
      id: "seo-cd-4",
      title: "Técnico e tracking",
      description:
        "O que quebra e o que se mede: tickets para o departamento Web, diagnóstico de problemas técnicos e os eventos de GA4 sem os quais o relatório não conta leads.",
      order: 9,
      section: "Client Delivery",
      lessons: lessons([
        {
          id: "seo-cd-ticket",
          title: "Como criar um ticket de alterações WEB",
          description:
            "Como se pede uma alteração ao departamento Web: o que tem de estar no ticket para não voltar, e como se acompanha até estar em produção.",
          presenter: "André",
        },
        {
          id: "seo-cd-tecnico",
          title: "Como solucionar um problema técnico",
          description:
            "O caminho de diagnóstico de um problema técnico no site do cliente — o que se verifica primeiro e quando se escala.",
          presenter: "André",
        },
        {
          id: "seo-cd-ga4",
          title:
            "Como criar os eventos no GA4 do cliente para tracking correto",
          description:
            "Os eventos que têm de existir no GA4 para o relatório mensal contar leads a sério — como se criam e como se confirma que disparam.",
          presenter: "André",
        },
      ]),
      quiz: quizFor("seo-cd-4", "Quiz — Técnico e tracking"),
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
    keyPoints: (Array.isArray(o.keyPoints) ? o.keyPoints : [])
      .map((k) => str(k).trim())
      .filter((k) => k.length > 0),
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
