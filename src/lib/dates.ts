// Single source of truth for date formatting across the workspace.
// Convention: DD/MM/YYYY everywhere (per user preference). For dates with
// times, DD/MM/YYYY HH:mm. Locale forced to en-GB so the slash separator
// is consistent regardless of the user's browser locale.

const LOCALE = "en-GB";

/** "17/05/2026" */
export function formatDate(d: Date | number | string | null | undefined): string {
  if (d === null || d === undefined) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "17/05/2026 14:30" */
export function formatDateTime(d: Date | number | string | null | undefined): string {
  if (d === null || d === undefined) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "17 May 2026" — for places where a friendlier read is wanted (PDF cover etc). */
export function formatDateLong(d: Date | number | string | null | undefined): string {
  if (d === null || d === undefined) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Local-timezone ISO date (yyyy-mm-dd) for a given Date — defaults to
 *  today. Uses local parts (not toISOString, which is UTC) so "today"
 *  matches the user's wall clock in Lisbon. */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole days from today until the given ISO date (yyyy-mm-dd).
 *  Negative when the date is in the past, 0 for today. Compares at
 *  date granularity (midnight local) so partial days don't skew it. */
export function daysUntilISO(iso: string, now: Date = new Date()): number {
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return Number.NaN;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}
