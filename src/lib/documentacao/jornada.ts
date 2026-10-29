// Jornada de Cliente (v78.46) — o caminho de um projeto SEO, mês a mês e
// semana a semana. Puro: tipos, o caminho de partida e a validação. Em KV
// (`docs:jornada-cliente`) fica a versão que a direção edita na própria página;
// sem nada guardado, vale o caminho daqui.
//
// Cada mês tem um título, um objetivo, os marcos do mês (o que fecha o mês ou
// se repete nele) e quatro semanas, como os roadmaps da app. Cada semana tem
// blocos: o que se faz nessa semana.

export const JOURNEY_KINDS = [
  { id: "cliente", label: "Cliente", color: "#e879f9" },
  { id: "reporting", label: "Reporting", color: "#fbbf24" },
  { id: "pesquisa", label: "Pesquisa", color: "#818cf8" },
  { id: "tecnico", label: "Técnico", color: "#22d3ee" },
  { id: "on-page", label: "On-Page", color: "#a78bfa" },
  { id: "conteudo", label: "Conteúdo", color: "#34d399" },
  { id: "local", label: "Local", color: "#fb923c" },
  { id: "off-page", label: "Off-Page", color: "#fb7185" },
  { id: "crescimento", label: "Crescimento", color: "#facc15" },
] as const;

export type JourneyKind = (typeof JOURNEY_KINDS)[number]["id"];

export const WEEKS_PER_JOURNEY_MONTH = 4;
export const MAX_JOURNEY_MONTHS = 12;
export const MAX_BLOCKS_PER_SLOT = 8;

export type JourneyBlock = {
  id: string;
  title: string;
  detail: string;
  kind: JourneyKind;
  /** Um processo com passo a passo (JOURNEY_GUIDES), que abre num painel
   *  lateral a partir do bloco. */
  guide?: string;
};
export type JourneyWeek = { id: string; blocks: JourneyBlock[] };
export type JourneyMonth = {
  id: string;
  title: string;
  goal: string;
  /** Os marcos do mês — o que o fecha ou se repete nele. */
  blocks: JourneyBlock[];
  weeks: JourneyWeek[];
};
export type Journey = {
  months: JourneyMonth[];
  /** 0 = o caminho de partida, nunca editado. */
  updatedAt: number;
  updatedBy: string | null;
};

export function journeyKind(id: string) {
  return JOURNEY_KINDS.find((k) => k.id === id) ?? JOURNEY_KINDS[0];
}

// ---------------------------------------------------------------------------
// Processos — o passo a passo de um bloco, num painel lateral. O conteúdo é
// rico (imagem, ficheiro para descarregar), por isso vive em código; o bloco
// guarda só o id e a direção move-o ou remove-o como outro qualquer.
// ---------------------------------------------------------------------------

export type JourneyGuide = {
  id: string;
  title: string;
  lead: string;
  /** Porque é que isto importa — uma ou duas frases. */
  why: string;
  /** O que perguntar ao cliente. */
  questions: string[];
  /** Como se faz, por ordem. */
  steps: string[];
  image?: { src: string; width: number; height: number; alt: string; caption: string };
  download?: { href: string; label: string; note: string };
};

