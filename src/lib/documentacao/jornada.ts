// Jornada de Cliente (v78.46) — a parte comum a todos os projetos SEO, mês a
// mês. Puro: tipos, o caminho de partida e a validação. Em KV
// (`docs:jornada-cliente`) fica a versão que a direção edita na própria
// página; sem nada guardado, vale o caminho daqui.
//
// Cada mês tem um título, um objetivo e as tarefas do mês: na estrada vê-se
// só o título de cada uma; a explicação abre num painel lateral (v78.48).
// Até à v78.56 cada mês tinha quatro semanas e os «marcos do mês»; o que
// estiver guardado nesse formato junta-se no mês ao ler (normalizeJourney).

export const MAX_JOURNEY_MONTHS = 12;
/** As tarefas de um mês — o que antes cabia nas quatro semanas e nos marcos. */
export const MAX_BLOCKS_PER_MONTH = 24;
/** O limite antigo de cada semana e dos marcos (só para ler o formato antigo). */
const LEGACY_MAX_PER_SLOT = 8;
/** A explicação de uma tarefa pode ter vários parágrafos. */
export const MAX_DETAIL_CHARS = 4000;

export type JourneyBlock = {
  id: string;
  /** Vazio só num espaço por preencher. */
  title: string;
  /** A explicação da tarefa, mostrada no painel lateral. */
  detail: string;
  /** Um processo com passo a passo (JOURNEY_GUIDES), mostrado no painel
   *  por baixo da explicação. */
  guide?: string;
  /** Um espaço por preencher pela direção: na estrada lê-se «Tarefa por
   *  definir»; deixa de o ser quando se grava com um título. */
  placeholder?: true;
};
export type JourneyMonth = {
  id: string;
  /** Vazio enquanto a direção não lhe der nome. */
  title: string;
  goal: string;
  /** As tarefas do mês, pela ordem em que se fazem. */
  blocks: JourneyBlock[];
};
export type Journey = {
  months: JourneyMonth[];
  /** 0 = o caminho de partida, nunca editado. */
  updatedAt: number;
  updatedBy: string | null;
};

export const PLACEHOLDER_TITLE = "Tarefa por definir";

// ---------------------------------------------------------------------------
// Processos — o passo a passo de uma tarefa, no painel lateral. O conteúdo é
// rico (imagem, ficheiro para descarregar), por isso vive em código; a tarefa
// guarda só o id e a direção move-a ou remove-a como outra qualquer.
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
  /** A ferramenta que cada cliente recebe para o processo (v78.73: a página
   *  de registo da Origem de Pacientes), com um exemplo real e o link dele.
   *  Com ferramenta, a imagem e o ficheiro em baixo passam a ser a alternativa. */
  tool?: {
    title: string;
    intro: string;
    image: { src: string; width: number; height: number; alt: string; caption: string };
    example: { href: string; label: string; note: string };
  };
  image?: { src: string; width: number; height: number; alt: string; caption: string };
  download?: { href: string; label: string; note: string };
};

