// GA4 e-commerce slice of the Monthly Report — the numbers behind the
// "Conversão · SEO Orgânico" table and the top pages/products lists.
//
// Everything here is filtered to the Organic Search channel: «receita SEO» só
// é receita SEO se a atribuição for essa. Os totais da loja inteira (todos os
// canais) são outro número e vêm de outro sítio (shopify.ts), com outra
// etiqueta.
//
// A tabela compara 4 meses (3 consecutivos + o homólogo), e o runReport do
// GA4 aceita exatamente 4 dateRanges — uma chamada para a tabela inteira.
// Como no ga4-report: nunca se fabrica um zero — um purchase tracking que
// nunca disparou em 365 dias devolve `purchasesInstrumented: false` e as
// células ficam por preencher, não a zeros.

import { resolveGa4Property, runReport } from "@/lib/ga4";
import { googleAuthConfigured } from "@/lib/google-auth";
import type { DateRange } from "./report-dates";

export type Ga4EcomMonth = {
  revenue: number;
  transactions: number;
  users: number;
  sessions: number;
};

export type Ga4EcomReport =
  | {
      status: "ok";
      propertyId: string;
      /** Um por range pedido, na mesma ordem. Zeros verdadeiros quando o mês
       *  não teve tráfego orgânico (a propriedade respondeu na mesma). */
      months: Ga4EcomMonth[];
      /** O evento purchase disparou alguma vez nos últimos 365 dias? false →
       *  receita/transações não estão instrumentadas e não se mostram zeros. */
      purchasesInstrumented: boolean;
      /** Páginas orgânicas mais vistas no mês do relatório. */
      topPages: { page: string; views: number }[];
      /** Produtos com receita orgânica no mês do relatório. */
      topProducts: { name: string; revenue: number; quantity: number }[];
      /** O tracking de items (itemRevenue) existe na propriedade? */
      itemsInstrumented: boolean;
    }
  | { status: "not-configured" }
  | { status: "no-property" }
  | { status: "error"; message: string };

type Row = {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
};

const num = (row: Row | undefined, i: number): number =>
  Number(row?.metricValues?.[i]?.value ?? 0);

const ORGANIC_FILTER = {
  filter: {
    fieldName: "sessionDefaultChannelGroup",
    stringFilter: { value: "Organic Search", matchType: "EXACT" },
  },
};

/** Pull the e-commerce block for one client: the 4 conversion-table months,
 *  the instrumentation probes, and the month's top pages + products. */
export async function getGa4EcomReport(
  slug: string,
  opts: {
    /** As 4 colunas da tabela, na ordem em que devem sair. Máx. 4 — o teto
     *  de dateRanges do runReport. */
    ranges: DateRange[];
    /** O mês do relatório (top pages/produtos são só deste). */
    current: DateRange;
    propertyIdOverride?: string | null;
  },
): Promise<Ga4EcomReport> {
  if (!googleAuthConfigured) return { status: "not-configured" };
  const resolved = await resolveGa4Property(slug, opts.propertyIdOverride);
  if (!resolved) return { status: "no-property" };
  const { token, propertyId } = resolved;

  const ranges = opts.ranges.slice(0, 4);

  try {
    const [monthRows, probeRows, pageRows, itemRows] = await Promise.all([
      // As 4 colunas numa chamada. Sem dimensões — cada range devolve (no
      // máximo) uma linha, marcada com date_range_N.
      runReport(token, propertyId, {
        dateRanges: ranges.map((r) => ({
          startDate: r.startDate,
          endDate: r.endDate,
        })),
        metrics: [
          { name: "purchaseRevenue" },
          { name: "transactions" },
          { name: "totalUsers" },
          { name: "sessions" },
        ],
        dimensionFilter: ORGANIC_FILTER,
      }),
      // Sonda de instrumentação (365 dias, TODOS os canais): o purchase
      // existe? o tracking de items existe? Sem isto, um cliente sem
      // e-commerce tracking leria «0 €» — que é mentira, não medição.
      runReport(token, propertyId, {
        dateRanges: [{ startDate: "365daysAgo", endDate: "yesterday" }],
        metrics: [{ name: "transactions" }, { name: "itemRevenue" }],
      }),
      // Páginas orgânicas mais vistas no mês do relatório.
      runReport(token, propertyId, {
        dateRanges: [
          {
            startDate: opts.current.startDate,
            endDate: opts.current.endDate,
          },
        ],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        dimensionFilter: ORGANIC_FILTER,
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 10,
      }),
      // Produtos por receita orgânica no mês do relatório. Best-effort: se a
      // combinação item × canal não for suportada nesta propriedade, a lista
      // simplesmente não sai (fallback Shopify/manual) — nunca derruba o resto.
      runReport(token, propertyId, {
        dateRanges: [
          {
            startDate: opts.current.startDate,
            endDate: opts.current.endDate,
          },
        ],
        dimensions: [{ name: "itemName" }],
        metrics: [{ name: "itemRevenue" }, { name: "itemsPurchased" }],
        dimensionFilter: ORGANIC_FILTER,
        orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
        limit: 10,
      }).catch(() => [] as Row[]),
    ]);

    // Cada linha pertence a um range (date_range_0…3); um range sem linha é
    // um mês sem tráfego orgânico — zeros verdadeiros, a propriedade existe.
    const byRange = new Map<number, Row>();
    for (const r of monthRows as Row[]) {
      const tag = (r.dimensionValues ?? []).find((d) =>
        (d.value ?? "").startsWith("date_range_"),
      )?.value;
      const idx = tag ? Number(tag.replace("date_range_", "")) : 0;
      if (Number.isFinite(idx)) byRange.set(idx, r);
    }
    const months: Ga4EcomMonth[] = ranges.map((_, i) => {
      const row = byRange.get(i);
      return {
        revenue: num(row, 0),
        transactions: num(row, 1),
        users: num(row, 2),
        sessions: num(row, 3),
      };
    });

    const probe = (probeRows as Row[])[0];
    const purchasesInstrumented = num(probe, 0) > 0;
    const itemsInstrumented = num(probe, 1) > 0;

    const topPages = (pageRows as Row[])
      .map((r) => ({
        page: r.dimensionValues?.[0]?.value ?? "",
        views: num(r, 0),
      }))
      .filter((p) => p.page && p.views > 0);

    const topProducts = (itemRows as Row[])
      .map((r) => ({
        name: r.dimensionValues?.[0]?.value ?? "",
        revenue: num(r, 0),
        quantity: num(r, 1),
      }))
      // "(not set)" = evento de compra sem items — não é um produto.
      .filter((p) => p.name && p.name !== "(not set)" && p.revenue > 0);

    return {
      status: "ok",
      propertyId,
      months,
      purchasesInstrumented,
      topPages,
      topProducts,
      itemsInstrumented,
    };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error ? err.message : "GA4 ecommerce request failed",
    };
  }
}