export const JOURNEY_GUIDES: Record<string, JourneyGuide> = {
  "registo-leads": {
    id: "registo-leads",
    title: "Registo de leads e origem dos clientes",
    lead: "Na semana 8, o consultor pergunta ao cliente se conta quantas pessoas o contactam e vêm à clínica todos os meses, e se pergunta a cada uma de onde vem.",
    why: "É essencial para medir os resultados do projeto. O GA4 não sabe quem ligou, quem mandou mensagem ou quem apareceu ao balcão: só o cliente sabe, se contar e perguntar.",
    questions: [
      "Estão a contar quantas pessoas pedem informação, marcam e vêm à clínica todos os meses?",
      "Perguntam a cada pessoa como vos conheceu? Google, IAs como o ChatGPT, redes sociais, recomendação…",
      "Por que canal chegam: email, telefone, WhatsApp ou ao balcão?",
      "Têm os números do mesmo mês do ano passado, para compararmos?",
    ],
    steps: [
      "Na call da semana 8, explicar porquê: sem estes números não se consegue mostrar o que o SEO trouxe ao negócio.",
      "Se o cliente ainda não regista, enviar o modelo de Excel e combinar quem o preenche — normalmente a receção.",
      "Em cada contacto, a receção pergunta «Como nos conheceu?» e soma 1 na origem e no canal certos.",
      "No fim do mês, o cliente envia o ficheiro; os números entram no Monthly Report, comparados com o mesmo mês do ano anterior.",
    ],
    image: {
      src: "/documentacao/registo-leads-exemplo.png",
      width: 1914,
      height: 170,
      alt: "Exemplo de registo mensal: funil de curiosos, marcações, depósitos e visitas, e a origem das marcações por canal de contacto",
      caption: "Um exemplo de uma clínica: o funil do mês comparado com o ano anterior e a origem das marcações por canal. Não precisa de ser mais do que isto.",
    },
    download: {
      href: "/documentacao/modelo-registo-leads.xlsx",
      label: "Modelo de Excel — registo de leads",
      note: "Um separador por mês, com as contas feitas: o cliente só preenche as células amarelas.",
    },
  },
};

/** Um id curto para um bloco, semana ou mês novo. */
export function newJourneyId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// O caminho de partida — seis meses, do onboarding à renovação.
// ---------------------------------------------------------------------------

type Seed = [JourneyKind, string, string, string?];
const b = (prefix: string, items: Seed[]): JourneyBlock[] =>
  items.map(([kind, title, detail, guide], i) => ({
    id: `${prefix}-${i + 1}`,
    kind,
    title,
    detail,
    ...(guide ? { guide } : {}),
  }));

function month(n: number, title: string, goal: string, marcos: Seed[], weeks: Seed[][]): JourneyMonth {
  return {
    id: `m${n}`,
    title,
    goal,
    blocks: b(`m${n}-marco`, marcos),
    weeks: weeks.map((w, i) => ({ id: `m${n}-s${i + 1}`, blocks: b(`m${n}-s${i + 1}`, w) })),
  };
}

const MONTHLY_REPORT: Seed = [
  "reporting",
  "Monthly Report até dia 2",
  "O relatório do mês que fechou, pela app, enviado em vídeo e apresentado na call do mês.",
];
const nps = (n: number): Seed => [
  "cliente",
  `NPS do mês ${n}`,
  "Na última semana do mês: o formulário por SMS, uma semana de espera, um follow-up e, se não responder, uma call.",
];

