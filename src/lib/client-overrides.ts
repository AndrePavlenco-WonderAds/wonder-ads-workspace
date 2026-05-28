// Per-client overrides that aren't (yet) sourced from Notion.

/** Map raw Notion title (trimmed) → display title used in UI + slug. */
export const TITLE_OVERRIDES: Record<string, string> = {
  "Mimus clínica dentária": "Clínica Mimus",
  "Institute Of Holistic Nutrition": "IHN",
  "Corrida do Tempo": "CDT",
};

/** Slugs to hide from the workspace (client offboarded, etc). */
export const EXCLUDED_SLUGS = new Set<string>(["c-saccor"]);

// Luana N. → André P. handover (v74.6). André took over Luana's book; the
// slug membership stays the same, only the consultant identity changed.
const ANDRE = new Set([
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
]);

/** Returns the Head Consultant for a given client slug. */
export function getConsultantForSlug(slug: string): string {
  if (ANDRE.has(slug)) return "André P.";
  if (FRAN_R.has(slug)) return "Fran. R.";
  if (YENISEY.has(slug)) return "Yenisey R.";
  return "Unassigned";
}

/** Returns the work email of the Head Consultant for a given client slug.
 *  Used on PDF/DOCX deliverables so replies land in the inbox of the
 *  consultant actually managing the project (not the shared seo@ alias). */
export function getConsultantEmailForSlug(slug: string): string {
  if (ANDRE.has(slug)) return "andre@wonder-ads.com";
  if (FRAN_R.has(slug)) return "fran@wonder-ads.com";
  if (YENISEY.has(slug)) return "yeni@wonder-ads.com";
  return "seo@wonder-ads.com";
}

/** Display order used for grouping client cards into columns. */
export const CONSULTANT_ORDER = [
  "Fran. R.",
  "Yenisey R.",
  "André P.",
] as const;
