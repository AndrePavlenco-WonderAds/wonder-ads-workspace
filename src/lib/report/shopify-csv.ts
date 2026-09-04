// Importação por CSV da Shopify — o caminho que sobrevive ao fim das custom apps.
//
// PORQUÊ: desde 1 de janeiro de 2026 a Shopify já não deixa criar «legacy
// custom apps» no admin da loja (o botão «Develop apps» passou a apontar para
// o Dev Dashboard em dev.shopify.com) e as contas de COLABORADOR — que é como
// a agência entra nas lojas dos clientes — não têm acesso ao Dev Dashboard.
// Resultado: para uma loja nova é impossível gerar um token shpat_… com a
// nossa conta. As lojas que já tinham token continuam a funcionar (o
// `lib/shopify.ts` é o caminho preferido quando existe); para as outras, o
// consultor exporta o CSV do admin — coisa que a conta de colaborador PODE
// fazer — e cola-o aqui.
//
// O que este módulo lê, sem o consultor ter de escolher o formato:
//   1. Orders → Export (uma linha por artigo)   → meses + produtos
//   2. Analytics → Sales over time → Export     → meses
//   3. Analytics → Sales by product → Export    → produtos
//
// HONESTIDADE, a mesma da API: estes totais são da LOJA INTEIRA (todos os
// canais), nunca «receita orgânica». Entram no relatório com source "shopify",
// que é o que faz sair a etiqueta «loja inteira» no documento do cliente.

export const MAX_CSV_MONTHS = 36;
export const MAX_CSV_PRODUCTS = 10;
/** Teto de segurança do que o browser aceita colar/abrir (~8 MB de texto). */
export const MAX_CSV_CHARS = 8_000_000;

export const MONTH_KEY_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/;

export type ShopifyCsvProduct = {
  name: string;
  revenue: number;
  quantity: number | null;
};

/** Totais de um mês, tal como ficam gravados no report-config do cliente. */
export type ShopifyCsvMonthEntry = {
  revenue: number;
  orders: number;
  /** ms — para a UI poder dizer «importado a 04/09/2026». */
  importedAt: number;
};

export type ShopifyCsvKind = "orders" | "sales-over-time" | "sales-by-product";

export type ShopifyCsvParse =
  | {
      status: "ok";
      kind: ShopifyCsvKind;
      /** Um por mês encontrado, do mais antigo para o mais recente. */
      months: { key: string; revenue: number; orders: number }[];
      /** "2026-06" → produtos mais vendidos nesse mês. */
      productsByMonth: Record<string, ShopifyCsvProduct[]>;
      /** Linhas de dados lidas (sem o cabeçalho). */
      rows: number;
      currency: string | null;
      warnings: string[];
    }
  | { status: "error"; message: string };

// —— CSV cru ————————————————————————————————————————————————————————

/** Divide o texto respeitando aspas (RFC 4180) — um nome de produto com
 *  vírgula ou uma morada com quebra de linha não podem partir a tabela. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** O Excel português grava CSV com `;` e uma colagem de folha de cálculo vem
 *  com tabs — testa os três e fica com o que der mais colunas no cabeçalho. */
function detectDelimiter(text: string): string {
  const head = text.slice(0, 20_000);
  let best = ",";
  let bestCols = 0;
  for (const d of [",", ";", "\t"]) {
    const first = parseDelimited(head, d)[0];
    const cols = first?.length ?? 0;
    if (cols > bestCols) {
      bestCols = cols;
      best = d;
    }
  }
  return best;
}

/** "Lineitem name" / "Vendas líquidas" → "lineitemname" / "vendasliquidas".
 *  Sem acentos, sem espaços, sem pontuação: um cabeçalho só tem de bater no
 *  sentido, não na escrita. */
