// Shared types for the GA4 Metrics panel. Kept separate from ga4.ts so client
// components can import the types without pulling server-only code into the
// browser bundle.

export type Ga4MetricFormat = "number" | "decimal" | "percent" | "duration";

export type Ga4Metric = {
  key: string;
  label: string;
  /** Current-period value. */
  value: number;
  /** Value for the preceding period of equal length — drives the trend arrow. */
  previous: number;
  format: Ga4MetricFormat;
  /** Whether an increase is good — controls the arrow colour. Bounce rate is
   *  the odd one out (an increase is bad). */
  higherIsBetter: boolean;
};

/** GA4 default channel groups we expose as a filter. "all" = no filter. */
export type Ga4Channel =
  | "all"
  | "Organic Search"
  | "Direct"
  | "Organic Social"
  | "Referral"
  | "Paid Search"
  | "Email";

export const GA4_CHANNELS: { value: Ga4Channel; label: string }[] = [
  { value: "all", label: "All channels" },
  { value: "Organic Search", label: "Organic Search" },
  { value: "Direct", label: "Direct" },
  { value: "Organic Social", label: "Organic Social" },
  { value: "Referral", label: "Referral" },
  { value: "Paid Search", label: "Paid Search" },
  { value: "Email", label: "Email" },
];

export type Ga4Data =
  | {
      status: "ok";
      propertyId: string;
      metrics: Ga4Metric[];
      /** Daily sessions across the window — drives the sparkline. */
      trend: number[];
      days: number;
      channel: Ga4Channel;
    }
  /** No Google service account configured on this deployment. */
  | { status: "not-configured" }
  /** No GA4 property found for this client's domain. */
  | { status: "no-property" }
  /** The Analytics API rejected the request — usually missing access or the
   *  Analytics APIs not enabled / scoped yet. */
  | { status: "error"; message: string };
