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
  image?: { src: string; width: number; height: number; alt: string; caption: string };
  download?: { href: string; label: string; note: string };
};

export const JOURNEY_GUIDES: Record<string, JourneyGuide> = {
  "registo-leads": {
    id: "registo-leads",
    title: "Registo de leads e origem dos clientes",
    lead: "No 2.º mês (semana 8 do roadmap), o consultor pergunta ao cliente se conta quantas pessoas o contactam e vêm à clínica todos os meses, e se pergunta a cada uma de onde vem.",
    why: "É essencial para medir os resultados do projeto. O GA4 não sabe quem ligou, quem mandou mensagem ou quem apareceu ao balcão: só o cliente sabe, se contar e perguntar.",
    questions: [
      "Estão a contar quantas pessoas pedem informação, marcam e vêm à clínica todos os meses?",
      "Perguntam a cada pessoa como vos conheceu? Google, IAs como o ChatGPT, redes sociais, recomendação…",
      "Por que canal chegam: email, telefone, WhatsApp ou ao balcão?",
      "Têm os números do mesmo mês do ano passado, para compararmos?",
    ],
    steps: [
      "Na call do 2.º mês (semana 8 do roadmap), explicar porquê: sem estes números não se consegue mostrar o que o SEO trouxe ao negócio.",
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

/** Um id curto para uma tarefa ou um mês novo. */
export function newJourneyId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// O caminho de partida — seis meses por preencher pela direção, com um espaço
// por mês. Só o mês 2 já tem tarefa: o registo de leads (era a semana 8,
// pedido do André, 2026-10-29).
// ---------------------------------------------------------------------------

const LEADS_MONTH = 2;

export const DEFAULT_JOURNEY: Journey = {
  updatedAt: 0,
  updatedBy: null,
  months: Array.from({ length: 6 }, (_, mi) => {
    const id = `m${mi + 1}`;
    return {
      id,
      title: "",
      goal: "",
      blocks:
        mi + 1 === LEADS_MONTH
          ? [{ id: `${id}-registo-leads`, title: JOURNEY_GUIDES["registo-leads"].title, detail: "", guide: "registo-leads" }]
          : [{ id: `${id}-1`, title: "", detail: "", placeholder: true as const }],
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
