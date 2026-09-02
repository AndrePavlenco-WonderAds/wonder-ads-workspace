// Calendar-month windows for the Monthly SEO & Lead-Gen Report.
//
// Unlike the GA4/GSC panels (rolling N-day windows), the report always covers
// a *complete calendar month* — the previous full month — and compares it to
// the prior month (MoM) and the same month last year (YoY). GSC data lags
// ~2-3 days, so `isGscDataReady` guards generation until the month's last day
// is actually available.

export type DateRange = { startDate: string; endDate: string }; // "YYYY-MM-DD"

export type ReportPeriod = {
  /** "2026-06" — the canonical period key used for the store + filename. */
  key: string;
  /** "Junho de 2026" — PT label for the cover. */
  label: string;
  /** First day of the month, "YYYY-MM-01". */
  monthStart: string;
  /** Last day of the month, "YYYY-MM-DD". */
  monthEnd: string;
};

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

type YM = { year: number; month: number }; // month is 1-12

/** Days in a 1-12 month (handles leap years). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function ymFromKey(key: string): YM {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

const keyOf = (ym: YM) => `${ym.year}-${pad2(ym.month)}`;
const labelOf = (ym: YM) => `${PT_MONTHS[ym.month - 1]} de ${ym.year}`;

/** Shift a year-month by `delta` months (can be negative), rolling years. */
function shiftMonth(ym: YM, delta: number): YM {
  const idx = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function rangeOf(ym: YM): DateRange {
  return {
    startDate: `${ym.year}-${pad2(ym.month)}-01`,
    endDate: `${ym.year}-${pad2(ym.month)}-${pad2(daysInMonth(ym.year, ym.month))}`,
  };
}

/** Whether a "YYYY-MM" key is well-formed and a real month. */
export function isValidPeriodKey(key: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(key)) return false;
  const { month } = ymFromKey(key);
  return month >= 1 && month <= 12;
}

/** Build a ReportPeriod from a "YYYY-MM" key. */
export function periodFromKey(key: string): ReportPeriod {
  const ym = ymFromKey(key);
  const r = rangeOf(ym);
  return { key: keyOf(ym), label: labelOf(ym), monthStart: r.startDate, monthEnd: r.endDate };
}

/** The last fully-complete calendar month relative to `now`. On 21/07/2026
 *  this returns June 2026. This is the default period the report generates. */
export function previousCompleteMonth(now: Date = new Date()): ReportPeriod {
  const prev = shiftMonth({ year: now.getFullYear(), month: now.getMonth() + 1 }, -1);
  return periodFromKey(keyOf(prev));
}

/** The month currently in progress. On 29/07/2026 this returns July 2026 —
 *  the "quero o relatório de julho hoje" case. Reporting it produces a
 *  month-to-date window, never a fake full month. */
export function currentMonth(now: Date = new Date()): ReportPeriod {
  return periodFromKey(keyOf({ year: now.getFullYear(), month: now.getMonth() + 1 }));
}

/** Last day we can trust data for. GSC lags ~2 days; GA4 is usually good
 *  through yesterday. We take the *later-lagging* source so every section of
 *  a partial report describes the SAME window — a report whose leads cover
 *  1–28 but whose clicks cover 1–26 invites exactly the wrong comparison.
 *
 *  Lag de 2 dias (v77.2, pedido do Andre): o mês em curso fica gerável a
 *  partir do DIA 3, a qualquer hora — no dia 3 o cutoff é o dia 1. */
export function dataCutoff(now: Date = new Date(), lagDays = 2): string {
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      lagDays * 86_400_000,
  );
  return d.toISOString().slice(0, 10);
}

const dayOf = (iso: string) => Number(iso.slice(8, 10));

/** Clamp a month to its first `days` days (or its full length, if shorter).
 *  February compared against a 30-day January stops at the 28th/29th. */
function firstDaysOf(ym: YM, days: number): DateRange {
  const len = daysInMonth(ym.year, ym.month);
  const end = Math.min(days, len);
  return {
    startDate: `${ym.year}-${pad2(ym.month)}-01`,
    endDate: `${ym.year}-${pad2(ym.month)}-${pad2(end)}`,
  };
}

export type ReportCoverage = {
  /** true when the month isn't over (or its data isn't in yet). */
  partial: boolean;
  /** Days actually covered, e.g. 26 for "1–26 July". */
  days: number;
  /** Days in the full calendar month. */
  monthDays: number;
  /** Last day included, "YYYY-MM-DD". */
  through: string;
};

