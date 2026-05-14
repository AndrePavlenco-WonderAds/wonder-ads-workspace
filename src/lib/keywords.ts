// Shared types for the Tracked Keywords panel. Kept separate from gsc.ts so
// client components can import the types without pulling the server-only
// Google auth code into the browser bundle.

export type KeywordRow = {
  /** The search query as it appears in Google Search Console. */
  query: string;
  /** Average ranking position over the window (lower = better). */
  position: number;
  clicks: number;
  impressions: number;
  /** Position improvement vs the previous window (positive = moved up).
   *  null when the query had no impressions in the previous window. */
  change: number | null;
};

export type KeywordData =
  | {
      status: "ok";
      siteUrl: string;
      rows: KeywordRow[];
      start: string;
      end: string;
    }
  /** No Google service account configured on this deployment. */
  | { status: "not-configured" }
  /** No Search Console property is mapped for this client. */
  | { status: "no-property" }
  /** The Search Console API rejected the request — usually means the
   *  service account hasn't been granted access to the property yet. */
  | { status: "error"; message: string };
