// Leitura do plugin WordPress «WonderAds — IA no site» (v78.87).
//
// O plugin conta, no próprio site, os pedidos dos assistentes de IA que se
// identificam ao abrir uma página para responder a alguém (ChatGPT-User,
// Claude-User, Perplexity-User, MistralAI-User). É a única forma de ver o uso
// das APPS dos assistentes: a visita de quem clica na app chega ao GA4 sem
// origem («Direto»), mas o pedido da IA a ler a página chega ao site sempre.
//
// Fonte: o código do plugin está em `wordpress-plugins/wonderads-ia-no-site`;
// o .zip é público em /wp-plugin/ e os sites atualizam-se sozinhos a partir
// de /api/wp-plugin/ia-no-site (ver lib/report/wp-plugin-release.ts).

import "server-only";
import { randomUUID } from "node:crypto";
import type { DateRange } from "./report-dates";
import {
  AI_FETCH_ASSISTANTS,
  type AiFetchBlock,
  type AiFetchKey,
} from "./report-types";
import { IA_PLUGIN_RELEASE } from "./wp-plugin-release";

/** O nome com que cada assistente se identifica no pedido. */
export const AI_FETCH_AGENT: Record<AiFetchKey, string> = {
  chatgpt: "ChatGPT-User",
  claude: "Claude-User",
  perplexity: "Perplexity-User",
  mistral: "MistralAI-User",
};

const AGENT_TO_KEY = new Map<string, AiFetchKey>(
  AI_FETCH_ASSISTANTS.map((k) => [AI_FETCH_AGENT[k], k] as const),
);

const CLIENT_UA = "WonderAds-Workspace/1.0 (+https://workspace.wonder-ads.com)";
const TIMEOUT_MS = 12_000;

type PluginPayload = {
  plugin?: string;
  timezone?: string;
  days?: Record<string, Record<string, number>> | unknown[];
  pages?: { month: string; agent: string; path: string; count: number }[];
  lastTest?: { nonce?: string; agent?: string; path?: string; at?: number } | null;
  cache?: string[];
  /** AAAA-MM-DD do primeiro dia de contagem (plugin 1.1.0+). */
  since?: string;
  // ── plugin 1.1.0+ ──
  storage?: "table" | "option";
  /** Cada cache que o plugin reconhece e o que fez com ela. */
  caches?: PluginCacheStatus[];
  /** A última verificação que o site fez a si próprio (diária). */
  check?: PluginSelfCheck | null;
  env?: { wp?: string; php?: string; server?: string; multisite?: boolean; autoUpdate?: boolean };
  plugins?: string[];
};

export type PluginCacheStatus = {
  name: string;
  /** auto = o plugin ajusta sozinho · host = só o alojamento · manual = à mão. */
  handled: "auto" | "host" | "manual";
  applied: boolean;
  note?: string | null;
};

export type PluginSelfCheck = {
  at: number;
  verdict?: "ok" | "cache" | "blocked" | "error" | null;
  error?: string | null;
  agents?: Record<string, { reached: number; attempts: number; status: number[] }>;
  blocks?: {
    file: boolean;
    lines: { line: number; text: string; block: string | null; kind: "exclusion" | "possible-block" }[];
  };
};

export type PluginRead =
  | { ok: true; payload: PluginPayload }
  | { ok: false; status: number | null; message: string };

/** Lê o endpoint do plugin. `?rest_route=` funciona com ou sem permalinks
 *  bonitos; o `_` impede que uma cache de página sirva a resposta. */
export async function readPlugin(
  site: string,
  key: string,
  range?: { from: string; to: string },
): Promise<PluginRead> {
  const url = new URL(site);
  url.pathname = "/";
  url.searchParams.set("rest_route", "/wonderads/v1/ai-visibility");
  if (range) {
    url.searchParams.set("from", range.from);
    url.searchParams.set("to", range.to);
  }
  url.searchParams.set("_", String(Date.now()));
  try {
    const res = await fetch(url, {
      headers: { "X-WA-Key": key, "User-Agent": CLIENT_UA, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        status: res.status,
        message: "O site recusou a chave — copia-a outra vez de Definições → WonderAds IA.",
      };
    }
    if (res.status === 404) {
      return {
        ok: false,
        status: 404,
        message: "O plugin não respondeu — confirma que está instalado e ativo no WordPress.",
      };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, message: `O site respondeu ${res.status}.` };
    }
    const payload = (await res.json().catch(() => null)) as PluginPayload | null;
    if (!payload || typeof payload !== "object" || !payload.plugin) {
      return { ok: false, status: res.status, message: "Resposta inesperada do site." };
    }
    return { ok: true, payload };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: null, message: `Sem resposta do site (${msg}).` };
  }
}

