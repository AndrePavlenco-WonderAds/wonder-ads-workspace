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
  /** The client's main Business Profile — the one auto-matched from their
   *  website, or pinned via report-config.gbpLocationId. */
  | "gbpWebsite"
  | "gbpDirections"
  | "gbpCall"
  /** An extra line configured for this client — see CustomLeadEvent. */
  | `custom:${string}`
  /** An additional Business Profile: `gbp:<profileId>:website|directions|call`.
   *  A multi-unit clinic has one listing per unit, each with its own clicks
   *  and direction requests, and rolling them into one number hides which
   *  unit is actually being found. */
  | `gbp:${string}`;

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

/** An additional Google Business Profile beyond the client's main listing.
 *  Multi-unit clients (a clinic with a practice in Cascais and another in
 *  Lisboa) have one listing per unit; each is pulled separately so the report
 *  can show which unit is actually being found.
 *
 *  `id` is stable and independent of the label, so renaming a unit never
 *  re-points a manually filled value — the channel keys are
 *  `gbp:<id>:website` / `:directions` / `:call`. */
export type GbpProfile = {
  id: string;
  label: string;
  /** GBP location id ("locations/123…" or the bare numeric id). */
  locationId: string;
};

/** Cap on extra Business Profiles per client. Each one costs two more
 *  Performance API calls per report, on an API with a low quota. */
export const MAX_GBP_PROFILES = 8;

/** The client's main listing — the one auto-matched from the website, or
 *  pinned via `report-config.gbpLocationId`. Its channel keys are the original
 *  `gbpWebsite` / `gbpDirections` / `gbpCall`, so nothing a consultant filled
 *  in before multi-profile support re-points. */
export const GBP_MAIN_PROFILE_ID = "main";

/** The three metrics of one profile. */
export type GbpMetricTrio = "website" | "directions" | "call";

/** Channel key for one metric of one profile. The main listing keeps its
 *  original keys; extra profiles are namespaced by their stable id. */
export function gbpChannelKey(
  profileId: string,
  metric: GbpMetricTrio,
): LeadChannelKey {
  if (profileId === GBP_MAIN_PROFILE_ID) {
    return metric === "website"
      ? "gbpWebsite"
      : metric === "directions"
        ? "gbpDirections"
        : "gbpCall";
  }
  return `gbp:${profileId}:${metric}`;
}

/** True for every Business Profile channel — main or extra. These are always
 *  manual-fillable (the API is often unavailable), unlike GA4 lead events. */
export function isGbpChannelKey(key: string): boolean {
  return key.startsWith("gbp");
}

/** One profile's three metrics, kept alongside the consolidated totals so the
 *  report can break a multi-unit client down per listing. */
export type GbpProfileMetrics = {
  id: string;
  label: string;
  websiteClicks: ReportMetric;
  directions: ReportMetric;
  callClicks: ReportMetric;
};

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

/** One target keyword's TRUE SERP position, checked by SE Ranking.
 *
 *  Distinct from TargetKeywordRank, which is a GSC *average* over whatever
 *  impressions Google chose to serve — a keyword with no impressions simply
 *  disappears there. SE Ranking checks a fixed SERP on a schedule, so every
 *  keyword gets an answer whether or not it earned impressions. */
export type SeRankingRank = {
  keyword: string;
  /** null = outside the tracked depth (top 100). */
  position: number | null;
  previousPosition: number | null;
  /** previous − current, so positive = climbed. null when there's no earlier
   *  check to compare against. */
  change: number | null;
  volume: number | null;
  /** Ranked inside the Google local pack rather than the blue links — for a
   *  clinic the pack is often the result that actually books appointments. */
  inLocalPack: boolean;
};

/** The SE Ranking rank-tracking block of a report. Optional on the snapshot:
 *  reports generated before this existed simply have none, and clients whose
 *  project isn't synced yet never get one. */
export type SeRankingBlock = {
  siteId: number;
  /** Date of the position check being shown ("2026-08-03"). */
  checkedOn: string;
  /** True when `checkedOn` falls outside the reported month. Rank tracking
   *  only starts when the project is created, so a report for an earlier month
   *  has no check from that month; the report then labels the real check date
   *  instead of implying the number belongs to the reported period. */
  outsidePeriod: boolean;
  ranks: SeRankingRank[];
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

/** A evolução dos últimos meses — a secção que responde a «isto está a
 *  crescer?», que é a pergunta que um número de um mês sozinho nunca responde.
 *
 *  Cada série tem exatamente um valor por entrada de `months`, na mesma ordem.
 *  `null` = mês sem medição (a propriedade ainda não existia), que se desenha
 *  como buraco na linha e não como queda a zero. */
export type ReportTrend = {
  /** ["2025-09" … "2026-08"], mais antigo primeiro. */
  months: string[];
  /** Rótulos curtos já traduzidos ("set", "out", …) para o eixo. */
  labels: string[];
  organicUsers: (number | null)[];
  organicSessions: (number | null)[];
  leads: (number | null)[];
  gscClicks: (number | null)[];
  gscImpressions: (number | null)[];
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
  /** True SERP positions from SE Ranking for the same target keywords, shown
   *  under the GSC table. Absent when the client has no synced project. */
  seRanking?: SeRankingBlock;
  /** Evolução dos últimos 12 meses. Ausente nos relatórios gerados antes da
   *  v76.32 e quando o GA4 não respondeu. */
  trend?: ReportTrend;
  ai: {
    totalSessions: ReportMetric;
    sources: AiSourceRow[];
  };
  gbp: {
    /** Consolidated across every profile. Identical to the single listing for
     *  the clients that have one, so the existing card renders unchanged. */
    websiteClicks: ReportMetric;
    directions: ReportMetric;
    callClicks: ReportMetric;
    /** Per-listing breakdown, present only when the client has more than one
     *  Business Profile. Optional so older snapshots still load. */
    profiles?: GbpProfileMetrics[];
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
