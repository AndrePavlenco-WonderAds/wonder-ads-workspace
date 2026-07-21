// Presentation helpers for the Monthly Report — locale-aware number/percent
// formatting (PT clients get pt-PT digits, EN clients en-GB) and the MoM delta
// with its direction + good/bad sense (position is inverted: lower is better).

import { momPercent, type ReportMetric } from "./report-types";

type Lang = "pt" | "en";

const numLocale = (lang: Lang) => (lang === "pt" ? "pt-PT" : "en-GB");

/** Format a metric's current value for display, honouring its unit. Returns a
 *  placeholder ("—") when the value is missing / pending. */
export function formatValue(m: ReportMetric, lang: Lang): string {
  if (m.value === null) return "—";
  return formatRaw(m.value, m.unit, lang);
}

export function formatRaw(
  value: number,
  unit: ReportMetric["unit"],
  lang: Lang,
): string {
  const loc = numLocale(lang);
  switch (unit) {
    case "percent":
      return `${value.toLocaleString(loc, { maximumFractionDigits: 1 })}%`;
    case "ratio":
      return `${(value * 100).toLocaleString(loc, { maximumFractionDigits: 1 })}%`;
    case "position":
      return value.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case "seconds": {
      const s = Math.round(value);
      return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
    }
    default:
      return Math.round(value).toLocaleString(loc);
  }
}

export type MetricDelta = {
  /** e.g. "+18,3%" or "▲ 2,4" for position. */
  text: string;
  dir: "up" | "down" | "flat";
  /** true when the movement is good for the client. */
  good: boolean;
};

/** MoM delta for a metric, or null when it can't be computed. */
export function metricDelta(m: ReportMetric, lang: Lang): MetricDelta | null {
  if (m.value === null || m.previous === null) return null;
  const loc = numLocale(lang);

  // Position: show the raw improvement in ranks (prev - cur); lower is better.
  if (m.unit === "position") {
    const diff = m.previous - m.value; // positive = moved up the SERP
    if (Math.abs(diff) < 0.05) return { text: "0", dir: "flat", good: true };
    return {
      text: `${Math.abs(diff).toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
      dir: diff > 0 ? "up" : "down",
      good: diff > 0,
    };
  }

  const mom = momPercent(m);
  if (mom === null || !Number.isFinite(mom)) return null;
  if (Math.abs(mom) < 0.05) return { text: "0%", dir: "flat", good: true };
  return {
    text: `${mom > 0 ? "+" : ""}${mom.toLocaleString(loc, { maximumFractionDigits: 1 })}%`,
    dir: mom > 0 ? "up" : "down",
    good: mom > 0,
  };
}

/** The short "não instrumentado" / "pendente" / "N/A" note for a pending
 *  metric, by source. Returns null when the metric has a real value. */
export function pendingNote(m: ReportMetric, lang: Lang): string | null {
  if (m.value !== null) return null;
  const pt = lang === "pt";
  if (m.source === "na" && !m.instrumented) return pt ? "não instrumentado" : "not instrumented";
  if (m.source === "manual") return pt ? "a preencher" : "awaiting input";
  return pt ? "sem dados" : "no data";
}
