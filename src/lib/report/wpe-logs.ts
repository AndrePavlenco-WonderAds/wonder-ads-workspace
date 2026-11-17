// Registos do servidor do WP Engine → visitas das IAs, TODAS (v78.96).
//
// No WP Engine a cache (Varnish) fica antes do WordPress e não pode deixar
// passar um User-Agent (confirmado pelo suporte a 12 e 16/11/2026): o plugin
// só vê as visitas que a cache não serviu. Os registos NGINX têm TODOS os
// pedidos, servidos pela cache ou não — e o WP Engine copia-os todas as
// noites (~02:00 UTC, o dia anterior) para um bucket S3 nosso
// (a doc do LargeFS diz `wpe_logs/<instalação>/nginx/…`; a cópia real veio
// em `wpe_logs/nginx/…` — ver wpeLogKeyInfo).
//
// O cron diário (/api/cron/wpe-logs) lê cada ficheiro novo uma vez e guarda
// em KV só as visitas das IAs (assistentes + robôs de pesquisa), já filtradas:
//   - só GET com resposta 2xx/304 a uma página (nada de 404, ficheiros
//     .json/.xml, «/.env»… — é o que os scanners pedem a fingir ser o ChatGPT);
//   - sem os pedidos do próprio servidor nem os testes do workspace/plugin
//     (User-Agent com «WonderAds-Test»);
//   - o endereço IP confrontado com as listas oficiais da OpenAI e da
//     Perplexity: fora da lista = falso, não conta. (A Anthropic e a Mistral
//     não publicam listas — essas contam, exceto se o mesmo endereço foi
//     apanhado a fingir ser outra IA: ver `liars` em readWpeLogs.)
// No relatório, cada dia coberto pelos registos usa os registos; os outros
// usam o plugin (wp-ai-visibility.ts).

import "server-only";
import { kv } from "@vercel/kv";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { s3Download, s3List, type S3Creds } from "./s3-read";

/** As IAs que lemos dos registos — pela ordem em que o plugin as reconhece. */
export const LOG_AGENTS = [
  "ChatGPT-User",
  "Claude-User",
  "Perplexity-User",
  "MistralAI-User",
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot",
] as const;

/** Listas oficiais de endereços (JSON com `prefixes[].ipv4Prefix/ipv6Prefix`). */
const IP_LISTS: Partial<Record<(typeof LOG_AGENTS)[number], string>> = {
  "ChatGPT-User": "https://openai.com/chatgpt-user.json",
  "OAI-SearchBot": "https://openai.com/searchbot.json",
  "Perplexity-User": "https://www.perplexity.com/perplexity-user.json",
  PerplexityBot: "https://www.perplexity.com/perplexitybot.json",
};

/** O sinal que os testes do workspace e do plugin põem no User-Agent. */
export const TEST_UA_MARK = "WonderAds-Test";

const ROOT = "wpe_logs/";
const KEY_INDEX = (install: string) => `wpe-logs:index:${install}`;
const KEY_FILE = (install: string, key: string) => `wpe-logs:file:${install}:${key}`;
const KEY_IPLISTS = "wpe-logs:iplists";

/** [segundos, índice em LOG_AGENTS, caminho, 1 verificado · 0 sem lista · -1 falso, hash do IP] */
export type LogEvent = [number, number, string, 1 | 0 | -1, string];

type FileEntry = { k: string; from: number; to: number; n: number };
type LogIndex = { files: FileEntry[]; updatedAt: number };
type LogFile = { k: string; from: number; to: number; lines: number; events: LogEvent[] };

export function wpeLogsCreds(): S3Creds | null {
  const accessKeyId = process.env.WPE_LOGS_AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.WPE_LOGS_AWS_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.WPE_LOGS_BUCKET?.trim();
  const region = process.env.WPE_LOGS_REGION?.trim() || "eu-west-1";
  if (!accessKeyId || !secretAccessKey || !bucket) return null;
  return { accessKeyId, secretAccessKey, bucket, region };
}

// ── endereços IP ────────────────────────────────────────────────────────

// (sem literais 0n/1n: o tsconfig ainda aponta para antes do ES2020)
const B0 = BigInt(0);
const B1 = BigInt(1);
const B16 = BigInt(16);
const BFFFF = BigInt(0xffff);

type Cidr = { v6: boolean; base: bigint; bits: number };

