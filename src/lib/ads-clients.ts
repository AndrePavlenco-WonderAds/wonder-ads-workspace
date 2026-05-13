// ADS DPT client roster.
//
// Slug matches the SEO DPT slug where the client overlaps so that briefs,
// palettes, tiers, and consultants automatically stay in sync via the
// existing per-slug lookups (client-briefs / client-colors / client-tiers /
// client-overrides).

export type AdsClient = {
  slug: string;
  title: string;
  icon: string;
};

export const ADS_CLIENTS: AdsClient[] = [
  // Shared with SEO DPT — same slug, same brief, same palette
  { slug: "ihn", title: "IHN", icon: "🟢" },
  { slug: "insync-design", title: "InSync Design", icon: "💎" },
  // ADS-only client
  { slug: "clinica-empatia", title: "Clínica Empatia", icon: "💗" },
];

export function getAdsClient(slug: string): AdsClient | null {
  return ADS_CLIENTS.find((c) => c.slug === slug) ?? null;
}
