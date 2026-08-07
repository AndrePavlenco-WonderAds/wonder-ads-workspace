// GA4 data layer for the Monthly Report. Pulls calendar-month numbers the
// panel's rolling-window `getGa4Data` doesn't cover:
//   • Leads — counts of the client's named lead events (form/call/email/whatsapp)
//     for the month and the prior month, plus a 365-day probe that tells us
//     whether each event is instrumented at all (so a real 0 is never shown
//     as if it were a tracked metric).
//   • Organic — sessions/users/new users/engaged sessions/engagement rate/avg
//     engagement time, filtered to the Organic Search channel, month vs. prior
//     month, plus the Google-organic-specific user count.
//   • AI Visibility — sessions grouped by sessionSource, filtered to the
//     configured LLM-referral regex list.
//
// Reuses the service-account token + property resolution + runReport helper
// from ga4.ts. Never fabricates: a missing property returns a status, not zeros.

import { resolveGa4Property, runReport } from "@/lib/ga4";
import { googleAuthConfigured } from "@/lib/google-auth";
import type { DateRange } from "./report-dates";
import type { LeadEventMap } from "./report-config-store";
import type { CustomLeadEvent } from "./report-types";

/** A month value with its prior-month counterpart (null when unavailable). */
export type MetricPair = { value: number; previous: number | null };

export type Ga4LeadBlock = {
  form: MetricPair;
  call: MetricPair;
  email: MetricPair;
  whatsapp: MetricPair;
  /** Whether each mapped event exists in the property at all (365-day probe).
   *  false → surface "não instrumentado", never a real 0. */
  instrumented: Record<keyof LeadEventMap, boolean>;
  /** The client's extra lead lines (2nd unit's phone, per-page form…), in the
   *  configured order and keyed by the line's stable id. */
  extra: { id: string; pair: MetricPair; instrumented: boolean }[];
};

export type Ga4OrganicBlock = {
  sessions: MetricPair;
  users: MetricPair;
  newUsers: MetricPair;
  engagedSessions: MetricPair;
  /** 0..1 ratio. */
  engagementRate: MetricPair;
  /** Seconds of average engagement time per user. */
  avgEngagementTimePerUser: MetricPair;
  /** Users from session_source=google + session_medium=organic specifically. */
  googleOrganicUsers: MetricPair;
};

export type Ga4AiSource = {
  source: string;
  sessions: number;
  users: number;
  engagedSessions: number;
};

export type Ga4AiBlock = { sources: Ga4AiSource[]; totalSessions: number };

/** Série mensal para o gráfico de evolução. Uma entrada por mês pedido, na
 *  mesma ordem (mais antigo primeiro); `null` = mês sem dados na propriedade
 *  (a conta ainda não existia), que é diferente de zero e tem de o continuar
 *  a ser no gráfico. */
export type Ga4TrendBlock = {
  organicUsers: (number | null)[];
  organicSessions: (number | null)[];
  leads: (number | null)[];
};

export type Ga4MonthlyReport =
  | {
      status: "ok";
      propertyId: string;
      organic: Ga4OrganicBlock;
      leads: Ga4LeadBlock;
      ai: Ga4AiBlock;
      /** Só presente quando `opts.trend` foi pedido e a query correu. */
      trend?: Ga4TrendBlock;
    }
  | { status: "not-configured" }
  | { status: "no-property" }
  | { status: "error"; message: string };

type Row = {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
};

const RANGE_CUR = "date_range_0";
const RANGE_PREV = "date_range_1";

/** Which date range a row belongs to (0 = current, 1 = previous). Single-range
 *  reports have no dateRange dimension → treated as current. */
function isPrevRow(row: Row): boolean {
  return (row.dimensionValues ?? []).some((d) => d.value === RANGE_PREV);
}

/** The non-dateRange dimension values of a row (e.g. the eventName / source). */
function realDims(row: Row): string[] {
  return (row.dimensionValues ?? [])
    .map((d) => d.value ?? "")
    .filter((v) => v !== RANGE_CUR && v !== RANGE_PREV);
}

const num = (row: Row | undefined, i = 0): number =>
  Number(row?.metricValues?.[i]?.value ?? 0);

/** Split a two-range report into its current + previous rows. */
function splitRanges(rows: Row[]): { cur?: Row; prev?: Row } {
  let cur: Row | undefined;
  let prev: Row | undefined;
  for (const r of rows) (isPrevRow(r) ? (prev = r) : (cur = r));
  return { cur, prev };
}

const pair = (cur: Row | undefined, prev: Row | undefined, i: number): MetricPair => ({
  value: num(cur, i),
  previous: prev ? num(prev, i) : null,
});

const channelFilter = (channel: string) => ({
  filter: {
    fieldName: "sessionDefaultChannelGroup",
    stringFilter: { value: channel, matchType: "EXACT" },
  },
});

/** "2026-08" → "2026-08-31". */
function monthEndOf(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${key}-${String(last).padStart(2, "0")}`;
}

/** A dimensão `yearMonth` do GA4 vem como "202608" — passa a "2026-08". */
function monthKeyFromGa4(raw: string): string | null {
  return /^\d{6}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4)}` : null;
}

