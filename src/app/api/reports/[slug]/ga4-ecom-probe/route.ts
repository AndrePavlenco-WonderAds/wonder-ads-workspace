// Diagnóstico do bloco e-commerce: o que é que o GA4 respondeu, pedido a
// pedido.
//
// Nasceu do Kings Gyms (v77.10): a tabela «What organic search sold» saiu
// inteira a "—" — receita, transações, conversão E utilizadores — com a
// propriedade certa ligada e dados visíveis no GA4. A causa era estrutural:
// os quatro pedidos do bloco corriam num Promise.all e a recusa de UM
// (combinações de âmbito item × sessão que a Data API rejeita com 400)
// derrubava os outros três. O fix está no ga4-ecommerce.ts; esta rota existe
// para se ver, em segundos e sem deploy de debug, qual dos pedidos a Google
// aceita nesta propriedade.
//
//   GET /api/reports/<slug>/ga4-ecom-probe?period=2026-08
//   → { propertyId, calls: [{ name, ok, rows, sample, error }] }

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { resolveGa4Property, runReport } from "@/lib/ga4";
import { googleAuthConfigured } from "@/lib/google-auth";
import { getReportConfig } from "@/lib/report/report-config-store";
import {
  isValidPeriodKey,
  monthRange,
  previousCompleteMonth,
} from "@/lib/report/report-dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORGANIC_FILTER = {
  filter: {
    fieldName: "sessionDefaultChannelGroup",
    stringFilter: { value: "Organic Search", matchType: "EXACT" },
  },
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { slug } = await params;
  if (!googleAuthConfigured) {
    return NextResponse.json({ error: "Sem service account Google." }, { status: 200 });
  }

  const asked = new URL(req.url).searchParams.get("period");
  const period =
    asked && isValidPeriodKey(asked) ? asked : previousCompleteMonth().key;
  const range = monthRange(period);

  const config = await getReportConfig(slug);
  const resolved = await resolveGa4Property(slug, config.ga4PropertyId);
  if (!resolved) {
    return NextResponse.json(
      { error: "Sem propriedade GA4 para este cliente.", stored: config.ga4PropertyId },
      { status: 200 },
    );
  }
  const { token, propertyId } = resolved;

  const dateRanges = [{ startDate: range.startDate, endDate: range.endDate }];
  const probes: { name: string; body: Record<string, unknown> }[] = [
    {
      name: "meses (4 ranges, filtro orgânico)",
      body: {
        dateRanges,
        metrics: [
          { name: "purchaseRevenue" },
          { name: "transactions" },
          { name: "totalUsers" },
          { name: "sessions" },
        ],
        dimensionFilter: ORGANIC_FILTER,
      },
    },
    {
      name: "utilizadores sem filtro",
      body: { dateRanges, metrics: [{ name: "totalUsers" }, { name: "sessions" }] },
    },
    {
      name: "sonda purchase (transactions)",
      body: {
        dateRanges: [{ startDate: "365daysAgo", endDate: "yesterday" }],
        metrics: [{ name: "transactions" }],
      },
    },
    {
      name: "sonda items (itemRevenue)",
      body: {
        dateRanges: [{ startDate: "365daysAgo", endDate: "yesterday" }],
        metrics: [{ name: "itemRevenue" }],
      },
    },
    {
      name: "sonda ANTIGA (transactions + itemRevenue juntos)",
      body: {
        dateRanges: [{ startDate: "365daysAgo", endDate: "yesterday" }],
        metrics: [{ name: "transactions" }, { name: "itemRevenue" }],
      },
    },
    {
      name: "páginas (pagePath, filtro orgânico)",
      body: {
        dateRanges,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        dimensionFilter: ORGANIC_FILTER,
        limit: 3,
      },
    },
    {
      name: "produtos com filtro orgânico (item × sessão)",
      body: {
        dateRanges,
        dimensions: [{ name: "itemName" }],
        metrics: [{ name: "itemRevenue" }, { name: "itemsPurchased" }],
        dimensionFilter: ORGANIC_FILTER,
        limit: 3,
      },
    },
    {
      name: "produtos sem filtro (loja inteira)",
      body: {
        dateRanges,
        dimensions: [{ name: "itemName" }],
        metrics: [{ name: "itemRevenue" }, { name: "itemsPurchased" }],
        limit: 3,
      },
    },
  ];

  const calls = [];
  for (const probe of probes) {
    try {
      const rows = await runReport(token, propertyId, probe.body);
      calls.push({
        name: probe.name,
        ok: true,
        rows: rows.length,
        sample: rows.slice(0, 3).map((r) => ({
          dims: (r.dimensionValues ?? []).map((d) => d.value),
          metrics: (r.metricValues ?? []).map((m) => m.value),
        })),
      });
    } catch (err) {
      calls.push({
        name: probe.name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    slug,
    period,
    range,
    propertyId,
    storedPropertyId: config.ga4PropertyId,
    calls,
  });
}
