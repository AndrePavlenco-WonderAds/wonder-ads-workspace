// Curated list of DataforSEO geo targets.
//
// DataforSEO has tens of thousands of location codes (the full Google Ads
// geo taxonomy). We bundle a focused list of the countries + cities the
// agency actually serves so the Keyword Research geo selector stays
// scannable and ranking-relevant rather than overwhelming.
//
// Codes verified against DataforSEO's `/v3/dataforseo_labs/locations_and_languages`
// endpoint. Add more by:
//   1. Calling that endpoint or browsing https://docs.dataforseo.com/v3/appendix/google_languages_and_locations/
//   2. Appending here with the right localModifier — the modifier is what
//      Claude uses to bake a real local-language suffix into recommended
//      keywords (e.g. "Dentista Lisboa" for PT-Lisbon, "Dentist NYC" for
//      US-New York).
//
// Why curated: a free-text city field would let consultants type "Lisbon"
// vs "Lisboa" vs "lisbon, pt" and we'd have to fuzzy-match against the
// taxonomy. A select with sensible labels keeps the keyword research
// dependable.

export type LocationTarget = {
  /** DataforSEO `location_code`. */
  locationCode: number;
  /** ISO-639-1 default language used in this market (overridable per client). */
  languageCode: string;
  /** Human-readable label shown in the UI ("Lisbon, Portugal"). */
  label: string;
  /** Whether this is a country (broader) or city (sharper) target. */
  scope: "country" | "city" | "region";
  /** What to append to keyword recommendations to make them locally-natural.
   *  Empty string when the keyword shouldn't carry a geo modifier (e.g.
   *  country-level pulls where modifiers vary by intent). */
  localModifier: string;
  /** Parent country label — used for grouping in the select. */
  country: string;
  /** Lowercase searchable string for typeahead matching. */
  searchKey: string;
};

function mk(
  partial: Omit<LocationTarget, "searchKey"> & { searchKey?: string },
): LocationTarget {
  return {
    ...partial,
    searchKey:
      partial.searchKey ??
      `${partial.label} ${partial.country} ${partial.localModifier}`
        .toLowerCase(),
  };
}

