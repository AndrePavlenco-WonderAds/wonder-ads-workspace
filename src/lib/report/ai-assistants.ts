// Os assistentes de IA do AI Visibility (secção 5 do relatório mensal).
// Módulo puro (sem GA4, sem KV): o gerador usa-o para dar nome às origens e o
// documento para desenhar os cartões, incluindo nos relatórios já gravados.
//
// PORQUE É QUE HÁ UMA LISTA FIXA (v78.84, pedido do André): o relatório só
// mostrava os assistentes que trouxeram visitas. Com só o ChatGPT no ecrã, o
// cliente não sabia se o Gemini estava a zero ou se nem sequer era medido.
// Agora os seis acompanhados aparecem sempre, a 0 quando não houve visitas,
// e o texto da secção diz quais são. Os outros (DeepSeek, Grok…) continuam a
// ser contados e só ganham cartão quando trazem alguém.

export type AiAssistantKey =
  | "chatgpt"
  | "gemini"
  | "copilot"
  | "perplexity"
  | "claude"
  | "mistral"
  | "deepseek"
  | "grok"
  | "you"
  | "phind";

type AiAssistant = {
  key: AiAssistantKey;
  label: string;
  /** Testados contra a origem da sessão no GA4 (`sessionSource`, um host).
   *  Também entram na deteção por domínio, por cima da lista guardada na
   *  config do cliente — essa lista fica congelada no KV ao gravar e não
   *  pode tirar nenhum destes do relatório. */
  patterns: string[];
};

/** Os seis que aparecem SEMPRE no relatório, por esta ordem quando estão
 *  empatados (a zero, tipicamente). */
export const TRACKED_AI_ASSISTANTS: readonly AiAssistant[] = [
  { key: "chatgpt", label: "ChatGPT", patterns: ["chatgpt", "openai"] },
  { key: "gemini", label: "Gemini", patterns: ["gemini"] },
  {
    key: "copilot",
    label: "Copilot",
    // O Copilot no Edge chega como `edgeservices.bing.com`; o antigo Bing
    // Chat é o mesmo produto, com outro nome.
    patterns: ["copilot", "edgeservices\\.bing\\.com", "\\.bing\\.com/chat"],
  },
  // Sem exigir o domínio: o GA4 regista muitas vezes `perplexity / (not set)`.
  { key: "perplexity", label: "Perplexity", patterns: ["perplexity"] },
  { key: "claude", label: "Claude", patterns: ["claude\\.ai"] },
  // O Le Chat da Mistral vive em chat.mistral.ai.
  { key: "mistral", label: "Mistral", patterns: ["mistral\\.ai"] },
];

/** Contados na mesma; só têm cartão quando trazem visitas. */
const OTHER_AI_ASSISTANTS: readonly AiAssistant[] = [
  { key: "deepseek", label: "DeepSeek", patterns: ["deepseek"] },
  { key: "grok", label: "Grok", patterns: ["grok"] },
  // Ancorado ao início do host ou a um ponto: sem isto apanhava «peekyou.com».
  { key: "you", label: "You.com", patterns: ["(^|\\.)you\\.com"] },
  { key: "phind", label: "Phind", patterns: ["phind"] },
];

const ALL_AI_ASSISTANTS = [...TRACKED_AI_ASSISTANTS, ...OTHER_AI_ASSISTANTS];

/** Padrões de deteção por domínio que têm de estar sempre ativos. */
export const AI_ASSISTANT_PATTERNS: string[] = ALL_AI_ASSISTANTS.flatMap(
  (a) => a.patterns,
);

const COMPILED = ALL_AI_ASSISTANTS.map((a) => ({
  key: a.key,
  label: a.label,
  res: a.patterns.map((p) => new RegExp(p, "i")),
}));

/** O assistente de uma origem do GA4, ou null quando não é nenhum dos
 *  conhecidos (uma origem nova que a Google pôs no canal «AI Assistant»). */
export function aiAssistantOf(
  source: string,
): { key: AiAssistantKey; label: string } | null {
  // «bing» sozinho só chega aqui depois de a origem já ter sido dada como
  // assistente (canal da Google ou lista de domínios) — é o Copilot.
  const s = source.toLowerCase();
  const hit = COMPILED.find((a) => a.res.some((re) => re.test(s)));
  if (hit) return { key: hit.key, label: hit.label };
  if (s.includes("bing")) return { key: "copilot", label: "Copilot" };
  return null;
}

/** «ChatGPT, Gemini, Copilot, Perplexity, Claude e Mistral». */
export function trackedAiAssistantsList(lang: "pt" | "en"): string {
  const labels = TRACKED_AI_ASSISTANTS.map((a) => a.label);
  const last = labels.pop();
  return `${labels.join(", ")} ${lang === "en" ? "and" : "e"} ${last}`;
}

export type AiAssistantCard = {
  /** Chave estável para o React: o assistente, ou a origem crua. */
  id: string;
  label: string;
  sessions: number;
  /** null quando nenhuma das origens trazia o mês anterior. */
  previousSessions: number | null;
  /** Todas as origens deste cartão vieram do canal da Google. */
  native: boolean;
  /** Um dos seis acompanhados, mesmo a zero. */
  tracked: boolean;
};

type SourceRow = {
  source: string;
  label: string;
  sessions: number;
  previousSessions?: number | null;
  native?: boolean;
};

/** Os cartões da secção: uma origem por assistente (chatgpt.com e openai
 *  somam no mesmo ChatGPT), os seis acompanhados sempre presentes, e os
 *  restantes só com visitas. Primeiro os que trouxeram mais gente; os que
 *  estão a zero ficam no fim, pela ordem da lista. */
export function aiAssistantCards(sources: SourceRow[]): AiAssistantCard[] {
  const cards = new Map<string, AiAssistantCard>();
  for (const a of TRACKED_AI_ASSISTANTS) {
    cards.set(a.key, {
      id: a.key,
      label: a.label,
      sessions: 0,
      previousSessions: null,
      native: true,
      tracked: true,
    });
  }
  for (const s of sources) {
    const who = aiAssistantOf(s.source);
    const id = who?.key ?? `src:${s.source}`;
    const card = cards.get(id) ?? {
      id,
      label: who?.label ?? s.label,
      sessions: 0,
      previousSessions: null,
      native: true,
      tracked: false,
    };
    card.sessions += s.sessions;
    if (typeof s.previousSessions === "number") {
      card.previousSessions = (card.previousSessions ?? 0) + s.previousSessions;
    }
    if (s.native === false) card.native = false;
    cards.set(id, card);
  }
  const order = new Map(
    TRACKED_AI_ASSISTANTS.map((a, i) => [a.key as string, i] as const),
  );
  return [...cards.values()]
    .filter((c) => c.tracked || c.sessions > 0)
    .sort(
      (a, b) =>
        b.sessions - a.sessions ||
        (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
    );
}
