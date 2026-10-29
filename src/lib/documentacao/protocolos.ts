// Protocolos Obrigatórios e Recomendados (v78.46) — as listas do SEO DPT.
// Puro: tipos, as listas de partida e a validação. Em KV
// (`docs:protocolos:<lista>`) fica a versão que a direção edita na própria
// página; sem nada guardado, vale a lista daqui.

export const PROTOCOL_LISTS = ["obrigatorios", "recomendados"] as const;
export type ProtocolList = (typeof PROTOCOL_LISTS)[number];

export const MAX_PROTOCOLS = 40;

/** Sugestões para o campo da frequência — escreve-se o que se quiser. */
export const PROTOCOL_CADENCES = ["Semanal", "De 2 em 2 semanas", "Mensal", "Trimestral", "Em cada projeto novo"];

export type Protocol = {
  id: string;
  title: string;
  /** «Mensal», «De 2 em 2 semanas»… */
  cadence: string;
  detail: string;
};

export type ProtocolDoc = {
  items: Protocol[];
  /** 0 = a lista de partida, nunca editada. */
  updatedAt: number;
  updatedBy: string | null;
};

export function newProtocolId(): string {
  return `p-${Math.random().toString(36).slice(2, 9)}`;
}

export const DEFAULT_PROTOCOLS: Record<ProtocolList, ProtocolDoc> = {
  obrigatorios: {
    updatedAt: 0,
    updatedBy: null,
    items: [
      {
        id: "call-mensal",
        title: "Pelo menos uma call por mês com cada cliente",
        cadence: "Mensal",
        detail:
          "Agendada no Google Calendar, com o convite enviado ao cliente, antes de o mês começar. É a call em que se apresenta o Monthly Report e se combina o mês seguinte.",
      },
      {
        id: "weekly-report",
        title: "Weekly Report todas as sextas-feiras",
        cadence: "Semanal",
        detail:
          "Um ponto de situação no grupo de WhatsApp de cada cliente: o que se fez na semana e o que vem a seguir. Sai do estúdio de Weekly Reports, a partir dos daily updates.",
      },
      {
        id: "monthly-report",
        title: "Monthly Report até dia 2 do mês seguinte",
        cadence: "Mensal",
        detail: "Um relatório por cliente, feito na app e enviado em vídeo, sobre o mês que fechou.",
      },
    ],
  },
  recomendados: {
    updatedAt: 0,
    updatedBy: null,
    items: [
      {
        id: "call-bi-semanal",
        title: "Uma call de 2 em 2 semanas com todos os clientes",
        cadence: "De 2 em 2 semanas",
        detail:
          "Uma call curta para manter o cliente a par: menos surpresas, aprovações mais rápidas e uma relação mais próxima do que a call mensal sozinha consegue.",
      },
      {
        id: "surprise-news",
        title: "Uma boa notícia por mês fora do relatório",
        cadence: "Mensal",
        detail:
          "Uma keyword que subiu, uma lead nova, uma review: enviada quando acontece, no grupo do cliente. O cliente sente o progresso entre relatórios.",
      },
      {
        id: "ideia-proativa",
        title: "Uma ideia proativa por mês",
        cadence: "Mensal",
        detail:
          "Propor ao cliente uma ideia que não estava no roadmap: uma página nova, uma parceria, um conteúdo de época. Mostra que pensamos no negócio dele, não só nas tarefas.",
      },
    ],
  },
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** A lista limpa, ou null se algum protocolo não tiver título. Ids repetidos
 *  são refeitos. */
export function normalizeProtocols(raw: unknown): Pick<ProtocolDoc, "items"> | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(o.items)) return null;
  const seen = new Set<string>();
  const items: Protocol[] = [];
  for (const it of o.items.slice(0, MAX_PROTOCOLS)) {
    const p = (it ?? {}) as Record<string, unknown>;
    const title = text(p.title, 120);
    if (!title) return null;
    let id = typeof p.id === "string" && /^[a-z0-9-]{1,40}$/i.test(p.id) ? p.id : newProtocolId();
    while (seen.has(id)) id = newProtocolId();
    seen.add(id);
    items.push({ id, title, cadence: text(p.cadence, 40), detail: text(p.detail, 600) });
  }
  return { items };
}
