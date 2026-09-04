// Shopify Admin API (GraphQL) — fallback de receita/encomendas/produtos para
// o relatório e-commerce quando o GA4 do cliente não tem purchase tracking.
//
// HONESTIDADE PRIMEIRO: a Shopify não sabe o que é «orgânico» — os totais
// daqui são da LOJA INTEIRA, todos os canais. Entram no relatório apenas como
// fallback, sempre com source "shopify" e a etiqueta «loja inteira» à vista.
// A fonte correta de «receita SEO» é o GA4 filtrado ao canal Organic Search
// (ga4-ecommerce.ts); quando esse existe, a Shopify nem é consultada.
//
// Auth: token de uma app da loja com scopes read_orders + read_all_orders
// (sem o segundo, a API só devolve os últimos 60 dias — a coluna homóloga
// precisa de 1 ano). O token (shpat_…) fica no report-config do cliente, em KV.
//
// ATENÇÃO (2026): este caminho já só existe para lojas que JÁ tenham token, ou
// onde o dono da loja crie a app por nós. Desde 1 de janeiro de 2026 a Shopify
// não deixa criar «legacy custom apps» no admin e mandou o desenvolvimento
// para o Dev Dashboard (dev.shopify.com), onde as contas de COLABORADOR — as
// da agência — não entram. Para essas lojas, os números entram por CSV
// exportado do admin: ver `report/shopify-csv.ts`.

import type { DateRange } from "./report/report-dates";

/** Versão da Admin API. A Shopify mantém cada versão ~12 meses e redireciona
 *  pedidos a versões expiradas para a mais antiga suportada, por isso uma
 *  versão desatualizada degrada com aviso em vez de partir. */
const API_VERSION = "2026-01";

/** Tetos de paginação. Totais: 250 encomendas/página × 12 = 3 000/mês.
 *  Produtos: página pequena porque os lineItems aninhados multiplicam o custo
 *  da query (o teto de custo por pedido é 1 000 pontos). */
const TOTALS_PAGE = 250;
const TOTALS_MAX_PAGES = 12;
const PRODUCTS_PAGE = 30;
const PRODUCTS_MAX_PAGES = 12;

export type ShopifyMonth = {
  /** Total pago das encomendas do mês (currentTotalPrice — já líquido de
   *  reembolsos), todos os canais. */
  revenue: number;
  orders: number;
};

export type ShopifyEcomReport =
  | {
      status: "ok";
      /** Um por range pedido, na mesma ordem; null = janela que falhou. */
      months: (ShopifyMonth | null)[];
      /** Produtos mais vendidos (por receita) no mês do relatório. */
      topProducts: { name: string; revenue: number; quantity: number }[];
      /** Moeda da loja ("GBP", "EUR"…), do primeiro pedido visto. */
      currency: string | null;
      /** Algum mês bateu no teto de paginação — totais por defeito. */
      truncated: boolean;
    }
  | { status: "error"; message: string };

type OrderNode = {
  cancelledAt: string | null;
  test: boolean;
  currentTotalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } };
  lineItems?: {
    nodes?: {
      title?: string;
      quantity?: number;
      originalTotalSet?: { shopMoney?: { amount?: string } };
    }[];
  };
};

type OrdersPage = {
  orders?: {
    pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
    nodes?: OrderNode[];
  };
};

async function adminGraphql(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<OrdersPage> {
  const res = await fetch(
    `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify respondeu ${res.status}. ${text.slice(0, 180)}`);
  }
  const json = (await res.json()) as {
    data?: OrdersPage;
    errors?: { message?: string; extensions?: { code?: string } }[];
  };
  if (json.errors?.length) {
    // Throttled: espera e o caller repete (o bucket regenera ~100 pontos/s).
    const throttled = json.errors.some(
      (e) => e.extensions?.code === "THROTTLED",
    );
    if (throttled) throw new ThrottledError();
    throw new Error(json.errors[0]?.message ?? "Shopify GraphQL error");
  }
  return json.data ?? {};
}

class ThrottledError extends Error {
  constructor() {
    super("throttled");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** adminGraphql com uma repetição quando o rate limit da loja aperta. */
async function callWithRetry(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<OrdersPage> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await adminGraphql(shopDomain, accessToken, query, variables);
    } catch (err) {
      if (err instanceof ThrottledError && attempt < 2) {
        await sleep(1500);
        continue;
      }
      throw err;
    }
  }
}

/** Search query da Admin API para as encomendas de uma janela. O fim é
 *  exclusivo no dia seguinte para apanhar o último dia inteiro em qualquer
 *  fuso da loja. */
