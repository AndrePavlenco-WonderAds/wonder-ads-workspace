// Per-client niche/industry tags — the third matching signal for SEO
// Directories (language + country come from client-geo.ts).
//
// These tags are matched against each directory's `tags` (see
// seo-directory-match.ts). Most of the roster is health/clinic, so unknown
// clients default to [] — which still surfaces every GENERAL business
// directory (the safe baseline), just no niche-specific boosts. Tag a client
// here when its niche is known so niche-specific directories (e.g. fitness,
// dental, travel) get prioritised. The consultant can also refine the niche
// live on the directories page without touching this file.
//
// Known tag vocabulary (shared with directory tags): health, dental,
// psychology, fitness, beauty, travel, food, fashion, lifestyle, news,
// webdesign, tech, software, startup, ecommerce, consulting, services.

const INDUSTRY: Record<string, string[]> = {
  "kings-gyms": ["fitness", "health"],
  "sentir-saude": ["health"],
  "clinica-fernando-almeida": ["health", "dental"],
  "white-clinic": ["health", "dental"],
  "spine-center": ["health"],
  "fisio-restelo": ["health"],
  "clinica-mimus": ["health"],
  "clinica-em-casa": ["health"],
  "clinica-empatia": ["health", "psychology"],
  "cuidamais": ["health"],  "aeger-prima": ["health"],
  "b-life": ["health"],
};

export function getClientIndustry(slug: string): string[] {
  return INDUSTRY[slug] ?? [];
}
