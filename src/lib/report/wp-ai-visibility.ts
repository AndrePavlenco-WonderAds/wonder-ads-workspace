// Leitura do plugin WordPress «WonderAds — IA no site» (v78.87).
//
// O plugin conta, no próprio site, os pedidos dos assistentes de IA que se
// identificam ao abrir uma página para responder a alguém (ChatGPT-User,
// Claude-User, Perplexity-User, MistralAI-User). É a única forma de ver o uso
// das APPS dos assistentes: a visita de quem clica na app chega ao GA4 sem
// origem («Direto»), mas o pedido da IA a ler a página chega ao site sempre.
//
// Fonte: o código do plugin está em `wordpress-plugins/wonderads-ia-no-site`
// e o .zip em /seo/plugin/ (refazer com scripts/wordpress-zip-ia-plugin.sh).

import "server-only";
import { randomUUID } from "node:crypto";
import type { DateRange } from "./report-dates";
import {
  AI_FETCH_ASSISTANTS,
  type AiFetchBlock,
  type AiFetchKey,
} from "./report-types";

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

/** O bloco do relatório: o mês e o anterior, numa só chamada ao site.
 *  Nunca lança — um site em baixo dá `status: "error"` com a razão. */
export async function fetchAiFetchBlock(
  site: string,
  key: string,
  current: DateRange,
  previous: DateRange,
): Promise<AiFetchBlock> {
  const read = await readPlugin(site, key, {
    from: previous.startDate,
    to: current.endDate,
  });
  const empty = Object.fromEntries(
    AI_FETCH_ASSISTANTS.map((k) => [k, { value: 0, previous: null }]),
  ) as AiFetchBlock["byAssistant"];
  if (!read.ok) {
    return {
      source: "wp-plugin",
      status: "error",
      message: read.message,
      byAssistant: empty,
      total: 0,
      previousTotal: null,
      topPages: [],
    };
  }
  const { payload } = read;
  const cur = sumRange(payload.days, current);
  const prev = sumRange(payload.days, previous);
  // O plugin só começou a contar no dia em que foi instalado: se não há um
  // único dia registado antes do mês, o «mês anterior» não é zero, é
  // desconhecido — e o relatório não pode inventar uma subida de 0 para N.
  const firstDay =
    payload.days && !Array.isArray(payload.days)
      ? Object.keys(payload.days).sort()[0]
      : undefined;
  const prevKnown = Boolean(firstDay && firstDay <= previous.startDate);

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
  return { source: "wp-plugin", status: "ok", message: null, byAssistant, total, previousTotal, topPages };
}

export type AiPluginTest = {
  ok: boolean;
  /** O pedido de teste chegou ao WordPress (não foi servido da cache). */
  reachedWordPress: boolean;
  message: string;
  plugin: string | null;
  cache: string[];
  /** Cabeçalhos de cache da resposta ao pedido de teste — o que a serviu. */
  cacheHeaders: Record<string, string>;
  thisMonth: Record<AiFetchKey, number> | null;
};

/** Teste ponta a ponta: (1) o plugin responde com esta chave; (2) um pedido
 *  a fingir ser o ChatGPT-User, à página inicial e SEM truques anti-cache,
 *  chega ao WordPress — se a cache de página o servir, o plugin nunca o vê,
 *  e é isso que o teste tem de apanhar. O pedido de teste leva um cabeçalho
 *  que o plugin regista à parte: não entra nas contagens. */
export async function testAiPlugin(site: string, key: string): Promise<AiPluginTest> {
  const first = await readPlugin(site, key);
  if (!first.ok) {
    return {
      ok: false,
      reachedWordPress: false,
      message: first.message,
      plugin: null,
      cache: [],
      cacheHeaders: {},
      thisMonth: null,
    };
  }
  const nonce = randomUUID();
  const cacheHeaders: Record<string, string> = {};
  try {
    const res = await fetch(new URL("/", site), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
        "X-WA-IA-Test": nonce,
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    for (const h of [
      "x-cache",
      "x-litespeed-cache",
      "x-proxy-cache",
      "x-cache-status",
      "cf-cache-status",
      "age",
      "x-powered-by",
    ]) {
      const v = res.headers.get(h);
      if (v) cacheHeaders[h] = v;
    }
    await res.arrayBuffer().catch(() => null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reachedWordPress: false,
      message: `O plugin responde, mas o pedido de teste à página inicial falhou (${msg}).`,
      plugin: first.payload.plugin ?? null,
      cache: first.payload.cache ?? [],
      cacheHeaders,
      thisMonth: null,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const after = await readPlugin(site, key, { from: monthStart, to: "9999-12-31" });
  const reached = after.ok && after.payload.lastTest?.nonce === nonce;
  const thisMonth = after.ok
    ? sumRange(after.payload.days, { startDate: monthStart, endDate: "9999-12-31" })
    : null;
  const cache = (after.ok ? after.payload.cache : first.payload.cache) ?? [];

  return {
    ok: reached,
    reachedWordPress: reached,
    message: reached
      ? "Tudo certo — o plugin responde e os pedidos das IAs chegam ao WordPress."
      : `O plugin responde, mas o pedido de teste foi servido pela cache de página sem chegar ao WordPress${cache.length ? ` (${cache.join(", ")})` : ""}. Os pedidos das IAs às páginas em cache não vão ser contados até estes assistentes saírem da cache.`,
    plugin: first.payload.plugin ?? null,
    cache,
    cacheHeaders,
    thisMonth,
  };
}
