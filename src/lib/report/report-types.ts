// Shared types for the Monthly Report snapshot. Kept free of server-only
// imports so client components (the report view, config editor) can import
// them without pulling GA4/GSC code into the browser bundle.

/** Where a metric's number came from — always shown, never a bare number. */
export type MetricSource = "ga4" | "gsc" | "gbp" | "manual" | "na";

export type MetricUnit = "count" | "percent" | "seconds" | "position" | "ratio";

export type ReportMetric = {
  /** Current-month value. null = not available / awaiting manual input. */
  value: number | null;
  /** Prior month (MoM). null when unknown. */
  previous: number | null;
  /** Same month last year (YoY). Optional. */
  yoy?: number | null;
  /** Trailing 6-month values (oldest-first) for the mini-trend, when known. */
  history?: number[];
  source: MetricSource;
  /** false → surface "não instrumentado" instead of a real-looking 0. */
  instrumented: boolean;
  /** Consultant explicitly marked this metric "N/A este mês" — a validated
   *  decision, so it counts as resolved (report can go ready) and shows "N/A"
   *  rather than a pending note. */
  manualNa?: boolean;
  unit: MetricUnit;
};

export type LeadChannelKey =
  | "form"
  | "call"
  | "email"
  | "whatsapp"
  | "gbpWebsite"
  | "gbpDirections"
  | "gbpCall"
  /** An extra line configured for this client — see CustomLeadEvent. */
  | `custom:${string}`;

/** An extra lead line beyond the four defaults: a second phone number for a
 *  second unit, a form that only lives on one landing page, a per-unit contact
 *  form… Each is its own row in the report, with its own label and its own
 *  list of GA4 event names, and each counts towards the consolidated total.
 *
 *  `id` is stable and independent of the label/events, so renaming a line (or
 *  reordering the list) never re-points a manually filled value: the report
 *  channel key is `custom:<id>`. */
export type CustomLeadEvent = {
  id: string;
  label: string;
  events: string[];
};

/** Cap on extra lines per client — enough for a multi-unit clinic without
 *  letting the GA4 event filter grow unbounded. */
export const MAX_CUSTOM_LEAD_EVENTS = 8;

export type LeadChannel = {
  key: LeadChannelKey;
  label: string;
  metric: ReportMetric;
};

export type TopQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
  change: number | null;
};

export type TopPageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type AiSourceRow = {
  source: string;
  label: string;
  sessions: number;
  users: number;
  engagedSessions: number;
};

/** Month-end keyword footprint from GSC. */
export type KeywordStats = {
  total: number;
  top3: number;
  top10: number;
  top20: number;
  avgPosition: number;
  /** Month-over-month keyword movement. Optional so reports generated before
   *  these fields render (and summarise) without them. */
  newKeywords?: number;
  improved?: number;
  enteredTop10?: number;
  enteredTop3?: number;
};

/** One of the client's committed target keywords, with where it actually
 *  ranks this month. Every target is listed — including those not ranking
 *  yet (`position: null`) — so the client sees the full worked list, not
 *  just the winners. */
export type TargetKeywordRank = {
  keyword: string;
  position: number | null;
  previousPosition: number | null;
  change: number | null;
  clicks: number;
  impressions: number;
  isNew: boolean;
};

/** A query whose ranking improved vs. the prior month. */
export type KeywordMover = {
  query: string;
  position: number;
  clicks: number;
  change: number;
};

/** How much of the month a report covers. A report generated mid-month is
 *  explicitly partial, and its MoM/YoY windows are cut to the same day count
 *  so the comparison stays honest. */
export type ReportCoverage = {
  partial: boolean;
  days: number;
  monthDays: number;
  through: string;
};

/** Per-source fetch outcome, for the internal provenance panel + re-auth. */
export type FetchStatus = {
  ok: boolean;
  /** "ok" | "not-configured" | "no-property" | "error" | "deferred". */
  status: string;
  message?: string;
};

export type ReportStatus = "draft" | "ready" | "sent";

export const REPORT_SCHEMA_VERSION = 3;