function ipToBig(ip: string): { v6: boolean; n: bigint } | null {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const p = ip.split(".").map(Number);
    if (p.some((x) => x > 255)) return null;
    return { v6: false, n: BigInt(((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]) };
  }
  if (!ip.includes(":")) return null;
  let s = ip.toLowerCase();
  const v4tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4tail) {
    const t = ipToBig(v4tail[1]);
    if (!t) return null;
    s = s.replace(v4tail[1], `${(t.n >> B16).toString(16)}:${(t.n & BFFFF).toString(16)}`);
  }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const groups = tail !== undefined ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h;
  if (groups.length !== 8) return null;
  let n = B0;
  for (const g of groups) n = (n << B16) + BigInt(parseInt(g || "0", 16));
  return { v6: true, n };
}

function parseCidr(c: string): Cidr | null {
  const [ip, b] = c.split("/");
  const x = ipToBig(ip);
  if (!x) return null;
  const bits = b === undefined ? (x.v6 ? 128 : 32) : Number(b);
  const width = x.v6 ? 128 : 32;
  const mask = bits === 0 ? B0 : ((B1 << BigInt(bits)) - B1) << BigInt(width - bits);
  return { v6: x.v6, base: x.n & mask, bits };
}

function inCidrs(ip: string, cidrs: Cidr[]): boolean | null {
  const x = ipToBig(ip);
  if (!x) return null;
  const same = cidrs.filter((c) => c.v6 === x.v6);
  if (!same.length) return null; // a lista não tem endereços desta família
  const width = x.v6 ? 128 : 32;
  return same.some((c) => {
    const mask = c.bits === 0 ? B0 : ((B1 << BigInt(c.bits)) - B1) << BigInt(width - c.bits);
    return (x.n & mask) === c.base;
  });
}

type IpLists = { at: number; lists: Record<string, string[]> };

/** As listas oficiais (guardadas um dia em KV; se a OpenAI/Perplexity não
 *  responderem, fica a última boa). */
async function loadIpLists(): Promise<Record<string, Cidr[]>> {
  let cached: IpLists | null = null;
  try {
    cached = await kv.get<IpLists>(KEY_IPLISTS);
  } catch {
    cached = null;
  }
  let lists = cached?.lists ?? {};
  if (!cached || Date.now() - cached.at > 24 * 3600_000) {
    const fresh: Record<string, string[]> = { ...lists };
    let any = false;
    await Promise.all(
      Object.entries(IP_LISTS).map(async ([agent, url]) => {
        try {
          const res = await fetch(url!, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
          if (!res.ok) return;
          const j = (await res.json()) as { prefixes?: { ipv4Prefix?: string; ipv6Prefix?: string }[] };
          const p = (j.prefixes ?? []).map((x) => x.ipv4Prefix ?? x.ipv6Prefix).filter((x): x is string => Boolean(x));
          if (p.length) {
            fresh[agent] = p;
            any = true;
          }
        } catch {
          /* fica a lista anterior */
        }
      }),
    );
    if (any) {
      lists = fresh;
      await kv.set(KEY_IPLISTS, { at: Date.now(), lists }).catch(() => null);
    }
  }
  return cidrsFromPrefixes(lists);
}

/** «1.2.3.0/24» por robô → intervalos prontos a comparar. */
export function cidrsFromPrefixes(lists: Record<string, string[]>): Record<string, Cidr[]> {
  return Object.fromEntries(
    Object.entries(lists).map(([a, l]) => [a, l.map(parseCidr).filter((c): c is Cidr => c !== null)]),
  );
}

// ── leitura de um ficheiro ──────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** «15/Nov/2026:00:18:23 +0000» → segundos. */
function parseClfTime(s: string): number | null {
  const m = s.match(/^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-])(\d{2})(\d{2})$/);
  if (!m || MONTHS[m[2]] === undefined) return null;
  const utc = Date.UTC(+m[3], MONTHS[m[2]], +m[1], +m[4], +m[5], +m[6]);
  const off = (m[7] === "-" ? -1 : 1) * (+m[8] * 60 + +m[9]) * 60_000;
  return Math.round((utc - off) / 1000);
}

const SKIP_BASENAMES = new Set(["robots.txt", "wp-login.php", "xmlrpc.php", "wp-cron.php", "favicon.ico", "admin-ajax.php"]);
const PAGE_EXT = new Set(["html", "htm", "php", "pdf"]);

/** É uma página que uma pessoa pediria à IA para ler? (as mesmas regras do
 *  plugin 1.2: wa_ia_is_page_path). */
