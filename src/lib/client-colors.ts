// Per-client brand colour palettes for SEO DPT clients.
// InSync Design comes from the actual site (#ffd900 + #108474).
// The others are thematic placeholders chosen from each client's name/emoji —
// swap to the real brand colours when the user provides website URLs.

export type ClientPalette = {
  from: string;
  via?: string;
  to: string;
};

const PALETTES: Record<string, ClientPalette> = {
  "insync-design": { from: "#FFD900", to: "#108474" }, // yellow → teal (live site)
  "institute-of-holistic-nutrition": { from: "#A8E063", via: "#56AB2F", to: "#1E5631" },
  "aeger-prima": { from: "#8E9BAE", via: "#3A4757", to: "#1A2230" },
  "b-life": { from: "#00E5FF", via: "#0066FF", to: "#1D2671" },
  "a-domingos": { from: "#E0C097", via: "#A4794A", to: "#5B3A1A" },
  "senior-resort": { from: "#A8C8E0", via: "#E8DCC4", to: "#7BA7C2" },
  "c-saccor": { from: "#FFE8C2", via: "#D9A864", to: "#7A4A1F" },
  "clinica-mimus": { from: "#FFAFCC", via: "#FF5C8A", to: "#9B2C5C" },
  wonderads: { from: "#343ED7", via: "#783DF5", to: "#C535C9" }, // our own brand
  "monte-mar": { from: "#5BA8D9", via: "#2F6A8F", to: "#0F2A3F" },
  "corrida-do-tempo": { from: "#E0A075", via: "#B07650", to: "#3D1F1B" },
  "sea-yourself": { from: "#FFB088", via: "#FF6B6B", to: "#2F8FB1" },
  "hds-learning": { from: "#C49AE0", via: "#7E3FBF", to: "#2A1148" },
  "white-clinic": { from: "#FFFFFF", via: "#B9DDF1", to: "#3A8FC2" },
  "fisio-restelo": { from: "#F2A0A8", via: "#E63946", to: "#1D3557" },
  "safe-away": { from: "#4A6E91", via: "#1E3A5F", to: "#0A1424" },
  "clinica-em-casa": { from: "#A5D8F0", via: "#5DA8D6", to: "#1A4D7D" },
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