export const DEFAULT_JOURNEY: Journey = {
  updatedAt: 0,
  updatedBy: null,
  months: [
    month(
      1,
      "Onboarding e fundações",
      "Conhecer o negócio, ter todos os acessos e sair do mês com o plano aprovado.",
      [
        ["reporting", "Weekly Report todas as sextas", "Desde a primeira semana, no grupo de WhatsApp do cliente: o que se fez e o que vem a seguir."],
        ["cliente", "Roadmap aprovado", "O mês fecha com o plano aprovado pelo cliente e todos os acessos registados na app."],
      ],
      [
        [
          ["pesquisa", "Ler o onboarding form", "Preencher os Do's, Dont's e Notes a partir do formulário e pedir já os acessos em falta: site, Google Business Profile, GA4 e Search Console."],
          ["pesquisa", "Keyword research e concorrência", "Keywords de SEO e prompts nas IAs (Searchable), os concorrentes locais e a proposta de target keywords."],
        ],
        [
          ["tecnico", "Site Audit", "Auditoria técnica inicial: indexação, velocidade, erros, estrutura e páginas em falta."],
          ["pesquisa", "Roadmap Client", "Transformar a auditoria e a research num plano mensal, priorizado, pronto a rever com o cliente."],
        ],
        [
          ["cliente", "Onboarding call", "Rever os quatro documentos com o cliente e combinar os protocolos: grupo de WhatsApp, Weekly Reports e Monthly Report com call."],
          ["tecnico", "Setup de tracking", "O cliente no Searchable e os eventos de conversão no GA4: chamadas, formulários e WhatsApp."],
        ],
        [["tecnico", "Primeiras correções técnicas", "Os erros críticos da auditoria: indexação, redirects, sitemap e robots."]],
      ],
    ),
    month(
      2,
      "On-page e técnico",
      "Pôr a casa em ordem: um site rápido, indexável e com as páginas certas para as target keywords.",
      [
        MONTHLY_REPORT,
        ["cliente", "Call mensal", "Pelo menos uma call no mês, marcada no calendário com o cliente."],
      ],
      [
        [
          ["on-page", "Títulos e meta descriptions", "Otimizar as páginas de serviço para as target keywords."],
          ["tecnico", "Velocidade", "Core Web Vitals: imagens, cache e o que estiver a atrasar o site."],
        ],
        [
          ["on-page", "Headings e links internos", "Uma estrutura clara em cada página e ligações entre os serviços relacionados."],
          ["tecnico", "Dados estruturados", "Schema do negócio, dos serviços e das perguntas frequentes."],
        ],
        [["local", "Google Business Profile", "Categorias, serviços, horários, fotos e descrição revistos; reviews respondidas."]],
        [
          [
            "cliente",
            "Registo de leads e origem dos clientes",
            "Perguntar ao cliente se conta os contactos e as visitas à clínica e de onde vêm. Sem isto não se medem os resultados do projeto.",
            "registo-leads",
          ],
          ["on-page", "Páginas em falta", "Propor as páginas que faltam: todos os serviços, a equipa, o sobre nós."],
          ["cliente", "Surprise news", "Partilhar a primeira vitória com o cliente: uma keyword a subir, uma lead, uma review."],
        ],
      ],
    ),
    month(
      3,
      "Conteúdo e presença local",
      "Começar a publicar com regularidade e reforçar a presença nas pesquisas locais.",
      [MONTHLY_REPORT, nps(3)],
      [
        [["conteudo", "Plano de conteúdo", "Calendário editorial a partir das keywords e das perguntas que os clientes fazem."]],
        [["conteudo", "Primeiros artigos", "Escrever, otimizar e enviar para aprovação do cliente."]],
        [["local", "Diretórios e citações", "Nome, morada e telefone iguais em todos os diretórios relevantes do setor."]],
        [
          ["cliente", "Enviar o NPS", "O formulário do mês 3, a tempo de o cliente responder antes de o mês fechar."],
          ["pesquisa", "Rever posições", "O que subiu, o que não mexeu e as prioridades do mês seguinte."],
        ],
      ],
    ),
    month(
      4,
      "Autoridade e GEO",
      "Ganhar autoridade fora do site e aparecer nas respostas das IAs.",
      [MONTHLY_REPORT, nps(4)],
      [
        [["off-page", "Estratégia de backlinks", "Lista de oportunidades: imprensa local, parceiros e diretórios do setor."]],
        [["off-page", "Primeiros backlinks e PR", "As primeiras ligações e menções conseguidas, registadas no roadmap."]],
        [["conteudo", "Conteúdo para as IAs", "Respostas diretas, FAQs e dados citáveis para os prompts do Searchable."]],
        [["crescimento", "Oportunidades de cross-sell", "Formulários, CRM, site: registar internamente o que pode ajudar o cliente a vender mais."]],
      ],
    ),
    month(
      5,
      "Escalar o que funciona",
      "Reforçar as páginas e os temas que já trazem tráfego e leads.",
      [MONTHLY_REPORT, nps(5)],
      [
        [["pesquisa", "Ler os resultados", "Que páginas, keywords e prompts estão a trazer tráfego e leads."]],
        [["conteudo", "Reforçar os vencedores", "Atualizar e expandir os conteúdos com melhor desempenho."]],
        [["on-page", "Conversão", "Testar os formulários e o caminho de uma lead no site e propor melhorias."]],
        [["cliente", "Leads por origem", "Rever com o cliente o registo de leads: quantas houve no mês e de onde vieram."]],
      ],
    ),
    month(
      6,
      "Consolidar e renovar",
      "Fechar o ciclo com resultados claros e o plano dos próximos seis meses.",
      [MONTHLY_REPORT, nps(6)],
      [
        [["pesquisa", "Overview dos seis meses", "O antes e o depois: tráfego, posições, leads e o que foi feito."]],
        [["crescimento", "Roadmap dos próximos seis meses", "A proposta do plano seguinte, a partir do que resultou."]],
        [["crescimento", "Reunião de renovação", "O overview, a proposta de roadmap e as plataformas de analytics abertas, prontas a mostrar."]],
        [["crescimento", "Registar a renovação", "A proposta registada na app. O ciclo seguinte começa no mês 1 do novo roadmap."]],
      ],
    ),
  ],
};

