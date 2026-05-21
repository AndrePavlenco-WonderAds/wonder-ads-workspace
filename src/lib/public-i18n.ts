// Tiny i18n helper for the (public-review) pages. Picks European
// Portuguese vs English based on the client's languageCode in
// client-geo. PT-PT specifically — uses "tu"/Portugal vocab, NOT
// Brazilian Portuguese. Designed to be expanded with ES / FR later.

import { getClientGeo } from "@/lib/client-geo";

export type PublicLang = "pt" | "en";

export function pickLang(slug: string): PublicLang {
  const code = getClientGeo(slug).languageCode;
  return code === "pt" ? "pt" : "en";
}

type Phrase = { pt: string; en: string };

const phrases = {
  // Meta Tags preview ----------------------------------------------------
  metaTagsBadge: {
    pt: "Pré-visualização de Meta Tags",
    en: "Meta Tags Preview",
  },
  metaTagsStats: {
    // Use {n} placeholder substitution
    pt: "{n} página{plural} · elaborado em {date} · profundidade: {depth}",
    en: "{n} page{plural} · drafted {date} · depth: {depth}",
  },
  metaTagsIntro: {
    pt: 'Estes são os <strong>títulos</strong> e <strong>meta descrições</strong> otimizados que preparámos para todas as páginas do teu site, com base na última Pesquisa de Palavras-chave e no briefing da tua marca. Cada linha mostra a tag atual (à esquerda) e a proposta de reescrita (à direita, a verde). Para aprovar ou pedir alterações, volta à tua {linkOpen}tabela de Aprovações Pendentes{linkClose}.',
    en: 'These are the optimised <strong>title tags</strong> and <strong>meta descriptions</strong> we\'ve drafted for every page on your site, based on the latest Keyword Research and your brand brief. Each row shows the current tag (left) next to the proposed rewrite (right, in green). To approve or request changes, head back to your {linkOpen}Pending Review table{linkClose}.',
  },
  // GMB Posts preview ----------------------------------------------------
  gmbBadge: { pt: "Pré-visualização de Posts GMB", en: "GMB Posts Preview" },
  gmbStats: {
    pt: "{n} post{plural} · elaborado em {date}",
    en: "{n} post{plural} · drafted {date}",
  },
  gmbIntro: {
    pt: 'Estes são os posts do Google Business Profile que preparámos para ti. Cada cartão mostra a imagem + legenda + call-to-action exatamente como aparecerão. Para aprovar ou pedir alterações, volta à tua {linkOpen}tabela de Aprovações Pendentes{linkClose}.',
    en: 'These are the Google Business Profile posts we\'ve drafted for you. Each card shows the image + caption + call-to-action exactly as they\'ll appear. To approve or request changes, head back to your {linkOpen}Pending Review table{linkClose}.',
  },
  // Pending Review public page -------------------------------------------
  pendingReviewBadge: { pt: "Aprovações Pendentes", en: "Pending Review" },
  pendingReviewIntro: {
    pt: 'Esta é a tua lista de aprovações pendentes. Clica em qualquer célula para editar — as alterações guardam automaticamente. Usa a coluna <strong>Status</strong> para aprovar / rejeitar / pedir alterações.',
    en: 'This is your pending-approval list. Click any cell to edit — your changes save automatically. Use the <strong>Status</strong> column to approve / reject / request changes.',
  },
  // Footer ---------------------------------------------------------------
  footerTagline: {
    pt: "Agência de Crescimento em Saúde & Bem-estar · #1 SEO em Portugal",
    en: "Health & Wellness Growth Agency · #1 SEO Provider in Portugal",
  },
  footerQuestions: {
    pt: "Dúvidas? Envia email a {consultant} — {emailLink}",
    en: "Questions? Email {consultant} — {emailLink}",
  },
  footerQuestionsNoName: {
    pt: "Dúvidas? Envia email a {emailLink}",
    en: "Questions? {emailLink}",
  },
} as const satisfies Record<string, Phrase>;

export type PhraseKey = keyof typeof phrases;

/** Look up a phrase + substitute named tokens. Tokens use {name} syntax.
 *  Pass plain string values via vars; pass JSX-safe HTML in vars too —
 *  the caller decides whether to render with dangerouslySetInnerHTML or
 *  manually split around link placeholders. */
export function t(
  lang: PublicLang,
  key: PhraseKey,
  vars: Record<string, string | number> = {},
): string {
  let s: string = phrases[key][lang];
  for (const [name, value] of Object.entries(vars)) {
    s = s.replaceAll(`{${name}}`, String(value));
  }
  return s;
}

/** Plural marker — returns "s" in English, "s" in Portuguese (both use
 *  trailing -s for most nouns). Kept as a helper so future languages
 *  with different plural rules can override. */
export function plural(n: number): string {
  return n === 1 ? "" : "s";
}
