// Per-client geo + language config for DataforSEO queries.
//
// Defaults to Portugal/Portuguese — most of the roster is Portuguese clinics.
// Override per-client where the brand operates in another market. The values
// here flow into the Domain Intelligence rank overview, ranked keywords, AND
// LLM Mentions queries so the dashboard always matches the client's market.
//
// DataforSEO location codes follow Google's geo codes:
//   Portugal=2620, Canada=2124, Australia=2036, Brazil=2076,
//   United States=2840, United Kingdom=2826, Spain=2724,
//   France=2250, Germany=2276, Italy=2380, Belgium=2056

export type ClientGeo = {
  locationCode: number;
  languageCode: string;
  countryLabel: string;
};

const DEFAULTS: ClientGeo = {
  locationCode: 2620,
  languageCode: "pt",
  countryLabel: "Portugal",
};

const OVERRIDES: Record<string, ClientGeo> = {
  ihn: { locationCode: 2124, languageCode: "en", countryLabel: "Canada" },
  "insync-design": {
    locationCode: 2036,
    languageCode: "en",
    countryLabel: "Australia",
  },
  "hds-learning": {
    locationCode: 2076,
    languageCode: "pt",
    countryLabel: "Brazil",
  },
  // WonderAds runs globally — anchor in PT since the team + main HQ is there.
};

export function getClientGeo(slug: string): ClientGeo {
  return OVERRIDES[slug] ?? DEFAULTS;
}

export function countryFromCode(code: number): string {
  const map: Record<number, string> = {
    2620: "Portugal",
    2840: "United States",
    2826: "United Kingdom",
    2724: "Spain",
    2250: "France",
    2276: "Germany",
    2124: "Canada",
    2380: "Italy",
    2056: "Belgium",
    2036: "Australia",
    2076: "Brazil",
  };
  return map[code] ?? `geo ${code}`;
}
