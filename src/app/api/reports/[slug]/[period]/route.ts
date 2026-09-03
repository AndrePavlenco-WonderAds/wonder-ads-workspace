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
  getReportConfig,
  normalizeKeywordList,
  saveReportConfig,
} from "@/lib/report/report-config-store";
import {
  ECOM_METRIC_KEYS,
  ECOM_TOP_LIMIT,
  MAX_KEYWORD_CURATION,
  MAX_REPORT_ATTACHMENTS,
  REPORT_SECTION_KEYS,
  isGbpChannelKey,
  manualMetric,
  naMetric,
  pendingEcomCell,
  pendingMetric,
  type EcomCell,
  type EcomMetricKey,
  type EcomTopPage,
  type EcomTopProduct,
  type GscAiDevice,
  type GscAiTopPage,
  type KeywordCuration,
  type LeadChannelKey,
  type MonthlyReportSnapshot,
  type ReportAttachment,
  type ReportSectionKey,
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

/** Páginas do relatório Generative AI (GSC) — substitui a lista por inteiro. */
function parseGscAiPages(v: unknown): GscAiTopPage[] | null {
  if (!Array.isArray(v)) return null;
  const out: GscAiTopPage[] = [];
  for (const item of v.slice(0, ECOM_TOP_LIMIT)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const page = typeof o.page === "string" ? o.page.trim().slice(0, 300) : "";
    const impressions = Number(o.impressions);
    if (!page || !Number.isFinite(impressions) || impressions < 0) continue;
    out.push({ page, impressions: Math.round(impressions) });
  }
  return out.sort((a, b) => b.impressions - a.impressions);
}

/** Dispositivos do relatório Generative AI — substitui a lista por inteiro. */
function parseGscAiDevices(v: unknown): GscAiDevice[] | null {
  if (!Array.isArray(v)) return null;
  const out: GscAiDevice[] = [];
  for (const item of v.slice(0, 5)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const device =
      typeof o.device === "string" ? o.device.trim().slice(0, 24) : "";
    const impressions = Number(o.impressions);
    if (!device || !Number.isFinite(impressions) || impressions < 0) continue;
    out.push({ device, impressions: Math.round(impressions) });
  }
  return out.sort((a, b) => b.impressions - a.impressions);
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
    /** Secções a retirar do documento (chaves de REPORT_SECTION_KEYS).
     *  Substitui a lista por inteiro; [] volta a incluir tudo. */
    hiddenSections?: unknown;
    /** Google IA (GSC · Generative AI): impressões do mês (número | "na" |
     *  null=repor pendente) + listas do CSV exportado. */
    gscAi?: { impressions?: unknown; topPages?: unknown; byDevice?: unknown };
    /** Curadoria da tabela de keywords (secção 7): escondidas, regra das
     *  fora do top 100, acrescentadas à mão. Substitui por inteiro. */
    kwCuration?: unknown;
    /** Prints e ficheiros anexados às notas. Substitui a lista por inteiro. */
    notesAttachments?: unknown;
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

  // Google IA — o valor do mês vem do CSV/manual; `previous` e `history`
  // ficam intactos (são o encadeamento automático entre relatórios).
  if (next.gscAi && body.gscAi && typeof body.gscAi === "object") {
    const g = body.gscAi;
    let impressions = next.gscAi.impressions;
    if (
      typeof g.impressions === "number" &&
      Number.isFinite(g.impressions) &&
      g.impressions >= 0
    ) {
      impressions = {
        ...impressions,
        value: Math.round(g.impressions),
        source: "manual",
        instrumented: true,
        manualNa: undefined,
      };
    } else if (g.impressions === "na") {
      impressions = {
        ...impressions,
        value: null,
        source: "na",
        manualNa: true,
      };
    } else if (g.impressions === null) {
      impressions = {
        ...impressions,
        value: null,
        source: "manual",
        manualNa: undefined,
      };
    }
    const pages = parseGscAiPages(g.topPages);
    const devices = parseGscAiDevices(g.byDevice);
    next = {
      ...next,
      gscAi: {
        ...next.gscAi,
        impressions,
        ...(pages ? { topPages: pages } : {}),
        ...(devices ? { byDevice: devices } : {}),
        updatedAt: Date.now(),
      },
    };
  }

  // Curadoria da tabela de keywords (v77.9). O snapshot leva a versão
  // completa; `hidden` e `hideUnranked` espelham-se no config do cliente
  // para que o próximo relatório nasça já sem o que se tirou.
  if (body.kwCuration && typeof body.kwCuration === "object") {
    const c = body.kwCuration as Record<string, unknown>;
    const hidden = normalizeKeywordList(c.hidden);
    const hideUnranked = c.hideUnranked === true;
    const added: KeywordCuration["added"] = [];
    if (Array.isArray(c.added)) {
      // Uma keyword que o Serpstat já trouxe não se acrescenta à mão — a
      // posição dele é a medida; a linha manual só duplicava a contagem.
      const seen = new Set<string>(
        [
          ...(next.liveRanks?.ranks ?? []),
          ...(next.liveRanks?.others ?? []),
        ].map((r) => r.keyword.toLowerCase()),
      );
      for (const item of c.added.slice(0, MAX_KEYWORD_CURATION)) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const keyword =
          typeof o.keyword === "string"
            ? o.keyword.trim().replace(/\s+/g, " ").slice(0, 120)
            : "";
        if (!keyword || seen.has(keyword.toLowerCase())) continue;
        seen.add(keyword.toLowerCase());
        const p = Number(o.position);
        const position =
          o.position === null || o.position === undefined || o.position === ""
            ? null
            : Number.isFinite(p) && p >= 1 && p <= 100
              ? Math.round(p)
              : null;
        added.push({ keyword, position });
      }
    }
    next = { ...next, kwCuration: { hidden, hideUnranked, added } };
    try {
      const cfg = await getReportConfig(slug);
      if (
        cfg.keywordsHidden.join("\n") !== hidden.join("\n") ||
        cfg.keywordsHideUnranked !== hideUnranked
      ) {
        await saveReportConfig(
          slug,
          { keywordsHidden: hidden, keywordsHideUnranked: hideUnranked },
          Date.now(),
        );
      }
    } catch (err) {
      // O relatório grava na mesma — o espelho no config é conveniência
      // para o mês seguinte, não condição.
      console.error("keyword curation config mirror failed:", err);
    }
  }

  // Anexos das notas (v77.9) — substitui a lista por inteiro (é o browser
  // que a gere e sabe o que lá está). Só URLs https, com teto.
  if (Array.isArray(body.notesAttachments)) {
    const list: ReportAttachment[] = [];
    for (const item of body.notesAttachments.slice(0, MAX_REPORT_ATTACHMENTS)) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const url = typeof o.url === "string" ? o.url.trim() : "";
      if (!/^https:\/\/\S+$/.test(url) || url.length > 1000) continue;
      const name = typeof o.name === "string" ? o.name.trim().slice(0, 200) : "";
      const type = typeof o.type === "string" ? o.type.trim().slice(0, 100) : "";
      const size = Number(o.size);
      const addedAt = Number(o.addedAt);
      list.push({
        url,
        name: name || "ficheiro",
        type,
        size: Number.isFinite(size) && size >= 0 ? Math.round(size) : 0,
        addedAt: Number.isFinite(addedAt) && addedAt > 0 ? addedAt : Date.now(),
      });
    }
    next = { ...next, notesAttachments: list };
  }

  // Secções retiradas do documento. Só chaves conhecidas entram.
  if (Array.isArray(body.hiddenSections)) {
    const hidden = body.hiddenSections.filter(
      (k): k is ReportSectionKey =>
        typeof k === "string" &&
        (REPORT_SECTION_KEYS as readonly string[]).includes(k),
    );
    next = { ...next, hiddenSections: hidden };
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