const dateRanges = (current: DateRange, previous: DateRange) => [
  { startDate: current.startDate, endDate: current.endDate },
  { startDate: previous.startDate, endDate: previous.endDate },
];

/** Pull the full GA4 slice of a monthly report for one client. */
export async function getGa4MonthlyReport(
  slug: string,
  opts: {
    current: DateRange;
    previous: DateRange;
    eventMap: LeadEventMap;
    /** Extra per-client lead lines, counted alongside the four defaults. */
    extraEvents?: CustomLeadEvent[];
    llmRegex: string[];
    propertyIdOverride?: string | null;
    /** Meses a puxar para o gráfico de evolução, mais antigo primeiro
     *  ("2025-09" … "2026-08"). Ausente = não se puxa série nenhuma. */
    trendMonths?: string[];
  },
): Promise<Ga4MonthlyReport> {
  if (!googleAuthConfigured) return { status: "not-configured" };

  const resolved = await resolveGa4Property(slug, opts.propertyIdOverride);
  if (!resolved) return { status: "no-property" };
  const { token, propertyId } = resolved;

  const { current, previous, eventMap, llmRegex } = opts;
  const extraEvents = opts.extraEvents ?? [];
  // Unique event names to query (two lead types could share a name).
  // Flattened alias list — one GA4 filter covering every name across types,
  // the four defaults plus the client's extra lines.
  const eventNames = Array.from(
    new Set([
      ...Object.values(eventMap).flat(),
      ...extraEvents.flatMap((e) => e.events),
    ]),
  );

  // Janela do gráfico: do primeiro dia do mês mais antigo ao último dia do
  // mais recente. Uma só query com a dimensão `yearMonth` cobre os doze meses
  // — puxar mês a mês seriam doze chamadas para desenhar uma linha.
  const trendMonths = (opts.trendMonths ?? []).filter((m) =>
    /^\d{4}-\d{2}$/.test(m),
  );
  const trendRange = trendMonths.length
    ? {
        startDate: `${trendMonths[0]}-01`,
        endDate: monthEndOf(trendMonths[trendMonths.length - 1]),
      }
    : null;

  try {
    const [organicRows, googleOrgRows, leadRows, probeRows, aiRows, trendOrganicRows, trendLeadRows] =
      await Promise.all([
        // Organic Search channel — month vs. prior month.
        runReport(token, propertyId, {
          dateRanges: dateRanges(current, previous),
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "newUsers" },
            { name: "engagedSessions" },
            { name: "engagementRate" },
            { name: "userEngagementDuration" },
          ],
          dimensionFilter: channelFilter("Organic Search"),
        }),
        // Google-organic users specifically (source=google + medium=organic).
        runReport(token, propertyId, {
          dateRanges: dateRanges(current, previous),
          metrics: [{ name: "totalUsers" }],
          dimensionFilter: {
            andGroup: {
              expressions: [
                {
                  filter: {
                    fieldName: "sessionSource",
                    stringFilter: { value: "google", matchType: "EXACT" },
                  },
                },
                {
                  filter: {
                    fieldName: "sessionMedium",
                    stringFilter: { value: "organic", matchType: "EXACT" },
                  },
                },
              ],
            },
          },
        }),
        // Lead events by name — month vs. prior month.
        runReport(token, propertyId, {
          dateRanges: dateRanges(current, previous),
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: {
            filter: {
              fieldName: "eventName",
              inListFilter: { values: eventNames },
            },
          },
        }),
        // 365-day instrumentation probe: does each event exist at all?
        runReport(token, propertyId, {
          dateRanges: [{ startDate: "365daysAgo", endDate: "yesterday" }],
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: {
            filter: {
              fieldName: "eventName",
              inListFilter: { values: eventNames },
            },
          },
        }),
        // AI Visibility — sessions by source (current month only).
        runReport(token, propertyId, {
          dateRanges: [{ startDate: current.startDate, endDate: current.endDate }],
          dimensions: [{ name: "sessionSource" }],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "engagedSessions" },
          ],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 250,
        }),
        // Evolução mensal — orgânico. Best-effort: se falhar, o relatório
        // sai na mesma, apenas sem o gráfico.
        trendRange
          ? runReport(token, propertyId, {
              dateRanges: [trendRange],
              dimensions: [{ name: "yearMonth" }],
              metrics: [{ name: "totalUsers" }, { name: "sessions" }],
              dimensionFilter: channelFilter("Organic Search"),
              limit: 60,
            }).catch(() => [] as Row[])
          : Promise.resolve([] as Row[]),
        // Evolução mensal — leads (todos os eventos configurados somados).
        trendRange && eventNames.length
          ? runReport(token, propertyId, {
              dateRanges: [trendRange],
              dimensions: [{ name: "yearMonth" }],
              metrics: [{ name: "eventCount" }],
              dimensionFilter: {
                filter: {
                  fieldName: "eventName",
                  inListFilter: { values: eventNames },
                },
              },
              limit: 60,
            }).catch(() => [] as Row[])
          : Promise.resolve([] as Row[]),
      ]);

    // --- Organic ---
    const { cur: oc, prev: op } = splitRanges(organicRows as Row[]);
    const { cur: gc, prev: gp } = splitRanges(googleOrgRows as Row[]);
    const avgTime = (r: Row | undefined): number => {
      const users = num(r, 1);
      return users > 0 ? num(r, 5) / users : 0;
    };
    const organic: Ga4OrganicBlock = {
      sessions: pair(oc, op, 0),
      users: pair(oc, op, 1),
      newUsers: pair(oc, op, 2),
      engagedSessions: pair(oc, op, 3),
      engagementRate: pair(oc, op, 4),
      avgEngagementTimePerUser: { value: avgTime(oc), previous: op ? avgTime(op) : null },
      googleOrganicUsers: pair(gc, gp, 0),
    };

    // --- Leads ---
    const counts: Record<string, { cur: number; prev: number }> = {};
    for (const r of leadRows as Row[]) {
      const name = realDims(r)[0] ?? "";
      if (!name) continue;
      (counts[name] ??= { cur: 0, prev: 0 });
      if (isPrevRow(r)) counts[name].prev += num(r, 0);
      else counts[name].cur += num(r, 0);
    }
    const seen = new Set<string>();
    for (const r of probeRows as Row[]) {
      const name = realDims(r)[0] ?? "";
      if (name && num(r, 0) > 0) seen.add(name);
    }
    // Sum every alias configured for a lead type. A client that renamed the
    // event mid-year keeps a continuous series as long as both names are listed.
    const leadPair = (evts: string[]): MetricPair =>
      evts.reduce<MetricPair>(
        (acc, evt) => ({
          value: (acc.value ?? 0) + (counts[evt]?.cur ?? 0),
          previous: (acc.previous ?? 0) + (counts[evt]?.prev ?? 0),
        }),
        { value: 0, previous: 0 },
      );
    // Instrumented when ANY alias has fired in the last 365 days.
    const anySeen = (evts: string[]) => evts.some((e) => seen.has(e));
    const leads: Ga4LeadBlock = {
      form: leadPair(eventMap.form),
      call: leadPair(eventMap.call),
      email: leadPair(eventMap.email),
      whatsapp: leadPair(eventMap.whatsapp),
      instrumented: {
        form: anySeen(eventMap.form),
        call: anySeen(eventMap.call),
        email: anySeen(eventMap.email),
        whatsapp: anySeen(eventMap.whatsapp),
      },
      extra: extraEvents.map((e) => ({
        id: e.id,
        pair: leadPair(e.events),
        instrumented: anySeen(e.events),
      })),
    };

    // --- AI Visibility ---
    const matchers = llmRegex
      .map((s) => {
        try {
          return new RegExp(s, "i");
        } catch {
          return null;
        }
      })
      .filter((re): re is RegExp => re !== null);
    const aiSources: Ga4AiSource[] = [];
    for (const r of aiRows as Row[]) {
      const source = realDims(r)[0] ?? "";
      if (source && matchers.some((re) => re.test(source))) {
        aiSources.push({
          source,
          sessions: num(r, 0),
          users: num(r, 1),
          engagedSessions: num(r, 2),
        });
      }
    }
    const ai: Ga4AiBlock = {
      sources: aiSources,
      totalSessions: aiSources.reduce((t, s) => t + s.sessions, 0),
    };

    // --- Evolução mensal ---
    let trend: Ga4TrendBlock | undefined;
    if (trendRange) {
      // GA4 devolve `yearMonth` como "202608". Um mês sem linha nenhuma é um
      // mês sem dados — fica null, não zero: uma linha a cair a pique até ao
      // fundo por causa de uma conta que ainda não existia é mentira.
      const users = new Map<string, number>();
      const sessions = new Map<string, number>();
      for (const r of trendOrganicRows as Row[]) {
        const key = monthKeyFromGa4(realDims(r)[0] ?? "");
        if (!key) continue;
        users.set(key, (users.get(key) ?? 0) + num(r, 0));
        sessions.set(key, (sessions.get(key) ?? 0) + num(r, 1));
      }
      const leadsByMonth = new Map<string, number>();
      for (const r of trendLeadRows as Row[]) {
        const key = monthKeyFromGa4(realDims(r)[0] ?? "");
        if (!key) continue;
        leadsByMonth.set(key, (leadsByMonth.get(key) ?? 0) + num(r, 0));
      }
      // A partir do primeiro mês COM dados, a ausência de linha é um zero
      // verdadeiro (houve tráfego antes, não houve neste mês). Antes disso é
      // «ainda não havia medição» — e essa parte da linha não se desenha.
      const firstWithData = trendMonths.findIndex((m) => users.has(m));
      const series = (byMonth: Map<string, number>) =>
        trendMonths.map((m, i) => {
          if (firstWithData === -1 || i < firstWithData) return null;
          return byMonth.get(m) ?? 0;
        });
      trend = {
        organicUsers: series(users),
        organicSessions: series(sessions),
        leads: series(leadsByMonth),
      };
    }

    return { status: "ok", propertyId, organic, leads, ai, trend };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "GA4 report request failed",
    };
  }
}