/** Soma por assistente os dias dentro do intervalo. */
function sumRange(
  days: PluginPayload["days"],
  range: DateRange,
): Record<AiFetchKey, number> {
  const out = Object.fromEntries(AI_FETCH_ASSISTANTS.map((k) => [k, 0])) as Record<
    AiFetchKey,
    number
  >;
  if (!days || Array.isArray(days)) return out;
  for (const [day, counts] of Object.entries(days)) {
    if (day < range.startDate || day > range.endDate || !counts) continue;
    for (const [agent, n] of Object.entries(counts)) {
      const k = AGENT_TO_KEY.get(agent);
      if (k && typeof n === "number" && Number.isFinite(n)) out[k] += n;
    }
  }
  return out;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** «2026-11-10» → «10/11/2026», sem passar por Date (sem fusos). */
export function isoDayToPt(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** O primeiro dia em que o plugin contou alguma coisa. Os robôs de indexação
 *  e treino (ClaudeBot, GPTBot…) passam todos os dias, por isso o primeiro
 *  dia registado é, na prática, o dia da instalação. */
function firstCountedDay(payload: PluginPayload): string | null {
  if (payload.since && ISO_DAY.test(payload.since)) return payload.since;
  if (!payload.days || Array.isArray(payload.days)) return null;
  const days = Object.keys(payload.days).filter((d) => ISO_DAY.test(d)).sort();
  return days[0] ?? null;
}

/** O bloco do relatório: o mês e o anterior, numa só chamada ao site (o
 *  histórico inteiro — são no máximo 400 dias — para saber desde quando o
 *  plugin conta). Nunca lança: um site em baixo dá `status: "error"`. */
export async function fetchAiFetchBlock(
  site: string,
  key: string,
  current: DateRange,
  previous: DateRange,
): Promise<AiFetchBlock> {
  const read = await readPlugin(site, key);
  const empty = Object.fromEntries(
    AI_FETCH_ASSISTANTS.map((k) => [k, { value: 0, previous: null }]),
  ) as AiFetchBlock["byAssistant"];
  const blank = {
    source: "wp-plugin" as const,
    byAssistant: empty,
    total: 0,
    previousTotal: null,
    topPages: [],
  };
  if (!read.ok) return { ...blank, status: "error", message: read.message };

  const { payload } = read;
  // Um mês anterior à instalação não é «0 pedidos», é «não medido» — o
  // relatório do cliente não pode mostrar um zero que não aconteceu.
  const since = firstCountedDay(payload);
  if (!since) {
    return {
      ...blank,
      status: "pending",
      message: "o plugin responde mas ainda não registou nenhum pedido de IA.",
    };
  }
  if (since > current.endDate) {
    return {
      ...blank,
      status: "pending",
      message: `o plugin só começou a contar a ${isoDayToPt(since)} — este mês é anterior.`,
    };
  }
  const cur = sumRange(payload.days, current);
  const prev = sumRange(payload.days, previous);
  // Sem um dia registado antes do mês anterior começar, o «mês anterior» não
  // é zero, é desconhecido — e o relatório não pode inventar uma subida de 0 para N.
  const prevKnown = since <= previous.startDate;

  const byAssistant = Object.fromEntries(
    AI_FETCH_ASSISTANTS.map((k) => [k, { value: cur[k], previous: prevKnown ? prev[k] : null }]),
  ) as AiFetchBlock["byAssistant"];

  const month = current.startDate.slice(0, 7);
  const pageTotals = new Map<string, number>();
  for (const p of payload.pages ?? []) {
    if (p.month !== month || !AGENT_TO_KEY.has(p.agent)) continue;
    pageTotals.set(p.path, (pageTotals.get(p.path) ?? 0) + (Number(p.count) || 0));
  }
  const topPages = [...pageTotals]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, 8);

  const total = AI_FETCH_ASSISTANTS.reduce((t, k) => t + cur[k], 0);
  const previousTotal = prevKnown
    ? AI_FETCH_ASSISTANTS.reduce((t, k) => t + prev[k], 0)
    : null;
  return {
    source: "wp-plugin",
    status: "ok",
    message: null,
    since: since > current.startDate ? since : null,
    byAssistant,
    total,
    previousTotal,
    topPages,
  };
}

export type AiPluginTestAgent = {
  key: AiFetchKey;
  /** Quantos dos pedidos de teste chegaram ao WordPress. */
  reached: number;
  attempts: number;
  /** O `x-cache` (ou equivalente) de cada pedido — HIT = servido pela cache. */
  cacheStatus: (string | null)[];
  /** O código HTTP de cada pedido (403 = o site recusa esta IA). */
  httpStatus: number[];
};

/** Os robôs de pesquisa e de treino das IAs — só para ver se o site os deixa
 *  entrar (bloquear os de PESQUISA tira o site das respostas). */
export const CRAWLER_TEST_UA = {
  "OAI-SearchBot": { kind: "search", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot" },
  "Claude-SearchBot": { kind: "search", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)" },
  PerplexityBot: { kind: "search", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" },
  GPTBot: { kind: "training", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot" },
  ClaudeBot: { kind: "training", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" },
} as const;

export type CrawlerAccess = { name: string; kind: "search" | "training"; status: number | null };

export type AiPluginTest = {
  ok: boolean;
  /** TODOS os pedidos de teste chegaram ao WordPress. */
  reachedWordPress: boolean;
  /** Algum assistente levou 401/403/429… — o site recusa-o. */
  blocked: boolean;
  message: string;
  plugin: string | null;
  /** Há uma versão mais nova do plugin publicada no workspace. */
  latestPlugin: string;
  cache: string[];
  /** Cabeçalhos de cache do último pedido de teste — o que o serviu. */
  cacheHeaders: Record<string, string>;
  agents: AiPluginTestAgent[];
  crawlers: CrawlerAccess[];
  thisMonth: Record<AiFetchKey, number> | null;
  /** Robôs de indexação e treino este mês (não entram no relatório). */
  crawlersThisMonth: Record<string, number> | null;
  /** AAAA-MM-DD — desde quando o plugin conta. */
  since: string | null;
  // ── o que o plugin 1.1.0+ diz de si próprio ──
  caches: PluginCacheStatus[];
  selfCheck: PluginSelfCheck | null;
  storage: "table" | "option" | null;
  env: PluginPayload["env"] | null;
};

/** O pedido de cada assistente, como chega a um site (formato público). */
const TEST_UA: Record<AiFetchKey, string> = {
  chatgpt:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  claude:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
  perplexity:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
  mistral:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)",
};

const CACHE_HEADERS = [
  "x-cache",
  "x-litespeed-cache",
  "x-proxy-cache",
  "x-cache-status",
  "x-cacheable",
  "cf-cache-status",
  "age",
  "x-powered-by",
];

/** Códigos com que um site recusa um robô. */
export const BLOCK_STATUSES = new Set([401, 403, 406, 429, 444]);

/** Teste ponta a ponta: (1) o plugin responde com esta chave; (2) cada um dos
 *  4 assistentes pede a página inicial DUAS vezes, sem truques anti-cache, e
 *  vê-se se o pedido chegou ao WordPress. Duas, porque uma cache de página
 *  com a página expirada deixa passar o PRIMEIRO pedido (revalida em fundo
 *  com ele) e serve os seguintes — um teste de um só pedido dava «tudo
 *  certo» no WP Engine (visto a 10/11/2026); (3) os robôs de pesquisa e de
 *  treino das IAs entram no site? Todos os pedidos levam o cabeçalho de
 *  teste, que o plugin regista à parte: não entram nas contagens. */
export async function testAiPlugin(site: string, key: string): Promise<AiPluginTest> {
  const first = await readPlugin(site, key);
  const base = {
    latestPlugin: IA_PLUGIN_RELEASE.version,
    caches: [] as PluginCacheStatus[],
    selfCheck: null,
    storage: null,
    env: null,
    crawlers: [] as CrawlerAccess[],
  };
  if (!first.ok) {
    return {
      ...base,
      ok: false,
      reachedWordPress: false,
      blocked: false,
      message: first.message,
      plugin: null,
      cache: [],
      cacheHeaders: {},
      agents: [],
      thisMonth: null,
      crawlersThisMonth: null,
      since: null,
    };
  }
  // Só o lastTest interessa entre pedidos: um intervalo vazio deixa a resposta leve.
  const none = { from: "9999-12-31", to: "9999-12-31" };
  const agents: AiPluginTestAgent[] = [];
  let cacheHeaders: Record<string, string> = {};
  let failed: string | null = null;

  for (const k of AI_FETCH_ASSISTANTS) {
    const row: AiPluginTestAgent = { key: k, reached: 0, attempts: 0, cacheStatus: [], httpStatus: [] };
    for (let i = 0; i < 2; i++) {
      const nonce = randomUUID();
      try {
        const res = await fetch(new URL("/", site), {
          headers: { "User-Agent": TEST_UA[k], "X-WA-IA-Test": nonce },
          cache: "no-store",
          redirect: "follow",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        cacheHeaders = {};
        for (const h of CACHE_HEADERS) {
          const v = res.headers.get(h);
          if (v) cacheHeaders[h] = v;
        }
        row.cacheStatus.push(
          res.headers.get("x-cache") ??
            res.headers.get("x-litespeed-cache") ??
            res.headers.get("x-proxy-cache") ??
            res.headers.get("x-cache-status") ??
            null,
        );
        row.httpStatus.push(res.status);
        await res.arrayBuffer().catch(() => null);
      } catch (err) {
        failed = err instanceof Error ? err.message : String(err);
        continue;
      }
      row.attempts++;
      const after = await readPlugin(site, key, none);
      if (after.ok && after.payload.lastTest?.nonce === nonce) row.reached++;
    }
    agents.push(row);
  }

  // Os robôs de pesquisa e de treino: um pedido cada, em paralelo (com o
  // cabeçalho de teste, para não entrarem nas contagens).
  const crawlers: CrawlerAccess[] = await Promise.all(
    Object.entries(CRAWLER_TEST_UA).map(async ([name, c]) => {
      try {
        const res = await fetch(new URL("/", site), {
          headers: { "User-Agent": c.ua, "X-WA-IA-Test": `crawler-${randomUUID()}` },
          cache: "no-store",
          redirect: "follow",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        await res.arrayBuffer().catch(() => null);
        return { name, kind: c.kind, status: res.status };
      } catch {
        return { name, kind: c.kind, status: null };
      }
    }),
  );

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const month = await readPlugin(site, key, { from: monthStart, to: "9999-12-31" });
  const thisMonth = month.ok
    ? sumRange(month.payload.days, { startDate: monthStart, endDate: "9999-12-31" })
    : null;
  let crawlersThisMonth: Record<string, number> | null = null;
  if (month.ok && month.payload.days && !Array.isArray(month.payload.days)) {
    crawlersThisMonth = {};
    for (const counts of Object.values(month.payload.days)) {
      for (const [agent, n] of Object.entries(counts ?? {})) {
        if (AGENT_TO_KEY.has(agent) || typeof n !== "number") continue;
        crawlersThisMonth[agent] = (crawlersThisMonth[agent] ?? 0) + n;
      }
    }
  }
  const latest = month.ok ? month.payload : first.payload;
  const cache = latest.cache ?? [];

  const attempts = agents.reduce((t, a) => t + a.attempts, 0);
  const reached = agents.reduce((t, a) => t + a.reached, 0);
  const all = attempts > 0 && reached === attempts && attempts === AI_FETCH_ASSISTANTS.length * 2;
  const blockedAgents = agents.filter((a) => a.httpStatus.some((c) => BLOCK_STATUSES.has(c)));
  const via = cache.length ? ` (${cache.join(", ")})` : "";
  const names = AI_FETCH_ASSISTANTS.map((k) => AI_FETCH_AGENT[k]).join(", ");
  const htaccessBlocks = (latest.check?.blocks?.lines ?? []).filter((l) => l.kind === "possible-block");

  let message: string;
  if (attempts === 0) {
    message = `O plugin responde, mas os pedidos de teste à página inicial falharam (${failed ?? "sem resposta"}).`;
  } else if (blockedAgents.length > 0) {
    const who = blockedAgents.map((a) => AI_FETCH_AGENT[a.key]).join(", ");
    const where = htaccessBlocks.length
      ? ` A regra está no .htaccess (linha ${htaccessBlocks.map((l) => l.line).join(", ")}) — ver em Definições → WonderAds IA.`
      : " Não há regra no .htaccess: o bloqueio está no alojamento ou numa firewall — pede para deixarem entrar estes nomes.";
    message = `O site RECUSA os pedidos de ${who} (${[...new Set(blockedAgents.flatMap((a) => a.httpStatus.filter((c) => BLOCK_STATUSES.has(c))))].join("/")}): essa IA não consegue ler o site — nem para responder a quem pergunta por ele. Isto prejudica a visibilidade nas IAs, além da contagem.${where}`;
  } else if (all) {
    message = "Tudo certo — os pedidos dos 4 assistentes chegam ao WordPress e vão ser contados.";
  } else if (reached === 0) {
    message = `O plugin responde, mas a cache de página${via} serve os pedidos das IAs sem chegarem ao WordPress. Só são contados quando a página expira na cache, por isso os números vão ficar abaixo do real. Para contar tudo, a cache tem de deixar passar: ${names}.`;
  } else {
    message = `O plugin responde, mas só ${reached} de ${attempts} pedidos de teste chegaram ao WordPress — a cache de página${via} serve os outros. Os pedidos das IAs só são contados quando a página expira na cache, por isso os números vão ficar abaixo do real. Para contar tudo, a cache tem de deixar passar: ${names}.`;
  }

  return {
    ok: all && blockedAgents.length === 0,
    reachedWordPress: all,
    blocked: blockedAgents.length > 0,
    message,
    plugin: first.payload.plugin ?? null,
    latestPlugin: IA_PLUGIN_RELEASE.version,
    cache,
    cacheHeaders,
    agents,
    crawlers,
    thisMonth,
    crawlersThisMonth,
    since: firstCountedDay(first.payload),
    caches: latest.caches ?? [],
    selfCheck: latest.check ?? null,
    storage: latest.storage ?? null,
    env: latest.env ?? null,
  };
}
