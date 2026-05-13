// Per-client metadata that isn't in Notion (yet).
// Keyed by slug — same slugs as everywhere else (briefs, palettes, tiers).

/** Real brand logo, fetched from each client's website and saved in /public/logos.
 *  Used in place of the Notion emoji on cards + project pages. */
export const CLIENT_LOGOS: Record<string, string> = {
  "insync-design": "/logos/insync-design.png",
  ihn: "/logos/ihn.png",
  "aeger-prima": "/logos/aeger-prima.png",
  "b-life": "/logos/b-life.png",
  "a-domingos": "/logos/a-domingos.png",
  "senior-resort": "/logos/senior-resort.png",
  "clinica-mimus": "/logos/clinica-mimus.png",
  wonderads: "/logos/wonderads.png",
  "monte-mar": "/logos/monte-mar.svg",
  cdt: "/logos/cdt.png",
  "sea-yourself": "/logos/sea-yourself.png",
  "hds-learning": "/logos/hds-learning.png",
  "white-clinic": "/logos/white-clinic.png",
  "fisio-restelo": "/logos/fisio-restelo.png",
  "safe-away": "/logos/safe-away.png",
  "clinica-em-casa": "/logos/clinica-em-casa.png",
};

export function getClientLogo(slug: string): string | null {
  return CLIENT_LOGOS[slug] ?? null;
}

/** White-on-transparent logos that need a dark chip background to be visible. */
export type LogoBgMode = "white" | "dark";

const LOGO_BG_OVERRIDES: Record<string, LogoBgMode> = {
  "b-life": "dark",
  "monte-mar": "dark",
};

export function getLogoBgMode(slug: string): LogoBgMode {
  return LOGO_BG_OVERRIDES[slug] ?? "white";
}

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