// ---------------------------------------------------------------------------
// Validação — o que chega do browser passa sempre por aqui antes de ir para KV.
// ---------------------------------------------------------------------------

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const idOf = (v: unknown, fallback: string) =>
  typeof v === "string" && /^[a-z0-9-]{1,40}$/i.test(v) ? v : fallback;

function normalizeBlocks(raw: unknown, prefix: string): JourneyBlock[] | null {
  if (!Array.isArray(raw)) return [];
  const out: JourneyBlock[] = [];
  for (const item of raw.slice(0, MAX_BLOCKS_PER_SLOT)) {
    const o = (item ?? {}) as Record<string, unknown>;
    const title = text(o.title, 90);
    if (!title) return null;
    const kind = JOURNEY_KINDS.some((k) => k.id === o.kind) ? (o.kind as JourneyKind) : "cliente";
    const guide = typeof o.guide === "string" && JOURNEY_GUIDES[o.guide] ? o.guide : undefined;
    out.push({ id: idOf(o.id, newJourneyId(prefix)), title, detail: text(o.detail, 400), kind, ...(guide ? { guide } : {}) });
  }
  return out;
}

/** O caminho limpo, ou null se alguma coisa não for válida (um título vazio,
 *  nenhum mês). Ids repetidos são refeitos. */
export function normalizeJourney(raw: unknown): Omit<Journey, "updatedAt" | "updatedBy"> | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(o.months) || o.months.length === 0) return null;
  const seen = new Set<string>();
  const unique = (id: string, prefix: string) => {
    let v = id;
    while (seen.has(v)) v = newJourneyId(prefix);
    seen.add(v);
    return v;
  };
  const months: JourneyMonth[] = [];
  for (const m of o.months.slice(0, MAX_JOURNEY_MONTHS)) {
    const mo = (m ?? {}) as Record<string, unknown>;
    const title = text(mo.title, 80);
    if (!title) return null;
    const blocks = normalizeBlocks(mo.blocks, "marco");
    if (!blocks) return null;
    const rawWeeks = Array.isArray(mo.weeks) ? mo.weeks : [];
    const weeks: JourneyWeek[] = [];
    for (let i = 0; i < WEEKS_PER_JOURNEY_MONTH; i++) {
      const w = (rawWeeks[i] ?? {}) as Record<string, unknown>;
      const wb = normalizeBlocks(w.blocks, "bloco");
      if (!wb) return null;
      weeks.push({ id: unique(idOf(w.id, newJourneyId("s")), "s"), blocks: wb.map((x) => ({ ...x, id: unique(x.id, "bloco") })) });
    }
    months.push({
      id: unique(idOf(mo.id, newJourneyId("m")), "m"),
      title,
      goal: text(mo.goal, 240),
      blocks: blocks.map((x) => ({ ...x, id: unique(x.id, "marco") })),
      weeks,
    });
  }
  return { months };
}
