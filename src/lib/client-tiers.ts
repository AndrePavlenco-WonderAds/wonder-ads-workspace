// Service-tier mapping for each SEO client.
// Lower → Higher visual impact: lite (subtle) · core (medium) · growth (full).

export type ClientTier = "lite" | "core" | "growth";

// v78.2: tabela de tiers atualizada pelo André (Cliente · Valor · Tag).
// Os clientes que não estavam na tabela (pausados) mantêm o tier anterior.
const TIERS: Record<string, ClientTier> = {
  // 1. Lite — entry-tier
  "aeger-prima": "lite",
  "clinica-mimus": "lite",
  ihn: "lite",
  cdt: "lite", // Corrida do Tempo
  "b-life": "lite",
  "kings-gyms": "lite",
  "clinica-medica-dentaria-colegio-militar": "lite",
  "insync-design": "lite",
  "safe-away": "lite",
  "clinica-em-casa": "lite",

  // 2. Core
  "maratona-clube-de-portugal": "core",
  "monte-mar": "core",
  "spine-center": "core",
  "white-clinic": "core",
  mymedic: "core",
  "sentir-saude": "core",
  "sea-yourself": "core",
  "hds-learning": "core",
  "fisio-restelo": "core",
  // v77.44: Real Hotels Group — «Core size», dito pelo André.
  "real-hotels-group": "core",

  // 3. Growth — premium tier
  brancoptica: "growth",
  "clinica-fernando-almeida": "growth", // Prof. Fernando Almeida
  "atn-medical": "growth",
  "cidalia-cabeleireiros": "growth",
  medway: "growth",
  "physio-hub": "growth",
  "antonio-gaspar": "growth",
  "a-domingos": "growth",

  // ADS-only clients
  "clinica-empatia": "core",
};

/** Clientes sem tag nenhuma — a própria agência. */
const NO_TIER = new Set(["wonderads"]);

/** Sort rank used to order cards inside a consultant column (top→bottom). */
export const TIER_RANK: Record<ClientTier, number> = {
  growth: 0,
  core: 1,
  lite: 2,
};

export function getClientTier(slug: string): ClientTier | null {
  if (NO_TIER.has(slug)) return null;
  return TIERS[slug] ?? "core";
}

/** Rank para ordenar; sem tier vai para o fim da coluna. */
export function tierRank(tier: ClientTier | null): number {
  return tier ? TIER_RANK[tier] : 3;
}

export const TIER_LABEL: Record<ClientTier, string> = {
  lite: "Lite",
  core: "Core",
  growth: "Growth",
};

export const TIER_ORDER: ClientTier[] = ["lite", "core", "growth"];
