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

/** Returns the Head Consultant for a given client slug. */
export function getConsultantForSlug(slug: string): string {
  if (MANUEL.has(slug)) return "Manuel Silva";
  if (FRAN_R.has(slug)) return "Fran. Rosa";
  if (ANDRE_PEREIRA.has(slug)) return "André Pereira";
  if (JOAO_B.has(slug)) return "João B.";
  return "Unassigned";
}

/** O consultor em vigor para um cliente, com rede para os que ainda não
 *  estão neste ficheiro.
 *
 *  PORQUE EXISTE (v76.47): a board e o motor de notificações resolviam o
 *  consultor SÓ pelo slug, de propósito — `getSeoClients()` está em cache de
 *  1 hora, e confiar no campo `consultant` dela fazia um cliente que mudou de
 *  mãos apontar à pessoa errada durante esse tempo.
 *
 *  Só que um cliente que entra pelo ONBOARDING não está aqui: o slug dele
 *  nasce quando o SuperAdmin cria o link, e a atribuição vive no registo de
 *  onboarding. Resolver só pelo slug devolvia "Unassigned" — e como as
 *  colunas da board são as do `CONSULTANT_ORDER`, o cliente não aparecia em
 *  coluna NENHUMA. Ficava invisível no departamento até alguém se lembrar de
 *  o acrescentar a este ficheiro e fazer deploy.
 *
 *  A ordem resolve as duas coisas: quem está aqui manda sempre (uma passagem
 *  de carteira escrita em código continua a ganhar à cache), e quem não está
 *  usa a atribuição que veio com ele. */
export function resolveConsultant(
  slug: string,
  fallback: string | null | undefined,
): string {
  const known = getConsultantForSlug(slug);
  if (known !== "Unassigned") return known;
  const f = typeof fallback === "string" ? fallback.trim() : "";
  return f || "Unassigned";
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