export function isPagePath(uri: string): string | null {
  if (uri.includes("rest_route=")) return null;
  const path = (uri.split("?")[0] || "/").split("#")[0] || "/";
  if (path.startsWith("/wp-json") || path.startsWith("/wp-admin")) return null;
  const segs = path.split("/").filter(Boolean);
  if (segs.some((s) => s.startsWith("."))) return null;
  const base = (segs[segs.length - 1] ?? "").toLowerCase();
  if (SKIP_BASENAMES.has(base)) return null;
  const dot = base.lastIndexOf(".");
  if (dot > 0 && !PAGE_EXT.has(base.slice(dot + 1))) return null;
  return path.slice(0, 191);
}

const LINE = /^(\S+)\s[^\[]*\[([^\]]+)\]\s+"(\S+)\s+(\S+)[^"]*"\s+(\d{3})/;

/** As visitas das IAs num ficheiro de registo (texto já descomprimido). */
export function parseAccessLog(
  text: string,
  ipLists: Record<string, Cidr[]>,
): { from: number; to: number; lines: number; events: LogEvent[] } {
  const lines = text.split("\n");
  const own = new Set<string>(); // o próprio servidor (cron, loopback)
  let from = Infinity;
  let to = -Infinity;
  let count = 0;
  const hits: { ip: string; t: number; a: number; path: string }[] = [];
  const lowerAgents = LOG_AGENTS.map((a) => a.toLowerCase());
  for (const line of lines) {
    if (!line) continue;
    const m = LINE.exec(line);
    if (!m) continue;
    count++;
    const t = parseClfTime(m[2]);
    if (t !== null) {
      if (t < from) from = t;
      if (t > to) to = t;
    }
    if (line.includes('"WordPress/')) own.add(m[1]);
    const lower = line.toLowerCase();
    const a = lowerAgents.findIndex((x) => lower.includes(x));
    if (a < 0 || t === null) continue;
    if (line.includes(TEST_UA_MARK)) continue;
    if (m[3] !== "GET") continue;
    const status = Number(m[5]);
    if (!((status >= 200 && status < 300) || status === 304)) continue;
    const path = isPagePath(m[4]);
    if (!path) continue;
    hits.push({ ip: m[1], t, a, path });
  }
  const events: LogEvent[] = [];
  for (const h of hits) {
    if (own.has(h.ip)) continue;
    const list = ipLists[LOG_AGENTS[h.a]];
    const inList = list?.length ? inCidrs(h.ip, list) : null;
    const v: 1 | 0 | -1 = inList === null ? 0 : inList ? 1 : -1;
    const ipHash = createHash("sha256").update(h.ip).digest("hex").slice(0, 8);
    events.push([h.t, h.a, h.path, v, ipHash]);
  }
  return { from: Number.isFinite(from) ? from : 0, to: Number.isFinite(to) ? to : 0, lines: count, events };
}

// ── cron: ficheiros novos → KV ──────────────────────────────────────────

export type WpeSyncResult = {
  install: string;
  added: number;
  files: number;
  events: number;
  error?: string;
};

const NOT_INSTALL = new Set(["wpe_logs", "nginx", "apache", "error", "errors", "access", "logs", ""]);

/** A instalação e se é um registo de acessos NGINX, a partir da chave S3.
 *  A doc do WP Engine diz `wpe_logs/<instalação>/nginx/<data>-<instalação>-apachestyle.log.gz`,
 *  mas a cópia real (17/11/2026) veio em `wpe_logs/nginx/…` — por isso aceita-se
 *  a instalação na pasta (antes ou depois de «nginx») ou no nome do ficheiro. */
export function wpeLogKeyInfo(key: string): { install: string | null; access: boolean } {
  const parts = key.replace(/^\/+/, "").split("/");
  const file = parts[parts.length - 1] ?? "";
  const dirs = parts.slice(0, -1);
  // Só o formato «apachestyle» (o que parseAccessLog lê): a pasta nginx traz
  // também `….access.log.gz` com OS MESMOS pedidos noutro formato — lê-lo
  // contaria a dobrar se um dia o formato coincidisse.
  const access =
    dirs.includes("nginx") &&
    /apachestyle/i.test(file) &&
    /\.log(\.\d+)?(\.gz)?$/.test(file);
  const at = dirs.indexOf("nginx");
  const fromDirs = [...dirs.slice(at + 1), ...dirs.slice(0, at).reverse()].find((d) => !NOT_INSTALL.has(d.toLowerCase()) && !/^\d+$/.test(d));
  // «20261110-0017-wonderads.apachestyle.log.gz» (real) ou
  // «201807051234-wonderads-apachestyle.log.gz» (doc): fora a data à frente.
  const stem = file.replace(/^(?:\d+[-_.])+/, "");
  const fromName = stem.match(/^(.+?)[._-](?:apachestyle|access|nginx)/i)?.[1] ?? null;
  const install = fromDirs ?? (fromName && !/^\d+$/.test(fromName) ? fromName : null);
  return { install: install ? install.toLowerCase() : null, access };
}

