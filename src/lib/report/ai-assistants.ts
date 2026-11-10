// Os assistentes de IA do AI Visibility (secção 5 do relatório mensal).
// Módulo puro (sem GA4, sem KV): a camada GA4 usa-o para DETETAR as visitas
// (filtro no próprio GA4, v78.85), o gerador para lhes dar nome e o documento
// para desenhar os cartões, incluindo nos relatórios já gravados.
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
  | "meta"
  | "you"
  | "phind";

type AiAssistant = {
  key: AiAssistantKey;
  label: string;
  /** DETEÇÃO — o que conta como visita deste assistente. Testados contra a
   *  origem da sessão no GA4 (`sessionSource`: um host, ou o utm_source
   *  quando o link o traz). Ancorados ao host inteiro (v78.85): «chatgpt»
   *  solto apanhava `chatgpt.co` e `<qualquer-coisa>.chatgpt.site`, que não
   *  são o ChatGPT. Sintaxe RE2 — vão também no filtro do próprio GA4. */
  detect: string[];
  /** AGRUPAMENTO — a que cartão pertence uma origem que já foi dada como
   *  assistente (pelo canal da Google ou pela deteção). Mais largo de
   *  propósito, para os relatórios antigos continuarem a juntar-se bem. */
  match: string[];
};

/** Host exato ou subdomínio dele: `chatgpt.com`, `m.chatgpt.com`. */
const host = (h: string) => `(^|\\.)${h.replace(/\./g, "\\.")}$`;
/** O valor exato (utm_source=perplexity, sem domínio). */
const exact = (v: string) => `^${v.replace(/\./g, "\\.")}$`;

/** Os seis que aparecem SEMPRE no relatório, por esta ordem quando estão
 *  empatados (a zero, tipicamente). */
export const TRACKED_AI_ASSISTANTS: readonly AiAssistant[] = [
  {
    key: "chatgpt",
    label: "ChatGPT",
    // O ChatGPT põe utm_source=chatgpt.com nos links que dá.
    detect: [host("chatgpt.com"), exact("chatgpt"), host("chat.openai.com"), exact("openai")],
    match: ["chatgpt", "openai"],
  },
  {
    key: "gemini",
    label: "Gemini",
    detect: [host("gemini.google.com"), exact("gemini"), host("bard.google.com")],
    match: ["gemini", "bard"],
  },
  {
    key: "copilot",
    label: "Copilot",
    // O Copilot no Edge chega como `edgeservices.bing.com`; o antigo Bing
    // Chat é o mesmo produto, com outro nome.
    detect: [
      host("copilot.microsoft.com"),
      host("copilot.com"),
      exact("copilot"),
      exact("edgeservices.bing.com"),
    ],
    match: ["copilot", "bing"],
  },
  {
    key: "perplexity",
    label: "Perplexity",
    // Sem domínio também: o GA4 regista muitas vezes `perplexity / (not set)`.
    detect: [host("perplexity.ai"), exact("perplexity")],
    match: ["perplexity"],
  },
  {
    key: "claude",
    label: "Claude",
    detect: [host("claude.ai"), exact("claude")],
    match: ["claude"],
  },
  {
    key: "mistral",
    label: "Mistral",
    // O Le Chat da Mistral vive em chat.mistral.ai.
    detect: [host("mistral.ai"), exact("mistral")],
    match: ["mistral"],
  },
];

/** Contados na mesma; só têm cartão quando trazem visitas. */
const OTHER_AI_ASSISTANTS: readonly AiAssistant[] = [
  { key: "deepseek", label: "DeepSeek", detect: [host("deepseek.com"), exact("deepseek")], match: ["deepseek"] },
  { key: "grok", label: "Grok", detect: [host("grok.com"), exact("grok")], match: ["grok"] },
  { key: "meta", label: "Meta AI", detect: [host("meta.ai")], match: ["meta.ai"] },
  { key: "you", label: "You.com", detect: [host("you.com")], match: ["you.com"] },
  { key: "phind", label: "Phind", detect: [host("phind.com"), exact("phind")], match: ["phind"] },
];

const ALL_AI_ASSISTANTS = [...TRACKED_AI_ASSISTANTS, ...OTHER_AI_ASSISTANTS];

/** Os padrões de deteção, todos. */
export const AI_DETECT_PATTERNS: string[] = ALL_AI_ASSISTANTS.flatMap(
  (a) => a.detect,
);

/** Um só regex para o filtro `PARTIAL_REGEXP` do GA4 (RE2, sem maiúsculas). */
export function aiDetectRegex(extra: string[] = []): string {
  return [...AI_DETECT_PATTERNS, ...extra].map((p) => `(?:${p})`).join("|");
}

const DETECT_RES = AI_DETECT_PATTERNS.map((p) => new RegExp(p, "i"));

/** A origem é de um dos assistentes conhecidos (deteção estrita). */
export function isAiSource(source: string): boolean {
  const s = source.trim();
  return DETECT_RES.some((re) => re.test(s));
}

const COMPILED = ALL_AI_ASSISTANTS.map((a) => ({
  key: a.key,
  label: a.label,
  match: a.match,
}));

/** O assistente de uma origem do GA4, ou null quando não é nenhum dos
 *  conhecidos (uma origem nova que a Google pôs no canal «AI Assistant»). */
export function aiAssistantOf(
  source: string,
): { key: AiAssistantKey; label: string } | null {
  // «bing» só chega aqui depois de a origem já ter sido dada como assistente
  // (canal da Google ou deteção) — é o Copilot.
  const s = source.toLowerCase();
  const hit = COMPILED.find((a) => a.match.some((m) => s.includes(m)));
  return hit ? { key: hit.key, label: hit.label } : null;
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
