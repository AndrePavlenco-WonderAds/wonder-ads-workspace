// Jornada de Cliente (v78.46) — a parte comum a todos os projetos SEO, mês a
// mês e semana a semana. Puro: tipos, o caminho de partida e a validação. Em
// KV (`docs:jornada-cliente`) fica a versão que a direção edita na própria
// página; sem nada guardado, vale o caminho daqui.
//
// Cada mês tem um título, um objetivo, os marcos do mês (opcionais) e quatro
// semanas, como os roadmaps da app. Cada semana tem tarefas: na estrada vê-se
// só o título; a explicação abre num painel lateral (v78.48).

export const WEEKS_PER_JOURNEY_MONTH = 4;
export const MAX_JOURNEY_MONTHS = 12;
export const MAX_BLOCKS_PER_SLOT = 8;
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
export type JourneyWeek = { id: string; blocks: JourneyBlock[] };
export type JourneyMonth = {
  id: string;
  /** Vazio enquanto a direção não lhe der nome. */
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

/** Um id curto para uma tarefa, semana ou mês novo. */
export function newJourneyId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// O caminho de partida — seis meses por preencher pela direção, com um espaço
// por semana. Só a semana 8 já tem tarefa: o registo de leads (pedido do
// André, 2026-10-29).
// ---------------------------------------------------------------------------

const LEADS_WEEK = 8;

export const DEFAULT_JOURNEY: Journey = {
  updatedAt: 0,
  updatedBy: null,
  months: Array.from({ length: 6 }, (_, mi) => ({
    id: `m${mi + 1}`,
    title: "",
    goal: "",
    blocks: [],
    weeks: Array.from({ length: WEEKS_PER_JOURNEY_MONTH }, (_, wi) => {
      const week = mi * WEEKS_PER_JOURNEY_MONTH + wi + 1;
      const id = `s${week}`;
      return {
        id,
        blocks:
          week === LEADS_WEEK
            ? [{ id: `${id}-registo-leads`, title: JOURNEY_GUIDES["registo-leads"].title, detail: "", guide: "registo-leads" }]
            : [{ id: `${id}-1`, title: "", detail: "", placeholder: true as const }],
      };
    }),
  })),
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

function normalizeBlocks(raw: unknown, prefix: string): JourneyBlock[] | null {
  if (!Array.isArray(raw)) return [];
  const out: JourneyBlock[] = [];
  for (const item of raw.slice(0, MAX_BLOCKS_PER_SLOT)) {
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

/** O caminho limpo, ou null se alguma coisa não for válida (uma tarefa sem
 *  título que não seja um espaço por preencher, nenhum mês). Ids repetidos são
 *  refeitos. */
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
    const blocks = normalizeBlocks(mo.blocks, "marco");
    if (!blocks) return null;
    const rawWeeks = Array.isArray(mo.weeks) ? mo.weeks : [];
    const weeks: JourneyWeek[] = [];
    for (let i = 0; i < WEEKS_PER_JOURNEY_MONTH; i++) {
      const w = (rawWeeks[i] ?? {}) as Record<string, unknown>;
      const wb = normalizeBlocks(w.blocks, "tarefa");
      if (!wb) return null;
      weeks.push({ id: unique(idOf(w.id, newJourneyId("s")), "s"), blocks: wb.map((x) => ({ ...x, id: unique(x.id, "tarefa") })) });
    }
    months.push({
      id: unique(idOf(mo.id, newJourneyId("m")), "m"),
      title: line(mo.title, 80),
      goal: line(mo.goal, 240),
      blocks: blocks.map((x) => ({ ...x, id: unique(x.id, "marco") })),
      weeks,
    });
  }
  return { months };
}
