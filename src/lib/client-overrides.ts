// Per-client overrides that aren't (yet) sourced from Notion.

/** Map raw Notion title (trimmed) → display title used in UI + slug. */
export const TITLE_OVERRIDES: Record<string, string> = {
  "Mimus clínica dentária": "Clínica Mimus",
};

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
  "institute-of-holistic-nutrition",
  "fisio-restelo",
  "monte-mar",
  "corrida-do-tempo",
]);

/** Returns the Head Consultant for a given client slug. */
export function getConsultantForSlug(slug: string): string {
  if (FRAN_R.has(slug)) return "Fran. R.";
  if (YENISEY.has(slug)) return "Yenisey";
  return "André";
}
