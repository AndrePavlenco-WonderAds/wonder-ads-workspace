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

/** The three windows a report needs: the month itself, the prior month (MoM),
 *  and the same month a year earlier (YoY). */
export function reportWindows(periodKey: string): {
  current: DateRange;
  prevMonth: DateRange;
  yoy: DateRange;
} {
  const ym = ymFromKey(periodKey);
  return {
    current: rangeOf(ym),
    prevMonth: rangeOf(shiftMonth(ym, -1)),
    yoy: rangeOf(shiftMonth(ym, -12)),
  };
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
