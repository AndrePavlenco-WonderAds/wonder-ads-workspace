// Catalogue for the SEO client onboarding form ("A Vossa Audiência e
// Conteúdo"). A faithful recreation of the Google Form "Onboarding WonderAds
// Form 2025/2026", turned into a step-by-step quiz.
//
// This module is PURE (no KV, no React) so it can be imported by both the
// public quiz form (client component) and the server-side store / PDF
// generation. All copy is PT-PT — this form is client-facing and Portuguese.
//
// Each step carries a `track` (seo | ads). The SEO form and the Ads form live
// in the same catalogue and are split by track (see stepsForTrack).

import type { OnbTrack } from "@/lib/onboarding-tracks";

/** Single-line text answer. */
export type OnbShortField = {
  kind: "short";
  name: string;
  label: string;
  help?: string;
  placeholder?: string;
  required: boolean;
};

/** Multi-line (paragraph) text answer. */
export type OnbLongField = {
  kind: "long";
  name: string;
  label: string;
  help?: string;
  placeholder?: string;
  required: boolean;
};

export type OnbCheckboxOption = {
  value: string;
  label: string;
  /** When true, selecting this option reveals a free-text "other" field. */
  other?: boolean;
};

/** "Select all that apply" answer. */
export type OnbCheckboxField = {
  kind: "checkbox";
  name: string;
  label: string;
  help?: string;
  required: boolean;
  options: OnbCheckboxOption[];
};

/** File upload answer (0+ files, stored as blob URLs). */
export type OnbFileField = {
  kind: "file";
  name: string;
  label: string;
  help?: string;
  required: boolean;
};

export type OnbField =
  | OnbShortField
  | OnbLongField
  | OnbCheckboxField
  | OnbFileField;

export const isShort = (f: OnbField): f is OnbShortField => f.kind === "short";
export const isLong = (f: OnbField): f is OnbLongField => f.kind === "long";
export const isCheckbox = (f: OnbField): f is OnbCheckboxField =>
  f.kind === "checkbox";
export const isFile = (f: OnbField): f is OnbFileField => f.kind === "file";

/** One screen of the quiz: a single question or a small logical group. */
export type OnbStep = {
  key: string;
  /** Section this step belongs to — drives the grouped ruler. */
  section: string;
  /** "01".."11" — mono tag shown in the quiz header. */
  sectionTag: string;
  /** Short title shown at the top of the step card. */
  title: string;
  fields: OnbField[];
  /** Which form this step belongs to. Missing → "seo". */
  track?: OnbTrack;
  /** Only included when the client onboarding is flagged e-commerce. */
  ecommerce?: boolean;
};

