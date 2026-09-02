// Google IA (AI Overviews + AI Mode) a partir do Search Console.
//
// ESTADO VERIFICADO (2026-09-02, sondagem com a nossa service account contra
// 6 propriedades reais): a Search Analytics API NÃO expõe o relatório
// Generative AI. Testado e rejeitado — 12 valores de `type` (todos
// INVALID_ARGUMENT no enum SearchType), 9 valores de `searchAppearance`
// («not a valid 'searchAppearance' for type WEB/DISCOVER»), 6 nomes de
// dimensão e as versões v1/v1beta do endpoint (404). A enumeração de
// `searchAppearance` FUNCIONA — devolveu REVIEW_SNIPPET, PRODUCT_SNIPPETS,
// MERCHANT_LISTINGS, TRANSLATED_RESULT noutras propriedades — e em nenhuma
// devolveu um valor de IA. Logo a ausência é da Google, não da sondagem.
//
// O QUE ESTE MÓDULO FAZ: repete essa sondagem uma vez por mês (resultado em
// cache no KV) e, no dia em que a Google abrir a API, o bloco de Google IA
// dos relatórios passa a preencher-se sozinho — sem editar código, sem
// migração, sem alguém ter de reparar na novidade. Até lá, o consultor cola
// o CSV exportado e o resto (MoM, histórico) já é automático.

import { kv } from "@vercel/kv";
import { rawSearchAnalytics, resolveGscSite } from "@/lib/gsc";
import type { DateRange } from "./report-dates";

const CACHE_KEY = "gsc-ai-support";
/** Re-sondagem mensal: é uma chamada barata e a novidade não pode passar
 *  despercebida durante meses. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Uma «receita» = uma forma de pedir os dados de IA à API. A primeira que a
 *  Google aceitar passa a ser usada para puxar tudo. */
type Recipe =
  | { kind: "type"; value: string }
  | { kind: "appearance"; value: string };

const RECIPES: Recipe[] = [
  // Um `type` próprio é a forma como a GSC separa Discover e News — é o
  // caminho mais provável para as superfícies de IA.
  ...["aiOverview", "aiOverviews", "aiMode", "generativeAi", "aiFeatures", "genAi"].map(
    (value) => ({ kind: "type" as const, value }),
  ),
  // Em alternativa, um search appearance filtrável dentro do type web.
  ...["AI_OVERVIEW", "AI_OVERVIEWS", "AI_MODE", "GENERATIVE_AI", "AI_FEATURES"].map(
    (value) => ({ kind: "appearance" as const, value }),
  ),
];

type Support = { supported: boolean; checkedAt: number; recipe?: Recipe };

/** Corpo do pedido para uma receita. */
function bodyFor(recipe: Recipe, range: DateRange, extra: Record<string, unknown> = {}) {
  const base = { startDate: range.startDate, endDate: range.endDate, ...extra };
  if (recipe.kind === "type") return { ...base, type: recipe.value };
  return {
    ...base,
    dimensionFilterGroups: [
      {
        filters: [
          {
            dimension: "searchAppearance",
            operator: "equals",
            expression: recipe.value,
          },
        ],
      },
    ],
  };
}

const storageOn = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

/** A API já aceita alguma das receitas? Resultado em cache — a sondagem só
 *  volta a correr passado um mês (ou com `force`). */
export async function getGscAiSupport(
  token: string,
  siteUrl: string,
  range: DateRange,
  force = false,
): Promise<Support> {
  if (!force && storageOn) {
    try {
      const cached = await kv.get<Support>(CACHE_KEY);
      if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) return cached;
    } catch {
      // KV em baixo não pode impedir o relatório — segue para a sondagem.
    }
  }

  let found: Recipe | undefined;
  for (const recipe of RECIPES) {
    const r = await rawSearchAnalytics(
      token,
      siteUrl,
      bodyFor(recipe, range, { rowLimit: 1 }),
    ).catch(() => null);
    if (r?.ok) {
      found = recipe;
      break;
    }
  }

  const result: Support = {
    supported: Boolean(found),
    checkedAt: Date.now(),
    ...(found ? { recipe: found } : {}),
  };
  if (storageOn) {
    try {
      await kv.set(CACHE_KEY, result);
    } catch {
      /* idem */
    }
  }
  return result;
}

export type GscAiPull = {
  impressions: number;
  topPages: { page: string; impressions: number }[];
  byDevice: { device: string; impressions: number }[];
};

const DEVICE_LABEL: Record<string, string> = {
  DESKTOP: "Desktop",
  MOBILE: "Mobile",
  TABLET: "Tablet",
};

/** Puxa o bloco de Google IA do mês — ou null quando a API ainda não o dá
 *  (que é o caso hoje). Nunca lança: o relatório sai na mesma. */
export async function fetchGscAiBlock(
  slug: string,
  range: DateRange,
  siteUrlOverride?: string | null,
): Promise<GscAiPull | null> {
  try {
    const resolved = await resolveGscSite(slug, siteUrlOverride);
    if (!resolved) return null;
    const { token, siteUrl } = resolved;

    const support = await getGscAiSupport(token, siteUrl, range);
    if (!support.supported || !support.recipe) return null;

    const [totals, pages, devices] = await Promise.all([
      rawSearchAnalytics(token, siteUrl, bodyFor(support.recipe, range, { rowLimit: 1 })),
      rawSearchAnalytics(token, siteUrl, bodyFor(support.recipe, range, { dimensions: ["page"], rowLimit: 10 })),
      rawSearchAnalytics(token, siteUrl, bodyFor(support.recipe, range, { dimensions: ["device"], rowLimit: 5 })),
    ]);

    type ApiRow = { keys?: string[]; impressions?: number };
    const rowsOf = (j: unknown): ApiRow[] => (j as { rows?: ApiRow[] })?.rows ?? [];

    const impressions = rowsOf(totals.json)[0]?.impressions ?? 0;
    if (!totals.ok) return null;

    return {
      impressions: Math.round(impressions),
      topPages: rowsOf(pages.json)
        .map((r) => ({ page: r.keys?.[0] ?? "", impressions: Math.round(r.impressions ?? 0) }))
        .filter((r) => r.page),
      byDevice: rowsOf(devices.json)
        .map((r) => ({
          device: DEVICE_LABEL[r.keys?.[0] ?? ""] ?? r.keys?.[0] ?? "",
          impressions: Math.round(r.impressions ?? 0),
        }))
        .filter((r) => r.device),
    };
  } catch (err) {
    console.error(`Google IA (GSC) falhou para ${slug}:`, err);
    return null;
  }
}