function ordersSearch(range: DateRange): string {
  const next = new Date(`${range.endDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = next.toISOString().slice(0, 10);
  return `created_at:>='${range.startDate}' created_at:<'${end}'`;
}

const TOTALS_QUERY = `
query MonthTotals($q: String!, $first: Int!, $after: String) {
  orders(first: $first, query: $q, after: $after, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      cancelledAt
      test
      currentTotalPriceSet { shopMoney { amount currencyCode } }
    }
  }
}`;

const PRODUCTS_QUERY = `
query MonthProducts($q: String!, $first: Int!, $after: String) {
  orders(first: $first, query: $q, after: $after, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      cancelledAt
      test
      lineItems(first: 20) {
        nodes { title quantity originalTotalSet { shopMoney { amount } } }
      }
    }
  }
}`;

/** Totais da loja (todos os canais) para as janelas pedidas + produtos mais
 *  vendidos no mês do relatório. Sequencial janela a janela para não esgotar
 *  o rate limit da loja num burst. */
export async function getShopifyEcomReport(opts: {
  shopDomain: string;
  accessToken: string;
  /** As colunas da tabela, na ordem em que devem sair. */
  ranges: DateRange[];
  /** Índice do mês do relatório em `ranges` (top produtos são só deste). */
  currentIndex: number;
}): Promise<ShopifyEcomReport> {
  const { shopDomain, accessToken } = opts;
  let currency: string | null = null;
  let truncated = false;

  try {
    const months: (ShopifyMonth | null)[] = [];
    for (const range of opts.ranges) {
      try {
        let revenue = 0;
        let orders = 0;
        let after: string | null = null;
        for (let page = 0; page < TOTALS_MAX_PAGES; page++) {
          const data: OrdersPage = await callWithRetry(
            shopDomain,
            accessToken,
            TOTALS_QUERY,
            { q: ordersSearch(range), first: TOTALS_PAGE, after },
          );
          const nodes = data.orders?.nodes ?? [];
          for (const o of nodes) {
            if (o.test || o.cancelledAt) continue;
            const money = o.currentTotalPriceSet?.shopMoney;
            revenue += Number(money?.amount ?? 0);
            orders += 1;
            if (!currency && money?.currencyCode) currency = money.currencyCode;
          }
          if (!data.orders?.pageInfo?.hasNextPage) {
            after = null;
            break;
          }
          after = data.orders.pageInfo.endCursor ?? null;
          if (!after) break;
          if (page === TOTALS_MAX_PAGES - 1) truncated = true;
        }
        months.push({ revenue, orders });
      } catch (err) {
        console.error(`Shopify totals falharam (${range.startDate}):`, err);
        months.push(null);
      }
    }

    // Produtos do mês do relatório. Best-effort: sem eles a secção cai para
    // o preenchimento manual, o resto do bloco sobrevive.
    const byProduct = new Map<string, { revenue: number; quantity: number }>();
    const current = opts.ranges[opts.currentIndex];
    if (current) {
      try {
        let after: string | null = null;
        for (let page = 0; page < PRODUCTS_MAX_PAGES; page++) {
          const data: OrdersPage = await callWithRetry(
            shopDomain,
            accessToken,
            PRODUCTS_QUERY,
            { q: ordersSearch(current), first: PRODUCTS_PAGE, after },
          );
          const nodes = data.orders?.nodes ?? [];
          for (const o of nodes) {
            if (o.test || o.cancelledAt) continue;
            for (const li of o.lineItems?.nodes ?? []) {
              const name = (li.title ?? "").trim();
              if (!name) continue;
              const cur = byProduct.get(name) ?? { revenue: 0, quantity: 0 };
              cur.revenue += Number(li.originalTotalSet?.shopMoney?.amount ?? 0);
              cur.quantity += li.quantity ?? 0;
              byProduct.set(name, cur);
            }
          }
          if (!data.orders?.pageInfo?.hasNextPage) break;
          after = data.orders.pageInfo.endCursor ?? null;
          if (!after) break;
          if (page === PRODUCTS_MAX_PAGES - 1) truncated = true;
        }
      } catch (err) {
        console.error("Shopify top products falharam:", err);
      }
    }
    const topProducts = [...byProduct.entries()]
      .map(([name, v]) => ({ name, revenue: v.revenue, quantity: v.quantity }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Todas as janelas falharam = a ligação está má (token/domínio); o painel
    // interno deve dizê-lo em vez de mostrar um bloco silenciosamente vazio.
    if (months.every((m) => m === null)) {
      return {
        status: "error",
        message: "Nenhuma janela respondeu — verifica o domínio e o token.",
      };
    }
    return { status: "ok", months, topProducts, currency, truncated };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Shopify request failed",
    };
  }
}
