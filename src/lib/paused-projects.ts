// Projetos em pausa (v78.81) — o portão das páginas públicas de cada cliente.
//
// Quando um SuperAdmin pausa/suspende um cliente no SEO DPT (o botão ⏸ no
// cartão — a lista `seo-paused-clients`), as páginas que o cliente abre sem
// sessão fecham: o registo de leads (Origem), a tabela de aprovações
// (pendingreview), as pré-visualizações (relatório, roadmap, keywords,
// briefing, posts, meta tags), o onboarding, o inquérito NPS e o Reviews Hub.
// No lugar delas aparece /projeto-em-pausa/<slug>, para toda a gente — a
// equipa vê o mesmo que o cliente. As APIs que essas páginas usam recusam
// pedidos sem sessão (423); com sessão, a equipa continua a trabalhar a partir
// da app como sempre.
//
// De fora, de propósito: as propostas (/proposta/…) — uma proposta de
// renovação é precisamente o que se manda a um cliente em pausa.
//
// Edge-safe: o middleware lê isto em cada pedido a estas rotas, por isso a
// lista vive em memória 15 s por instância e chega do Upstash por REST (o
// @vercel/kv puxa código Node que o Edge não tem). FALHA ABERTA: se o KV não
// responder fica a última lista conhecida (ou nenhuma) — mais vale uma página
// de um cliente em pausa abrir durante uma falha do KV do que fechar as de
// todos.

// v80.36: a mesma leitura traz os desbloqueios (paused-unlocks-shared.ts) —
// partes de um projeto em pausa que um SuperAdmin reabriu durante algum tempo.
import { UNLOCKS_KEY, isGrantActive, parseUnlocks, unitForApi, unitForSection, type UnlocksMap } from "./paused-unlocks-shared";

const KEY = "seo-paused-clients";
const TTL_MS = 15_000;
const KV_TIMEOUT_MS = 1500;

/** Onde mora a página «Projeto em pausa» (o middleware reescreve para lá). */
export const PAUSED_PAGE_PREFIX = "/projeto-em-pausa";

/** As secções públicas de um cliente: /<slug>/<secção>/… */
export const PUBLIC_PROJECT_SECTIONS: readonly string[] = [
  "origem",
  "reviews",
  "pendingreview",
  "preview",
  "onboarding",
  "survey",
];

/** As APIs dessas páginas, todas com o slug a seguir ao nome:
 *  /api/<nome>/<slug>/… */
export const PUBLIC_PROJECT_APIS: readonly string[] = [
  "origem",
  "reviews",
  "reviews-hub",
  "nps",
  "onboarding-gate",
  "onboarding-intake",
  "onboarding-accesses",
  "onboarding-files",
  "onboarding-progress",
];

/** Primeiros segmentos que nunca são um cliente (as rotas internas, os
 *  ficheiros do Next e as páginas públicas que não são de um cliente). */
const RESERVED_FIRST_SEGMENTS = new Set([
  "",
  "seo",
  "ads",
  "web",
  "commercial",
  "admin",
  "changelog",
  "formacao",
  "ausencias",
  "tools",
  "medalhas",
  "minigames",
  "probation",
  "ineficacias",
  "documentacao",
  // Ficha do prospect (v80.0) — /prospects/<slug> nunca é um cliente.
  "prospects",
  "login",
  "api",
  "proposta",
  "projeto-em-pausa",
  "review",
  "reviews",
  "_next",
  "static",
  "public",
]);

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** O cliente de uma página pública (/<slug>/<secção>/…), ou null. */
export function publicProjectPageSlug(pathname: string): string | null {
  const [, slug = "", section = ""] = pathname.split("/");
  if (RESERVED_FIRST_SEGMENTS.has(slug)) return null;
  if (!PUBLIC_PROJECT_SECTIONS.includes(section)) return null;
  return decode(slug);
}

