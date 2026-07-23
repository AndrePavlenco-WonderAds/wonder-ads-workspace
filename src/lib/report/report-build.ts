// Aggregator for the Monthly Report. Pulls GA4 + GSC (GBP deferred to Fase 3),
// assembles the fixed 8-section snapshot, computes the consolidated lead total,
// generates the Executive Summary by rules, and applies the golden-rule
// fallback: a metric we can't pull is marked source "na"/"manual" and the
// report stays "draft" until it's filled or marked N/A — never a fake 0.

import { getClientLocale } from "@/lib/client-locale";
import {
  getConsultantForSlug,
  getConsultantEmailForSlug,
} from "@/lib/client-overrides";
import { getGa4MonthlyReport, type MetricPair } from "./ga4-report";
import { getGscMonthlyReport } from "@/lib/gsc";
import { getGbpMonthlyReport } from "@/lib/gbp";
import { getReportConfig } from "./report-config-store";
import {
  periodFromKey,
  previousCompleteMonth,
  reportWindows,
} from "./report-dates";
import {
  REPORT_SCHEMA_VERSION,
  pendingMetric,
  isUnresolved,
  type FetchStatus,
  type LeadChannel,
  type MonthlyReportSnapshot,
  type ReportMetric,
  type ReportStatus,
} from "./report-types";

const ga4Metric = (
  pair: MetricPair,
  unit: ReportMetric["unit"],
): ReportMetric => ({
  value: pair.value,
  previous: pair.previous,
  source: "ga4",
  instrumented: true,
  unit,
});

/** A GA4 lead channel: real number when the event is instrumented, otherwise
 *  a pending metric so the UI shows "não instrumentado", never a fake 0. */
const leadMetric = (pair: MetricPair, instrumented: boolean): ReportMetric =>
  instrumented
    ? { value: pair.value, previous: pair.previous, source: "ga4", instrumented: true, unit: "count" }
    : pendingMetric("count", "na");

const gscMetric = (
  value: number,
  previous: number | null | undefined,
  unit: ReportMetric["unit"],
): ReportMetric => ({
  value,
  previous: previous ?? null,
  source: "gsc",
  instrumented: true,
  unit,
});

const gbpMetric = (p: { value: number; previous: number | null }): ReportMetric => ({
  value: p.value,
  previous: p.previous,
  source: "gbp",
  instrumented: true,
  unit: "count",
});

const LEAD_LABELS_PT: Record<string, string> = {
  form: "Formulários",
  call: "Cliques em Ligar",
  email: "Cliques em Email",
  whatsapp: "Cliques no WhatsApp",
  gbpWebsite: "GBP · cliques p/ website",
  gbpDirections: "GBP · pedidos de direções",
  gbpCall: "GBP · cliques p/ ligar",
};
const LEAD_LABELS_EN: Record<string, string> = {
  form: "Form submissions",
  call: "Call clicks",
  email: "Email clicks",
  whatsapp: "WhatsApp clicks",
  gbpWebsite: "GBP · website clicks",
  gbpDirections: "GBP · direction requests",
  gbpCall: "GBP · call clicks",
};

function sumConsolidated(channels: LeadChannel[]): ReportMetric {
  const have = channels.filter((c) => c.metric.value !== null);
  if (have.length === 0) return pendingMetric("count", "na");
  const value = have.reduce((t, c) => t + (c.metric.value ?? 0), 0);
  const prevKnown = have.filter((c) => c.metric.previous !== null);
  const previous = prevKnown.length
    ? prevKnown.reduce((t, c) => t + (c.metric.previous ?? 0), 0)
    : null;
  return {
    value,
    previous,
    source: "ga4",
    instrumented: true,
    unit: "count",
  };
}

/** Human-friendly AI source label from a GA4 sessionSource host. */
function aiLabel(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("chatgpt") || s.includes("openai")) return "ChatGPT";
  if (s.includes("gemini")) return "Gemini";
  if (s.includes("claude")) return "Claude";
  if (s.includes("perplexity")) return "Perplexity";
  if (s.includes("copilot")) return "Copilot";
  if (s.includes("bing")) return "Bing Chat";
  return source;
}

