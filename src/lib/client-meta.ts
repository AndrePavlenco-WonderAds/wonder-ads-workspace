// Per-client metadata that isn't in Notion (yet).
// Keyed by slug — same slugs as everywhere else (briefs, palettes, tiers).

export const CLIENT_WEBSITES: Record<string, string> = {
  "insync-design": "https://insyncdesign.com.au/",
  ihn: "https://instituteofholisticnutrition.com/",
  "aeger-prima": "https://aegerprima.pt/",
  "b-life": "https://b-life.clinic/",
  "a-domingos": "https://adomingoscorreia.pt/",
  "senior-resort": "https://senior-resort.pt/",
  "clinica-mimus": "https://www.mimus.pt/",
  wonderads: "https://wonder-ads.com/",
  "monte-mar": "https://www.montemar.pt/",
  cdt: "https://www.corridadotempo.pt/",
  "sea-yourself": "https://seayourself.pt/",
  "hds-learning": "https://hdslearning.com/",
  "white-clinic": "https://whiteclinic.pt/",
  "fisio-restelo": "https://fisiorestelo.pt/",
  "safe-away": "https://safeaway.pt/",
  "clinica-em-casa": "https://clinicaemcasa.pt/",
  // ADS-only — not known yet
  "clinica-empatia": "",
};

export function getClientWebsite(slug: string): string | null {
  const url = CLIENT_WEBSITES[slug];
  return url && url.length > 0 ? url : null;
}

/** Strip scheme + www + trailing slash for compact display. */
export function displayDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}