/** A secção de uma página pública (/<slug>/<secção>/…), ou null. */
export function publicProjectPageSection(pathname: string): string | null {
  const [, slug = "", section = ""] = pathname.split("/");
  if (RESERVED_FIRST_SEGMENTS.has(slug)) return null;
  return PUBLIC_PROJECT_SECTIONS.includes(section) ? section : null;
}

/** O nome de uma API dessas páginas (/api/<nome>/<slug>/…), ou null. */
export function publicProjectApiName(pathname: string): string | null {
  const [, api, name = ""] = pathname.split("/");
  return api === "api" && PUBLIC_PROJECT_APIS.includes(name) ? name : null;
}

/** O cliente de uma API dessas páginas (/api/<nome>/<slug>/…), ou null. */
export function publicProjectApiSlug(pathname: string): string | null {
  const [, api, name = "", slug = ""] = pathname.split("/");
  if (api !== "api" || !slug || !PUBLIC_PROJECT_APIS.includes(name)) return null;
  return decode(slug);
}

function kvEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

/** Só em desenvolvimento: `DEV_PAUSED_SLUGS=a,b` junta clientes à lista sem
 *  tocar no KV (que, em local, é o de produção). Em produção não existe. */
function devPausedSlugs(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  return (process.env.DEV_PAUSED_SLUGS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** O valor chega como o @vercel/kv o gravou: a lista em JSON. */
function parseSlugs(raw: unknown): string[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];
}

type PausedState = { slugs: Set<string>; unlocks: UnlocksMap };

async function readFromKv(): Promise<{ slugs: string[]; unlocks: UnlocksMap }> {
  const env = kvEnv();
  if (!env) return { slugs: [], unlocks: {} };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  try {
    const res = await fetch(env.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["MGET", KEY, UNLOCKS_KEY]),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`KV ${res.status}`);
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (json.error) throw new Error(json.error);
    const [slugs, unlocks] = Array.isArray(json.result) ? json.result : [null, null];
    return { slugs: parseSlugs(slugs ?? null), unlocks: parseUnlocks(unlocks ?? null) };
  } finally {
    clearTimeout(timer);
  }
}

let cached: { at: number; state: PausedState } | null = null;
let inflight: Promise<PausedState> | null = null;

/** Os clientes em pausa e os desbloqueios — em cache por instância 15 s. */
async function pausedState(): Promise<PausedState> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.state;
  if (!inflight) {
    inflight = (async () => {
      try {
        const kv = await readFromKv();
        const state = { slugs: new Set([...kv.slugs, ...devPausedSlugs()]), unlocks: kv.unlocks };
        cached = { at: Date.now(), state };
        return state;
      } catch (err) {
        console.error("paused-projects: leitura do KV falhou (fica aberto):", err);
        return cached?.state ?? { slugs: new Set(devPausedSlugs()), unlocks: {} };
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/** Os clientes em pausa — em cache por instância durante 15 s. */
export async function pausedProjectSlugs(): Promise<Set<string>> {
  return (await pausedState()).slugs;
}

export async function isProjectPaused(slug: string): Promise<boolean> {
  return (await pausedProjectSlugs()).has(slug);
}

/** A página /<slug>/<secção> abre? Sim se o projeto não está em pausa, ou se
 *  a parte a que a secção pertence está desbloqueada e dentro do prazo. */
export async function isPublicPageOpen(slug: string, section: string | null): Promise<boolean> {
  const { slugs, unlocks } = await pausedState();
  if (!slugs.has(slug)) return true;
  const unit = section ? unitForSection(section) : null;
  return Boolean(unit && isGrantActive(unlocks[slug]?.[unit.id]));
}

/** O mesmo para as APIs dessas páginas (/api/<nome>/<slug>). */
export async function isPublicApiOpen(slug: string, api: string | null): Promise<boolean> {
  const { slugs, unlocks } = await pausedState();
  if (!slugs.has(slug)) return true;
  const unit = api ? unitForApi(api) : null;
  return Boolean(unit && isGrantActive(unlocks[slug]?.[unit.id]));
}
