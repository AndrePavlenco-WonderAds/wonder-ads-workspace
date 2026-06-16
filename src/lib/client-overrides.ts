// Per-client overrides that aren't (yet) sourced from Notion.

/** Map raw Notion title (trimmed) → display title used in UI + slug. */
export const TITLE_OVERRIDES: Record<string, string> = {
  "Mimus clínica dentária": "Clínica Mimus",
  "Institute Of Holistic Nutrition": "IHN",
  "Corrida do Tempo": "CDT",
};

/** Slugs to hide from the workspace (client offboarded, etc). */
export const EXCLUDED_SLUGS = new Set<string>(["c-saccor"]);

// André P. → Manuel S. handover (v74.10). Manuel took over André's book;
// the slug membership stays the same, only the consultant identity
// changed. (André previously took over Luana's book in v74.6 — same
// pattern.)
const MANUEL = new Set([
  "aeger-prima",
  "a-domingos",
  "senior-resort",
  "safe-away",
  "clinica-em-casa",
]);

const FRAN_R = new Set([
  "b-life",
  "hds-learning",
  "sea-yourself",
  "clinica-mimus",
  "insync-design",
  "wonderads",
]);

const YENISEY = new Set([
  "white-clinic",
  "ihn",
  "fisio-restelo",
  "monte-mar",
  "cdt",
  "spine-center",
]);

// André Pereira — new SEO consultant (v74.31). His first book:
// Sentir Saúde + Clínica Fernando Almeida (both onboarded 15/06/2026).
const ANDRE_PEREIRA = new Set(["sentir-saude", "clinica-fernando-almeida"]);

/** Returns the Head Consultant for a given client slug. */
export function getConsultantForSlug(slug: string): string {
  if (MANUEL.has(slug)) return "Manuel S.";
  if (FRAN_R.has(slug)) return "Fran. R.";
  if (YENISEY.has(slug)) return "Yenisey R.";
  if (ANDRE_PEREIRA.has(slug)) return "André Pereira";
  return "Unassigned";
}

/** Returns the work email of the Head Consultant for a given client slug.
 *  Used on PDF/DOCX deliverables so replies land in the inbox of the
 *  consultant actually managing the project (not the shared seo@ alias). */
export function getConsultantEmailForSlug(slug: string): string {
  if (MANUEL.has(slug)) return "manuel@wonder-ads.com";
  if (FRAN_R.has(slug)) return "fran@wonder-ads.com";
  if (YENISEY.has(slug)) return "yeni@wonder-ads.com";
  if (ANDRE_PEREIRA.has(slug)) return "andre.pereira@wonder-ads.com";
  return "seo@wonder-ads.com";
}

/** Display order used for grouping client cards into columns. */
export const CONSULTANT_ORDER = [
  "Fran. R.",
  "Yenisey R.",
  "Manuel S.",
  "André Pereira",
] as const;
