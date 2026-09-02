// Manual edits to a stored monthly report: fill / clear / N/A the lead channels
// that couldn't be pulled (GBP + non-instrumented events), edit the notes, and
// move the status. After any edit the derived parts (consolidated total, exec
// summary, GBP mirror, status) are recomputed so the report is always coherent.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getReport, saveReport } from "@/lib/report/report-store";
import { recomputeDerived, MAX_SHOWN_MOVERS } from "@/lib/report/report-build";
import {
  ECOM_METRIC_KEYS,
  ECOM_TOP_LIMIT,
  isGbpChannelKey,
  manualMetric,
  naMetric,
  pendingEcomCell,
  pendingMetric,
  type EcomCell,
  type EcomMetricKey,
  type EcomTopPage,
  type EcomTopProduct,
  type LeadChannelKey,
  type MonthlyReportSnapshot,
  type ReportStatus,
} from "@/lib/report/report-types";

export const runtime = "nodejs";

/** One channel edit: a number fills it, "na" marks N/A, null resets to pending. */
type ChannelEdit = number | "na" | null;

/** Métricas da tabela e-commerce que aceitam casas decimais (dinheiro e a
 *  taxa); as restantes são contagens e arredondam ao inteiro. */
const ECOM_DECIMAL_KEYS = new Set<EcomMetricKey>([
  "revenue",
  "avgTicket",
  "conversionRate",
]);

/** Uma edição de célula da tabela e-commerce, com a mesma gramática dos
 *  canais: número preenche, "na" valida como N/A, null volta a pendente. */
function applyEcomEdit(key: EcomMetricKey, edit: unknown): EcomCell | null {
  if (typeof edit === "number" && Number.isFinite(edit) && edit >= 0) {
    const value = ECOM_DECIMAL_KEYS.has(key)
      ? Math.round(edit * 100) / 100
      : Math.round(edit);
    return { value, source: "manual" };
  }
  if (edit === "na") return { value: null, source: "na", manualNa: true };
  if (edit === null) return pendingEcomCell();
  return null;
}

/** Lista manual de produtos mais vendidos — substitui a atual por inteiro. */
function parseTopProducts(v: unknown): EcomTopProduct[] | null {
  if (!Array.isArray(v)) return null;
  const out: EcomTopProduct[] = [];
  for (const item of v.slice(0, ECOM_TOP_LIMIT)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim().slice(0, 160) : "";
    const revenue = Number(o.revenue);
    if (!name || !Number.isFinite(revenue) || revenue < 0) continue;
    const qty = Number(o.quantity);
    out.push({
      name,
      revenue: Math.round(revenue * 100) / 100,
      quantity: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : null,
    });
  }
  return out;
}

/** Lista manual de páginas mais acedidas — substitui a atual por inteiro. */
function parseTopPages(v: unknown): EcomTopPage[] | null {
  if (!Array.isArray(v)) return null;
  const out: EcomTopPage[] = [];
  for (const item of v.slice(0, ECOM_TOP_LIMIT)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const page = typeof o.page === "string" ? o.page.trim().slice(0, 300) : "";
    const views = Number(o.views);
    if (!page || !Number.isFinite(views) || views < 0) continue;
    out.push({ page, views: Math.round(views) });
  }
  return out;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string; period: string }> },
) {
  const { slug, period } = await params;

  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const snap = await getReport(slug, period);
  if (!snap) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    channels?: Partial<Record<LeadChannelKey, ChannelEdit>>;
    notes?: unknown;
    status?: unknown;
    /** Queries the consultant picked to show as position gains (max 5). */
    movers?: unknown;
    /** Edições da tabela e-commerce: coluna ("2026-06") → métrica → edição. */
    ecomCells?: Record<string, Partial<Record<EcomMetricKey, unknown>>>;
    /** Listas manuais (substituem por inteiro; fonte passa a "manual"). */
    ecomTopProducts?: unknown;
    ecomTopPages?: unknown;
  };

  let next: MonthlyReportSnapshot = { ...snap };

  // Apply per-channel manual edits.
  if (body.channels && typeof body.channels === "object") {
    next = {
      ...next,
      leads: {
        ...next.leads,
        channels: next.leads.channels.map((c) => {
          if (!(c.key in body.channels!)) return c;
          const edit = body.channels![c.key];
          // Every Business Profile row — main or per-unit — resets to "manual"
          // (the API is often unavailable); GA4 rows reset to "na".
          const resetSource = isGbpChannelKey(c.key) ? "manual" : "na";
          let metric = c.metric;
          if (typeof edit === "number" && Number.isFinite(edit) && edit >= 0) {
            metric = manualMetric(Math.round(edit), "count");
          } else if (edit === "na") {
            metric = naMetric("count");
          } else if (edit === null) {
            metric = pendingMetric("count", resetSource);
          }
          return { ...c, metric };
        }),
      },
    };
  }

  if (typeof body.notes === "string") {
    next = { ...next, notes: body.notes.slice(0, 4000) };
  }

  // Curated position-gain selection. Only queries that are actually in this
  // report's candidate list are accepted — the picker can't invent a row.
  if (Array.isArray(body.movers)) {
    const candidates = next.gsc.moverCandidates ?? next.gsc.topMovers;
    const wanted = body.movers.filter((q): q is string => typeof q === "string");
    const picked = wanted
      .map((q) => candidates.find((c) => c.query === q))
      .filter((m): m is (typeof candidates)[number] => Boolean(m))
      .slice(0, MAX_SHOWN_MOVERS);
    next = {
      ...next,
      gsc: { ...next.gsc, topMovers: picked, moversCurated: true },
    };
  }

  // Edições da tabela de conversão e-commerce. Só células que existem no
  // snapshot (uma coluna ou métrica inventada é ignorada), e as células
  // puxadas (ga4/gsc/shopify) também aceitam correção manual — a mesma
  // liberdade da grelha de canais.
  if (next.ecom && body.ecomCells && typeof body.ecomCells === "object") {
    next = {
      ...next,
      ecom: {
        ...next.ecom,
        columns: next.ecom.columns.map((col) => {
          const edits = body.ecomCells![col.key];
          if (!edits || typeof edits !== "object") return col;
          const cells = { ...col.cells };
          for (const key of ECOM_METRIC_KEYS) {
            if (!(key in edits)) continue;
            const cell = applyEcomEdit(key, edits[key]);
            if (cell) cells[key] = cell;
          }
          return { ...col, cells };
        }),
      },
    };
  }
  if (next.ecom) {
    let ecom = next.ecom;
    const products = parseTopProducts(body.ecomTopProducts);
    if (products) {
      ecom = { ...ecom, topProducts: products, topProductsSource: "manual" };
    }
    const pages = parseTopPages(body.ecomTopPages);
    if (pages) {
      ecom = { ...ecom, topPages: pages, topPagesSource: "manual" };
    }
    next = { ...next, ecom };
  }

  // Recompute derived fields (total, exec summary, GBP mirror, status).
  next = recomputeDerived(next);

  // Explicit status override (e.g. mark "sent"). Never allow "ready" while
  // something is still unresolved — recompute already forced "draft" there.
  const wanted = body.status as ReportStatus | undefined;
  if (wanted === "sent") next = { ...next, status: "sent" };
  else if (wanted === "draft") next = { ...next, status: "draft" };

  try {
    await saveReport(next);
    revalidatePath(`/seo/${slug}/report/${period}`);
    revalidatePath(`/${slug}/preview/report/${period}`);
    return NextResponse.json({ ok: true, status: next.status });
  } catch (err) {
    console.error("report patch failed:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
