// Per-client overrides that aren't (yet) sourced from Notion.

/** Map raw Notion title (trimmed) → display title used in UI + slug. */
export const TITLE_OVERRIDES: Record<string, string> = {
  "Mimus clínica dentária": "Clínica Mimus",
  "Institute Of Holistic Nutrition": "IHN",
  "Corrida do Tempo": "CDT",
};

const LUANA = new Set([
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
  if (LUANA.has(slug)) return "Luana N.";
  if (FRAN_R.has(slug)) return "Fran. R.";
  if (YENISEY.has(slug)) return "Yenisey";
  return "André";
}

/** Display order used for grouping client cards into columns. */
export const CONSULTANT_ORDER = [
  "André",
  "Fran. R.",
  "Yenisey",
  "Luana N.",
] as const;
