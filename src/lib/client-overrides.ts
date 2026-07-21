// Per-client overrides that aren't (yet) sourced from Notion.

/** Map raw Notion title (trimmed) → display title used in UI + slug. */
export const TITLE_OVERRIDES: Record<string, string> = {
  "Mimus clínica dentária": "Clínica Mimus",
  "Institute Of Holistic Nutrition": "IHN",
  "Corrida do Tempo": "CDT",
};

/** Slugs to hide from the workspace (client offboarded, etc). */
export const EXCLUDED_SLUGS = new Set<string>(["c-saccor", "senior-resort"]);

// André P. → Manuel S. handover (v74.10). Manuel took over André's book;
// the slug membership stays the same, only the consultant identity
// changed. (André previously took over Luana's book in v74.6 — same
// pattern.)
// v75.4: IHN moved here from Yenisey (offboarded).
const MANUEL = new Set([
  "aeger-prima",
  "a-domingos",
  "safe-away",
  "clinica-em-casa",
  "ihn",
]);

// v75.4: Monte Mar + Fisio Restelo moved here from Yenisey (offboarded).
const FRAN_R = new Set([
  "b-life",
  "hds-learning",
  "sea-yourself",
  "clinica-mimus",
  "insync-design",
  "wonderads",
  "monte-mar",
  "fisio-restelo",
]);

// André Pereira — new SEO consultant (v74.31). His first book:
// Sentir Saúde + Clínica Fernando Almeida (both onboarded 15/06/2026).
// CuidaMais added v74.38. Kings Gyms (kingsgyms.com) added v74.59.
// v75.4: White Clinic + Spine Center + CDT moved here from Yenisey.
const ANDRE_PEREIRA = new Set([
  "sentir-saude",
  "clinica-fernando-almeida",
  "cuidamais",
  "kings-gyms",
  "white-clinic",
  "spine-center",
  "cdt",
]);

// João B. — new SEO consultant (v75.4). First book: two clients still in
// onboarding (superadmin filling the forms) — surfaced on the board via
// EXTRA_SEO_CLIENTS in notion.ts. When they submit the onboarding form the
// same slug promotes seamlessly and the intake attaches to /seo/<slug>.
const JOAO_B = new Set([
  "cidalia-cabeleireiros",
  "mymedic",
]);

// Yenisey Rodriguez offboarded (v75.4). Her book was redistributed:
// IHN → Manuel; White Clinic + Spine Center + CDT → André Pereira;
// Monte Mar + Fisio Restelo → Fran. The column is gone.

/** Returns the Head Consultant for a given client slug. */
export function getConsultantForSlug(slug: string): string {
  if (MANUEL.has(slug)) return "Manuel Silva";
  if (FRAN_R.has(slug)) return "Fran. Rosa";
  if (ANDRE_PEREIRA.has(slug)) return "André Pereira";
  if (JOAO_B.has(slug)) return "João B.";
  return "Unassigned";
}

/** Returns the work email of the Head Consultant for a given client slug.
 *  Used on PDF/DOCX deliverables so replies land in the inbox of the
 *  consultant actually managing the project (not the shared seo@ alias). */
export function getConsultantEmailForSlug(slug: string): string {
  if (MANUEL.has(slug)) return "manuel@wonder-ads.com";
  if (FRAN_R.has(slug)) return "fran@wonder-ads.com";
  if (ANDRE_PEREIRA.has(slug)) return "andre.pereira@wonder-ads.com";
  if (JOAO_B.has(slug)) return "joao.batista@wonder-ads.com";
  return "seo@wonder-ads.com";
}

/** Display order used for grouping client cards into columns. */
export const CONSULTANT_ORDER = [
  "Fran. Rosa",
  "Manuel Silva",
  "André Pereira",
  "João B.",
] as const;
