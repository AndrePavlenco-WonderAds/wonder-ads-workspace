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

async function readFromKv(): Promise<string[]> {
  const env = kvEnv();
  if (!env) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  try {
    const res = await fetch(env.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["GET", KEY]),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`KV ${res.status}`);
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (json.error) throw new Error(json.error);
    return parseSlugs(json.result ?? null);
  } finally {
    clearTimeout(timer);
  }
}

let cached: { at: number; slugs: Set<string> } | null = null;
let inflight: Promise<Set<string>> | null = null;

/** Os clientes em pausa — em cache por instância durante 15 s. */
export async function pausedProjectSlugs(): Promise<Set<string>> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.slugs;
  if (!inflight) {
    inflight = (async () => {
      try {
        const slugs = new Set([...(await readFromKv()), ...devPausedSlugs()]);
        cached = { at: Date.now(), slugs };
        return slugs;
      } catch (err) {
        console.error("paused-projects: leitura do KV falhou (fica aberto):", err);
        return cached?.slugs ?? new Set(devPausedSlugs());
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

export async function isProjectPaused(slug: string): Promise<boolean> {
  return (await pausedProjectSlugs()).has(slug);
}