/** The three windows a report needs: the month itself, the prior month (MoM),
 *  and the same month a year earlier (YoY).
 *
 *  For a COMPLETE month this is three full calendar months, exactly as before.
 *  For a month still in progress the current window is clamped to the data
 *  cutoff — and, critically, **the comparison windows are clamped to the same
 *  number of days**. Comparing 26 days of July against all 30 days of June
 *  would show a fake collapse in every metric.
 *
 *  The clamped comparison is still stored on every metric (`previous`), but
 *  since v76.90 a partial report does NOT display it — no delta chips, no
 *  percentages in the Executive Summary. Numbers only, until the month
 *  closes and the report is regenerated. */
export function reportWindows(
  periodKey: string,
  opts: { now?: Date; lagDays?: number } = {},
): {
  current: DateRange;
  prevMonth: DateRange;
  yoy: DateRange;
  coverage: ReportCoverage;
} {
  const ym = ymFromKey(periodKey);
  const full = rangeOf(ym);
  const monthDays = daysInMonth(ym.year, ym.month);
  const cutoff = dataCutoff(opts.now ?? new Date(), opts.lagDays ?? 2);

  // Complete month: nothing to clamp — identical to the pre-v76.17 behaviour.
  if (cutoff >= full.endDate) {
    return {
      current: full,
      prevMonth: rangeOf(shiftMonth(ym, -1)),
      yoy: rangeOf(shiftMonth(ym, -12)),
      coverage: {
        partial: false,
        days: monthDays,
        monthDays,
        through: full.endDate,
      },
    };
  }

  // Month in progress (or data not in yet). If the cutoff predates the month
  // entirely there is nothing to report — collapse to day 1 so callers still
  // get a valid range and the empty result speaks for itself.
  const days = cutoff < full.startDate ? 1 : dayOf(cutoff);
  const current = firstDaysOf(ym, days);
  return {
    current,
    prevMonth: firstDaysOf(shiftMonth(ym, -1), days),
    yoy: firstDaysOf(shiftMonth(ym, -12), days),
    coverage: {
      partial: true,
      days: Math.min(days, monthDays),
      monthDays,
      through: current.endDate,
    },
  };
}

/** Label suffix for a partial period, e.g. "Julho de 2026 (parcial · 1–26)". */
export function labelWithCoverage(
  label: string,
  coverage: ReportCoverage,
): string {
  return coverage.partial
    ? `${label} (parcial · 1–${coverage.days})`
    : label;
}

/** Can this period be reported at all? A future month has no data, and the
 *  current month only becomes reportable once the cutoff reaches day 1. */
export function isPeriodReportable(
  periodKey: string,
  now: Date = new Date(),
  lagDays = 2,
): boolean {
  if (!isValidPeriodKey(periodKey)) return false;
  const ym = ymFromKey(periodKey);
  const start = `${ym.year}-${pad2(ym.month)}-01`;
  return dataCutoff(now, lagDays) >= start;
}

/** The N most-recent complete months up to (and including) `periodKey`,
 *  oldest-first — used for the 6-month mini-trend on each metric. */
export function trailingMonths(periodKey: string, count: number): ReportPeriod[] {
  const ym = ymFromKey(periodKey);
  const out: ReportPeriod[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(periodFromKey(keyOf(shiftMonth(ym, -i))));
  }
  return out;
}

/** Full calendar range of a "YYYY-MM" key — or, when `days` is given, its
 *  first `days` days. Used by the e-commerce conversion table: a partial-month
 *  report clamps EVERY compared column to the same day count, for the same
 *  reason reportWindows clamps MoM/YoY. */
export function monthRange(periodKey: string, days?: number): DateRange {
  const ym = ymFromKey(periodKey);
  return typeof days === "number" ? firstDaysOf(ym, days) : rangeOf(ym);
}

/** O mesmo mês do ano anterior — "2026-09" → "2025-09". A coluna homóloga da
 *  tabela e-commerce, onde vivem os picos sazonais (Black Friday & afins). */
export function sameMonthLastYear(periodKey: string): ReportPeriod {
  return periodFromKey(keyOf(shiftMonth(ymFromKey(periodKey), -12)));
}

/** GSC data lags ~2-3 days. Only generate once the month's last day (plus the
 *  lag) has passed, so we never report a partial last day as complete. */
export function isGscDataReady(
  periodKey: string,
  now: Date = new Date(),
  lagDays = 3,
): boolean {
  const ym = ymFromKey(periodKey);
  const lastDay = new Date(ym.year, ym.month - 1, daysInMonth(ym.year, ym.month));
  const readyAt = lastDay.getTime() + lagDays * 86_400_000;
  return now.getTime() >= readyAt;
}
