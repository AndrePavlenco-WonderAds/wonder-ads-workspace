// Contas do Reviews Hub — puras, correm no servidor (resumo do chip) e no
// browser (dashboard filtrado por salão). Sem imports de servidor.

import type { HubDraft, HubLocation, HubReview, HubSummary, StarLevel } from "./types";

export type MonthPoint = {
  /** "2026-09" */
  key: string;
  count: number;
  average: number | null;
};

export type LocationStats = {
  id: string;
  short: string;
  /** Contagem e média oficiais da Google, quando a sync as trouxe. */
  total: number;
  average: number | null;
  unanswered: number;
  negativeUnanswered: number;
  responseRate: number | null;
  last30: number;
};

export type HubStats = {
  total: number;
  average: number | null;
  distribution: Record<StarLevel, number>;
  withText: number;
  unanswered: number;
  negativeUnanswered: number;
  responseRate: number | null;
  /** Mediana, em horas, entre a review e a resposta (últimos 12 meses). */
  medianReplyHours: number | null;
  last30: number;
  prev30: number;
  last30Average: number | null;
  months: MonthPoint[];
  locations: LocationStats[];
};

const DAY = 24 * 60 * 60 * 1000;

export function isNegative(r: HubReview): boolean {
  return r.stars > 0 && r.stars <= 3;
}

export function needsReply(r: HubReview): boolean {
  return !r.reply;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** As contas do dashboard. `locations` dá a contagem/média oficial da
 *  Google; sem ela, contam as reviews guardadas. */
export function computeStats(
  reviews: HubReview[],
  locations: HubLocation[],
  now = Date.now(),
): HubStats {
  const distribution: Record<StarLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let withText = 0;
  let unanswered = 0;
  let negativeUnanswered = 0;
  let replied = 0;
  let last30 = 0;
  let prev30 = 0;
  const last30Stars: number[] = [];
  const replyHours: number[] = [];
  const byMonth = new Map<string, number[]>();

  for (const r of reviews) {
    const created = Date.parse(r.created);
    if (r.stars) distribution[r.stars] += 1;
    if (r.text) withText += 1;
    if (r.reply) {
      replied += 1;
      const repliedAt = Date.parse(r.reply.updated);
      if (now - created < 365 * DAY && repliedAt >= created) {
        replyHours.push((repliedAt - created) / 3_600_000);
      }
    } else {
      unanswered += 1;
      if (isNegative(r)) negativeUnanswered += 1;
    }
    const age = now - created;
    if (age < 30 * DAY) {
      last30 += 1;
      if (r.stars) last30Stars.push(r.stars);
    } else if (age < 60 * DAY) {
      prev30 += 1;
    }
    const k = monthKey(r.created);
    const list = byMonth.get(k) ?? [];
    list.push(r.stars);
    byMonth.set(k, list);
  }

  // Últimos 12 meses, com zeros nos meses sem reviews (o gráfico não salta).
  const months: MonthPoint[] = [];
  const d = new Date(now);
  d.setUTCDate(1);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    const key = m.toISOString().slice(0, 7);
    const stars = (byMonth.get(key) ?? []).filter((s) => s > 0);
    months.push({ key, count: (byMonth.get(key) ?? []).length, average: avg(stars) });
  }

  const byLoc = new Map<string, HubReview[]>();
  for (const r of reviews) {
    const list = byLoc.get(r.loc) ?? [];
    list.push(r);
    byLoc.set(r.loc, list);
  }
  const locStats: LocationStats[] = locations.map((l) => {
    const rs = byLoc.get(l.id) ?? [];
    const rated = rs.filter((r) => r.stars > 0).map((r) => r.stars as number);
    const answered = rs.filter((r) => r.reply).length;
    return {
      id: l.id,
      short: l.short,
      total: l.total ?? rs.length,
      average: l.average ?? avg(rated),
      unanswered: rs.filter(needsReply).length,
      negativeUnanswered: rs.filter((r) => needsReply(r) && isNegative(r)).length,
      responseRate: rs.length ? answered / rs.length : null,
      last30: rs.filter((r) => now - Date.parse(r.created) < 30 * DAY).length,
    };
  });

  // A média global pesa cada salão pela contagem oficial quando a temos —
  // é o número que o cliente vê no Google, não o das reviews guardadas.
  const official = locStats.filter((l) => l.average !== null && l.total > 0);
  const officialTotal = official.reduce((a, l) => a + l.total, 0);
  const rated = reviews.filter((r) => r.stars > 0).map((r) => r.stars as number);
  const average =
    locations.length > 0 && officialTotal > 0
      ? official.reduce((a, l) => a + (l.average ?? 0) * l.total, 0) / officialTotal
      : avg(rated);
  const total =
    locations.length > 0 && officialTotal > 0
      ? locStats.reduce((a, l) => a + l.total, 0)
      : reviews.length;

  return {
    total,
    average,
    distribution,
    withText,
    unanswered,
    negativeUnanswered,
    responseRate: reviews.length ? replied / reviews.length : null,
    medianReplyHours: median(replyHours),
    last30,
    prev30,
    last30Average: avg(last30Stars),
    months,
    locations: locStats,
  };
}

export function computeSummary(
  reviews: HubReview[],
  locations: HubLocation[],
  drafts: Record<string, HubDraft>,
  syncedAt: number | null,
): HubSummary {
  const s = computeStats(reviews, locations);
  return {
    average: s.average,
    total: s.total,
    unanswered: s.unanswered,
    negativeUnanswered: s.negativeUnanswered,
    awaitingApproval: Object.values(drafts).filter(
      (d) => d.status === "awaiting_approval",
    ).length,
    syncedAt,
  };
}
