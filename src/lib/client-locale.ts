// Per-client language. Most Wonder Ads clients are Portuguese (PT-PT),
// but a few operate in English (e.g. IHN — Institute of Holistic
// Nutrition). Client-facing artefacts — reports, generated creatives —
// must be written in the client's own language.
//
// Add a slug here when onboarding an English-speaking client.

export type ClientLocale = "pt" | "en";

const ENGLISH_CLIENT_SLUGS = new Set<string>([
  "ihn",
]);

export function getClientLocale(slug: string): ClientLocale {
  return ENGLISH_CLIENT_SLUGS.has(slug) ? "en" : "pt";
}

export function isEnglishClient(slug: string): boolean {
  return getClientLocale(slug) === "en";
}

/** Human language name for prompts. */
export function localeLanguageName(locale: ClientLocale): string {
  return locale === "en" ? "English" : "Portuguese (Portugal)";
}
