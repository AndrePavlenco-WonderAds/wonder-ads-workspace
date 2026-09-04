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

import {
  getGa4PropertyCurrency,
  resolveGa4Property,
  runReport,
} from "@/lib/ga4";
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
       *  não teve tráfego orgânico (a propriedade respondeu na mesma);
       *  null quando a chamada dos meses falhou. */
      months: (Ga4EcomMonth | null)[];
      /** O evento purchase disparou alguma vez nos últimos 365 dias? false →
       *  receita/transações não estão instrumentadas e não se mostram zeros. */
      purchasesInstrumented: boolean;
      /** Páginas orgânicas mais vistas no mês do relatório. */
      topPages: { page: string; views: number }[];
      /** Produtos com receita no mês do relatório. */
      topProducts: { name: string; revenue: number; quantity: number }[];
      /** "organic" = filtrados ao canal orgânico; "store" = loja inteira,
       *  porque a API recusou cruzar produtos com o canal. */
      topProductsScope: "organic" | "store";
      /** O tracking de items (itemRevenue) existe na propriedade? */
      itemsInstrumented: boolean;
      /** Moeda da propriedade ("GBP"…) — a receita do runReport vem sem
       *  moeda e o cliente pode não estar em euros. null = desconhecida. */
      currencyCode: string | null;
      /** Pedidos que a API recusou — cada um só apaga a sua parte. */
      warnings: string[];
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
    // CADA pedido por si (v77.10). Antes eram quatro dentro de um
    // Promise.all: bastava a API recusar UM para o bloco inteiro sair como
    // "error" e a tabela do cliente ficar toda a "—" — utilizadores e páginas
    // incluídos, que nada têm a ver com o pedido recusado. Foi o que
    // aconteceu ao Kings Gyms. Agora cada chamada só apaga a sua própria
    // coluna e o que falhou fica escrito no painel interno.
    const settle = async <T,>(
      name: string,
      run: () => Promise<T>,
      fallback: T,
      warnings: string[],
    ): Promise<T> => {
      try {
        return await run();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`GA4 e-commerce · ${name} falhou (${propertyId}):`, message);
        warnings.push(`${name}: ${message.slice(0, 160)}`);
        return fallback;
      }
    };

    const warnings: string[] = [];
    const empty: Row[] = [];

    const [monthRows, trxProbe, itemProbe, pageRows, products, currencyCode] =
      await Promise.all([
      // As 4 colunas numa chamada. Sem dimensões — cada range devolve (no
      // máximo) uma linha, marcada com date_range_N.
      settle(
        "meses",
        () =>
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
          }) as Promise<Row[]>,
        null as Row[] | null,
        warnings,
      ),
      // Sonda de instrumentação (365 dias, TODOS os canais): o purchase
      // existe? Sem isto, um cliente sem e-commerce tracking leria «0 €» —
      // que é mentira, não medição.
      //
      // SEPARADA da sonda de items (v77.10): `transactions` é de âmbito
      // evento e `itemRevenue` de âmbito item, e a Data API recusa certas
      // combinações de âmbitos com 400 — uma recusa que, no Promise.all
      // antigo, levava o bloco inteiro à frente.
      settle(
        "sonda purchase",
        () =>
          runReport(token, propertyId, {
            dateRanges: [{ startDate: "365daysAgo", endDate: "yesterday" }],
            metrics: [{ name: "transactions" }],
          }) as Promise<Row[]>,
        empty,
        warnings,
      ),
      settle(
        "sonda items",
        () =>
          runReport(token, propertyId, {
            dateRanges: [{ startDate: "365daysAgo", endDate: "yesterday" }],
            metrics: [{ name: "itemRevenue" }],
          }) as Promise<Row[]>,
        empty,
        warnings,
      ),
      // Páginas orgânicas mais vistas no mês do relatório.
      settle(
        "páginas",
        () =>
          runReport(token, propertyId, {
            dateRanges: [
              { startDate: opts.current.startDate, endDate: opts.current.endDate },
            ],
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }],
            dimensionFilter: ORGANIC_FILTER,
            orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
            limit: 10,
          }) as Promise<Row[]>,
        empty,
        warnings,
      ),
      // Produtos por receita orgânica no mês do relatório. A dimensão itemName
      // é de âmbito item e o filtro de canal de âmbito sessão: a Data API
      // recusa esse cruzamento em muitas propriedades. Quando recusa, repete
      // sem o filtro — dá os produtos da LOJA INTEIRA, e o relatório diz isso
      // por palavras (nunca se chama orgânico ao que não é).
      (async (): Promise<{ rows: Row[]; scope: "organic" | "store" }> => {
        const productsBody = (filtered: boolean) => ({
          dateRanges: [
            { startDate: opts.current.startDate, endDate: opts.current.endDate },
          ],
          dimensions: [{ name: "itemName" }],
          metrics: [{ name: "itemRevenue" }, { name: "itemsPurchased" }],
          ...(filtered ? { dimensionFilter: ORGANIC_FILTER } : {}),
          orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
          limit: 10,
        });
        try {
          const rows = (await runReport(
            token,
            propertyId,
            productsBody(true),
          )) as Row[];
          if (rows.length) return { rows, scope: "organic" };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          warnings.push(`produtos (orgânico): ${message.slice(0, 120)}`);
        }
        const rows = await settle(
          "produtos (loja inteira)",
          () => runReport(token, propertyId, productsBody(false)) as Promise<Row[]>,
          empty,
          warnings,
        );
        return { rows, scope: "store" };
      })(),
      // Moeda da propriedade — barata e best-effort.
      getGa4PropertyCurrency(token, propertyId),
    ]);

    // Cada linha pertence a um range (date_range_0…3); um range sem linha é
    // um mês sem tráfego orgânico — zeros verdadeiros, a propriedade existe.
    const byRange = new Map<number, Row>();
    for (const r of monthRows ?? []) {
      const tag = (r.dimensionValues ?? []).find((d) =>
        (d.value ?? "").startsWith("date_range_"),
      )?.value;
      const idx = tag ? Number(tag.replace("date_range_", "")) : 0;
      if (Number.isFinite(idx)) byRange.set(idx, r);
    }
    const months: (Ga4EcomMonth | null)[] = ranges.map((_, i) => {
      if (!monthRows) return null;
      const row = byRange.get(i);
      return {
        revenue: num(row, 0),
        transactions: num(row, 1),
        users: num(row, 2),
        sessions: num(row, 3),
      };
    });

    // Instrumentação: a sonda é a resposta preferida, mas os próprios meses
    // provam-na — se houve receita ou transações orgânicas no período, o
    // purchase está instrumentado, tenha a sonda respondido ou não.
    const monthsShowSales = months.some(
      (m) => m !== null && (m.transactions > 0 || m.revenue > 0),
    );
    const purchasesInstrumented = num(trxProbe[0], 0) > 0 || monthsShowSales;
    const itemsInstrumented = num(itemProbe[0], 0) > 0;

    const topPages = pageRows
      .map((r) => ({
        page: r.dimensionValues?.[0]?.value ?? "",
        views: num(r, 0),
      }))
      .filter((p) => p.page && p.views > 0);

    const topProducts = products.rows
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
      topProductsScope: products.scope,
      itemsInstrumented,
      currencyCode,
      warnings,
    };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error ? err.message : "GA4 ecommerce request failed",
    };
  }
}
