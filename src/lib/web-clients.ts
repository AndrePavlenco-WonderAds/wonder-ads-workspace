// Web DPT client roster — sites, landing pages, and standalone web
// build-outs the agency runs. Mirrors the ADS_CLIENTS pattern: slug
// is shared with SEO when the client overlaps so briefs/palettes/
// tiers stay in sync via the existing per-slug lookups.

export type WebClient = {
  slug: string;
  title: string;
  icon: string;
  /** Free-text consultant override for the Web side. Defaults to
   *  Unassigned in `client-overrides.ts` when not provided here. */
  consultant?: string;
  /** True when this client also exists in the SEO DPT — drives a
   *  cross-department badge in the SuperAdmin Suite. */
  sharedWithSeo?: boolean;
};

export const WEB_CLIENTS: WebClient[] = [
  // v74.71: "Prof. Fernando Almeida" removed from Web — consolidated into
  // the single SEO client (slug clinica-fernando-almeida) which now carries
  // that display name.
];

export function getWebClient(slug: string): WebClient | null {
  return WEB_CLIENTS.find((c) => c.slug === slug) ?? null;
}