export const DEFAULT_ONBOARDING_STEPS: OnbStep[] = [
  // 01 — INFORMAÇÕES DA EMPRESA
  {
    key: "empresa",
    section: "Empresa",
    sectionTag: "01",
    title: "Informações da Empresa",
    fields: [
      { kind: "short", name: "empresa_nome", label: "Nome da Empresa", required: true },
      {
        kind: "short",
        name: "empresa_contacto",
        label: "Pessoa de Principal Contacto (nome e número)",
        required: true,
      },
      {
        kind: "short",
        name: "empresa_email",
        label: "Email Geral do Negócio",
        placeholder: "ex. info@wonder-ads.com",
        required: true,
      },
      {
        kind: "short",
        name: "empresa_telefone",
        label: "Número de Contacto da Empresa (Móvel ou Fixo)",
        required: true,
      },
      {
        kind: "short",
        name: "empresa_morada",
        label: "Morada (Rua / Cidade / Código Postal)",
        required: true,
      },
      { kind: "short", name: "empresa_website", label: "Link do Website", required: true },
    ],
  },
  {
    key: "ferramentas",
    section: "Empresa",
    sectionTag: "01",
    title: "Ferramentas",
    fields: [
      {
        kind: "checkbox",
        name: "ferramentas",
        label: "Indique quais ferramentas tem de certeza!",
        required: false,
        options: [
          { value: "ga", label: "Google Analytics" },
          { value: "gsc", label: "Google Search Console" },
          { value: "gmb", label: "Google My Business" },
          { value: "merchant", label: "Google Merchant Center" },
          { value: "gtm", label: "Google Tag Manager" },
        ],
      },
    ],
  },

  // 02 — QUESTÕES ESPECÍFICAS PARA SEO
  {
    key: "area_influencia",
    section: "SEO",
    sectionTag: "02",
    title: "Área de Influência",
    fields: [
      {
        kind: "long",
        name: "area_influencia",
        label: "Área de Influência",
        help: "Indique a cidade, bem como as cidades e distritos vizinhos por favor. Considere mencionar zonas com maior população/audiência, nem que sejam um pouco mais distantes.",
        required: true,
      },
    ],
  },
  {
    key: "keywords",
    section: "SEO",
    sectionTag: "02",
    title: "Keywords",
    fields: [
      {
        kind: "long",
        name: "keywords",
        label:
          "Quais as keywords que gostaria de aparecer sempre em 1º lugar ou pelo menos na primeira página?",
        help: 'Pense sem pressa e mencione pelo menos 10 keywords. Não se esqueça de priorizar serviços que vão ser o foco da parceria. Aqui estão alguns exemplos: "clínica estética braga", "branqueamento dentário Porto", "implantes Lisboa", "ginásio barato vila nova de gaia".',
        required: true,
      },
    ],
  },
  {
    key: "conteudo_autor",
    section: "SEO",
    sectionTag: "02",
    title: "Conteúdo",
    fields: [
      {
        kind: "long",
        name: "conteudo_autor",
        label:
          "Tem alguém específico que possa verificar ou escrever conteúdo como Artigos de Blog? (Se sim, deixe o contacto)",
        help: "Pense num colaborador, médico, estagiário, assistente ou alguém que possa tirar 30min a 1h por semana para rever e/ou escrever conteúdo. É importante mostrar ao Google que percebem daquilo que vendem/fazem.",
        required: true,
      },
    ],
  },
  {
    key: "competidores",
    section: "SEO",
    sectionTag: "02",
    title: "Competidores",
    fields: [
      {
        kind: "long",
        name: "competidores",
        label:
          "Mencione todos os seus competidores da zona. Especialmente aqueles maiores que estão a crescer nos últimos tempos. Quantos mais, melhor!",
        help: "Adicione os links dos seus principais concorrentes para que possamos analisá-los e identificar o que estão a fazer bem — de forma a superarmos a sua performance e fazermos melhor que eles. Isto é importantíssimo.",
        required: true,
      },
    ],
  },

  // 03 — OBJETIVOS DE NEGÓCIO
  {
    key: "objetivos",
    section: "Objetivos",
    sectionTag: "03",
    title: "Objetivos de Negócio",
    fields: [
      {
        kind: "long",
        name: "objetivos",
        label:
          "Quais são os seus principais objetivos de negócio para os próximos 6 a 12 meses?",
        help: "Por exemplo: aumentar as vendas, gerar leads, reconhecimento da marca, expandir a base de clientes.",
        required: true,
      },
    ],
  },
  {
    key: "kpis",
    section: "Objetivos",
    sectionTag: "03",
    title: "Indicadores (KPIs)",
    fields: [
      {
        kind: "long",
        name: "kpis",
        label:
          "Tem algum indicador-chave de desempenho (KPIs) que faça tracking em termos de SEO? (Se sim, qual?)",
        help: 'Por exemplo: "tenho cerca de 5 pessoas a virem do website e do ChatGPT por semana, geralmente 4 são interessadas e avançam com um tratamento".',
        required: true,
      },
    ],
  },

  // 04 — TARGET AUDIENCE
  {
    key: "publico_alvo",
    section: "Público-Alvo",
    sectionTag: "04",
    title: "Público-Alvo",
    fields: [
      {
        kind: "long",
        name: "publico_alvo",
        label: "Descreva o seu público-alvo.",
        help: "Este é um grupo de pessoas com um certo conjunto de características demográficas e psicográficas. Demografia: (por exemplo, idade, género, localização). Psicografia: (por exemplo, interesses, comportamentos, valores).",
        required: true,
      },
    ],
  },
  {
    key: "publico_excluir",
    section: "Público-Alvo",
    sectionTag: "04",
    title: "Segmentos a Excluir",
    fields: [
      {
        kind: "long",
        name: "publico_excluir",
        label: "Há algum segmento de público que deseja excluir?",
        help: "Por exemplo: clientes existentes, determinados locais.",
        required: true,
      },
    ],
  },

  // 05 — MARCA E COMUNICAÇÃO
  {
    key: "proposta_valor",
    section: "Marca",
    sectionTag: "05",
    title: "Proposta de Valor",
    fields: [
      {
        kind: "long",
        name: "proposta_valor",
        label: "Qual é a proposta de valor da sua marca? (o que torna o seu produto/serviço único?)",
        help: "É Qualidade? Rapidez? Longa durabilidade? Versátil para todos? Específico para crianças ou idosos? Mencione pelo menos 4 pontos.",
        required: true,
      },
    ],
  },
  {
    key: "motivos_escolha",
    section: "Marca",
    sectionTag: "05",
    title: "Motivos de Escolha",
    fields: [
      {
        kind: "long",
        name: "motivos_escolha",
        label: "Mencione 4 motivos dos clientes escolherem a sua marca vs. os competidores.",
        required: false,
      },
    ],
  },
  {
    key: "tom_voz",
    section: "Marca",
    sectionTag: "05",
    title: "Tom de Voz",
    fields: [
      {
        kind: "long",
        name: "tom_voz",
        label: "Que tom de voz deve ser usado no SEO?",
        help: "Por exemplo: casual e amigável OU autoritário e profissional.",
        required: true,
      },
    ],
  },
  {
    key: "palavras",
    section: "Marca",
    sectionTag: "05",
    title: "Palavras a Usar/Evitar",
    fields: [
      {
        kind: "long",
        name: "palavras",
        label: "Existem palavras ou frases específicas que prefere usar ou evitar?",
        required: true,
      },
    ],
  },
  {
    key: "branding_guia",
    section: "Marca",
    sectionTag: "05",
    title: "Manual de Marca",
    fields: [
      {
        kind: "file",
        name: "branding_guia",
        label: "Tem um guia/portfólio/manual com o seu branding? Se sim, anexe-o.",
        required: false,
      },
    ],
  },
  {
    key: "migracao",
    section: "Marca",
    sectionTag: "05",
    title: "Migrações Previstas",
    fields: [
      {
        kind: "long",
        name: "migracao",
        label:
          "Tem planos para fazer alguma migração do blog, servidor, artigos, mudanças grandes no site, etc. nas próximas semanas?",
        required: false,
      },
    ],
  },
  {
    key: "cores",
    section: "Marca",
    sectionTag: "05",
    title: "Cores da Marca",
    fields: [
      {
        kind: "long",
        name: "cores",
        label: "Quais são as cores primárias e secundárias da sua marca?",
        help: "Cores primárias: [códigos Hex/RGB/CMYK]. Cores secundárias: [códigos Hex/RGB/CMYK].",
        required: false,
      },
    ],
  },

  // 06 — SERVIÇO / PRODUTO
  {
    key: "mais_vendidos",
    section: "Serviço",
    sectionTag: "06",
    title: "Serviços/Produtos mais Vendidos",
    fields: [
      {
        kind: "long",
        name: "mais_vendidos",
        label: "Quais são os serviços/produtos mais vendidos?",
        help: 'Exemplo: "no meu caso são os branqueamentos dentários".',
        required: true,
      },
    ],
  },
  {
    key: "processo_comercial",
    section: "Serviço",
    sectionTag: "06",
    title: "Processo Comercial",
    fields: [
      {
        kind: "long",
        name: "processo_comercial",
        label: "Existem elementos no seu processo comercial que ajudam muito a vender?",
        required: false,
      },
    ],
  },
  {
    key: "objecoes",
    section: "Serviço",
    sectionTag: "06",
    title: "Objeções",
    fields: [
      {
        kind: "long",
        name: "objecoes",
        label:
          "Quais são as principais objeções que precisam de ultrapassar? (dúvidas, receios ou hesitações dos potenciais clientes)",
        help: "Mencione tudo o que já lhe perguntaram e vier à cabeça. É importante para mostrarmos aos motores de pesquisa (Google, etc.) que sabemos resolver qualquer dificuldade do público-alvo.",
        required: true,
      },
    ],
  },
  {
    key: "frase_unica",
    section: "Serviço",
    sectionTag: "06",
    title: "Numa Frase",
    fields: [
      {
        kind: "short",
        name: "frase_unica",
        label: "Numa frase, descreva o seu serviço de uma forma única.",
        required: false,
      },
    ],
  },

  // 07 — PROVAS, OFERTAS, GARANTIAS
  {
    key: "credibilidade",
    section: "Provas",
    sectionTag: "07",
    title: "Credibilidade",
    fields: [
      {
        kind: "long",
        name: "credibilidade",
        label:
          "Liste qualquer tipo de credibilidade que possam ter (clientes notáveis/famosos, número de reviews, testemunhos, credenciais).",
        required: true,
      },
    ],
  },
  {
    key: "ofertas",
    section: "Provas",
    sectionTag: "07",
    title: "Ofertas",
    fields: [
      {
        kind: "long",
        name: "ofertas",
        label: "Que ofertas é que o seu negócio tem? (ofertas, promoções, descontos, lead magnets, etc.)",
        help: "Tem alguma a decorrer agora ou que seja recorrente? Partilhe detalhes para usarmos isto para atrair pesquisas e mostrarmos cada vez mais atividade no SEO.",
        required: true,
      },
    ],
  },
  {
    key: "garantias",
    section: "Provas",
    sectionTag: "07",
    title: "Garantias",
    fields: [
      {
        kind: "long",
        name: "garantias",
        label: "Tem algumas garantias?",
        help: 'Por exemplo: "O paciente sai da minha clínica satisfeito ou então ofereço um segundo tratamento/consulta".',
        required: false,
      },
    ],
  },

  // 08 — O VOSSO MARKETING
  {
    key: "marketing_mal",
    section: "Marketing",
    sectionTag: "08",
    title: "O que Correu Mal",
    fields: [
      {
        kind: "long",
        name: "marketing_mal",
        label: "Pode contar-nos a sua experiência com marketing: o que é que correu mal e porquê?",
        help: 'Vamos aprender com isto e reforçar os protocolos da equipa nestes pontos. Por exemplo: "A minha agência anterior demorava a responder". Muito bem — agilidade para si é importante. Vamos responder dentro de 30 minutos.',
        required: true,
      },
    ],
  },
  {
    key: "marketing_bem",
    section: "Marketing",
    sectionTag: "08",
    title: "O que Correu Bem",
    fields: [
      {
        kind: "long",
        name: "marketing_bem",
        label: "O que funcionou bem nas suas parcerias anteriores?",
        required: true,
      },
    ],
  },

  // 09 — DETALHES & MÉTRICAS
  {
    key: "datas",
    section: "Métricas",
    sectionTag: "09",
    title: "Datas Importantes",
    fields: [
      {
        kind: "long",
        name: "datas",
        label: "Há alguma data ou prazo importante que devamos ter em conta?",
        help: "Por exemplo: datas de lançamento de produtos/novos serviços, promoções sazonais ou aniversário do negócio.",
        required: true,
      },
    ],
  },
  {
    key: "ltv",
    section: "Métricas",
    sectionTag: "09",
    title: "Valor Médio do Cliente (LTV)",
    fields: [
      {
        kind: "short",
        name: "ltv",
        label: "Qual é o valor médio de um cliente (LTV – Life Time Value)?",
        help: "Ou seja: quanto dinheiro, em média, cada cliente gasta consigo ao longo do tempo em que é seu cliente?",
        required: true,
      },
    ],
  },
  {
    key: "cac",
    section: "Métricas",
    sectionTag: "09",
    title: "Custo de Aquisição (CAC)",
    fields: [
      {
        kind: "short",
        name: "cac",
        label: "Qual é o custo médio de aquisição por cliente? (opcional)",
        help: "Ou seja: quanto dinheiro, em média, gasta para conseguir um novo cliente? (por exemplo, com anúncios, campanhas ou promoções).",
        required: false,
      },
    ],
  },
  {
    key: "ticket_medio",
    section: "Métricas",
    sectionTag: "09",
    title: "Custo Médio dos Serviços",
    fields: [
      {
        kind: "short",
        name: "ticket_medio",
        label: "Qual é o custo médio dos vossos serviços ou produtos?",
        help: "Por exemplo: se tiverem um serviço que custa 30 € e outro que custa 100 €, o preço médio será cerca de 65 €.",
        required: true,
      },
    ],
  },
  {
    key: "origem_clientes",
    section: "Métricas",
    sectionTag: "09",
    title: "Origem dos Clientes",
    fields: [
      {
        kind: "checkbox",
        name: "origem_clientes",
        label: "Origem da maior parte dos clientes (o que tem mais peso)",
        required: false,
        options: [
          { value: "referencias", label: "Referências (referrals / boca-a-boca)" },
          { value: "ads_pagos", label: "Anúncios Pagos" },
          { value: "organico_web", label: "Orgânico (Website → Google e IAs como o ChatGPT)" },
          { value: "organico_social", label: "Orgânico (Redes Sociais)" },
          { value: "email", label: "Email Marketing" },
          { value: "offline", label: "Offline (Walk-ins / Folhetos / Placares)" },
          { value: "networking", label: "Networking, Eventos e Feiras" },
          { value: "outro", label: "Outro", other: true },
        ],
      },
    ],
  },
  {
    key: "outro_website",
    section: "Métricas",
    sectionTag: "09",
    title: "Outros Websites",
    fields: [
      {
        kind: "short",
        name: "outro_website",
        label: "Tem mais algum website para além do acima mencionado?",
        required: true,
      },
    ],
  },

  // 10 — CONFORMIDADE LEGAL
  {
    key: "legal",
    section: "Legal",
    sectionTag: "10",
    title: "Conformidade Legal",
    fields: [
      {
        kind: "long",
        name: "legal",
        label:
          "Há algum tópico ou tipo de conteúdo que esteja fora dos limites por motivos legais ou de conformidade?",
        required: false,
      },
    ],
  },

  // 11 — NOTAS FINAIS
  {
    key: "notas_finais",
    section: "Notas Finais",
    sectionTag: "11",
    title: "Notas Finais",
    fields: [
      {
        kind: "long",
        name: "notas_finais",
        label: "Há mais alguma coisa que devamos saber para garantir o sucesso desta parceria?",
        help: "Por exemplo: aprovações internas, parcerias de terceiros, necessidades específicas nos relatórios.",
        required: false,
      },
    ],
  },
  {
    key: "anexos",
    section: "Notas Finais",
    sectionTag: "11",
    title: "Anexos",
    fields: [
      {
        kind: "file",
        name: "anexos",
        label:
          "Anexe quaisquer documentos ou arquivos relevantes que nos ajudem a entender melhor o seu negócio, necessidades e objetivos.",
        required: false,
      },
    ],
  },

  // ===================== ADS FORM (track "ads") =====================
  // Adapted from the Google/Meta Ads client questionnaire. Client-facing PT-PT.
  {
    key: "ads_segmentacao",
    track: "ads",
    section: "Segmentação",
    sectionTag: "A1",
    title: "Localizações e Raio",
    fields: [
      {
        kind: "long",
        name: "ads_q1",
        label:
          "Quais são as moradas completas de cada localização do negócio, e qual o raio/zona de onde vem a maioria dos clientes?",
        help: "Indique o raio (em km) ou os códigos-postais de onde vêm a maioria dos clientes.",
        required: true,
      },
    ],
  },
  {
    key: "ads_publico",
    track: "ads",
    section: "Segmentação",
    sectionTag: "A1",
    title: "Público a Atrair",
    fields: [
      {
        kind: "long",
        name: "ads_q2",
        label:
          "Quem querem atrair sobretudo (idade, género, objetivos)? Há alguém que prefiram NÃO segmentar?",
        required: true,
      },
    ],
  },
  {
    key: "ads_acao",
    track: "ads",
    section: "Segmentação",
    sectionTag: "A1",
    title: "Ação Principal",
    fields: [
      {
        kind: "long",
        name: "ads_q3",
        label:
          "Qual é a ÚNICA ação que mais querem que um potencial cliente faça?",
        help: "Por exemplo: marcar um teste/visita, enviar um pedido, ligar, ou comprar online.",
        required: true,
      },
    ],
  },
  {
    key: "ads_oferta",
    track: "ads",
    section: "Ofertas",
    sectionTag: "A2",
    title: "Oferta de Entrada",
    fields: [
      {
        kind: "long",
        name: "ads_q4",
        label: "Que oferta de entrada podemos promover nos anúncios?",
        help: "Por exemplo: passe grátis, sem taxa de inscrição, 1º mês a €X, sessão grátis.",
        required: true,
      },
    ],
  },
  {
    key: "ads_precos",
    track: "ads",
    section: "Ofertas",
    sectionTag: "A2",
    title: "Planos e Preços",
    fields: [
      {
        kind: "long",
        name: "ads_q5",
        label: "Quais são os vossos planos/pacotes e preços? (mensal vs. contrato)",
        required: true,
      },
    ],
  },
  {
    key: "ads_produtos",
    track: "ads",
    section: "Ofertas",
    sectionTag: "A2",
    title: "Outros Produtos",
    fields: [
      {
        kind: "long",
        name: "ads_q6",
        label:
          "Além do produto principal, o que mais devemos anunciar? Quais são os mais populares e os mais rentáveis?",
        required: false,
      },
    ],
  },
  {
    key: "ads_usp",
    track: "ads",
    section: "Ofertas",
    sectionTag: "A2",
    title: "Diferenciação",
    fields: [
      {
        kind: "long",
        name: "ads_q7",
        label:
          "Porque é que as pessoas escolhem o vosso negócio em vez da concorrência local?",
        help: "Equipamento, atendimento, horário, preço, comunidade, localização…",
        required: true,
      },
    ],
  },
  {
    key: "ads_concorrentes",
    track: "ads",
    section: "Ofertas",
    sectionTag: "A2",
    title: "Concorrentes",
    fields: [
      {
        kind: "long",
        name: "ads_q8",
        label: "Quem são os vossos principais concorrentes locais e cadeias próximas?",
        required: true,
      },
    ],
  },
  {
    key: "ads_orcamento",
    track: "ads",
    section: "Orçamento",
    sectionTag: "A3",
    title: "Orçamento Mensal",
    fields: [
      {
        kind: "short",
        name: "ads_q9",
        label: "Que orçamento mensal gostariam de investir em Ads?",
        required: true,
      },
    ],
  },
  {
    key: "ads_valor",
    track: "ads",
    section: "Orçamento",
    sectionTag: "A3",
    title: "Valor do Cliente",
    fields: [
      {
        kind: "long",
        name: "ads_q10",
        label:
          "Qual é o valor médio mensal, a duração típica de um cliente e a margem de lucro aproximada?",
        help: "Isto permite-nos definir um custo-por-conversão que seja realmente rentável para vocês.",
        required: true,
      },
    ],
  },
  {
    key: "ads_sazonalidade",
    track: "ads",
    section: "Orçamento",
    sectionTag: "A3",
    title: "Datas-Chave",
    fields: [
      {
        kind: "long",
        name: "ads_q11",
        label:
          "Há épocas altas ou datas-chave a planear? (Ano Novo, setembro, verão, aberturas…)",
        required: false,
      },
    ],
  },
  {
    key: "ads_landing",
    track: "ads",
    section: "Website & Tracking",
    sectionTag: "A4",
    title: "Destino dos Anúncios",
    fields: [
      {
        kind: "long",
        name: "ads_q12",
        label:
          "Para onde devem os anúncios enviar as pessoas — página de inscrição, página por localização, ou homepage? Existe uma página mobile-friendly com formulário claro?",
        required: true,
      },
    ],
  },
  {
    key: "ads_contas",
    track: "ads",
    section: "Website & Tracking",
    sectionTag: "A4",
    title: "Histórico de Ads",
    fields: [
      {
        kind: "long",
        name: "ads_q13",
        label:
          "Já correram Google/Meta Ads antes (ou correm agora)? Se sim, partilhem o ID da conta e resultados passados.",
        required: false,
      },
    ],
  },
  {
    key: "ads_followup",
    track: "ads",
    section: "Contactos",
    sectionTag: "A5",
    title: "Gestão de Contactos",
    fields: [
      {
        kind: "long",
        name: "ads_q14",
        label:
          "Quando entra um contacto ou chamada, quem faz o follow-up e com que rapidez?",
        help: "Um follow-up rápido é um dos maiores fatores para transformar leads em clientes.",
        required: true,
      },
    ],
  },

  // ============ E-COMMERCE ADS (track "ads", só quando e-commerce) ============
  // Mesmas perguntas para Google Ads e Meta Ads em e-commerce.
  {
    key: "ec_plataforma",
    track: "ads",
    ecommerce: true,
    section: "E-commerce",
    sectionTag: "A6",
    title: "Plataforma de Loja",
    fields: [
      {
        kind: "long",
        name: "ec_q1",
        label:
          "Que plataforma de e-commerce usam? (Shopify, WooCommerce, Magento, PrestaShop…)",
        required: true,
      },
    ],
  },
  {
    key: "ec_catalogo",
    track: "ads",
    ecommerce: true,
    section: "E-commerce",
    sectionTag: "A6",
    title: "Catálogo",
    fields: [
      {
        kind: "long",
        name: "ec_q2",
        label:
          "Quantos produtos (SKUs) têm no catálogo e quais são as categorias principais?",
        required: true,
      },
    ],
  },
  {
    key: "ec_aov",
    track: "ads",
    ecommerce: true,
    section: "E-commerce",
    sectionTag: "A6",
    title: "Valor Médio de Encomenda",
    fields: [
      {
        kind: "short",
        name: "ec_q3",
        label: "Qual é o valor médio de encomenda (AOV)?",
        required: true,
      },
    ],
  },
  {
    key: "ec_feed",
    track: "ads",
    ecommerce: true,
    section: "E-commerce",
    sectionTag: "A6",
    title: "Feed de Produtos",
    fields: [
      {
        kind: "long",
        name: "ec_q4",
        label:
          "Já têm o feed de produtos / Google Merchant Center (ou catálogo Meta) configurado? Se sim, em que estado?",
        required: false,
      },
    ],
  },
  {
    key: "ec_topprodutos",
    track: "ads",
    ecommerce: true,
    section: "E-commerce",
    sectionTag: "A6",
    title: "Produtos-Chave",
    fields: [
      {
        kind: "long",
        name: "ec_q5",
        label: "Quais são os produtos mais vendidos e os de maior margem?",
        required: true,
      },
    ],
  },
  {
    key: "ec_envios",
    track: "ads",
    ecommerce: true,
    section: "E-commerce",
    sectionTag: "A6",
    title: "Envios",
    fields: [
      {
        kind: "long",
        name: "ec_q6",
        label:
          "Para que zonas/países enviam? Há custos de envio ou portes grátis acima de um valor?",
        required: false,
      },
    ],
  },
  {
    key: "ec_tracking",
    track: "ads",
    ecommerce: true,
    section: "E-commerce",
    sectionTag: "A6",
    title: "Pixel & Conversões",
    fields: [
      {
        kind: "long",
        name: "ec_q7",
        label:
          "Têm o pixel/tag de conversão e os eventos de compra instalados? (Meta Pixel, Google Tag, eventos de e-commerce)",
        required: false,
      },
    ],
  },
  {
    key: "ec_roas",
    track: "ads",
    ecommerce: true,
    section: "E-commerce",
    sectionTag: "A6",
    title: "Conversão & ROAS",
    fields: [
      {
        kind: "long",
        name: "ec_q8",
        label:
          "Qual é a taxa de conversão média da loja e qual o retorno (ROAS) alvo que pretendem?",
        required: false,
      },
    ],
  },
];