export type WpeSyncReport = {
  installs: WpeSyncResult[];
  /** Objetos no bucket e quantos são registos de acessos NGINX. */
  scanned: { objects: number; access: number };
  /** Registos NGINX sem instalação reconhecível (nomes só, até 5). */
  unmatched: string[];
};

/** Lê os ficheiros novos de todas as instalações do bucket. */
export async function syncWpeLogs(opts: { maxFilesPerInstall?: number } = {}): Promise<WpeSyncReport> {
  const empty: WpeSyncReport = { installs: [], scanned: { objects: 0, access: 0 }, unmatched: [] };
  const creds = wpeLogsCreds();
  if (!creds) return empty;
  const max = opts.maxFilesPerInstall ?? 40;
  const { keys: all } = await s3List(creds, ROOT, { max: 50_000 });
  const byInstall = new Map<string, string[]>();
  const unmatched: string[] = [];
  let access = 0;
  for (const { key } of all) {
    const info = wpeLogKeyInfo(key);
    if (!info.access) continue;
    access++;
    if (!info.install) {
      if (unmatched.length < 5) unmatched.push(key);
      continue;
    }
    byInstall.set(info.install, [...(byInstall.get(info.install) ?? []), key]);
  }
  const ipLists = byInstall.size ? await loadIpLists() : {};
  const out: WpeSyncResult[] = [];
  for (const [install, keys] of byInstall) {
    const res: WpeSyncResult = { install, added: 0, files: 0, events: 0 };
    try {
      const index = (await kv.get<LogIndex>(KEY_INDEX(install))) ?? { files: [], updatedAt: 0 };
      const done = new Set(index.files.map((f) => f.k));
      const todo = keys
        .filter((k) => !done.has(k))
        .sort()
        .slice(0, max);
      for (const k of todo) {
        const raw = await s3Download(creds, k);
        const text = (k.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8");
        const parsed = parseAccessLog(text, ipLists);
        const file: LogFile = { k, ...parsed };
        await kv.set(KEY_FILE(install, k), file);
        index.files.push({ k, from: parsed.from, to: parsed.to, n: parsed.events.length });
        res.added++;
        res.events += parsed.events.length;
      }
      index.files.sort((a, b) => a.from - b.from);
      index.updatedAt = Date.now();
      if (res.added) await kv.set(KEY_INDEX(install), index);
      res.files = index.files.length;
    } catch (e) {
      res.error = e instanceof Error ? e.message : String(e);
    }
    out.push(res);
  }
  return { installs: out, scanned: { objects: all.length, access }, unmatched };
}

// ── leitura para o relatório ────────────────────────────────────────────

/** «2026-11-15» de um instante, no fuso do site (IANA ou «+01:00»). */
function makeDayFn(tz: string): (sec: number) => string {
  const off = tz.match(/^([+-])(\d{1,2}):?(\d{2})$/);
  if (off || tz === "" || tz === "UTC") {
    const ms = off ? (off[1] === "-" ? -1 : 1) * (+off[2] * 60 + +off[3]) * 60_000 : 0;
    return (sec) => new Date(sec * 1000 + ms).toISOString().slice(0, 10);
  }
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    return (sec) => f.format(new Date(sec * 1000));
  } catch {
    return (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
  }
}

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type WpeLogCounts = {
  /** dia → robô → visitas (só os dias cobertos pelos registos). */
  days: Record<string, Record<string, number>>;
  pages: { month: string; agent: string; path: string; count: number }[];
  /** Dias inteiros cobertos pelos registos (no fuso do site). */
  covered: string[];
  /** Por dia: pedidos com nome de IA vindos de fora das listas oficiais
   *  (ignorados). */
  fakes: Record<string, number>;
  /** Caminhos pedidos pelos falsos (para limpar as páginas antigas do plugin). */
  fakePaths: string[];
};

/** Gaps maiores do que isto entre ficheiros = buraco na cobertura. */
const GAP_SEC = 3 * 3600;
/** Um site calmo pode não ter pedidos nos primeiros/últimos minutos do dia. */
const EDGE_SEC = 45 * 60;

/** As visitas das IAs de uma instalação entre dois dias (inclusive). */
export async function readWpeLogs(
  install: string,
  tz: string,
  fromDay: string,
  toDay: string,
): Promise<WpeLogCounts | null> {
  if (!wpeLogsCreds()) return null;
  let index: LogIndex | null = null;
  try {
    index = await kv.get<LogIndex>(KEY_INDEX(install));
  } catch {
    return null;
  }
  if (!index?.files.length) return null;
  const dayOf = makeDayFn(tz);
  // Ficheiros que tocam no intervalo (com um dia de folga para os fusos).
  const lo = Date.parse(`${fromDay}T00:00:00Z`) / 1000 - 86400;
  const hi = Date.parse(`${toDay}T00:00:00Z`) / 1000 + 2 * 86400;
  const wanted = index.files.filter((f) => f.to >= lo && f.from <= hi);
  if (!wanted.length) return null;
  const files: LogFile[] = [];
  for (let i = 0; i < wanted.length; i += 20) {
    const batch = await kv.mget<(LogFile | null)[]>(...wanted.slice(i, i + 20).map((f) => KEY_FILE(install, f.k)));
    for (const f of batch) if (f) files.push(f);
  }

  // Cobertura: intervalos dos ficheiros, colados quando o buraco é pequeno.
  const spans = files
    .map((f) => [f.from - EDGE_SEC, f.to + EDGE_SEC] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1] + GAP_SEC) last[1] = Math.max(last[1], s[1]);
    else merged.push([...s]);
  }
  const covered: string[] = [];
  for (let d = fromDay; d <= toDay; d = nextDay(d)) {
    // início e fim do dia no fuso do site: procura à hora (DST incluído)
    const guess = Date.parse(`${d}T00:00:00Z`) / 1000;
    let start = -1;
    let end = -1;
    for (let s = guess - 15 * 3600; s <= guess + 39 * 3600; s += 900) {
      const day = dayOf(s);
      if (day === d && start < 0) start = s;
      if (day === d) end = s + 900;
    }
    if (start < 0) continue;
    if (merged.some(([a, b]) => a <= start && b >= end)) covered.push(d);
  }
  const coveredSet = new Set(covered);

  // Um endereço apanhado a fingir ser o ChatGPT/Perplexity (fora da lista
  // oficial) é um scanner: os pedidos dele em nome do Claude ou da Mistral
  // (que não publicam listas) também são falsos. No wonder-ads.com (9–16/11)
  // foram 73 de 104 — os scanners pedem as mesmas páginas com cada nome.
  const liars = new Set<string>();
  for (const f of files) for (const e of f.events) if (e[3] === -1) liars.add(e[4]);

  const seen = new Set<string>();
  const days: WpeLogCounts["days"] = {};
  const pageMap = new Map<string, number>();
  const fakes: Record<string, number> = {};
  const fakePaths = new Set<string>();
  for (const f of files) {
    for (const [t, a, path, v, h] of f.events) {
      const id = `${t}|${h}|${path}|${a}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const day = dayOf(t);
      if (!coveredSet.has(day)) continue;
      if (v === -1 || (v === 0 && liars.has(h))) {
        fakes[day] = (fakes[day] ?? 0) + 1;
        fakePaths.add(path);
        continue;
      }
      const agent = LOG_AGENTS[a];
      if (!agent) continue;
      (days[day] ??= {})[agent] = (days[day][agent] ?? 0) + 1;
      const pk = `${day.slice(0, 7)}\u0000${agent}\u0000${path}`;
      pageMap.set(pk, (pageMap.get(pk) ?? 0) + 1);
    }
  }
  const pages = [...pageMap].map(([k, count]) => {
    const [month, agent, path] = k.split("\u0000");
    return { month, agent, path, count };
  });
  return { days, pages, covered, fakes, fakePaths: [...fakePaths] };
}

/** O último dia coberto pelos registos (para o painel «IA no site»). */
export async function wpeLogsLastDay(install: string, tz = "UTC"): Promise<string | null> {
  try {
    const index = await kv.get<LogIndex>(KEY_INDEX(install));
    const last = index?.files.reduce((m, f) => Math.max(m, f.to), 0) ?? 0;
    return last ? makeDayFn(tz)(last) : null;
  } catch {
    return null;
  }
}