export const JOURNEY_GUIDES: Record<string, JourneyGuide> = {
  "registo-leads": {
    id: "registo-leads",
    title: "Registo de leads e origem dos clientes",
    lead: "No 2.º mês (semana 8 do roadmap), o consultor pergunta ao cliente se conta quantas pessoas o contactam e vêm à clínica todos os meses, e se pergunta a cada uma de onde vem. Todos os clientes passam a ter uma página própria para este registo, aberta num tablet ou no computador da receção.",
    why: "É essencial para medir os resultados do projeto. O GA4 não sabe quem ligou, quem mandou mensagem ou quem apareceu ao balcão: só o cliente sabe, se contar e perguntar.",
    questions: [
      "Estão a contar quantas pessoas pedem informação, marcam e vêm à clínica todos os meses?",
      "Perguntam a cada pessoa como vos conheceu? Google, IAs como o ChatGPT, redes sociais, recomendação…",
      "Por que canal chegam: email, telefone, WhatsApp ou ao balcão?",
      "Têm os números do mesmo mês do ano passado, para compararmos?",
      "Há um tablet ou um computador na receção onde possa ficar aberta a página do registo?",
    ],
    steps: [
      "Na call do 2.º mês (semana 8 do roadmap), explicar porquê: sem estes números não se consegue mostrar o que o SEO trouxe ao negócio.",
      "Combinar onde se regista (um tablet ou o computador da receção) e quem regista: normalmente a receção.",
      "Pedir à direção a página de registo do cliente, com as clínicas, as origens e os canais certos, e o PIN de 6 dígitos para a receção.",
      "No aparelho da receção, abrir a página e escrever o PIN uma vez: fica guardado 180 dias. No tablet, «Adicionar ao ecrã principal» abre-a como uma app.",
      "Em cada contacto novo, a receção pergunta «Como nos conheceu?» e toca na origem e depois no canal. Um engano desfaz-se no «Anular», durante 20 segundos.",
      "No fim do mês, os números estão no separador Relatórios da página e no chip «Origem» da ficha do cliente no SEO DPT; entram no Monthly Report, comparados com o mesmo mês do ano anterior.",
    ],
    tool: {
      title: "A página de registo na receção",
      intro:
        "Cada cliente tem a sua página de registo, com a marca dele, num link próprio (/<cliente>/origem). Abre-se num tablet ou no computador da receção e cada pessoa nova fica registada em dois toques: a origem e o canal. Os números ficam logo contados por mês e por clínica, sem ficheiro para enviar.",
      image: {
        src: "/documentacao/registo-leads-tablet-exemplo.png",
        width: 2360,
        height: 1640,
        alt: "A página de registo da MyMedic num tablet: as origens em teclas grandes (Google, ChatGPT ou outra IA, redes sociais, recomendação…) e os registos de hoje à direita",
        caption: "O exemplo da MyMedic, num tablet: a receção toca na origem, escolhe o canal e o registo aparece em «Hoje». Os registos desta imagem são de exemplo.",
      },
      example: {
        href: "/mymedic/origem",
        label: "Ver o exemplo: MyMedic",
        note: "O piloto, desde 03/11/2026. Com a sessão da equipa entra-se sem PIN; é só para ver, porque o que se registar ali conta nos números da clínica.",
      },
    },
    image: {
      src: "/documentacao/registo-leads-exemplo.png",
      width: 1914,
      height: 170,
      alt: "Exemplo de registo mensal: funil de curiosos, marcações, depósitos e visitas, e a origem das marcações por canal de contacto",
      caption: "Enquanto a página do cliente não está pronta, fica o Excel: o funil do mês comparado com o ano anterior e a origem das marcações por canal. Não precisa de ser mais do que isto.",
    },
    download: {
      href: "/documentacao/modelo-registo-leads.xlsx",
      label: "Modelo de Excel — registo de leads",
      note: "A alternativa sem tablet nem computador: um separador por mês, com as contas feitas. O cliente só preenche as células amarelas e envia-o no fim do mês.",
    },
  },
};

/** Um id curto para uma tarefa ou um mês novo. */
export function newJourneyId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// O caminho de partida — seis meses por preencher pela direção, com um espaço
// por mês. Tarefas já dadas pelo André: no mês 1, confirmar a medição dos
// contactos do site (v78.67); no mês 2, o registo de leads (era a semana 8,
// 2026-10-29; a página de registo na receção entrou na v78.73); no mês 3,
// avaliar a reunião presencial (v78.67).
//
// Mudar este caminho em código = entrada em CODE_DOC_UPDATES (updates-log.ts)
// na mesma versão, para o aviso chegar ao sino do SEO DPT. As edições feitas
// na própria página registam-se sozinhas (PUT /api/documentacao/[doc]).
// ---------------------------------------------------------------------------

export const TRACKING_TASK_TITLE = "Confirmar que todos os contactos do site são medidos no GTM/GA4";
export const MEETING_TASK_TITLE = "Avaliar uma reunião presencial com o cliente";

