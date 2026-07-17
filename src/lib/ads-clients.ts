// ADS DPT client roster.
//
// Slug matches the SEO DPT slug where the client overlaps so that briefs,
// palettes, tiers, and consultants automatically stay in sync via the
// existing per-slug lookups (client-briefs / client-colors / client-tiers /
// client-overrides).

import type { ClientTier } from "./client-tiers";

export type AdChannel = "google" | "meta";

export type AdsClient = {
  slug: string;
  title: string;
  icon: string;
  /** ADS-side consultant override. Shared clients keep their SEO consultant
   *  separately — only ADS DPT uses this field. */
  consultant?: string;
  /** ADS-side tier override. Same client can have a different tier on the
   *  SEO side (which reads from client-tiers.ts). */
  tier?: ClientTier;
  /** Paid-media channels this client runs. */
  channels?: AdChannel[];
  /** True when this client also exists in the SEO DPT — drives the
   *  "SEO & ADS Client" badge and keeps briefs + files in sync. */
  sharedWithSeo?: boolean;
};

const ALL_CHANNELS: AdChannel[] = ["google", "meta"];

export const ADS_CLIENTS: AdsClient[] = [
  // Shared with SEO DPT — same slug, same brief, same palette.
  // ADS-side consultant + tier differ from SEO-side.
  {
    slug: "ihn",
    title: "IHN",
    icon: "🟢",
    consultant: "Germano C.",
    tier: "core",
    channels: ALL_CHANNELS,
    sharedWithSeo: true,
  },
  {
    slug: "insync-design",
    title: "InSync Design",
    icon: "💎",
    consultant: "Germano C.",
    tier: "core",
    channels: ALL_CHANNELS,
    sharedWithSeo: true,
  },
  {
    slug: "white-clinic",
    title: "White Clinic",
    icon: "🦷",
    consultant: "Germano C.",
    channels: ALL_CHANNELS,
    sharedWithSeo: true,
  },
  // ADS-only client
  {
    slug: "clinica-empatia",
    title: "Clínica Empatia",
    icon: "💗",
    consultant: "Germano C.",
    tier: "core",
    channels: ALL_CHANNELS,
  },
  // Wonder Ads' own paid media.
  {
    slug: "wonder-ads",
    title: "Wonder Ads",
    icon: "🦋",
    consultant: "Germano C.",
    tier: "core",
    channels: ALL_CHANNELS,
  },
];

export function getAdsClient(slug: string): AdsClient | null {
  return ADS_CLIENTS.find((c) => c.slug === slug) ?? null;
}

/** True when a client is present in both the SEO and ADS departments. */
export function isSharedWithSeo(slug: string): boolean {
  return getAdsClient(slug)?.sharedWithSeo === true;
}
