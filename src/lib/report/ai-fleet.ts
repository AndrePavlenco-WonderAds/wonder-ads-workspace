// «IA no site» de TODOS os clientes SEO ativos (v78.92): as IAs conseguem
// ler cada site? Que plataforma é? O plugin WordPress está ligado e a contar?
//
// Para cada site, pedidos à página inicial como um browser normal e como
// cada IA (os 4 assistentes + os 3 robôs de pesquisa). Um 401/403/429/… a
// uma IA quando o browser entra = o site recusa essa IA — ela não consegue
// ler o site nem para responder a quem pergunta por ele (visto no Mimus e na
// Sentir Saúde a 11/11/2026, confirmado pelo próprio ChatGPT). Os pedidos
// levam o cabeçalho de teste do plugin: não entram nas contagens.
//
// O resultado fica em KV (`ai-fleet:last`) para a página abrir sem esperar.

import "server-only";
import { kv } from "@vercel/kv";
import { randomUUID } from "node:crypto";
import { readPlugin, BLOCK_STATUSES, type PluginCacheStatus } from "./wp-ai-visibility";

const KEY = "ai-fleet:last";
const TIMEOUT_MS = 12_000;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Quem testamos: os 4 assistentes (abrem a página quando alguém pergunta)
 *  e os robôs de pesquisa (indexam o site para as respostas). */
export const FLEET_AGENTS = [
  { name: "ChatGPT-User", label: "ChatGPT", kind: "user", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot" },
  { name: "Claude-User", label: "Claude", kind: "user", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)" },
  { name: "Perplexity-User", label: "Perplexity", kind: "user", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)" },
  { name: "MistralAI-User", label: "Mistral", kind: "user", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)" },
  { name: "OAI-SearchBot", label: "ChatGPT Search", kind: "search", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot" },
  { name: "PerplexityBot", label: "Perplexity (pesquisa)", kind: "search", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" },
  { name: "Claude-SearchBot", label: "Claude (pesquisa)", kind: "search", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)" },
] as const;

export type FleetPlatform = "WordPress" | "Shopify" | "Squarespace" | "Wix" | "Webflow" | "outra" | "?";

export type FleetRow = {
  slug: string;
  title: string;
  site: string | null;
  platform: FleetPlatform;
  /** Código HTTP do browser normal (null = o site não respondeu). */
  browser: number | null;
  agents: { name: string; label: string; kind: "user" | "search"; status: number | null }[];
  /** Os nomes recusados (só conta se o browser entrou). */
  blocked: string[];
  plugin: {
    connected: boolean;
    ok: boolean;
    version: string | null;
    verdict: "ok" | "cache" | "blocked" | "error" | null;
    caches: PluginCacheStatus[];
    since: string | null;
    message: string | null;
  };
  checkedAt: number;
};

export type FleetSnapshot = { at: number; rows: FleetRow[] };

export type FleetClient = {
  slug: string;
  title: string;
  site: string | null;
  pluginSite: string | null;
  pluginKey: string | null;
};

function detectPlatform(html: string, headers: Headers): FleetPlatform {
  if (headers.get("x-shopid") || headers.get("x-shopify-stage") || /cdn\.shopify\.com/i.test(html)) return "Shopify";
  if (/squarespace/i.test(html) || (headers.get("server") ?? "").toLowerCase().includes("squarespace")) return "Squarespace";
  if (headers.get("x-wix-request-id") || /static\.wixstatic\.com/i.test(html)) return "Wix";
  if (/webflow/i.test(headers.get("x-powered-by") ?? "") || /data-wf-site/i.test(html)) return "Webflow";
  if (/\/wp-content\/|\/wp-includes\//i.test(html) || /api\.w\.org/i.test(headers.get("link") ?? "")) return "WordPress";
  return "outra";
}

async function get(url: string, ua: string): Promise<{ status: number | null; html: string; headers: Headers | null }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ua, "X-WA-IA-Test": `fleet-${randomUUID()}`, Accept: "text/html,*/*" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const html = (await res.text().catch(() => "")).slice(0, 200_000);
    return { status: res.status, html, headers: res.headers };
  } catch {
    return { status: null, html: "", headers: null };
  }
}

/** Um site: browser + cada IA, um pedido de cada vez (em paralelo, um WAF
 *  podia ver uma rajada e responder 429 a tudo). */
export async function checkFleetClient(c: FleetClient): Promise<FleetRow> {
  const row: FleetRow = {
    slug: c.slug,
    title: c.title,
    site: c.site,
    platform: "?",
    browser: null,
    agents: [],
    blocked: [],
    plugin: {
      connected: Boolean(c.pluginSite && c.pluginKey),
      ok: false,
      version: null,
      verdict: null,
      caches: [],
      since: null,
      message: null,
    },
    checkedAt: Date.now(),
  };
  if (c.site) {
    const home = new URL("/", c.site).toString();
    const base = await get(home, BROWSER_UA);
    row.browser = base.status;
    if (base.headers) row.platform = detectPlatform(base.html, base.headers);
    for (const a of FLEET_AGENTS) {
      const r = await get(home, a.ua);
      row.agents.push({ name: a.name, label: a.label, kind: a.kind, status: r.status });
    }
    const browserIn = row.browser !== null && row.browser < 400;
    row.blocked = browserIn
      ? row.agents.filter((a) => a.status !== null && BLOCK_STATUSES.has(a.status)).map((a) => a.name)
      : [];
  }
  if (c.pluginSite && c.pluginKey) {
    const read = await readPlugin(c.pluginSite, c.pluginKey, { from: "9999-12-31", to: "9999-12-31" });
    if (read.ok) {
      row.plugin.ok = true;
      row.plugin.version = read.payload.plugin ?? null;
      row.plugin.verdict = read.payload.check?.verdict ?? null;
      row.plugin.caches = read.payload.caches ?? [];
      row.plugin.since = read.payload.since ?? null;
    } else {
      row.plugin.message = read.message;
    }
  }
  return row;
}

/** Todos, 5 sites de cada vez. */
export async function runFleetCheck(clients: FleetClient[]): Promise<FleetSnapshot> {
  const rows: FleetRow[] = new Array(clients.length);
  let next = 0;
  const worker = async () => {
    while (next < clients.length) {
      const i = next++;
      rows[i] = await checkFleetClient(clients[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, clients.length) }, worker));
  const snap = { at: Date.now(), rows };
  await kv.set(KEY, snap).catch(() => null);
  return snap;
}

export async function getFleetSnapshot(): Promise<FleetSnapshot | null> {
  try {
    const s = await kv.get<FleetSnapshot>(KEY);
    return s && Array.isArray(s.rows) ? s : null;
  } catch {
    return null;
  }
}
