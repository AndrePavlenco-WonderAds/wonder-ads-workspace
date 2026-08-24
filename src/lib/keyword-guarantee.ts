// Clientes com GARANTIA CONTRATUAL de posicionamento nas Premium Keywords.
//
// O contrato compromete a agência com as 3 palavras-chave douradas que o
// consultor marca na tabela de Target Keywords da ficha do cliente
// (`premium: true` — ver `target-keywords-store.ts`). É por isso que o teto
// das Premium são exatamente 3: uma por cada posição garantida no contrato.
//
// Esta lista é a fonte da verdade do lado do CONTRATO — quem assinou. A
// marcação das estrelas é a fonte da verdade do lado do TRABALHO — quais
// são as três. As duas vivem em sítios diferentes de propósito: assinar
// contrato não escolhe keywords, e escolher keywords não assina contrato.
//
// v76.85 — lista inicial dada pelo André.

/** Quantas posições o contrato de garantia cobre. Igual ao teto de
 *  MAX_PREMIUM_KEYWORDS, e pela mesma razão. */
export const KEYWORD_GUARANTEE_COUNT = 3;

const GUARANTEE_SLUGS = new Set<string>([
  "cidalia-cabeleireiros",
  "mymedic",
  "maratona-clube-de-portugal",
  "brancoptica",
  "clinica-fernando-almeida",
  "spine-center",
  "sentir-saude",
]);

/** True quando o cliente assinou contrato com garantia de keywords. */
export function hasKeywordGuarantee(slug: string): boolean {
  return GUARANTEE_SLUGS.has(slug);
}

/** Todos os slugs com garantia — para contagens e painéis de gestão. */
export function listKeywordGuaranteeSlugs(): string[] {
  return [...GUARANTEE_SLUGS];
}
