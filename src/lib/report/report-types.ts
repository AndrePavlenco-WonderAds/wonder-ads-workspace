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
  unit: MetricUnit;
};

export type LeadChannelKey =
  | "form"
  | "call"
  | "email"
  | "whatsapp"
  | "gbpWebsite"
  | "gbpDirections"
  | "gbpCall";

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

/** Per-source fetch outcome, for the internal provenance panel + re-auth. */
export type FetchStatus = {
  ok: boolean;
  /** "ok" | "not-configured" | "no-property" | "error" | "deferred". */
  status: string;
  message?: string;
};

export type ReportStatus = "draft" | "ready" | "sent";

export const REPORT_SCHEMA_VERSION = 1;

export type MonthlyReportSnapshot = {
  schemaVersion: number;
  slug: string;
  clientTitle: string;
  /** "2026-06". */
  period: string;
  /** "Junho de 2026". */
  periodLabel: string;
  generatedAt: number;
  status: ReportStatus;
  lang: "pt" | "en";

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

/** Percentage change of a metric, or null when it can't be computed. */
export function momPercent(m: ReportMetric): number | null {
  if (m.value === null || m.previous === null || m.previous === 0) return null;
  return ((m.value - m.previous) / m.previous) * 100;
}