/** Executive summary — POSITIVE highlights only, never a negative. Aims for
 *  3–5 bullets. A metric that fell is simply omitted (or shown as a neutral
 *  total), never framed as a drop. */
function buildExecSummary(
  snap: Omit<MonthlyReportSnapshot, "execSummary">,
  lang: "pt" | "en",
): string[] {
  const pt = lang === "pt";
  const t = (p: string, e: string) => (pt ? p : e);
  const fmt = (n: number | null | undefined) =>
    typeof n === "number" ? Math.round(n).toLocaleString(pt ? "pt-PT" : "en-GB") : "";

  // Positive % gain for a metric (position is inverted: lower = improvement).
  const gainOf = (m: ReportMetric): number | null => {
    if (m.value === null || m.previous === null || m.previous === 0) return null;
    if (m.unit === "position") {
      const diff = m.previous - m.value;
      return diff > 0.05 ? (diff / m.previous) * 100 : null;
    }
    const mom = ((m.value - m.previous) / m.previous) * 100;
    return mom > 0.5 ? mom : null;
  };

  const cand: { pri: number; text: string }[] = [];
  const seen = new Set<string>();
  const add = (pri: number, text: string) => {
    if (text && !seen.has(text)) {
      seen.add(text);
      cand.push({ pri, text });
    }
  };

  // Leads (top priority; positive framing whether or not it grew).
  const leads = snap.leads.total;
  const leadGain = gainOf(leads);
  if (leads.value && leads.value > 0) {
    if (leadGain !== null)
      add(100, t(
        `Geraram-se **${fmt(leads.value)}** leads — **+${leadGain.toFixed(0)}%** face ao mês anterior.`,
        `**${fmt(leads.value)}** leads generated — **+${leadGain.toFixed(0)}%** vs. last month.`,
      ));
    else
      add(96, t(
        `Geraram-se **${fmt(leads.value)}** leads este mês.`,
        `**${fmt(leads.value)}** leads generated this month.`,
      ));
  }

  const ug = gainOf(snap.organic.users);
  if (ug !== null)
    add(90, t(`Utilizadores orgânicos a crescer **+${ug.toFixed(0)}%** face ao mês anterior.`, `Organic users up **+${ug.toFixed(0)}%** vs. last month.`));
  else if (snap.organic.users.value && snap.organic.users.value > 0)
    add(58, t(`**${fmt(snap.organic.users.value)}** utilizadores chegaram por pesquisa orgânica.`, `**${fmt(snap.organic.users.value)}** users arrived via organic search.`));

  const cg = gainOf(snap.gsc.clicks);
  if (cg !== null)
    add(86, t(`Clicks na Pesquisa Google **+${cg.toFixed(0)}%** face ao mês anterior.`, `Google Search clicks **+${cg.toFixed(0)}%** vs. last month.`));

  const pg = gainOf(snap.gsc.position);
  if (pg !== null && snap.gsc.position.value !== null)
    add(84, t(`Posição média melhorou para **${snap.gsc.position.value.toFixed(1)}** na Google.`, `Average position improved to **${snap.gsc.position.value.toFixed(1)}** on Google.`));

  const ig = gainOf(snap.gsc.impressions);
  if (ig !== null)
    add(70, t(`Impressões na Pesquisa Google **+${ig.toFixed(0)}%**.`, `Google Search impressions **+${ig.toFixed(0)}%**.`));

  // Keyword movement vs. last month (positive-only, like the rest of the summary).
  const ks = snap.gsc.keywordStats;
  if (ks) {
    if (ks.enteredTop3 && ks.enteredTop3 > 0)
      add(83, t(
        `**${fmt(ks.enteredTop3)}** ${ks.enteredTop3 === 1 ? "keyword chegou" : "keywords chegaram"} ao **Top 3** da Google.`,
        `**${fmt(ks.enteredTop3)}** ${ks.enteredTop3 === 1 ? "keyword reached" : "keywords reached"} the **Top 3** on Google.`,
      ));
    if (ks.enteredTop10 && ks.enteredTop10 > 0)
      add(80, t(
        `**${fmt(ks.enteredTop10)}** ${ks.enteredTop10 === 1 ? "keyword subiu" : "keywords subiram"} para o **Top 10** da Google.`,
        `**${fmt(ks.enteredTop10)}** ${ks.enteredTop10 === 1 ? "keyword climbed" : "keywords climbed"} into the **Top 10** on Google.`,
      ));
    if (ks.newKeywords && ks.newKeywords > 0)
      add(74, t(
        `**${fmt(ks.newKeywords)}** novas keywords a rankar na Google este mês.`,
        `**${fmt(ks.newKeywords)}** new keywords ranking on Google this month.`,
      ));
    if (ks.improved && ks.improved > 0)
      add(56, t(
        `**${fmt(ks.improved)}** keywords subiram de posição face ao mês anterior.`,
        `**${fmt(ks.improved)}** keywords improved their position vs. last month.`,
      ));
  }

  const eg = gainOf(snap.organic.engagementRate);
  if (eg !== null)
    add(60, t(`Taxa de engagement a subir **+${eg.toFixed(0)}%**.`, `Engagement rate up **+${eg.toFixed(0)}%**.`));

  const ai = snap.ai;
  if (ai.totalSessions.value && ai.totalSessions.value > 0) {
    const top = [...ai.sources].sort((a, b) => b.sessions - a.sessions)[0];
    add(66, t(
      `**${fmt(ai.totalSessions.value)}** sessões vieram de assistentes de IA${top ? `, lideradas pelo ${top.label}` : ""}.`,
      `**${fmt(ai.totalSessions.value)}** sessions came from AI assistants${top ? `, led by ${top.label}` : ""}.`,
    ));
  }

  if (snap.gsc.topQueries.length) {
    const byClicks = snap.gsc.topQueries[0];
    add(54, t(`A pesquisa «**${byClicks.query}**» trouxe **${fmt(byClicks.clicks)}** clicks.`, `The query “**${byClicks.query}**” drove **${fmt(byClicks.clicks)}** clicks.`));
    const best = [...snap.gsc.topQueries]
      .filter((q) => q.position > 0)
      .sort((a, b) => a.position - b.position)[0];
    if (best)
      add(52, t(`«**${best.query}**» está em **${best.position.toFixed(1)}** na Google.`, `“**${best.query}**” sits at **${best.position.toFixed(1)}** on Google.`));
  }

  cand.sort((a, b) => b.pri - a.pri);
  return cand.slice(0, 5).map((c) => c.text);
}

