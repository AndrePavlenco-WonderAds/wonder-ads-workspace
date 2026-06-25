// Per-client brand colour palettes for SEO DPT clients.
// Colours extracted directly from each client's live website (HTML + linked
// CSS). Where the site exposed too few brand colours, a thematic complement
// has been chosen to round out the gradient.

export type ClientPalette = {
  from: string;
  via?: string;
  to: string;
};

const PALETTES: Record<string, ClientPalette> = {
  // Australia — insyncdesign.com.au — yellow + teal accent on dark
  "insync-design": { from: "#FFD900", to: "#108474" },
  // Canada — instituteofholisticnutrition.com — terracotta + olive (earthy)
  ihn: { from: "#D0552C", via: "#A37033", to: "#455616" },
  // Lisbon — aegerprima.pt — orange + purple + navy
  "aeger-prima": { from: "#EF8722", via: "#573996", to: "#003388" },
  // Cascais — b-life.clinic — clean medical cyan / deep blue
  "b-life": { from: "#00C2D7", via: "#0073E6", to: "#003366" },
  // Fundão — adomingoscorreia.pt — sky blue → teal → deep purple
  "a-domingos": { from: "#4FB2E5", via: "#2F6E89", to: "#322382" },
  // Cadaval — senior-resort.pt — green tones
  "senior-resort": { from: "#6FE6B2", via: "#00DD80", to: "#009C61" },
  // Ermesinde — mimus.pt — coral pink + teal
  "clinica-mimus": { from: "#FF8A8B", via: "#3EC7C5", to: "#404040" },
  // Wonder Ads itself — keep brand gradient
  wonderads: { from: "#343ED7", via: "#783DF5", to: "#C535C9" },
  // Cascais — montemar.pt — sea blue + warm gold (coastal)
  "monte-mar": { from: "#FFBF00", via: "#8ECFD7", to: "#4B4B49" },
  // Lisbon — corridadotempo.pt — yellow/orange + near-black (high contrast)
  cdt: { from: "#F9B600", via: "#F6A800", to: "#222221" },
  // Nazaré — seayourself.pt — purple-blue + ocean blue
  "sea-yourself": { from: "#5D4FFF", via: "#4A90E2", to: "#2C5282" },
  // Dubai — hdslearning.com — sky to deep blue
  "hds-learning": { from: "#38B5E6", via: "#1E88E5", to: "#0D47A1" },
  // Lisbon — whiteclinic.pt — blue + warm tan + deep green
  "white-clinic": { from: "#1863DC", via: "#AE895D", to: "#0F341F" },
  // Lisbon — fisiorestelo.pt — cyan → blue → deep navy
  "fisio-restelo": { from: "#00B0C7", via: "#1863DC", to: "#0E2A5E" },
  // Madeira — safeaway.pt — mint teal + blue (their primary colour is mint)
  "safe-away": { from: "#66C6C2", via: "#5897FB", to: "#007AFF" },
  // Portugal — clinicaemcasa.pt — light blue → primary blue → deep
  "clinica-em-casa": { from: "#95D3EA", via: "#1C5CFF", to: "#2A5296" },
  // ADS-only — Clínica Empatia — warm peach → rose → deep magenta
  "clinica-empatia": { from: "#FFCDB2", via: "#FF8FA3", to: "#C9184A" },
  // sentirsaude.pt — light azure → blue → deep navy (logo gradient)
  "sentir-saude": { from: "#3FA9DC", via: "#1C6FB0", to: "#16314F" },
  // clinicasdentariasfa.pt — playful multicolour mark on charcoal
  "clinica-fernando-almeida": { from: "#E84B8A", via: "#F49B0B", to: "#2B2D33" },
  // cuidamais.pt — real brand colours from the "cuida+" wordmark:
  // green "+" (#0A8015) + navy text.
  cuidamais: { from: "#3FB54A", via: "#0A8015", to: "#23286A" },
  // kingsgyms.com — gold crown + white wordmark on black (regal gold → dark).
  "kings-gyms": { from: "#E8C66B", via: "#B8902F", to: "#0A0A0A" },
};

const DEFAULT_PALETTE: ClientPalette = {
  from: "#343ED7",
  via: "#783DF5",
  to: "#C535C9",
};

export function getClientPalette(slug: string): ClientPalette {
  return PALETTES[slug] ?? DEFAULT_PALETTE;
}

export function paletteToGradient(p: ClientPalette, angle = 135): string {
  if (p.via) {
    return `linear-gradient(${angle}deg, ${p.from} 0%, ${p.via} 50%, ${p.to} 100%)`;
  }
  return `linear-gradient(${angle}deg, ${p.from} 0%, ${p.to} 100%)`;
}