const SEEDED_BLOCKS: Record<number, JourneyBlock[]> = {
  1: [
    {
      id: "m1-medicao-contactos",
      title: TRACKING_TASK_TITLE,
      detail:
        "Conferir se todos os contactos do site estão a ser medidos no GTM/GA4: telefone, WhatsApp, formulário e direções.\n\nSem isto, o registo de leads do mês 2 já começa incompleto.",
    },
  ],
  2: [{ id: "m2-registo-leads", title: JOURNEY_GUIDES["registo-leads"].title, detail: "", guide: "registo-leads" }],
  3: [
    {
      id: "m3-reuniao-presencial",
      title: MEETING_TASK_TITLE,
      detail:
        "Conferir se vale a pena reunirmos presencialmente com o cliente, com o team leader e com o consultor do projeto.\n\nSó se aplica a clientes de Portugal continental.",
    },
  ],
};

export const DEFAULT_JOURNEY: Journey = {
  updatedAt: 0,
  updatedBy: null,
  months: Array.from({ length: 6 }, (_, mi) => {
    const id = `m${mi + 1}`;
    return {
      id,
      title: "",
      goal: "",
      blocks: SEEDED_BLOCKS[mi + 1] ?? [{ id: `${id}-1`, title: "", detail: "", placeholder: true as const }],
    };
  }),
};

// ---------------------------------------------------------------------------
// Validação — o que chega do browser passa sempre por aqui antes de ir para KV.
// ---------------------------------------------------------------------------

const line = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
/** Texto com parágrafos: mantém as quebras de linha, tira o resto do ruído. */
const prose = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((l) => l.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, max)
    : "";
const idOf = (v: unknown, fallback: string) =>
  typeof v === "string" && /^[a-z0-9-]{1,40}$/i.test(v) ? v : fallback;

function normalizeBlocks(raw: unknown, prefix: string, max: number): JourneyBlock[] | null {
  if (!Array.isArray(raw)) return [];
  const out: JourneyBlock[] = [];
  for (const item of raw.slice(0, max)) {
    const o = (item ?? {}) as Record<string, unknown>;
    const title = line(o.title, 90);
    const placeholder = o.placeholder === true && !title;
    if (!title && !placeholder) return null;
    const guide = typeof o.guide === "string" && JOURNEY_GUIDES[o.guide] ? o.guide : undefined;
    out.push({
      id: idOf(o.id, newJourneyId(prefix)),
      title,
      detail: prose(o.detail, MAX_DETAIL_CHARS),
      ...(guide ? { guide } : {}),
      ...(placeholder ? { placeholder: true as const } : {}),
    });
  }
  return out;
}

/** As tarefas de um mês guardado no formato antigo (até à v78.56): os marcos
 *  do mês e depois as quatro semanas, por ordem. Os espaços por preencher
 *  juntam-se: com uma tarefa a sério já não fazem falta; sem nenhuma, fica um. */
function legacyMonthBlocks(mo: Record<string, unknown>): JourneyBlock[] | null {
  const all: JourneyBlock[] = [];
  for (const raw of [mo.blocks, ...(mo.weeks as unknown[]).map((w) => ((w ?? {}) as Record<string, unknown>).blocks)]) {
    const list = normalizeBlocks(raw, "tarefa", LEGACY_MAX_PER_SLOT);
    if (!list) return null;
    all.push(...list);
  }
  const real = all.filter((b) => !b.placeholder);
  return real.length > 0 ? real : all.slice(0, 1);
}

/** O caminho limpo, ou null se alguma coisa não for válida (uma tarefa sem
 *  título que não seja um espaço por preencher, nenhum mês). Ids repetidos são
 *  refeitos. Lê também o formato antigo, com semanas. */
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
    const blocks = Array.isArray(mo.weeks) ? legacyMonthBlocks(mo) : normalizeBlocks(mo.blocks, "tarefa", MAX_BLOCKS_PER_MONTH);
    if (!blocks) return null;
    months.push({
      id: unique(idOf(mo.id, newJourneyId("m")), "m"),
      title: line(mo.title, 80),
      goal: line(mo.goal, 240),
      blocks: blocks.slice(0, MAX_BLOCKS_PER_MONTH).map((x) => ({ ...x, id: unique(x.id, "tarefa") })),
    });
  }
  return { months };
}