/** Build (do not persist) the monthly report snapshot for a client. Deterministic
 *  given the live data — the caller persists via report-store.saveReport. */
export async function buildMonthlyReport(
  slug: string,
  clientTitle: string,
  periodKey?: string,
  nowMs: number = Date.now(),
): Promise<MonthlyReportSnapshot> {
  const period = periodKey ? periodFromKey(periodKey) : previousCompleteMonth(new Date(nowMs));
  const windows = reportWindows(period.key);
  const config = await getReportConfig(slug);
  const lang = getClientLocale(slug);

  const [ga4, gsc, gbp] = await Promise.all([
    getGa4MonthlyReport(slug, {
      current: windows.current,
      previous: windows.prevMonth,
      eventMap: config.eventMap,
      llmRegex: config.llmRegex,
      propertyIdOverride: config.ga4PropertyId,
    }),
    getGscMonthlyReport(slug, {
      current: windows.current,
      previous: windows.prevMonth,
      siteUrlOverride: config.gscSiteUrl,
      topLimit: 10,
    }),
    getGbpMonthlyReport(slug, {
      current: windows.current,
      previous: windows.prevMonth,
      locationIdOverride: config.gbpLocationId,
    }),
  ]);

  const ga4Fetch: FetchStatus =
    ga4.status === "ok"
      ? { ok: true, status: "ok" }
      : { ok: false, status: ga4.status, message: ga4.status === "error" ? ga4.message : undefined };
  const gscFetch: FetchStatus =
    gsc.status === "ok"
      ? { ok: true, status: "ok" }
      : { ok: false, status: gsc.status, message: gsc.status === "error" ? gsc.message : undefined };
  const gbpFetch: FetchStatus =
    gbp.status === "ok"
      ? { ok: true, status: "ok" }
      : { ok: false, status: gbp.status, message: gbp.status === "error" ? gbp.message : undefined };

  const labels = lang === "pt" ? LEAD_LABELS_PT : LEAD_LABELS_EN;

  // --- Leads channels ---
  const channels: LeadChannel[] = [];
  if (ga4.status === "ok") {
    channels.push(
      { key: "form", label: labels.form, metric: leadMetric(ga4.leads.form, ga4.leads.instrumented.form) },
      { key: "call", label: labels.call, metric: leadMetric(ga4.leads.call, ga4.leads.instrumented.call) },
      { key: "email", label: labels.email, metric: leadMetric(ga4.leads.email, ga4.leads.instrumented.email) },
      { key: "whatsapp", label: labels.whatsapp, metric: leadMetric(ga4.leads.whatsapp, ga4.leads.instrumented.whatsapp) },
    );
  } else {
    for (const key of ["form", "call", "email", "whatsapp"] as const) {
      channels.push({ key, label: labels[key], metric: pendingMetric("count", "na") });
    }
  }
  // GBP lead channels — real values when the Business Profile Performance API
  // is reachable, else pending manual input (never a fabricated 0).
  channels.push(
    {
      key: "gbpWebsite",
      label: labels.gbpWebsite,
      metric: gbp.status === "ok" ? gbpMetric(gbp.websiteClicks) : pendingMetric("count", "manual"),
    },
    {
      key: "gbpDirections",
      label: labels.gbpDirections,
      metric: gbp.status === "ok" ? gbpMetric(gbp.directions) : pendingMetric("count", "manual"),
    },
    {
      key: "gbpCall",
      label: labels.gbpCall,
      metric: gbp.status === "ok" ? gbpMetric(gbp.callClicks) : pendingMetric("count", "manual"),
    },
  );

  const leadsTotal = sumConsolidated(channels);

  // --- Organic ---
  const organic =
    ga4.status === "ok"
      ? {
          sessions: ga4Metric(ga4.organic.sessions, "count"),
          users: ga4Metric(ga4.organic.users, "count"),
          googleOrganicUsers: ga4Metric(ga4.organic.googleOrganicUsers, "count"),
          newUsers: ga4Metric(ga4.organic.newUsers, "count"),
          returningUsers: {
            value:
              ga4.organic.users.value !== null && ga4.organic.newUsers.value !== null
                ? Math.max(0, ga4.organic.users.value - ga4.organic.newUsers.value)
                : null,
            previous:
              ga4.organic.users.previous !== null && ga4.organic.newUsers.previous !== null
                ? Math.max(0, ga4.organic.users.previous - ga4.organic.newUsers.previous)
                : null,
            source: "ga4" as const,
            instrumented: true,
            unit: "count" as const,
          },
          engagedSessions: ga4Metric(ga4.organic.engagedSessions, "count"),
          engagementRate: ga4Metric(ga4.organic.engagementRate, "ratio"),
          avgEngagementTimePerUser: ga4Metric(ga4.organic.avgEngagementTimePerUser, "seconds"),
        }
      : {
          sessions: pendingMetric("count"),
          users: pendingMetric("count"),
          googleOrganicUsers: pendingMetric("count"),
          newUsers: pendingMetric("count"),
          returningUsers: pendingMetric("count"),
          engagedSessions: pendingMetric("count"),
          engagementRate: pendingMetric("ratio"),
          avgEngagementTimePerUser: pendingMetric("seconds"),
        };

  // --- GSC ---
  const gscBlock =
    gsc.status === "ok"
      ? {
          clicks: gscMetric(gsc.totals.clicks, gsc.prevTotals?.clicks, "count"),
          impressions: gscMetric(gsc.totals.impressions, gsc.prevTotals?.impressions, "count"),
          ctr: gscMetric(gsc.totals.ctr, gsc.prevTotals?.ctr, "ratio"),
          position: gscMetric(gsc.totals.position, gsc.prevTotals?.position, "position"),
          topQueries: gsc.topQueries.map((q) => ({
            query: q.query,
            clicks: q.clicks,
            impressions: q.impressions,
            position: q.position,
            change: q.change,
          })),
          topPages: gsc.topPages.map((p) => ({
            page: p.page,
            clicks: p.clicks,
            impressions: p.impressions,
            ctr: p.ctr,
            position: p.position,
          })),
          keywordStats: gsc.keywordStats,
          topMovers: gsc.topMovers,
        }
      : {
          clicks: pendingMetric("count"),
          impressions: pendingMetric("count"),
          ctr: pendingMetric("ratio"),
          position: pendingMetric("position"),
          topQueries: [],
          topPages: [],
          keywordStats: null,
          topMovers: [],
        };

  // --- AI Visibility ---
  const aiBlock =
    ga4.status === "ok"
      ? {
          totalSessions: {
            value: ga4.ai.totalSessions,
            previous: null,
            source: "ga4" as const,
            instrumented: true,
            unit: "count" as const,
          },
          sources: ga4.ai.sources.map((s) => ({
            source: s.source,
            label: aiLabel(s.source),
            sessions: s.sessions,
            users: s.users,
            engagedSessions: s.engagedSessions,
          })),
        }
      : { totalSessions: pendingMetric("count"), sources: [] };

  // --- GBP ---
  const gbpBlock =
    gbp.status === "ok"
      ? {
          websiteClicks: gbpMetric(gbp.websiteClicks),
          directions: gbpMetric(gbp.directions),
          callClicks: gbpMetric(gbp.callClicks),
        }
      : {
          websiteClicks: pendingMetric("count", "manual"),
          directions: pendingMetric("count", "manual"),
          callClicks: pendingMetric("count", "manual"),
        };

  const base: Omit<MonthlyReportSnapshot, "execSummary"> = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    slug,
    clientTitle,
    period: period.key,
    periodLabel: period.label,
    generatedAt: nowMs,
    status: "draft" as ReportStatus,
    lang,
    consultant: {
      name: getConsultantForSlug(slug),
      email: getConsultantEmailForSlug(slug),
    },
    leads: { total: leadsTotal, channels },
    organic,
    gsc: gscBlock,
    ai: aiBlock,
    gbp: gbpBlock,
    // Fresh pull ⇒ not finalised. The consultant fills the manual data then
    // clicks "Finalizar" (which is what announces to #client-wins), so a
    // re-generation always requires re-finalising = a fresh announcement.
    finalizedAt: null,
    notes: "",
    fetch: { ga4: ga4Fetch, gsc: gscFetch, gbp: gbpFetch },
    pdfBlobUrl: null,
  };

  return { ...base, execSummary: buildExecSummary(base, lang) };
}