// The form is editable in-app (SuperAdmin) via onboarding-content-store.
// These helpers are PURE and take the live `steps` array so both the default
// and any KV override work identically.

/** A step's track, defaulting to "seo" for pre-track content. */
export function stepTrack(s: OnbStep): OnbTrack {
  return s.track ?? "seo";
}

/** The steps belonging to one form (track). */
export function stepsForTrack(steps: OnbStep[], track: OnbTrack): OnbStep[] {
  return steps.filter((s) => stepTrack(s) === track);
}

/** The steps a client actually fills for a form: matching track, and only
 *  e-commerce steps when the client onboarding is flagged e-commerce. */
export function stepsForForm(
  steps: OnbStep[],
  opts: { track: OnbTrack; ecommerce: boolean },
): OnbStep[] {
  return steps.filter(
    (s) => stepTrack(s) === opts.track && (!s.ecommerce || opts.ecommerce),
  );
}

/** All fields, flattened, in order. */
export function flattenFields(steps: OnbStep[]): OnbField[] {
  return steps.flatMap((s) => s.fields);
}

/** Names of every required field (for progress + validation). */
export function requiredNames(steps: OnbStep[]): string[] {
  return flattenFields(steps)
    .filter((f) => f.required)
    .map((f) => f.name);
}

/** Unique sections, in order — drives the grouped ruler. */
export function sectionsOf(steps: OnbStep[]): { key: string; tag: string }[] {
  const seen = new Set<string>();
  const out: { key: string; tag: string }[] = [];
  for (const s of steps) {
    if (!seen.has(s.section)) {
      seen.add(s.section);
      out.push({ key: s.section, tag: s.sectionTag });
    }
  }
  return out;
}

