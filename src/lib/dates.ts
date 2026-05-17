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
