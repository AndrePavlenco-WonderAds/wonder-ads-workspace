// Auditoria do AI Visibility — SÓ LEITURA, nada é gravado (v78.85).
//   GET /api/reports/ai-audit?period=2026-10&slugs=spine-center,ihn,…
//
// Responde à pergunta «estamos a contar bem os assistentes de IA?» com o GA4
// real de cada cliente: corre a deteção ANTIGA (top 250 de todas as origens +
// lista solta) e a NOVA (filtro no próprio GA4 + hosts ancorados) lado a
// lado, e lista as origens do mês com cara de IA que nenhuma das duas apanha.
// Editores do SEO DPT apenas.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { resolveGa4Property, runReport } from "@/lib/ga4";
import { getReportConfig } from "@/lib/report/report-config-store";
import { aiSourceRows } from "@/lib/report/ga4-report";
import { aiAssistantOf, isAiSource } from "@/lib/report/ai-assistants";
import { isValidPeriodKey, monthRange, trailingMonths } from "@/lib/report/report-dates";

export const runtime = "nodejs";
export const maxDuration = 300;

type Row = {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
};

const PREV = "date_range_1";
const isPrev = (r: Row) => (r.dimensionValues ?? []).some((d) => d.value === PREV);
const sourceOf = (r: Row) => r.dimensionValues?.[0]?.value ?? "";
const sessionsOf = (r: Row) => Number(r.metricValues?.[0]?.value ?? 0);

/** Sessões do mês por origem (só o intervalo atual). */
function currentBySource(rows: Row[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (isPrev(r)) continue;
    const s = sourceOf(r);
    if (s) m.set(s, (m.get(s) ?? 0) + sessionsOf(r));
  }
  return m;
}

function byAssistant(sources: Map<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [s, n] of sources) {
    if (n <= 0) continue;
    const label = aiAssistantOf(s)?.label ?? s;
    out[label] = (out[label] ?? 0) + n;
  }
  return out;
}

const sum = (m: Map<string, number>) => [...m.values()].reduce((t, n) => t + n, 0);

/** Origens com cara de assistente de IA, para apanhar o que a lista não tem. */
const LOOKS_LIKE_AI =
  /gpt|openai|claude|anthropic|gemini|bard|copilot|perplexity|mistral|deepseek|grok|llm|meta\.ai|you\.com|phind|poe\.com|character\.ai|huggingface|qwen|kimi|manus|chatbot|\bai\b/i;

export async function GET(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "";
  if (!isValidPeriodKey(period)) {
    return NextResponse.json({ error: "period inválido (AAAA-MM)" }, { status: 400 });
  }
  const slugs = (url.searchParams.get("slugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
  if (!slugs.length) {
    return NextResponse.json({ error: "slugs em falta" }, { status: 400 });
  }

  const current = monthRange(period);
  const previous = monthRange(trailingMonths(period, 2)[0].key);
  const ranges = [
    { startDate: current.startDate, endDate: current.endDate },
    { startDate: previous.startDate, endDate: previous.endDate },
  ];
  const metrics = [{ name: "sessions" }];

  const results = [];
  for (const slug of slugs) {
    try {
      const config = await getReportConfig(slug);
      const resolved = await resolveGa4Property(slug, config.ga4PropertyId);
      if (!resolved) {
        results.push({ slug, error: "sem propriedade GA4" });
        continue;
      }
      const { token, propertyId } = resolved;
      const looseRes = config.llmRegex
        .map((p) => {
          try {
            return new RegExp(p, "i");
          } catch {
            return null;
          }
        })
        .filter((re): re is RegExp => re !== null);

      const [oldRows, newRows, nativeRows, allMonthRows] = await Promise.all([
        // Antigo: top 250 linhas de todas as origens, dois meses.
        runReport(token, propertyId, {
          dateRanges: ranges,
          dimensions: [{ name: "sessionSource" }],
          metrics,
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 250,
        }) as Promise<Row[]>,
        // Novo: o filtro no próprio GA4.
        aiSourceRows(token, propertyId, current, previous) as Promise<Row[]>,
        // O canal «AI Assistant» da Google (entra nos dois métodos).
        runReport(token, propertyId, {
          dateRanges: ranges,
          dimensions: [{ name: "sessionSource" }],
          metrics,
          dimensionFilter: {
            filter: {
              fieldName: "sessionDefaultChannelGroup",
              inListFilter: { values: ["AI Assistant", "AI assistant", "AI Assistants"] },
            },
          },
          limit: 250,
        }).catch(() => [] as Row[]) as Promise<Row[]>,
        // Todas as origens do mês, sem corte, para procurar o que escapa.
        runReport(token, propertyId, {
          dateRanges: [ranges[0]],
          dimensions: [{ name: "sessionSource" }],
          metrics,
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 10000,
        }) as Promise<Row[]>,
      ]);

      const native = currentBySource(nativeRows);
      const oldAll = currentBySource(oldRows);
      const oldSet = new Map(native);
      for (const [s, n] of oldAll) {
        if (!oldSet.has(s) && looseRes.some((re) => re.test(s))) oldSet.set(s, n);
      }
      const newSet = new Map(native);
      for (const [s, n] of currentBySource(newRows)) {
        if (!newSet.has(s) && isAiSource(s)) newSet.set(s, n);
      }
      const allMonth = currentBySource(allMonthRows);
      const suspicious = [...allMonth]
        .filter(([s]) => !newSet.has(s) && LOOKS_LIKE_AI.test(s))
        .map(([source, sessions]) => ({ source, sessions }));

      results.push({
        slug,
        propertyId,
        sourcesThisMonth: allMonth.size,
        oldCapCovered: oldAll.size,
        old: { total: sum(oldSet), byAssistant: byAssistant(oldSet) },
        new: { total: sum(newSet), byAssistant: byAssistant(newSet) },
        onlyInOld: [...oldSet].filter(([s]) => !newSet.has(s)).map(([source, sessions]) => ({ source, sessions })),
        onlyInNew: [...newSet].filter(([s]) => !oldSet.has(s)).map(([source, sessions]) => ({ source, sessions })),
        nativeSources: Object.fromEntries(native),
        suspicious,
      });
    } catch (err) {
      results.push({ slug, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ period, current, previous, results });
}
