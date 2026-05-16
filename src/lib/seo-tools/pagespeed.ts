// Google PageSpeed Insights v5 wrapper.
// Free, official, no API key required for low volume — set PAGESPEED_API_KEY
// to lift quota. Docs: https://developers.google.com/speed/docs/insights/v5/get-started

export type PsiStrategy = "mobile" | "desktop";

export type PsiCategoryScores = {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
};

export type PsiCoreWebVitals = {
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  fcpMs: number | null;
  ttfbMs: number | null;
};

export type PsiAuditFinding = {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
};

export type PsiResult = {
  strategy: PsiStrategy;
  fetchedAt: string;
  finalUrl: string;
  scores: PsiCategoryScores;
  fieldData: PsiCoreWebVitals; // from CrUX if available
  labData: PsiCoreWebVitals; // from Lighthouse lab run
  failedAudits: PsiAuditFinding[]; // score < 0.9, sorted by impact
  warnings: string[];
};

const ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;

function n(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundedScore(raw: unknown): number | null {
  const v = n(raw);
  return v === null ? null : Math.round(v * 100);
}

type LighthouseAudit = {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  displayValue?: string;
  details?: { overallSavingsMs?: number };
};

type LighthouseCategory = {
  id?: string;
  title?: string;
  score?: number | null;
  auditRefs?: { id: string; weight?: number }[];
};

type PsiResponse = {
  id?: string;
  loadingExperience?: {
    metrics?: Record<string, { percentile?: number }>;
  };
  lighthouseResult?: {
    finalUrl?: string;
    fetchTime?: string;
    requestedUrl?: string;
    runWarnings?: string[];
    categories?: Record<string, LighthouseCategory>;
    audits?: Record<string, LighthouseAudit>;
  };
};

function extractScores(
  cats: Record<string, LighthouseCategory> | undefined,
): PsiCategoryScores {
  return {
    performance: roundedScore(cats?.performance?.score),
    accessibility: roundedScore(cats?.accessibility?.score),
    bestPractices: roundedScore(cats?.["best-practices"]?.score),
    seo: roundedScore(cats?.seo?.score),
  };
}

function extractLabCwv(
  audits: Record<string, LighthouseAudit> | undefined,
): PsiCoreWebVitals {
  return {
    lcpMs: n(audits?.["largest-contentful-paint"]?.score) === null
      ? null
      : parseMsDisplay(audits?.["largest-contentful-paint"]?.displayValue),
    inpMs: n(audits?.["interaction-to-next-paint"]?.score) === null
      ? null
      : parseMsDisplay(audits?.["interaction-to-next-paint"]?.displayValue),
    cls: parseCls(audits?.["cumulative-layout-shift"]?.displayValue),
    fcpMs: parseMsDisplay(audits?.["first-contentful-paint"]?.displayValue),
    ttfbMs: parseMsDisplay(audits?.["server-response-time"]?.displayValue),
  };
}

function extractFieldCwv(
  metrics: Record<string, { percentile?: number }> | undefined,
): PsiCoreWebVitals {
  return {
    lcpMs: n(metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile),
    inpMs: n(metrics?.INTERACTION_TO_NEXT_PAINT?.percentile),
    cls:
      n(metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile) === null
        ? null
        : (metrics!.CUMULATIVE_LAYOUT_SHIFT_SCORE!.percentile as number) / 100,
    fcpMs: n(metrics?.FIRST_CONTENTFUL_PAINT_MS?.percentile),
    ttfbMs: n(metrics?.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile),
  };
}

function parseMsDisplay(s: string | undefined): number | null {
  if (!s) return null;
  // "1.2 s" → 1200, "350 ms" → 350
  const match = s.match(/([\d.]+)\s*(ms|s)/i);
  if (!match) return null;
  const v = parseFloat(match[1]);
  return Number.isFinite(v) ? (match[2].toLowerCase() === "s" ? v * 1000 : v) : null;
}

function parseCls(s: string | undefined): number | null {
  if (!s) return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

function extractFailedAudits(
  audits: Record<string, LighthouseAudit> | undefined,
  cats: Record<string, LighthouseCategory> | undefined,
  limit = 12,
): PsiAuditFinding[] {
  if (!audits || !cats) return [];
  const weightById = new Map<string, number>();
  for (const cat of Object.values(cats)) {
    for (const ref of cat.auditRefs ?? []) {
      const w = ref.weight ?? 0;
      if (w > (weightById.get(ref.id) ?? 0)) weightById.set(ref.id, w);
    }
  }
  const failed: (PsiAuditFinding & { weight: number; savingsMs: number })[] =
    [];
  for (const [id, a] of Object.entries(audits)) {
    if (typeof a.score !== "number") continue;
    if (a.score >= 0.9) continue;
    failed.push({
      id,
      title: a.title ?? id,
      description: stripMarkdownLinks(a.description ?? ""),
      score: a.score,
      displayValue: a.displayValue,
      weight: weightById.get(id) ?? 0,
      savingsMs: a.details?.overallSavingsMs ?? 0,
    });
  }
  failed.sort(
    (a, b) =>
      b.weight - a.weight ||
      b.savingsMs - a.savingsMs ||
      (a.score ?? 0) - (b.score ?? 0),
  );
  return failed.slice(0, limit).map((entry) => {
    const { weight, savingsMs, ...rest } = entry;
    void weight;
    void savingsMs;
    return rest;
  });
}

function stripMarkdownLinks(s: string): string {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
}

export async function runPageSpeed(
  url: string,
  strategy: PsiStrategy,
  opts: { signal?: AbortSignal } = {},
): Promise<PsiResult> {
  const params = new URLSearchParams();
  params.set("url", url);
  params.set("strategy", strategy);
  for (const c of CATEGORIES) params.append("category", c);
  if (process.env.PAGESPEED_API_KEY) {
    params.set("key", process.env.PAGESPEED_API_KEY);
  }

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    signal: opts.signal,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `PageSpeed Insights ${strategy} failed: HTTP ${res.status} ${body.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as PsiResponse;
  const lh = json.lighthouseResult ?? {};
  return {
    strategy,
    fetchedAt: lh.fetchTime ?? new Date().toISOString(),
    finalUrl: lh.finalUrl ?? url,
    scores: extractScores(lh.categories),
    fieldData: extractFieldCwv(json.loadingExperience?.metrics),
    labData: extractLabCwv(lh.audits),
    failedAudits: extractFailedAudits(lh.audits, lh.categories),
    warnings: lh.runWarnings ?? [],
  };
}

export function formatPsiForPrompt(r: PsiResult): string {
  const lines: string[] = [];
  lines.push(`## PageSpeed Insights — ${r.strategy}`);
  lines.push(`Tested URL: ${r.finalUrl}`);
  lines.push("");
  lines.push("**Lighthouse scores (0-100):**");
  lines.push(`- Performance: ${fmt(r.scores.performance)}`);
  lines.push(`- Accessibility: ${fmt(r.scores.accessibility)}`);
  lines.push(`- Best Practices: ${fmt(r.scores.bestPractices)}`);
  lines.push(`- SEO: ${fmt(r.scores.seo)}`);
  lines.push("");
  lines.push("**Field data (CrUX, real users — 28 day p75):**");
  lines.push(cwvLine("LCP (ms)", r.fieldData.lcpMs, 2500, 4000));
  lines.push(cwvLine("INP (ms)", r.fieldData.inpMs, 200, 500));
  lines.push(cwvLine("CLS", r.fieldData.cls, 0.1, 0.25, true));
  lines.push(cwvLine("FCP (ms)", r.fieldData.fcpMs, 1800, 3000));
  lines.push(cwvLine("TTFB (ms)", r.fieldData.ttfbMs, 800, 1800));
  lines.push("");
  lines.push("**Lab data (single Lighthouse run):**");
  lines.push(`- LCP: ${fmtMs(r.labData.lcpMs)}`);
  lines.push(`- INP: ${fmtMs(r.labData.inpMs)}`);
  lines.push(`- CLS: ${fmt(r.labData.cls)}`);
  lines.push(`- FCP: ${fmtMs(r.labData.fcpMs)}`);
  lines.push(`- TTFB: ${fmtMs(r.labData.ttfbMs)}`);

  if (r.failedAudits.length > 0) {
    lines.push("");
    lines.push("**Top failed / opportunity audits (sorted by impact):**");
    for (const a of r.failedAudits) {
      const pct =
        typeof a.score === "number" ? `${Math.round(a.score * 100)}/100` : "n/a";
      lines.push(`- **${a.title}** (${pct}${a.displayValue ? `, ${a.displayValue}` : ""})`);
      if (a.description) lines.push(`  - ${a.description}`);
    }
  }

  if (r.warnings.length > 0) {
    lines.push("");
    lines.push("**Runtime warnings:** " + r.warnings.join("; "));
  }

  return lines.join("\n");
}

function fmt(v: number | null): string {
  return v === null ? "—" : v.toString();
}

function fmtMs(v: number | null): string {
  return v === null ? "—" : `${Math.round(v)} ms`;
}

function cwvLine(
  label: string,
  v: number | null,
  good: number,
  poor: number,
  lowerIsBetter = false,
): string {
  if (v === null) return `- ${label}: — (no CrUX data)`;
  const status =
    (lowerIsBetter || true) && (v <= good ? "✅ good" : v <= poor ? "⚠️ needs improvement" : "❌ poor");
  const valStr = label === "CLS" ? v.toFixed(3) : Math.round(v).toString();
  return `- ${label}: ${valStr} ${status}`;
}
