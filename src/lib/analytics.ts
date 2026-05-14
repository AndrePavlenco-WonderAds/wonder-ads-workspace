// Shared types for the GA4 Metrics panel. Kept separate from ga4.ts so client
// components can import the types without pulling server-only code into the
// browser bundle.

export type Ga4MetricKey = "users" | "sessions" | "engagement" | "conversions";

export type Ga4Metric = {
  key: Ga4MetricKey;
  label: string;
  /** Current 30-day value. */
  value: number;
  /** Value for the preceding 30-day window — used for the trend arrow. */
  previous: number;
  /** "number" → integer count; "percent" → 0–1 ratio shown as a %. */
  format: "number" | "percent";
};

export type Ga4Data =
  | {
      status: "ok";
      propertyId: string;
      metrics: Ga4Metric[];
      /** Daily sessions for the last 30 days — drives the sparkline. */
      trend: number[];
    }
  /** No Google service account configured on this deployment. */
  | { status: "not-configured" }
  /** No GA4 property found for this client's domain. */
  | { status: "no-property" }
  /** The Analytics API rejected the request — usually missing access or
   *  the Analytics APIs not enabled / scoped yet. */
  | { status: "error"; message: string };
