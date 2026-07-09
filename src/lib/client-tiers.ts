// Service-tier mapping for each SEO client.
// Lower → Higher visual impact: lite (subtle) · core (medium) · growth (full).

export type ClientTier = "lite" | "core" | "growth";

const TIERS: Record<string, ClientTier> = {
  // 1. Lite — entry-tier
  "insync-design": "lite",
  wonderads: "lite",
  cdt: "lite",
  "safe-away": "lite",
  "clinica-em-casa": "lite",

  // 2. Core
  ihn: "core",
  "aeger-prima": "core",  "clinica-mimus": "core",
  "monte-mar": "core",
  "sea-yourself": "core",
  "hds-learning": "core",
  "fisio-restelo": "core",

  // 3. Growth — premium tier
  "a-domingos": "growth",
  "b-life": "growth",
  "white-clinic": "growth",
  "sentir-saude": "growth",
  "clinica-fernando-almeida": "core",

  // ADS-only clients
  "clinica-empatia": "core",
};

/** Sort rank used to order cards inside a consultant column (top→bottom). */
export const TIER_RANK: Record<ClientTier, number> = {
  growth: 0,
  core: 1,
  lite: 2,
};

export function getClientTier(slug: string): ClientTier {
  return TIERS[slug] ?? "core";
}

export const TIER_LABEL: Record<ClientTier, string> = {
  lite: "Lite",
  core: "Core",
  growth: "Growth",
};

export const TIER_ORDER: ClientTier[] = ["lite", "core", "growth"];