/** Recompute the derived parts of a snapshot after a manual edit: mirror the
 *  GBP lead channels into the GBP section, re-sum the consolidated lead total,
 *  regenerate the Executive Summary, and set the status (ready once no lead
 *  channel is left unresolved; a "sent" report stays sent). */
export function recomputeDerived(
  snap: MonthlyReportSnapshot,
): MonthlyReportSnapshot {
  const byKey = Object.fromEntries(
    snap.leads.channels.map((c) => [c.key, c.metric] as const),
  );
  const gbp = {
    websiteClicks: byKey.gbpWebsite ?? snap.gbp.websiteClicks,
    directions: byKey.gbpDirections ?? snap.gbp.directions,
    callClicks: byKey.gbpCall ?? snap.gbp.callClicks,
  };
  const total = sumConsolidated(snap.leads.channels);
  const withLeads: MonthlyReportSnapshot = {
    ...snap,
    gbp,
    leads: { ...snap.leads, total },
  };
  const execSummary = buildExecSummary(withLeads, snap.lang);
  const hasUnresolved = snap.leads.channels.some((c) => isUnresolved(c.metric));
  const status: ReportStatus =
    snap.status === "sent" ? "sent" : hasUnresolved ? "draft" : "ready";
  return { ...withLeads, execSummary, status };
}
