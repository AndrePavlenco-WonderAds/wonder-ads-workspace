// SONDAGEM: a Search Analytics API já expõe o relatório Generative AI?
//
// Os artigos de agosto de 2026 dizem que não, mas testaram só o parâmetro
// `type`. Falta testar a via por onde a GSC SEMPRE expôs tipos de resultado
// especiais: a dimensão `searchAppearance` — que se auto-documenta, porque
// enumerar a dimensão devolve os valores que a propriedade realmente tem.
//
// Esta rota não decide nada: pergunta à Google e devolve as respostas cruas,
// para a decisão ser tomada com dados e não com um blog. Não custa quota
// relevante (search analytics tem limites altos) e é read-only.
//
//   GET /api/admin/gsc-ai-probe?slug=a-domingos

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { resolveGscSite, rawSearchAnalytics } from "@/lib/gsc";
import { resolveGa4Property, runReport } from "@/lib/ga4";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Erro curto e legível de uma resposta da Google. */
function errOf(json: unknown): string {
  const e = (json as { error?: { message?: string; status?: string } })?.error;
  if (!e) return "";
  return `${e.status ?? ""} ${e.message ?? ""}`.trim().slice(0, 220);
}

function rowsOf(json: unknown): { keys: string[]; impressions: number; clicks: number }[] {
  const rows = (json as { rows?: { keys?: string[]; impressions?: number; clicks?: number }[] })?.rows;
  return (rows ?? []).map((r) => ({
    keys: r.keys ?? [],
    impressions: r.impressions ?? 0,
    clicks: r.clicks ?? 0,
  }));
}

export async function GET(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const slug = new URL(req.url).searchParams.get("slug") ?? "a-domingos";
  const resolved = await resolveGscSite(slug);
  if (!resolved) {
    return NextResponse.json({ error: "no-property", slug }, { status: 400 });
  }
  const { token, siteUrl } = resolved;

  // Janela larga (a AI Overview é recente e o volume é baixo).
  const startDate = "2026-06-01";
  const endDate = "2026-08-31";
  const base = { startDate, endDate, rowLimit: 100 };

  const out: Record<string, unknown> = { slug, siteUrl, window: { startDate, endDate } };

  // —— 1. ENUMERAR searchAppearance ————————————————————————————————
  // O teste que ninguém fez. Se a Google criou um search appearance para as
  // AI Overviews / AI Mode, ele aparece nesta lista sem termos de adivinhar
  // o nome — e a partir daí filtra-se por ele.
  const appearance = await rawSearchAnalytics(token, siteUrl, {
    ...base,
    dimensions: ["searchAppearance"],
  });
  out.searchAppearance = appearance.ok
    ? { ok: true, values: rowsOf(appearance.json).map((r) => ({ value: r.keys[0], impressions: r.impressions, clicks: r.clicks })) }
    : { ok: false, status: appearance.status, error: errOf(appearance.json) };

  // —— 2. VALORES DE `type` ————————————————————————————————————————
  // Confirmar (ou desmentir) o que os artigos dizem, com a resposta da Google.
  const typeCandidates = [
    "web", "aiOverview", "ai_overview", "aiOverviews", "aiMode", "ai_mode",
    "generativeAi", "generative_ai", "genAi", "aiFeatures", "ai",
  ];
  const types: Record<string, unknown> = {};
  for (const type of typeCandidates) {
    const r = await rawSearchAnalytics(token, siteUrl, { ...base, type, rowLimit: 1 });
    types[type] = r.ok
      ? { ok: true, totalImpressions: rowsOf(r.json)[0]?.impressions ?? 0 }
      : { ok: false, status: r.status, error: errOf(r.json) };
  }
  out.types = types;

  // —— 3. FILTRAR por um searchAppearance de IA ————————————————————
  // Mesmo que a enumeração não o liste, o filtro pode aceitá-lo (a GSC já
  // teve valores filtráveis antes de os enumerar).
  const appearanceCandidates = [
    "AI_OVERVIEW", "AI_OVERVIEWS", "AI_MODE", "GENERATIVE_AI", "SGE",
    "AI_SUMMARY", "GEN_AI", "AI",
  ];
  const filters: Record<string, unknown> = {};
  for (const value of appearanceCandidates) {
    const r = await rawSearchAnalytics(token, siteUrl, {
      ...base,
      rowLimit: 1,
      dimensionFilterGroups: [
        {
          filters: [
            { dimension: "searchAppearance", operator: "equals", expression: value },
          ],
        },
      ],
    });
    filters[value] = r.ok
      ? { ok: true, rows: rowsOf(r.json).length, impressions: rowsOf(r.json)[0]?.impressions ?? 0 }
      : { ok: false, status: r.status, error: errOf(r.json) };
  }
  out.appearanceFilters = filters;

  // —— 4. DIMENSÕES NOVAS ——————————————————————————————————————————
  const dimensionCandidates = [
    "aiFeature", "generativeAiFeature", "aiSurface", "searchSurface", "surface",
  ];
  const dims: Record<string, unknown> = {};
  for (const dimension of dimensionCandidates) {
    const r = await rawSearchAnalytics(token, siteUrl, {
      ...base,
      rowLimit: 5,
      dimensions: [dimension],
    });
    dims[dimension] = r.ok
      ? { ok: true, values: rowsOf(r.json).map((x) => x.keys[0]) }
      : { ok: false, status: r.status, error: errOf(r.json) };
  }
  out.dimensions = dims;

  // —— 5. GA4: existe canal nativo de IA? ——————————————————————————
  // A Google terá acrescentado um canal «AI Assistant» ao Default Channel
  // Group em maio de 2026. O nome exato importa (o filtro é por string), por
  // isso enumeram-se os canais reais da propriedade em vez de o adivinhar.
  try {
    const ga4 = await resolveGa4Property(slug);
    if (!ga4) {
      out.ga4 = { ok: false, error: "no-property" };
    } else {
      const [channels, sources] = await Promise.all([
        runReport(ga4.token, ga4.propertyId, {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 50,
        }).catch((e) => {
          throw e;
        }),
        // O medium `ai-assistant` é o que a Google atribui a este canal.
        runReport(ga4.token, ga4.propertyId, {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 100,
        }).catch(() => []),
      ]);
      const chRows = (channels as { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[]).map(
        (r) => ({
          channel: r.dimensionValues?.[0]?.value ?? "",
          sessions: Number(r.metricValues?.[0]?.value ?? 0),
        }),
      );
      const srcRows = (sources as { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[])
        .map((r) => ({
          source: r.dimensionValues?.[0]?.value ?? "",
          medium: r.dimensionValues?.[1]?.value ?? "",
          sessions: Number(r.metricValues?.[0]?.value ?? 0),
        }))
        .filter(
          (r) =>
            /ai|gpt|gemini|claude|perplex|copilot/i.test(r.source) ||
            /ai/i.test(r.medium),
        );
      out.ga4 = {
        ok: true,
        propertyId: ga4.propertyId,
        channels: chRows,
        aiLikeSources: srcRows,
      };
    }
  } catch (e) {
    out.ga4 = { ok: false, error: e instanceof Error ? e.message.slice(0, 220) : "failed" };
  }

  return NextResponse.json(out, {
    headers: { "cache-control": "no-store" },
  });
}
