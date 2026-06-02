// Per-client brief — Do's, Don'ts, and General notes.
// Keyed by client slug (same slugs as Notion/colors/tiers).
//
// Edit this file directly to update a brief, then push. Briefs are read on
// /seo/[slug] pages and will also feed the per-project Claude blog-writer
// chat (v18) and the ADS DPT once cross-department views land.

export type ClientBrief = {
  dos: string[];
  donts: string[];
  notes: string[];
};

const EMPTY: ClientBrief = { dos: [], donts: [], notes: [] };

const BRIEFS: Record<string, ClientBrief> = {
  "insync-design": EMPTY,
  ihn: EMPTY,
  "aeger-prima": EMPTY,
  "b-life": EMPTY,
  "a-domingos": EMPTY,
  "senior-resort": EMPTY,
  "clinica-mimus": EMPTY,
  wonderads: EMPTY,
  "monte-mar": EMPTY,
  cdt: EMPTY,
  "sea-yourself": EMPTY,
  "hds-learning": EMPTY,
  "white-clinic": EMPTY,
  "fisio-restelo": EMPTY,
  "safe-away": EMPTY,
  "clinica-em-casa": EMPTY,
  "spine-center": EMPTY,

  // ADS-only clients
  "clinica-empatia": EMPTY,

  // Web-only clients
  "prof-fernando-almeida": EMPTY,
};

export function getClientBrief(slug: string): ClientBrief {
  return BRIEFS[slug] ?? EMPTY;
}

export function hasAnyBriefContent(brief: ClientBrief): boolean {
  return (
    brief.dos.length > 0 ||
    brief.donts.length > 0 ||
    brief.notes.length > 0
  );
}