export type MonthlyReportSnapshot = {
  schemaVersion: number;
  slug: string;
  clientTitle: string;
  /** "2026-06". */
  period: string;
  /** "Junho de 2026", ou "Julho de 2026 (parcial · 1–26)" num mês em curso. */
  periodLabel: string;
  /** Which days the report actually covers. Present from v76.17; absent on
   *  older snapshots, which are always complete months by construction. */
  coverage?: ReportCoverage;
  generatedAt: number;
  status: ReportStatus;
  lang: "pt" | "en";
  /** SEO consultant who owns this client — shown on the report + PDF footer. */
  consultant: { name: string; email: string };

  leads: {
    total: ReportMetric;
    channels: LeadChannel[];
  };
  organic: {
    sessions: ReportMetric;
    users: ReportMetric;
    googleOrganicUsers: ReportMetric;
    newUsers: ReportMetric;
    returningUsers: ReportMetric;
    engagedSessions: ReportMetric;
    engagementRate: ReportMetric;
    avgEngagementTimePerUser: ReportMetric;
  };
  gsc: {
    clicks: ReportMetric;
    impressions: ReportMetric;
    ctr: ReportMetric;
    position: ReportMetric;
    topQueries: TopQueryRow[];
    topPages: TopPageRow[];
    keywordStats: KeywordStats | null;
    /** The movers actually SHOWN to the client — at most 5. Defaults to the
     *  biggest gains; the consultant can re-pick from `moverCandidates`. */
    topMovers: KeywordMover[];
    /** Up to 20 gainers to choose from. Raw movement surfaces competitor
     *  brand names and off-strategy terms, which are exactly the ones we
     *  don't want in a client's report — so the pick is human. Optional:
     *  reports generated before v76.16 have none. */
    moverCandidates?: KeywordMover[];
    /** True once a consultant has curated the selection, so the UI can tell
     *  "these are the automatic top 5" from "these were chosen". */
    moversCurated?: boolean;
    /** The client's target keywords with their current position. Optional so
     *  reports generated before v76.15 still load (schemaVersion is a hard
     *  equality check in report-store — bumping it would discard them). */
    targetRanks?: TargetKeywordRank[];
  };
  ai: {
    totalSessions: ReportMetric;
    sources: AiSourceRow[];
  };
  gbp: {
    websiteClicks: ReportMetric;
    directions: ReportMetric;
    callClicks: ReportMetric;
  };

  /** 3–5 auto-generated highlight bullets. */
  execSummary: string[];
  /** When the consultant explicitly finalised the report (clicked "Finalizar").
   *  null/undefined = still in preparation. Reset to null on every (re)generation
   *  so a fresh data pull must be re-finalised — which re-announces to
   *  #client-wins. Gates the PDF / public link / send-for-approval actions. */
  finalizedAt?: number | null;
  /** Free text from the account manager (section 8). */
  notes: string;
  /** Per-source fetch provenance (internal only, stripped from the PDF). */
  fetch: { ga4: FetchStatus; gsc: FetchStatus; gbp: FetchStatus };
  pdfBlobUrl: string | null;
};

/** A metric that couldn't be pulled — awaiting manual input or N/A. */
export function pendingMetric(
  unit: MetricUnit,
  source: MetricSource = "na",
): ReportMetric {
  return { value: null, previous: null, source, instrumented: false, unit };
}

/** A metric filled in by hand. */
export function manualMetric(value: number, unit: MetricUnit): ReportMetric {
  return { value, previous: null, source: "manual", instrumented: true, unit };
}

/** A metric explicitly marked N/A for this month. */
export function naMetric(unit: MetricUnit): ReportMetric {
  return { value: null, previous: null, source: "na", instrumented: false, manualNa: true, unit };
}

/** True when a metric still needs consultant attention (not pulled, not
 *  filled, not marked N/A). Reports go "ready" only when none remain. */
export function isUnresolved(m: ReportMetric): boolean {
  return m.value === null && !m.manualNa;
}

/** Percentage change of a metric, or null when it can't be computed. */
export function momPercent(m: ReportMetric): number | null {
  if (m.value === null || m.previous === null || m.previous === 0) return null;
  return ((m.value - m.previous) / m.previous) * 100;
}