/** Key under which a checkbox option's free-text "other" answer is stored. */
export function otherTextKey(fieldName: string, optionValue: string): string {
  return `${fieldName}__${optionValue}`;
}

/** All valid "other" text keys, derived from checkbox options flagged `other`. */
export function otherKeysOf(steps: OnbStep[]): string[] {
  return flattenFields(steps)
    .filter(isCheckbox)
    .flatMap((f) =>
      f.options.filter((o) => o.other).map((o) => otherTextKey(f.name, o.value)),
    );
}

export function findField(steps: OnbStep[], name: string): OnbField | null {
  return flattenFields(steps).find((f) => f.name === name) ?? null;
}

/** Human label for a checkbox option value. */
export function optionLabel(
  steps: OnbStep[],
  fieldName: string,
  value: string,
): string {
  const f = findField(steps, fieldName);
  if (!f || !isCheckbox(f)) return value;
  return f.options.find((o) => o.value === value)?.label ?? value;
}

// ---- Normalisation (for the KV override → guard against malformed data) ----

const FIELD_KINDS = ["short", "long", "checkbox", "file"] as const;

function normalizeField(raw: unknown): OnbField | null {
  if (!raw || typeof raw !== "object") return null;
  const name = (raw as { name?: unknown }).name;
  const label = (raw as { label?: unknown }).label;
  const rawKind = (raw as { kind?: unknown }).kind;
  if (typeof name !== "string" || !name.trim()) return null;
  if (typeof label !== "string") return null;
  if (!FIELD_KINDS.includes(rawKind as (typeof FIELD_KINDS)[number])) return null;
  const kind = rawKind as (typeof FIELD_KINDS)[number];
  const help =
    typeof (raw as { help?: unknown }).help === "string"
      ? (raw as { help: string }).help
      : undefined;
  const placeholder =
    typeof (raw as { placeholder?: unknown }).placeholder === "string"
      ? (raw as { placeholder: string }).placeholder
      : undefined;
  const required = Boolean((raw as { required?: unknown }).required);
  if (kind === "checkbox") {
    const rawOpts = (raw as { options?: unknown }).options;
    const options = Array.isArray(rawOpts)
      ? rawOpts
          .filter((o) => o && typeof o === "object")
          .map((o) => ({
            value: String((o as { value?: unknown }).value ?? ""),
            label: String((o as { label?: unknown }).label ?? ""),
            other: Boolean((o as { other?: unknown }).other) || undefined,
          }))
          .filter((o) => o.value && o.label)
      : [];
    return { kind: "checkbox", name, label, help, required, options };
  }
  if (kind === "file") {
    return { kind: "file", name, label, help, required };
  }
  return {
    kind: kind as "short" | "long",
    name,
    label,
    help,
    placeholder,
    required,
  };
}

/** Coerce arbitrary stored data into valid steps, or null if unusable. */
export function normalizeSteps(raw: unknown): OnbStep[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const steps: OnbStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const key = (s as { key?: unknown }).key;
    const section = (s as { section?: unknown }).section;
    const sectionTag = (s as { sectionTag?: unknown }).sectionTag;
    const title = (s as { title?: unknown }).title;
    const rawFields = (s as { fields?: unknown }).fields;
    if (typeof key !== "string" || typeof section !== "string") continue;
    const fields = Array.isArray(rawFields)
      ? rawFields
          .map(normalizeField)
          .filter((f): f is OnbField => f !== null)
      : [];
    if (fields.length === 0) continue;
    const trackRaw = (s as { track?: unknown }).track;
    const track: OnbTrack =
      trackRaw === "ads" || trackRaw === "common" ? trackRaw : "seo";
    const ecommerce = Boolean((s as { ecommerce?: unknown }).ecommerce) || undefined;
    steps.push({
      key,
      section,
      sectionTag: typeof sectionTag === "string" ? sectionTag : "",
      title: typeof title === "string" ? title : section,
      fields,
      track,
      ecommerce,
    });
  }
  return steps.length ? steps : null;
}