function squash(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Índice da 1.ª coluna que bate exatamente; senão a 1.ª que contém o termo. */
function findCol(headers: string[], names: string[]): number {
  for (const n of names) {
    const i = headers.indexOf(n);
    if (i >= 0) return i;
  }
  for (const n of names) {
    const i = headers.findIndex((h) => h.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

// —— Números e datas ——————————————————————————————————————————————

/** Aceita "1,234.56", "1.234,56", "€ 1 234,56" e "-12.30" (devoluções). */
export function parseCsvNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,.\-]/g, "").trim();
  if (!cleaned || cleaned === "-") return null;
  let s = cleaned;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // O separador mais à direita é o decimal; o outro é dos milhares.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // "1,234" é ambíguo: só é milhares quando o padrão inteiro o for.
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const MONTH_NAMES: [string, number][] = [
  ["january", 1], ["february", 2], ["march", 3], ["april", 4], ["may", 5],
  ["june", 6], ["july", 7], ["august", 8], ["september", 9], ["october", 10],
  ["november", 11], ["december", 12],
  ["janeiro", 1], ["fevereiro", 2], ["marco", 3], ["abril", 4], ["maio", 5],
  ["junho", 6], ["julho", 7], ["agosto", 8], ["setembro", 9], ["outubro", 10],
  ["novembro", 11], ["dezembro", 12],
  ["jan", 1], ["feb", 2], ["fev", 2], ["mar", 3], ["apr", 4], ["abr", 4],
  ["jun", 6], ["jul", 7], ["aug", 8], ["ago", 8], ["sep", 9], ["set", 9],
  ["oct", 10], ["out", 10], ["nov", 11], ["dec", 12], ["dez", 12],
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Qualquer data que a Shopify escreva → "2026-06". `ambiguous` avisa quando
 *  um "05/06/2026" teve de assumir dia-primeiro (formato europeu). */
export function parseMonthKey(raw: string | undefined): {
  key: string | null;
  ambiguous: boolean;
} {
  const s = (raw ?? "").trim();
  if (!s) return { key: null, ambiguous: false };

  // "2026-06-30 14:23:11 +0100", "2026-06-30", "2026-06", "Week of 2026-06-01"
  const iso = /(\d{4})-(\d{1,2})(?:-\d{1,2})?/.exec(s);
  if (iso) {
    const m = Number(iso[2]);
    if (m >= 1 && m <= 12) return { key: `${iso[1]}-${pad2(m)}`, ambiguous: false };
  }
  // "2026/06/30"
  const slashY = /(\d{4})\/(\d{1,2})/.exec(s);
  if (slashY) {
    const m = Number(slashY[2]);
    if (m >= 1 && m <= 12) return { key: `${slashY[1]}-${pad2(m)}`, ambiguous: false };
  }
  // "30/06/2026" ou "06/30/2026"
  const dmy = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    const monthFirst = a <= 12 && b > 12;
    const month = monthFirst ? a : b;
    if (month >= 1 && month <= 12) {
      return {
        key: `${dmy[3]}-${pad2(month)}`,
        ambiguous: a <= 12 && b <= 12,
      };
    }
  }
  // "June 2026", "Junho de 2026", "2026 Set"
  const year = /(\d{4})/.exec(s);
  if (year) {
    const norm = squash(s);
    let found: number | null = null;
    let foundLen = 0;
    for (const [name, month] of MONTH_NAMES) {
      if (name.length > foundLen && norm.includes(name)) {
        found = month;
        foundLen = name.length;
      }
    }
    if (found) return { key: `${year[1]}-${pad2(found)}`, ambiguous: false };
  }
  return { key: null, ambiguous: false };
}

// —— Dicionários de cabeçalhos (EN + PT, que o admin fala as duas) ————

const COL_DATE = ["day", "week", "month", "date", "dia", "semana", "mes", "data", "periodo"];
const COL_CREATED = ["createdat", "paidat", "datacriacao", "criadoem"];
const COL_NAME = ["name", "order", "ordername", "encomenda", "nome"];
const COL_TOTAL = ["total", "totalprice", "ordertotal", "valortotal"];
const COL_REFUNDED = ["refundedamount", "refunded", "valorreembolsado", "reembolsado"];
const COL_CANCELLED = ["cancelledat", "canceladoem"];
const COL_FINANCIAL = ["financialstatus", "estadofinanceiro"];
const COL_CURRENCY = ["currency", "moeda", "presentmentcurrency"];
const COL_ORDERS = ["orders", "ordercount", "orderscount", "totalorders", "encomendas", "numerodeencomendas"];
const COL_SALES = [
  "totalsales", "netsales", "grosssales", "sales", "totalrevenue", "revenue",
  "vendastotais", "vendasliquidas", "vendasbrutas", "vendas", "receita",
];
const COL_PRODUCT = ["producttitle", "productname", "product", "itemname", "produto", "nomedoproduto", "titulodoproduto"];
const COL_VARIANT = ["productvarianttitle", "varianttitle", "variant", "variante"];
const COL_QUANTITY = ["netquantity", "quantityordered", "quantity", "unitssold", "units", "itemssold", "quantidadeliquida", "quantidade", "unidades"];
const COL_LI_NAME = ["lineitemname", "lineitemtitle"];
const COL_LI_QTY = ["lineitemquantity"];
const COL_LI_PRICE = ["lineitemprice"];
const COL_LI_DISCOUNT = ["lineitemdiscount"];

// —— Parser ————————————————————————————————————————————————————————

type MonthAcc = { revenue: number; orders: number };
type ProductAcc = { revenue: number; quantity: number; hasQty: boolean };

function topProducts(acc: Map<string, ProductAcc>): ShopifyCsvProduct[] {
  return [...acc.entries()]
    .map(([name, v]) => ({
      name,
      revenue: Math.round(v.revenue * 100) / 100,
      quantity: v.hasQty ? Math.round(v.quantity) : null,
    }))
    .filter((p) => p.revenue > 0 || (p.quantity ?? 0) > 0)
    .sort((a, b) => b.revenue - a.revenue || (b.quantity ?? 0) - (a.quantity ?? 0))
    .slice(0, MAX_CSV_PRODUCTS);
}

/** Lê um CSV exportado da Shopify. `targetMonth` é o mês do relatório: um
 *  export de produtos não traz datas, por isso os produtos ficam nesse mês. */
export function parseShopifyCsv(
  text: string,
  opts: { targetMonth?: string } = {},
): ShopifyCsvParse {
  const clean = text.replace(/^\ufeff/, "").trim();
  if (!clean) return { status: "error", message: "Ficheiro vazio." };
  if (clean.length > MAX_CSV_CHARS) {
    return {
      status: "error",
      message: "Ficheiro demasiado grande (>8 MB). Exporta um intervalo de datas mais curto.",
    };
  }

  const table = parseDelimited(clean, detectDelimiter(clean));
  if (table.length < 2) {
    return { status: "error", message: "O ficheiro não tem cabeçalho e linhas de dados." };
  }
  const headers = table[0].map(squash);
  const body = table.slice(1);
  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

  const warnings: string[] = [];
  const months = new Map<string, MonthAcc>();
  const productsByMonth = new Map<string, Map<string, ProductAcc>>();
  let currency: string | null = null;
  let ambiguousDates = false;

  const addProduct = (
    month: string,
    name: string,
    revenue: number,
    quantity: number | null,
  ) => {
    let bucket = productsByMonth.get(month);
    if (!bucket) {
      bucket = new Map();
      productsByMonth.set(month, bucket);
    }
    const cur = bucket.get(name) ?? { revenue: 0, quantity: 0, hasQty: false };
    cur.revenue += revenue;
    if (quantity !== null) {
      cur.quantity += quantity;
      cur.hasQty = true;
    }
    bucket.set(name, cur);
  };

  const cCreated = findCol(headers, COL_CREATED);
  const cLiName = findCol(headers, COL_LI_NAME);
  const cTotal = findCol(headers, COL_TOTAL);
  const cName = findCol(headers, COL_NAME);
  const cProduct = findCol(headers, COL_PRODUCT);
  const cDate = cCreated >= 0 ? cCreated : findCol(headers, COL_DATE);
  const cSales = findCol(headers, COL_SALES);
  const cOrders = findCol(headers, COL_ORDERS);

  const isOrdersExport = cCreated >= 0 && (cLiName >= 0 || cTotal >= 0);

  if (isOrdersExport) {
    // —— 1. Orders → Export: uma linha por artigo, os campos da encomenda só
    // aparecem na primeira linha dela. Percorre-se em ordem, carregando o mês
    // e o «saltar esta encomenda» de linha para linha.
    const cRefunded = findCol(headers, COL_REFUNDED);
    const cCancelled = findCol(headers, COL_CANCELLED);
    const cFinancial = findCol(headers, COL_FINANCIAL);
    const cCurrency = findCol(headers, COL_CURRENCY);
    const cLiQty = findCol(headers, COL_LI_QTY);
    const cLiPrice = findCol(headers, COL_LI_PRICE);
    const cLiDiscount = findCol(headers, COL_LI_DISCOUNT);

    let month: string | null = null;
    let skip = false;
    let lastName = "";
    let cancelled = 0;

    for (const row of body) {
      const name = cell(row, cName);
      const created = cell(row, cCreated);
      const totalRaw = cell(row, cTotal);
      // Uma encomenda começa quando o número muda (ou, sem coluna de número,
      // quando a linha traz data/total próprios).
      const starts = name
        ? name !== lastName
        : Boolean(created) || Boolean(totalRaw);
      if (name) lastName = name;

      if (starts) {
        const parsed = parseMonthKey(created);
        if (parsed.ambiguous) ambiguousDates = true;
        if (parsed.key) month = parsed.key;
        const status = cell(row, cFinancial).toLowerCase();
        skip =
          Boolean(cell(row, cCancelled)) ||
          status === "voided" ||
          status === "anulado" ||
          !month;
        if (!skip) {
          const total = parseCsvNumber(totalRaw);
          if (total !== null) {
            const refunded = parseCsvNumber(cell(row, cRefunded)) ?? 0;
            const acc = months.get(month!) ?? { revenue: 0, orders: 0 };
            acc.revenue += total - refunded;
            acc.orders += 1;
            months.set(month!, acc);
          }
          if (!currency) currency = cell(row, cCurrency).toUpperCase() || null;
        } else if (cell(row, cCancelled)) {
          cancelled++;
        }
      }

      if (skip || !month) continue;

      const liName = cell(row, cLiName);
      if (liName) {
        const qty = parseCsvNumber(cell(row, cLiQty)) ?? 1;
        const price = parseCsvNumber(cell(row, cLiPrice)) ?? 0;
        const discount = parseCsvNumber(cell(row, cLiDiscount)) ?? 0;
        addProduct(month, liName.slice(0, 120), price * qty - discount, qty);
      }
    }

    if (cancelled > 0) {
      warnings.push(`${cancelled} encomenda(s) cancelada(s) ignorada(s).`);
    }
    if (cTotal < 0) {
      warnings.push(
        "O export não tem a coluna «Total» — só saíram produtos, sem receita mensal.",
      );
    }
  } else if (cProduct >= 0) {
    // —— 3. Analytics → Sales by product: sem datas, os produtos são do mês
    // do relatório (o intervalo que o consultor escolheu ao exportar).
    const cVariant = findCol(headers, COL_VARIANT);
    const cQty = findCol(headers, COL_QUANTITY);
    const target = opts.targetMonth;
    if (!target || !MONTH_KEY_RE.test(target)) {
      return {
        status: "error",
        message: "Export de produtos sem datas: não sei a que mês pertence.",
      };
    }
    // Um export de produtos com coluna de data também alimenta os meses.
    const hasDate = cDate >= 0 && cDate !== cProduct;
    for (const row of body) {
      const base = cell(row, cProduct);
      if (!base) continue;
      const variant = cell(row, cVariant);
      const name = (
        variant && variant.toLowerCase() !== "default title"
          ? `${base} · ${variant}`
          : base
      ).slice(0, 120);
      const revenue = parseCsvNumber(cell(row, cSales)) ?? 0;
      const qty = parseCsvNumber(cell(row, cQty));
      let month = target;
      if (hasDate) {
        const parsed = parseMonthKey(cell(row, cDate));
        if (parsed.ambiguous) ambiguousDates = true;
        if (parsed.key) month = parsed.key;
      }
      addProduct(month, name, revenue, qty);
      if (hasDate && cOrders >= 0) {
        const orders = parseCsvNumber(cell(row, cOrders));
        if (orders !== null) {
          const acc = months.get(month) ?? { revenue: 0, orders: 0 };
          acc.revenue += revenue;
          acc.orders += orders;
          months.set(month, acc);
        }
      }
    }
  } else if (cDate >= 0 && (cSales >= 0 || cOrders >= 0)) {
    // —— 2. Analytics → Sales over time: uma linha por dia/semana/mês.
    for (const row of body) {
      const parsed = parseMonthKey(cell(row, cDate));
      if (parsed.ambiguous) ambiguousDates = true;
      if (!parsed.key) continue;
      const acc = months.get(parsed.key) ?? { revenue: 0, orders: 0 };
      acc.revenue += parseCsvNumber(cell(row, cSales)) ?? 0;
      acc.orders += parseCsvNumber(cell(row, cOrders)) ?? 0;
      months.set(parsed.key, acc);
    }
  } else {
    return {
      status: "error",
      message:
        "Não reconheci as colunas. Exporta de Orders → Export, ou de Analytics → Sales over time / Sales by product.",
    };
  }

  if (months.size === 0 && productsByMonth.size === 0) {
    return {
      status: "error",
      message: "Li o ficheiro mas não encontrei linhas com data e valores.",
    };
  }
  if (ambiguousDates) {
    warnings.push(
      "Datas no formato dd/mm/aaaa — assumi dia primeiro (europeu). Confirma os meses abaixo.",
    );
  }
  if (months.size > MAX_CSV_MONTHS) {
    warnings.push(`Só guardo os ${MAX_CSV_MONTHS} meses mais recentes.`);
  }

  const monthList = [...months.entries()]
    .map(([key, v]) => ({
      key,
      revenue: Math.max(0, Math.round(v.revenue * 100) / 100),
      orders: Math.max(0, Math.round(v.orders)),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-MAX_CSV_MONTHS);

  const products: Record<string, ShopifyCsvProduct[]> = {};
  for (const [month, acc] of productsByMonth) {
    const list = topProducts(acc);
    if (list.length) products[month] = list;
  }

  const kind: ShopifyCsvKind = isOrdersExport
    ? "orders"
    : cProduct >= 0
      ? "sales-by-product"
      : "sales-over-time";

  return {
    status: "ok",
    kind,
    months: monthList,
    productsByMonth: products,
    rows: body.length,
    currency,
    warnings,
  };
}

// —— Normalizadores do que fica gravado (usados no store e na rota) ————

const isMonthKey = (k: string) => MONTH_KEY_RE.test(k);
const posNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

export function normalizeCsvMonths(
  v: unknown,
): Record<string, ShopifyCsvMonthEntry> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, ShopifyCsvMonthEntry> = {};
  for (const [key, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!isMonthKey(key) || !raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const revenue = posNum(o.revenue);
    const orders = posNum(o.orders);
    if (revenue === null && orders === null) continue;
    out[key] = {
      revenue: Math.round((revenue ?? 0) * 100) / 100,
      orders: Math.round(orders ?? 0),
      importedAt: typeof o.importedAt === "number" ? o.importedAt : 0,
    };
  }
  // Só os meses mais recentes — o config é um blob pequeno em KV.
  const keys = Object.keys(out).sort().slice(-MAX_CSV_MONTHS);
  return Object.fromEntries(keys.map((k) => [k, out[k]]));
}

export function normalizeCsvProducts(
  v: unknown,
): Record<string, ShopifyCsvProduct[]> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, ShopifyCsvProduct[]> = {};
  for (const [key, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!isMonthKey(key) || !Array.isArray(raw)) continue;
    const list: ShopifyCsvProduct[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim().slice(0, 120) : "";
      const revenue = posNum(o.revenue);
      const quantity = posNum(o.quantity);
      if (!name || (revenue === null && quantity === null)) continue;
      list.push({
        name,
        revenue: Math.round((revenue ?? 0) * 100) / 100,
        quantity: quantity === null ? null : Math.round(quantity),
      });
      if (list.length >= MAX_CSV_PRODUCTS) break;
    }
    if (list.length) out[key] = list;
  }
  const keys = Object.keys(out).sort().slice(-MAX_CSV_MONTHS);
  return Object.fromEntries(keys.map((k) => [k, out[k]]));
}
