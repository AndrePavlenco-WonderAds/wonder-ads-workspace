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
// v75.4: IHN moved here when the previous SEO consultant left.
const MANUEL = new Set([
  "aeger-prima",
  "a-domingos",
  "safe-away",
  "clinica-em-casa",
  "ihn",
]);

// v75.4: Monte Mar + Fisio Restelo moved here when the previous SEO
// consultant left.
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
// v75.4: White Clinic + Spine Center + CDT moved here when the previous
// SEO consultant left.
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
// v76.39: Maratona Clube de Portugal (onboarding 01/09/2026).
const JOAO_B = new Set([
  "cidalia-cabeleireiros",
  "mymedic",
  "maratona-clube-de-portugal",
  // v76.82: Brancóptica, promovida do onboarding a 18/08/2026. Já caía na
  // coluna dele pelo consultor do registo de onboarding; fica fixada aqui
  // para `getConsultantEmailForSlug` também a reconhecer — sem isto, as
  // entregas em PDF/DOCX saíam com o alias seo@ em vez do email dele.
  "brancoptica",
]);

// v75.4: uma consultora de SEO saiu e a carteira dela foi redistribuída:
// IHN → Manuel; White Clinic + Spine Center + CDT → André Pereira;
// Monte Mar + Fisio Restelo → Fran. A coluna dela desapareceu do board.

/** Os consultores de SEO que podem ter carteira — nome de exibição (tem de
 *  bater com as colunas da board e com `name` nas credenciais) + email de
 *  trabalho. A ordem é a das colunas da board. */
export const SEO_CONSULTANTS = [
  { name: "Fran. Rosa", email: "fran@wonder-ads.com" },
  { name: "Manuel Silva", email: "manuel@wonder-ads.com" },
  { name: "André Pereira", email: "andre.pereira@wonder-ads.com" },
  { name: "João B.", email: "joao.batista@wonder-ads.com" },
] as const;

/** Display order used for grouping client cards into columns. */
export const CONSULTANT_ORDER = SEO_CONSULTANTS.map((c) => c.name);

/** O email de trabalho de um consultor pelo nome; seo@ para quem não é
 *  consultor de SEO conhecido (ou "Unassigned"). */
export function consultantEmailByName(name: string | null | undefined): string {
  return (
    SEO_CONSULTANTS.find((c) => c.name === name)?.email ?? "seo@wonder-ads.com"
  );
}

/** A carteira ESCRITA EM CÓDIGO (os Sets acima) — sem as migrações feitas
 *  pelo SuperAdmin na board (v77.34), que vivem no KV.
 *
 *  ⚠️ Não usar para mostrar o consultor de um cliente: isso é o
 *  `getConsultantForSlug` de `@/lib/consultant-assignments`, que aplica as
 *  migrações por cima destes defaults. Isto só serve a quem não pode ler o
 *  KV (a cache da Notion, que é re-resolvida à saída de qualquer forma). */
export function defaultConsultantForSlug(slug: string): string {
  if (MANUEL.has(slug)) return "Manuel Silva";
  if (FRAN_R.has(slug)) return "Fran. Rosa";
  if (ANDRE_PEREIRA.has(slug)) return "André Pereira";
  if (JOAO_B.has(slug)) return "João B.";
  return "Unassigned";
}