export const LOCATION_TARGETS: LocationTarget[] = [
  // --- Portugal ---
  mk({
    locationCode: 2620,
    languageCode: "pt",
    label: "Portugal (national)",
    scope: "country",
    localModifier: "",
    country: "Portugal",
  }),
  mk({
    locationCode: 1011961,
    languageCode: "pt",
    label: "Lisbon",
    scope: "city",
    localModifier: "Lisboa",
    country: "Portugal",
  }),
  mk({
    locationCode: 1011962,
    languageCode: "pt",
    label: "Porto",
    scope: "city",
    localModifier: "Porto",
    country: "Portugal",
  }),
  mk({
    locationCode: 1011967,
    languageCode: "pt",
    label: "Algarve (Faro)",
    scope: "region",
    localModifier: "Algarve",
    country: "Portugal",
  }),
  mk({
    locationCode: 1011964,
    languageCode: "pt",
    label: "Coimbra",
    scope: "city",
    localModifier: "Coimbra",
    country: "Portugal",
  }),
  mk({
    locationCode: 1011965,
    languageCode: "pt",
    label: "Braga",
    scope: "city",
    localModifier: "Braga",
    country: "Portugal",
  }),
  mk({
    locationCode: 1011969,
    languageCode: "pt",
    label: "Madeira (Funchal)",
    scope: "region",
    localModifier: "Madeira",
    country: "Portugal",
  }),

  // --- Spain ---
  mk({
    locationCode: 2724,
    languageCode: "es",
    label: "Spain (national)",
    scope: "country",
    localModifier: "",
    country: "Spain",
  }),
  mk({
    locationCode: 1005419,
    languageCode: "es",
    label: "Madrid",
    scope: "city",
    localModifier: "Madrid",
    country: "Spain",
  }),
  mk({
    locationCode: 1005418,
    languageCode: "es",
    label: "Barcelona",
    scope: "city",
    localModifier: "Barcelona",
    country: "Spain",
  }),
  mk({
    locationCode: 1005538,
    languageCode: "es",
    label: "Valencia",
    scope: "city",
    localModifier: "Valencia",
    country: "Spain",
  }),

  // --- Brazil ---
  mk({
    locationCode: 2076,
    languageCode: "pt",
    label: "Brazil (national)",
    scope: "country",
    localModifier: "",
    country: "Brazil",
  }),
  mk({
    locationCode: 1001541,
    languageCode: "pt",
    label: "São Paulo",
    scope: "city",
    localModifier: "São Paulo",
    country: "Brazil",
  }),
  mk({
    locationCode: 1001540,
    languageCode: "pt",
    label: "Rio de Janeiro",
    scope: "city",
    localModifier: "Rio de Janeiro",
    country: "Brazil",
  }),
  mk({
    locationCode: 1001516,
    languageCode: "pt",
    label: "Belo Horizonte",
    scope: "city",
    localModifier: "BH",
    country: "Brazil",
  }),

  // --- United Kingdom ---
  mk({
    locationCode: 2826,
    languageCode: "en",
    label: "United Kingdom (national)",
    scope: "country",
    localModifier: "UK",
    country: "United Kingdom",
  }),
  mk({
    locationCode: 1006886,
    languageCode: "en",
    label: "London",
    scope: "city",
    localModifier: "London",
    country: "United Kingdom",
  }),
  mk({
    locationCode: 1006894,
    languageCode: "en",
    label: "Manchester",
    scope: "city",
    localModifier: "Manchester",
    country: "United Kingdom",
  }),

  // --- United States ---
  mk({
    locationCode: 2840,
    languageCode: "en",
    label: "United States (national)",
    scope: "country",
    localModifier: "USA",
    country: "United States",
  }),
  mk({
    locationCode: 1023191,
    languageCode: "en",
    label: "New York, NY",
    scope: "city",
    localModifier: "NYC",
    country: "United States",
  }),
  mk({
    locationCode: 1013962,
    languageCode: "en",
    label: "Los Angeles, CA",
    scope: "city",
    localModifier: "LA",
    country: "United States",
  }),
  mk({
    locationCode: 1015214,
    languageCode: "en",
    label: "Miami, FL",
    scope: "city",
    localModifier: "Miami",
    country: "United States",
  }),
  mk({
    locationCode: 1014221,
    languageCode: "en",
    label: "Chicago, IL",
    scope: "city",
    localModifier: "Chicago",
    country: "United States",
  }),

  // --- Canada ---
  mk({
    locationCode: 2124,
    languageCode: "en",
    label: "Canada (national)",
    scope: "country",
    localModifier: "Canada",
    country: "Canada",
  }),
  mk({
    locationCode: 1002005,
    languageCode: "en",
    label: "Toronto",
    scope: "city",
    localModifier: "Toronto",
    country: "Canada",
  }),
  mk({
    locationCode: 1002006,
    languageCode: "en",
    label: "Vancouver",
    scope: "city",
    localModifier: "Vancouver",
    country: "Canada",
  }),
  mk({
    locationCode: 1002007,
    languageCode: "en",
    label: "Montréal",
    scope: "city",
    localModifier: "Montréal",
    country: "Canada",
  }),

  // --- Australia ---
  mk({
    locationCode: 2036,
    languageCode: "en",
    label: "Australia (national)",
    scope: "country",
    localModifier: "Australia",
    country: "Australia",
  }),
  mk({
    locationCode: 1000339,
    languageCode: "en",
    label: "Sydney",
    scope: "city",
    localModifier: "Sydney",
    country: "Australia",
  }),
  mk({
    locationCode: 1000567,
    languageCode: "en",
    label: "Melbourne",
    scope: "city",
    localModifier: "Melbourne",
    country: "Australia",
  }),

  // --- France ---
  mk({
    locationCode: 2250,
    languageCode: "fr",
    label: "France (national)",
    scope: "country",
    localModifier: "",
    country: "France",
  }),
  mk({
    locationCode: 1006094,
    languageCode: "fr",
    label: "Paris",
    scope: "city",
    localModifier: "Paris",
    country: "France",
  }),

  // --- Germany ---
  mk({
    locationCode: 2276,
    languageCode: "de",
    label: "Germany (national)",
    scope: "country",
    localModifier: "",
    country: "Germany",
  }),
  mk({
    locationCode: 1003854,
    languageCode: "de",
    label: "Berlin",
    scope: "city",
    localModifier: "Berlin",
    country: "Germany",
  }),
  mk({
    locationCode: 1004293,
    languageCode: "de",
    label: "Munich",
    scope: "city",
    localModifier: "München",
    country: "Germany",
  }),

  // --- Italy ---
  mk({
    locationCode: 2380,
    languageCode: "it",
    label: "Italy (national)",
    scope: "country",
    localModifier: "",
    country: "Italy",
  }),
  mk({
    locationCode: 1008267,
    languageCode: "it",
    label: "Milan",
    scope: "city",
    localModifier: "Milano",
    country: "Italy",
  }),
  mk({
    locationCode: 1008382,
    languageCode: "it",
    label: "Rome",
    scope: "city",
    localModifier: "Roma",
    country: "Italy",
  }),

  // --- Belgium ---
  mk({
    locationCode: 2056,
    languageCode: "fr",
    label: "Belgium (national)",
    scope: "country",
    localModifier: "",
    country: "Belgium",
  }),
];

/** Given a city/region target, find its parent country entry — used as a
 *  graceful fallback when DataforSEO doesn't return data for the city
 *  code (either the code is wrong or the city is too small for Google
 *  Keyword Planner data). */
export function getCountryFallback(target: LocationTarget): LocationTarget | null {
  if (target.scope === "country") return null;
  return (
    LOCATION_TARGETS.find(
      (t) => t.scope === "country" && t.country === target.country,
    ) ?? null
  );
}

/** Resolve a free-text or label string to a LocationTarget. Returns null
 *  when no match is confident enough — caller falls back to the client's
 *  default geo (from client-geo.ts). */
export function findLocationTarget(raw: string | null | undefined): LocationTarget | null {
  if (!raw) return null;
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  // Exact label match first.
  const exact = LOCATION_TARGETS.find((t) => t.label.toLowerCase() === q);
  if (exact) return exact;
  // localModifier exact (e.g. "Lisboa" → Lisbon target).
  const byMod = LOCATION_TARGETS.find(
    (t) => t.localModifier && t.localModifier.toLowerCase() === q,
  );
  if (byMod) return byMod;
  // Substring match against the searchKey.
  const subs = LOCATION_TARGETS.find((t) => t.searchKey.includes(q));
  return subs ?? null;
}

/** UI helper: group entries by country so the select renders as
 *  <optgroup label="Portugal"><option>...</option></optgroup>. */
export function groupLocationTargets(): { country: string; entries: LocationTarget[] }[] {
  const order: string[] = [];
  const map = new Map<string, LocationTarget[]>();
  for (const t of LOCATION_TARGETS) {
    if (!map.has(t.country)) {
      map.set(t.country, []);
      order.push(t.country);
    }
    map.get(t.country)!.push(t);
  }
  return order.map((country) => ({ country, entries: map.get(country)! }));
}
