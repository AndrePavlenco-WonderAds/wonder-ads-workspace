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
  /** ADS-side consultant override. Shared clients keep their SEO consultant
   *  separately — only ADS DPT uses this field. */
  consultant?: string;
};

export const ADS_CLIENTS: AdsClient[] = [
  // Shared with SEO DPT — same slug, same brief, same palette.
  // ADS-side consultant differs from SEO-side.
  { slug: "ihn", title: "IHN", icon: "🟢", consultant: "Germano C." },
  {
    slug: "insync-design",
    title: "InSync Design",
    icon: "💎",
    consultant: "Germano C.",
  },
  // ADS-only client
  {
    slug: "clinica-empatia",
    title: "Clínica Empatia",
    icon: "💗",
    consultant: "Germano C.",
  },
];

export function getAdsClient(slug: string): AdsClient | null {
  return ADS_CLIENTS.find((c) => c.slug === slug) ?? null;
}
