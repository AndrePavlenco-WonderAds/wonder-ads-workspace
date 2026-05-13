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

  // 2. Core — most clients
  ihn: "core",
  "c-saccor": "core",
  "senior-resort": "core",
  "clinica-mimus": "core",
  "monte-mar": "core",
  "sea-yourself": "core",
  "hds-learning": "core",
  "fisio-restelo": "core",

  // 3. Growth — premium tier
  "a-domingos": "growth",
  "b-life": "growth",
  "white-clinic": "growth",
  "aeger-prima": "core",
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
