// SEO Directories — the agency's shared backlink-directory database.
//
// Seeded from the Wonder Ads Free + Paid Backlink Directories Libraries
// (Notion), deduped by registrable domain so http/https/www and subdomain
// variants collapse to one entry. Once the team edits the database in-app it
// lives in Vercel KV (see seo-directories-store.ts); this SEED is the
// first-run data + the fallback when KV is empty/unconfigured.
//
// Matching against a client uses `languages` (market language), `countries`
// (geo relevance) and `tags`/`general` (niche fit) — see seo-directory-match.ts.

export type SpamScore = "very-low" | "low" | "medium" | "high";

export type SeoDirectory = {
  id: string;
  name: string;
  url: string;
  /** Raw niche/industry label as written in the library. */
  niche: string;
  /** Normalized niche tags used for client matching (e.g. ["fitness","health"]). */
  tags: string[];
  /** True when the directory accepts any business niche (business / local /
   *  reviews / classifieds / maps / expat) — always relevant for citations. */
  general: boolean;
  /** Market languages the directory serves: "pt", "en", … */
  languages: string[];
  /** Country tokens: PT, ES, UK, US, AU, CA, IN, AE, BS, EU, GLOBAL. */
  countries: string[];
  da: number | null;
  dr: number | null;
  organicTraffic: number | null;
  spamScore: SpamScore | null;
  submission: string;
  paid: boolean;
};

export const SPAM_SCORES: SpamScore[] = ["very-low", "low", "medium", "high"];

export const SPAM_LABELS: Record<SpamScore, string> = {
  "very-low": "Very Low",
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Human labels for the country tokens used in `countries`. */
export const COUNTRY_LABELS: Record<string, string> = {
  PT: "Portugal",
  ES: "Spain",
  UK: "United Kingdom",
  US: "United States",
  AU: "Australia",
  CA: "Canada",
  IN: "India",
  AE: "UAE",
  BS: "Bahamas",
  EU: "Europe",
  GLOBAL: "Global",
};

export const LANGUAGE_LABELS: Record<string, string> = {
  pt: "Português",
  en: "English",
};

const KNOWN_COUNTRIES = Object.keys(COUNTRY_LABELS);
const MAX_DIRECTORIES = 5000;

function str(v: unknown, max: number, fallback = ""): string {
  return typeof v === "string" && v.trim().length > 0
    ? v.trim().slice(0, max)
    : fallback;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

function strList(v: unknown, lower = false): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = typeof x === "string" ? x.trim() : "";
    if (!s) continue;
    const val = lower ? s.toLowerCase() : s;
    if (!out.includes(val)) out.push(val.slice(0, 40));
  }
  return out;
}

/** Stable id from the registrable-ish slug of a URL, used for new rows. */
export function directoryIdFromUrl(url: string): string {
  const host = url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
  const slug = host.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `dir-${slug || Math.random().toString(36).slice(2, 8)}`;
}

/** Validate + clamp an arbitrary array into clean SeoDirectory records.
 *  Used on every KV write so a malformed client payload can't poison the
 *  store. Unknown spam scores fall back to null; unknown country tokens
 *  are dropped. */
export function sanitizeDirectories(arr: unknown): SeoDirectory[] {
  if (!Array.isArray(arr)) return [];
  const out: SeoDirectory[] = [];
  const seenIds = new Set<string>();
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const d = raw as Record<string, unknown>;
    const url = str(d.url, 500);
    if (!url) continue;
    let id = str(d.id, 80) || directoryIdFromUrl(url);
    while (seenIds.has(id)) id = `${id}-${seenIds.size}`;
    seenIds.add(id);
    const spamRaw = str(d.spamScore, 20).toLowerCase();
    const spamScore = (SPAM_SCORES as string[]).includes(spamRaw)
      ? (spamRaw as SpamScore)
      : null;
    const countries = strList(d.countries).filter((c) =>
      KNOWN_COUNTRIES.includes(c),
    );
    const languages = strList(d.languages, true);
    out.push({
      id,
      name: str(d.name, 200) || url,
      url,
      niche: str(d.niche, 200),
      tags: strList(d.tags, true),
      general: d.general === true,
      languages: languages.length ? languages : ["en"],
      countries: countries.length ? countries : ["GLOBAL"],
      da: numOrNull(d.da),
      dr: numOrNull(d.dr),
      organicTraffic: numOrNull(d.organicTraffic),
      spamScore,
      submission: str(d.submission, 500),
      paid: d.paid === true,
    });
    if (out.length >= MAX_DIRECTORIES) break;
  }
  return out;
}

export const SEED_DIRECTORIES: SeoDirectory[] = [
  {
    "id": "dir-google-com",
    "name": "Google Business Profile",
    "url": "https://www.google.com/business/",
    "niche": "Local Business Listings",
    "tags": [
      "business",
      "local"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 100,
    "dr": 98,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Free — verify business",
    "paid": false
  },
  {
    "id": "dir-apple-com",
    "name": "Apple Business Connect",
    "url": "https://businessconnect.apple.com",
    "niche": "Map / Local Listings",
    "tags": [
      "business",
      "local"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 95,
    "dr": 96,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Free — verify business",
    "paid": false
  },
  {
    "id": "dir-yelp-com",
    "name": "Yelp",
    "url": "https://www.yelp.com",
    "niche": "Reviews / Local Business",
    "tags": [
      "business",
      "reviews"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 93,
    "dr": 93,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Free — claim business",
    "paid": false
  },
  {
    "id": "dir-tripadvisor-com",
    "name": "TripAdvisor",
    "url": "https://www.tripadvisor.com",
    "niche": "Travel / Hospitality Directory",
    "tags": [
      "travel"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 93,
    "dr": 94,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Free — claim listing",
    "paid": false
  },
  {
    "id": "dir-openstreetmap-org",
    "name": "Openstreetmap",
    "url": "https://www.openstreetmap.org",
    "niche": "Map / Location Directory",
    "tags": [
      "local"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 92,
    "dr": 93,
    "organicTraffic": 9000000,
    "spamScore": "very-low",
    "submission": "Add business location",
    "paid": false
  },
  {
    "id": "dir-bingplaces-com",
    "name": "Bingplaces",
    "url": "https://www.bingplaces.com",
    "niche": "Local Listings",
    "tags": [
      "business",
      "local"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 92,
    "dr": 93,
    "organicTraffic": 20000000,
    "spamScore": "very-low",
    "submission": "Add business",
    "paid": false
  },
  {
    "id": "dir-trustpilot-com",
    "name": "Trustpilot",
    "url": "https://www.trustpilot.com",
    "niche": "Reviews Platform",
    "tags": [
      "reviews"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 92,
    "dr": 93,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Free — claim business",
    "paid": false
  },
  {
    "id": "dir-foursquare-com",
    "name": "Foursquare",
    "url": "https://foursquare.com",
    "niche": "Local Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 92,
    "dr": 92,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-yellowpages-com",
    "name": "Yellow Pages (US)",
    "url": "https://www.yellowpages.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 92,
    "dr": 92,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-bbb-org",
    "name": "Better Business Bureau",
    "url": "https://www.bbb.org",
    "niche": "Business / Reviews",
    "tags": [
      "business",
      "reviews"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 92,
    "dr": 93,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Business profile",
    "paid": false
  },
  {
    "id": "dir-crunchbase-com",
    "name": "Crunchbase",
    "url": "https://www.crunchbase.com",
    "niche": "Startup / Business Database",
    "tags": [
      "business",
      "startup"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 91,
    "dr": 92,
    "organicTraffic": 6000000,
    "spamScore": "very-low",
    "submission": "Create company profile",
    "paid": false
  },
  {
    "id": "dir-g2-com",
    "name": "G2",
    "url": "https://www.g2.com",
    "niche": "Software Reviews Directory",
    "tags": [
      "reviews",
      "software",
      "tech"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 91,
    "dr": 92,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Claim product",
    "paid": false
  },
  {
    "id": "dir-producthunt-com",
    "name": "Product Hunt",
    "url": "https://www.producthunt.com",
    "niche": "Startup / Tech Directory",
    "tags": [
      "startup",
      "tech"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 91,
    "dr": 92,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Submit product",
    "paid": false
  },
  {
    "id": "dir-houzz-com",
    "name": "Houzz",
    "url": "https://www.houzz.com",
    "niche": "Home Services Directory",
    "tags": [
      "services"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 90,
    "dr": 91,
    "organicTraffic": 20000000,
    "spamScore": "very-low",
    "submission": "Business account",
    "paid": false
  },
  {
    "id": "dir-capterra-com",
    "name": "Capterra",
    "url": "https://www.capterra.com",
    "niche": "Software Directory",
    "tags": [
      "software",
      "tech"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 90,
    "dr": 91,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Vendor profile",
    "paid": false
  },
  {
    "id": "dir-dnb-com",
    "name": "Dun & Bradstreet",
    "url": "https://www.dnb.com",
    "niche": "B2B Business Data",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 90,
    "dr": 91,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Business profile",
    "paid": false
  },
  {
    "id": "dir-healthgrades-com",
    "name": "Healthgrades",
    "url": "https://www.healthgrades.com",
    "niche": "Health / Medical Directory",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 90,
    "dr": 91,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Provider profile",
    "paid": false
  },
  {
    "id": "dir-yell-com",
    "name": "Yell",
    "url": "https://www.yell.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 89,
    "dr": 90,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-mapquest-com",
    "name": "Mapquest",
    "url": "https://www.mapquest.com",
    "niche": "Map / Local Listings",
    "tags": [
      "business",
      "local"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 88,
    "dr": 89,
    "organicTraffic": 7000000,
    "spamScore": "very-low",
    "submission": "Business location",
    "paid": false
  },
  {
    "id": "dir-sitejabber-com",
    "name": "Sitejabber",
    "url": "https://www.sitejabber.com",
    "niche": "Review Platform",
    "tags": [
      "reviews"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 88,
    "dr": 90,
    "organicTraffic": 4000000,
    "spamScore": "very-low",
    "submission": "Claim business",
    "paid": false
  },
  {
    "id": "dir-clutch-co",
    "name": "Clutch",
    "url": "https://clutch.co",
    "niche": "B2B Company Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 86,
    "dr": 89,
    "organicTraffic": 2000000,
    "spamScore": "very-low",
    "submission": "Company profile",
    "paid": false
  },
  {
    "id": "dir-justdial-com",
    "name": "Justdial",
    "url": "https://www.justdial.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "IN"
    ],
    "da": 82,
    "dr": 84,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-manta-com",
    "name": "Manta",
    "url": "https://www.manta.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US",
      "GLOBAL"
    ],
    "da": 80,
    "dr": 85,
    "organicTraffic": 3000000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-gust-com",
    "name": "Gust",
    "url": "https://gust.com",
    "niche": "Startup Platform",
    "tags": [
      "startup"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 80,
    "dr": 82,
    "organicTraffic": 900000,
    "spamScore": "low",
    "submission": "Startup registration",
    "paid": false
  },
  {
    "id": "dir-chamberofcommerce-com",
    "name": "Chamberofcommerce",
    "url": "https://www.chamberofcommerce.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 80,
    "dr": 85,
    "organicTraffic": 2000000,
    "spamScore": "very-low",
    "submission": "Business profile",
    "paid": false
  },
  {
    "id": "dir-merchantcircle-com",
    "name": "Merchantcircle",
    "url": "https://www.merchantcircle.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 78,
    "dr": 80,
    "organicTraffic": 1500000,
    "spamScore": "low",
    "submission": "Business profile",
    "paid": false
  },
  {
    "id": "dir-thomasnet-com",
    "name": "Thomasnet",
    "url": "https://www.thomasnet.com",
    "niche": "B2B Industrial Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 78,
    "dr": 80,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Company profile",
    "paid": false
  },
  {
    "id": "dir-doctoralia-pt",
    "name": "Doctoralia (PT)",
    "url": "https://www.doctoralia.pt",
    "niche": "Health / Medical Directory",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 78,
    "dr": 80,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Provider profile",
    "paid": false
  },
  {
    "id": "dir-hotfrog-com",
    "name": "Hotfrog",
    "url": "https://www.hotfrog.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 75,
    "dr": 78,
    "organicTraffic": 1200000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-bizcommunity-com",
    "name": "Bizcommunity",
    "url": "https://www.bizcommunity.com",
    "niche": "Business Network",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 74,
    "dr": 76,
    "organicTraffic": 900000,
    "spamScore": "low",
    "submission": "Account registration",
    "paid": false
  },
  {
    "id": "dir-catchafire-org",
    "name": "Catchafire",
    "url": "https://www.catchafire.org",
    "niche": "Professional Marketplace",
    "tags": [
      "professional"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 72,
    "dr": 74,
    "organicTraffic": 500000,
    "spamScore": "low",
    "submission": "Account registration",
    "paid": false
  },
  {
    "id": "dir-europages-co-uk",
    "name": "Europages",
    "url": "https://europages.co.uk",
    "niche": "B2B Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "EU"
    ],
    "da": 72,
    "dr": 75,
    "organicTraffic": 500000,
    "spamScore": "low",
    "submission": "Company registration",
    "paid": false
  },
  {
    "id": "dir-credihealth-com",
    "name": "Credihealth",
    "url": "https://credihealth.com/",
    "niche": "Health / Medical Platform",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 71,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-expat-com",
    "name": "Expat",
    "url": "https://www.expat.com/en/guide/europe/portugal/",
    "niche": "Expat Community & Directory",
    "tags": [
      "expat"
    ],
    "general": true,
    "languages": [
      "pt",
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 70,
    "dr": 75,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Account registration",
    "paid": false
  },
  {
    "id": "dir-homebeautiful-com-au",
    "name": "Homebeautiful",
    "url": "https://www.homebeautiful.com.au/",
    "niche": "Home & Lifestyle Magazine",
    "tags": [
      "lifestyle"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "AU"
    ],
    "da": 70,
    "dr": 75,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Editorial / guest post",
    "paid": false
  },
  {
    "id": "dir-mirror-co-uk",
    "name": "Mirror",
    "url": "https://directory.mirror.co.uk",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 500000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-yellow-place",
    "name": "Yellow",
    "url": "https://yellow.place",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 600000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-provenexpert-com",
    "name": "Provenexpert",
    "url": "https://www.provenexpert.com",
    "niche": "Reviews Directory",
    "tags": [
      "reviews"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 600000,
    "spamScore": "low",
    "submission": "Business profile",
    "paid": false
  },
  {
    "id": "dir-brownbook-net",
    "name": "Brownbook",
    "url": "https://www.brownbook.net",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 700000,
    "spamScore": "low",
    "submission": "Submit business",
    "paid": false
  },
  {
    "id": "dir-reviewcentre-com",
    "name": "Reviewcentre",
    "url": "https://www.reviewcentre.com",
    "niche": "Review Directory",
    "tags": [
      "reviews"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 70,
    "dr": 71,
    "organicTraffic": 900000,
    "spamScore": "low",
    "submission": "Claim listing",
    "paid": false
  },
  {
    "id": "dir-cybo-com",
    "name": "Cybo",
    "url": "https://www.cybo.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 900000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-ezlocal-com",
    "name": "Ezlocal",
    "url": "https://ezlocal.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 500000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-enrollbusiness-com",
    "name": "Enrollbusiness",
    "url": "https://us.enrollbusiness.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 500000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-scoot-co-uk",
    "name": "Scoot",
    "url": "https://www.scoot.co.uk",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 70,
    "dr": 71,
    "organicTraffic": 400000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-salespider-com",
    "name": "Salespider",
    "url": "https://salespider.com",
    "niche": "Business Network",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 70,
    "dr": 71,
    "organicTraffic": 350000,
    "spamScore": "low",
    "submission": "Business registration",
    "paid": false
  },
  {
    "id": "dir-citysquares-com",
    "name": "Citysquares",
    "url": "https://citysquares.com",
    "niche": "Local Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 200000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-csslight-com",
    "name": "Csslight",
    "url": "https://www.csslight.com",
    "niche": "Web Design Directory",
    "tags": [
      "webdesign"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 250000,
    "spamScore": "low",
    "submission": "Submit website",
    "paid": false
  },
  {
    "id": "dir-hotfrog-ca",
    "name": "Hotfrog",
    "url": "https://hotfrog.ca",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "CA"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 300000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-trustburn-com",
    "name": "Trustburn",
    "url": "https://trustburn.com",
    "niche": "Reviews Platform",
    "tags": [
      "reviews"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 700000,
    "spamScore": "low",
    "submission": "Claim listing",
    "paid": false
  },
  {
    "id": "dir-hotfrog-co-uk",
    "name": "Hotfrog",
    "url": "https://www.hotfrog.co.uk",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": 600000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-worten-pt",
    "name": "Worten",
    "url": "https://www.worten.pt/guest-post",
    "niche": "E-commerce / Technology Retail",
    "tags": [
      "ecommerce",
      "tech"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 70,
    "dr": 75,
    "organicTraffic": 3000000,
    "spamScore": "very-low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-topdoctors-pt",
    "name": "Top Doctors (PT)",
    "url": "https://www.topdoctors.pt",
    "niche": "Health / Medical Directory",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 70,
    "dr": 72,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Provider profile",
    "paid": false
  },
  {
    "id": "dir-kompass-com",
    "name": "Kompass",
    "url": "https://pt.kompass.com/",
    "niche": "B2B Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT",
      "GLOBAL"
    ],
    "da": 68,
    "dr": 70,
    "organicTraffic": 30000,
    "spamScore": "very-low",
    "submission": "Business registration",
    "paid": false
  },
  {
    "id": "dir-elocal-com",
    "name": "Elocal",
    "url": "https://elocal.com",
    "niche": "Local Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 68,
    "dr": 70,
    "organicTraffic": 300000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-europages-pt",
    "name": "Europages",
    "url": "https://www.europages.pt/",
    "niche": "B2B International Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 65,
    "dr": 75,
    "organicTraffic": 40000,
    "spamScore": "very-low",
    "submission": "Business registration",
    "paid": false
  },
  {
    "id": "dir-hotfrog-com-au",
    "name": "Hotfrog",
    "url": "https://www.hotfrog.com.au/",
    "niche": "Global Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "AU",
      "GLOBAL"
    ],
    "da": 65,
    "dr": 75,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Free listing + account",
    "paid": false
  },
  {
    "id": "dir-all-biz",
    "name": "All",
    "url": "https://all.biz",
    "niche": "Global B2B Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 65,
    "dr": 70,
    "organicTraffic": null,
    "spamScore": "very-low",
    "submission": "Business account",
    "paid": false
  },
  {
    "id": "dir-birminghammail-co-uk",
    "name": "Birminghammail",
    "url": "https://directory.birminghammail.co.uk",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 65,
    "dr": 67,
    "organicTraffic": 300000,
    "spamScore": "low",
    "submission": "Submit business",
    "paid": false
  },
  {
    "id": "dir-businessworld-in",
    "name": "Businessworld",
    "url": "https://businessworld.in",
    "niche": "Business News / Directory",
    "tags": [
      "business",
      "news"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "IN"
    ],
    "da": 65,
    "dr": 67,
    "organicTraffic": 400000,
    "spamScore": "low",
    "submission": "Account registration",
    "paid": false
  },
  {
    "id": "dir-openideo-com",
    "name": "Openideo",
    "url": "https://challenges.openideo.com",
    "niche": "Innovation Platform",
    "tags": [
      "startup"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 65,
    "dr": 66,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Account registration",
    "paid": false
  },
  {
    "id": "dir-tupalo-com",
    "name": "Tupalo",
    "url": "http://tupalo.com",
    "niche": "Local Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 65,
    "dr": 67,
    "organicTraffic": 400000,
    "spamScore": "low",
    "submission": "Business profile",
    "paid": false
  },
  {
    "id": "dir-callupcontact-com",
    "name": "Callupcontact",
    "url": "https://www.callupcontact.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 65,
    "dr": 68,
    "organicTraffic": 350000,
    "spamScore": "low",
    "submission": "Submit profile",
    "paid": false
  },
  {
    "id": "dir-ezilon-com",
    "name": "Ezilon",
    "url": "https://www.ezilon.com",
    "niche": "Web Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 65,
    "dr": 66,
    "organicTraffic": 250000,
    "spamScore": "low",
    "submission": "Submit site",
    "paid": false
  },
  {
    "id": "dir-startus-cc",
    "name": "Startus",
    "url": "https://www.startus.cc",
    "niche": "Startup Platform",
    "tags": [
      "startup"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "EU"
    ],
    "da": 65,
    "dr": 67,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Startup registration",
    "paid": false
  },
  {
    "id": "dir-tuugo-us",
    "name": "Tuugo",
    "url": "https://tuugo.us",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 65,
    "dr": 66,
    "organicTraffic": 300000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-trustlink-org",
    "name": "Trustlink",
    "url": "https://www.trustlink.org",
    "niche": "Review Directory",
    "tags": [
      "reviews"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 65,
    "dr": 67,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Claim listing",
    "paid": false
  },
  {
    "id": "dir-opendi-us",
    "name": "Opendi",
    "url": "https://www.opendi.us",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 65,
    "dr": 67,
    "organicTraffic": 200000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-smartguy-com",
    "name": "Smartguy",
    "url": "https://www.smartguy.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 65,
    "dr": 67,
    "organicTraffic": 250000,
    "spamScore": "low",
    "submission": "Business profile",
    "paid": false
  },
  {
    "id": "dir-mylocalservices-co-uk",
    "name": "Mylocalservices",
    "url": "https://www.mylocalservices.co.uk",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 65,
    "dr": 67,
    "organicTraffic": 200000,
    "spamScore": "low",
    "submission": "Business profile",
    "paid": false
  },
  {
    "id": "dir-ordemdospsicologos-pt",
    "name": "Ordemdospsicologos",
    "url": "https://www.ordemdospsicologos.pt/pt",
    "niche": "Official Psychology Association",
    "tags": [
      "health",
      "psychology"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 60,
    "dr": 65,
    "organicTraffic": 18000,
    "spamScore": "very-low",
    "submission": "Professional membership required",
    "paid": false
  },
  {
    "id": "dir-therapyroute-com",
    "name": "Therapyroute",
    "url": "https://www.therapyroute.com/therapists/portugal/1",
    "niche": "Global Therapist Directory",
    "tags": [
      "health",
      "psychology"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 70,
    "organicTraffic": 20000,
    "spamScore": "low",
    "submission": "Therapist profile registration",
    "paid": false
  },
  {
    "id": "dir-oneflare-com-au",
    "name": "Oneflare",
    "url": "https://www.oneflare.com.au/b/little-white-label",
    "niche": "Service Marketplace / Business Profile",
    "tags": [
      "business",
      "services"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "AU"
    ],
    "da": 60,
    "dr": 70,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Business registration + verification",
    "paid": false
  },
  {
    "id": "dir-getsurrey-co-uk",
    "name": "Getsurrey",
    "url": "https://directory.getsurrey.co.uk",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Submit business",
    "paid": false
  },
  {
    "id": "dir-dailypost-co-uk",
    "name": "Dailypost",
    "url": "https://directory.dailypost.co.uk",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Listing submission",
    "paid": false
  },
  {
    "id": "dir-leicestermercury-co-uk",
    "name": "Leicestermercury",
    "url": "https://directory.leicestermercury.co.uk",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Listing submission",
    "paid": false
  },
  {
    "id": "dir-plymouthherald-co-uk",
    "name": "Plymouthherald",
    "url": "https://directory.plymouthherald.co.uk",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Listing submission",
    "paid": false
  },
  {
    "id": "dir-hertfordshiremercury-co-uk",
    "name": "Hertfordshiremercury",
    "url": "https://directory.hertfordshiremercury.co.uk",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Listing submission",
    "paid": false
  },
  {
    "id": "dir-startupxplore-com",
    "name": "Startupxplore",
    "url": "https://startupxplore.com",
    "niche": "Startup Directory",
    "tags": [
      "startup"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "EU"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 120000,
    "spamScore": "low",
    "submission": "Startup profile",
    "paid": false
  },
  {
    "id": "dir-bahamaslocal-com",
    "name": "Bahamaslocal",
    "url": "https://www.bahamaslocal.com",
    "niche": "Local Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "BS"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 120000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-trepup-com",
    "name": "Trepup",
    "url": "https://www.trepup.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 120000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-lacartes-com",
    "name": "Lacartes",
    "url": "http://www.lacartes.com",
    "niche": "Local Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 120000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-findit-com",
    "name": "Findit",
    "url": "https://www.findit.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-1businessworld-com",
    "name": "1businessworld",
    "url": "https://1businessworld.com",
    "niche": "Business Network",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Business account",
    "paid": false
  },
  {
    "id": "dir-azbusinessfinder-com",
    "name": "Azbusinessfinder",
    "url": "https://www.azbusinessfinder.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 120000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-iglobal-co",
    "name": "Iglobal",
    "url": "https://www.iglobal.co",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 120000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-consultants500-com",
    "name": "Consultants500",
    "url": "https://www.consultants500.com",
    "niche": "Consultant Directory",
    "tags": [
      "consulting"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 61,
    "organicTraffic": 100000,
    "spamScore": "low",
    "submission": "Consultant profile",
    "paid": false
  },
  {
    "id": "dir-getlisteduae-com",
    "name": "Getlisteduae",
    "url": "https://www.getlisteduae.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "AE"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 120000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-localpages-com",
    "name": "Localpages",
    "url": "https://www.localpages.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-trueen-com",
    "name": "Trueen",
    "url": "https://trueen.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-bizidex-com",
    "name": "Bizidex",
    "url": "https://bizidex.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 61,
    "organicTraffic": 120000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-insertbiz-com",
    "name": "Insertbiz",
    "url": "https://www.insertbiz.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 61,
    "organicTraffic": 110000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-zumvu-com",
    "name": "Zumvu",
    "url": "https://zumvu.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 60,
    "dr": 62,
    "organicTraffic": 150000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-lisboasecreta-co",
    "name": "Lisboasecreta",
    "url": "https://lisboasecreta.co/",
    "niche": "City Guide / Events & Lifestyle Blog",
    "tags": [
      "lifestyle",
      "travel"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 60,
    "dr": 65,
    "organicTraffic": 800000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-jm-madeira-pt",
    "name": "Jm-madeira",
    "url": "https://www.jm-madeira.pt/",
    "niche": "Regional News / Media",
    "tags": [
      "news"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 60,
    "dr": 65,
    "organicTraffic": 707000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-divine-ca",
    "name": "Divine",
    "url": "https://divine.ca",
    "niche": "Women's Lifestyle Magazine",
    "tags": [
      "lifestyle"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "CA"
    ],
    "da": 60,
    "dr": 65,
    "organicTraffic": 120000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-emedicodiary-com",
    "name": "Emedicodiary",
    "url": "https://emedicodiary.com/",
    "niche": "Medical Blog",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 59,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-healthgroovy-com",
    "name": "Healthgroovy",
    "url": "https://healthgroovy.com/",
    "niche": "Health Blog",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 59,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-addyp-com",
    "name": "Addyp",
    "url": "https://addyp.com/",
    "niche": "Global Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 56,
    "organicTraffic": 70000,
    "spamScore": "low",
    "submission": "Free listing account",
    "paid": false
  },
  {
    "id": "dir-wordofmouth-com-au",
    "name": "Wordofmouth",
    "url": "https://wordofmouth.com.au/",
    "niche": "Review & Business Directory",
    "tags": [
      "business",
      "reviews"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "AU"
    ],
    "da": 55,
    "dr": 60,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Business profile",
    "paid": false
  },
  {
    "id": "dir-bestplumbers-com",
    "name": "Bestplumbers",
    "url": "https://bestplumbers.com",
    "niche": "Services Directory",
    "tags": [
      "services"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 55,
    "dr": 57,
    "organicTraffic": 80000,
    "spamScore": "low",
    "submission": "Business registration",
    "paid": false
  },
  {
    "id": "dir-qdexx-com",
    "name": "Qdexx",
    "url": "https://qdexx.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 57,
    "organicTraffic": 90000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-techdirectory-io",
    "name": "Techdirectory",
    "url": "https://www.techdirectory.io",
    "niche": "Tech Directory",
    "tags": [
      "tech"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 57,
    "organicTraffic": 70000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-nextbizthing-com",
    "name": "Nextbizthing",
    "url": "https://www.nextbizthing.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 57,
    "organicTraffic": 80000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-askmap-net",
    "name": "Askmap",
    "url": "http://www.askmap.net",
    "niche": "Map Directory",
    "tags": [
      "local"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 56,
    "organicTraffic": 70000,
    "spamScore": "low",
    "submission": "Add business",
    "paid": false
  },
  {
    "id": "dir-announceamerica-com",
    "name": "Announceamerica",
    "url": "https://announceamerica.com",
    "niche": "Classifieds",
    "tags": [
      "classifieds"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 55,
    "dr": 57,
    "organicTraffic": 90000,
    "spamScore": "medium",
    "submission": "Classified submission",
    "paid": false
  },
  {
    "id": "dir-dibiz-com",
    "name": "Dibiz",
    "url": "https://www.dibiz.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 56,
    "organicTraffic": 80000,
    "spamScore": "low",
    "submission": "Business profile",
    "paid": false
  },
  {
    "id": "dir-place123-net",
    "name": "Place123",
    "url": "http://www.place123.net",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 56,
    "organicTraffic": 80000,
    "spamScore": "low",
    "submission": "Submit listing",
    "paid": false
  },
  {
    "id": "dir-find-us-here-com",
    "name": "Find-us-here",
    "url": "https://www.find-us-here.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 57,
    "organicTraffic": 80000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-freelistingusa-com",
    "name": "Freelistingusa",
    "url": "https://www.freelistingusa.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 55,
    "dr": 56,
    "organicTraffic": 70000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-macro-market",
    "name": "Macro",
    "url": "https://macro.market",
    "niche": "Marketplace",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 57,
    "organicTraffic": 80000,
    "spamScore": "low",
    "submission": "Seller account",
    "paid": false
  },
  {
    "id": "dir-businesslistingplus-com",
    "name": "Businesslistingplus",
    "url": "https://businesslistingplus.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 56,
    "organicTraffic": 70000,
    "spamScore": "low",
    "submission": "Listing submission",
    "paid": false
  },
  {
    "id": "dir-gostartups-in",
    "name": "Gostartups",
    "url": "http://gostartups.in",
    "niche": "Startup Directory",
    "tags": [
      "startup"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "IN"
    ],
    "da": 55,
    "dr": 57,
    "organicTraffic": 90000,
    "spamScore": "low",
    "submission": "Startup listing",
    "paid": false
  },
  {
    "id": "dir-bunity-com",
    "name": "Bunity",
    "url": "https://bunity.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 56,
    "organicTraffic": 80000,
    "spamScore": "low",
    "submission": "Listing submission",
    "paid": false
  },
  {
    "id": "dir-citybyapp-com",
    "name": "Citybyapp",
    "url": "https://www.citybyapp.com",
    "niche": "Local Business App",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 55,
    "dr": 57,
    "organicTraffic": 90000,
    "spamScore": "low",
    "submission": "Business registration",
    "paid": false
  },
  {
    "id": "dir-bizmaker-org",
    "name": "Bizmaker",
    "url": "https://www.bizmaker.org",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 56,
    "organicTraffic": 80000,
    "spamScore": "low",
    "submission": "Listing submission",
    "paid": false
  },
  {
    "id": "dir-peeplocal-com",
    "name": "Peeplocal",
    "url": "https://www.peeplocal.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 56,
    "organicTraffic": 80000,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-bizexposed-com",
    "name": "Bizexposed",
    "url": "https://www.bizexposed.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": 57,
    "organicTraffic": 70000,
    "spamScore": "low",
    "submission": "Listing submission",
    "paid": false
  },
  {
    "id": "dir-iberinform-pt",
    "name": "Iberinform",
    "url": "https://www.iberinform.pt/",
    "niche": "Corporate Data / Business Info",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT",
      "ES"
    ],
    "da": 55,
    "dr": 65,
    "organicTraffic": 12000,
    "spamScore": "very-low",
    "submission": "Paid / corporate",
    "paid": true
  },
  {
    "id": "dir-noticiasdecoimbra-pt",
    "name": "Noticiasdecoimbra",
    "url": "https://www.noticiasdecoimbra.pt/",
    "niche": "Regional News Website",
    "tags": [
      "news"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 55,
    "dr": 60,
    "organicTraffic": 180000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-yourhealthmagazine-net",
    "name": "Yourhealthmagazine",
    "url": "https://yourhealthmagazine.net",
    "niche": "Health Magazine / Medical Articles",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 55,
    "dr": 60,
    "organicTraffic": 45000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-beststartup-ca",
    "name": "Beststartup",
    "url": "https://beststartup.ca",
    "niche": "Startup / Business Blog",
    "tags": [
      "business",
      "startup"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "CA"
    ],
    "da": 55,
    "dr": 60,
    "organicTraffic": 60000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-healthmanagement-org",
    "name": "Healthmanagement",
    "url": "https://healthmanagement.org/",
    "niche": "Health Management / Medical",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 55,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-showmelocal-com",
    "name": "Showmelocal",
    "url": "https://global.showmelocal.com/country-pt",
    "niche": "Local Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 54,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-mundopsicologos-pt",
    "name": "Mundopsicologos",
    "url": "https://www.mundopsicologos.pt/",
    "niche": "Therapist Directory",
    "tags": [
      "health",
      "psychology"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 52,
    "dr": 60,
    "organicTraffic": 22000,
    "spamScore": "low",
    "submission": "Therapist registration",
    "paid": false
  },
  {
    "id": "dir-startlocal-com-au",
    "name": "Startlocal",
    "url": "https://startlocal.com.au/",
    "niche": "Local Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "AU"
    ],
    "da": 50,
    "dr": 55,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Free directory submission",
    "paid": false
  },
  {
    "id": "dir-postlistd-com",
    "name": "Postlistd",
    "url": "https://postlistd.com",
    "niche": "Classifieds",
    "tags": [
      "classifieds"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 50,
    "dr": 52,
    "organicTraffic": 50000,
    "spamScore": "medium",
    "submission": "Free classified",
    "paid": false
  },
  {
    "id": "dir-contractors-directory",
    "name": "Contractors",
    "url": "https://www.contractors.directory",
    "niche": "Contractors Directory",
    "tags": [
      "contractors",
      "services"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 50,
    "dr": 52,
    "organicTraffic": 60000,
    "spamScore": "low",
    "submission": "Contractor profile",
    "paid": false
  },
  {
    "id": "dir-webdirex-com",
    "name": "Webdirex",
    "url": "https://webdirex.com",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 50,
    "dr": 52,
    "organicTraffic": 40000,
    "spamScore": "low",
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-tasteoflisboa-com",
    "name": "Tasteoflisboa",
    "url": "https://www.tasteoflisboa.com/pt/contactos/",
    "niche": "Food Tours / Travel Experiences",
    "tags": [
      "food",
      "travel"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 50,
    "dr": 55,
    "organicTraffic": 45000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-lisbonlux-com",
    "name": "Lisbonlux",
    "url": "https://www.lisbonlux.com/about-us.html",
    "niche": "Lisbon Travel & Lifestyle Guide",
    "tags": [
      "lifestyle",
      "travel"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 50,
    "dr": 55,
    "organicTraffic": 70000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-tribunaalentejo-pt",
    "name": "Tribunaalentejo",
    "url": "https://www.tribunaalentejo.pt/",
    "niche": "Regional News / Media",
    "tags": [
      "news"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 50,
    "dr": 55,
    "organicTraffic": 70000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-theseeker-ca",
    "name": "Theseeker",
    "url": "https://theseeker.ca",
    "niche": "Local News / Lifestyle Blog",
    "tags": [
      "business",
      "lifestyle",
      "news"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "CA"
    ],
    "da": 50,
    "dr": 55,
    "organicTraffic": 25000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-guiadacidade-pt",
    "name": "Guiadacidade",
    "url": "https://www.guiadacidade.pt/pt",
    "niche": "Business / Tourism Directory",
    "tags": [
      "business",
      "travel"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 48,
    "dr": 50,
    "organicTraffic": 5000,
    "spamScore": "low",
    "submission": "Free account & business listing",
    "paid": false
  },
  {
    "id": "dir-nchstats-com",
    "name": "Nchstats",
    "url": "https://nchstats.com/",
    "niche": "Health Statistics Blog",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 48,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-myhuckleberry-com",
    "name": "Myhuckleberry",
    "url": "https://myhuckleberry.com",
    "niche": "Local Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 45,
    "dr": 50,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Free business profile",
    "paid": false
  },
  {
    "id": "dir-portugalundiscovered-com",
    "name": "Portugalundiscovered",
    "url": "https://portugalundiscovered.com/contact/",
    "niche": "Portugal Travel Guide",
    "tags": [
      "travel"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 45,
    "dr": 50,
    "organicTraffic": 30000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-fitness4all-pt",
    "name": "Fitness4all",
    "url": "https://www.fitness4all.pt/",
    "niche": "Fitness / Gym Network",
    "tags": [
      "fitness",
      "health"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 45,
    "dr": 50,
    "organicTraffic": 90000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-sheerme-com",
    "name": "Sheerme",
    "url": "https://blog.sheerme.com/",
    "niche": "Beauty & Wellness Platform Blog",
    "tags": [
      "beauty",
      "health"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 45,
    "dr": 50,
    "organicTraffic": 30000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-comercioenoticias-pt",
    "name": "Comercioenoticias",
    "url": "https://comercioenoticias.pt/",
    "niche": "Business & Economic News",
    "tags": [
      "business",
      "news"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 45,
    "dr": 50,
    "organicTraffic": 40000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-dianarangaves-com",
    "name": "Dianarangaves",
    "url": "https://dianarangaves.com/",
    "niche": "Health / Pharmacy Blog",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 45,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-evidencenetwork-ca",
    "name": "Evidencenetwork",
    "url": "https://evidencenetwork.ca/",
    "niche": "Health Policy / Medical",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "CA"
    ],
    "da": 45,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-directorioamarelo-pt",
    "name": "Directorioamarelo",
    "url": "http://www.directorioamarelo.pt/",
    "niche": "Yellow Pages Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 42,
    "dr": 45,
    "organicTraffic": 7000,
    "spamScore": "low",
    "submission": "Business listing registration",
    "paid": false
  },
  {
    "id": "dir-theweeklyhealthiness-net",
    "name": "Theweeklyhealthiness",
    "url": "https://theweeklyhealthiness.net/",
    "niche": "Health & Wellness Blog",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 41,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-misterwhat-pt",
    "name": "Misterwhat",
    "url": "https://www.misterwhat.pt/",
    "niche": "Local Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 40,
    "dr": 50,
    "organicTraffic": 7000,
    "spamScore": "low",
    "submission": "Free listing + verification",
    "paid": false
  },
  {
    "id": "dir-citationbuilderpro-com",
    "name": "Citationbuilderpro",
    "url": "https://citationbuilderpro.com",
    "niche": "Citation / SEO Service Platform",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 40,
    "dr": 45,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Paid citation service",
    "paid": false
  },
  {
    "id": "dir-mochiloesemochilinhas-com",
    "name": "Mochiloesemochilinhas",
    "url": "https://mochiloesemochilinhas.com/",
    "niche": "Travel Blog",
    "tags": [
      "travel"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 40,
    "dr": 45,
    "organicTraffic": 25000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-dobem-pt",
    "name": "Dobem",
    "url": "https://dobem.pt/c",
    "niche": "Health / Wellness Blog",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 40,
    "dr": 45,
    "organicTraffic": 15000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-portuguesesoul-com",
    "name": "Portuguesesoul",
    "url": "https://portuguesesoul.com/",
    "niche": "Portuguese Culture / Lifestyle Blog",
    "tags": [
      "lifestyle"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 40,
    "dr": 45,
    "organicTraffic": 20000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-businesslane-ca",
    "name": "Businesslane",
    "url": "https://www.businesslane.ca",
    "niche": "Business / Startup Blog",
    "tags": [
      "business",
      "startup"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "CA"
    ],
    "da": 40,
    "dr": 45,
    "organicTraffic": 15000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-ap-to-pt",
    "name": "Ap-to",
    "url": "https://www.ap-to.pt/",
    "niche": "Occupational Therapy Association",
    "tags": [
      "health",
      "psychology"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 38,
    "dr": 40,
    "organicTraffic": 1500,
    "spamScore": "low",
    "submission": "Professional membership",
    "paid": false
  },
  {
    "id": "dir-portugalconnexions-com",
    "name": "Portugalconnexions",
    "url": "https://portugalconnexions.com",
    "niche": "Expat / Business Directory",
    "tags": [
      "business",
      "expat"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 38,
    "dr": 40,
    "organicTraffic": 3500,
    "spamScore": "low",
    "submission": "Business profile registration",
    "paid": false
  },
  {
    "id": "dir-cuteblessings-com",
    "name": "Cuteblessings",
    "url": "https://cuteblessings.com/",
    "niche": "Lifestyle & Wellness Blog",
    "tags": [
      "health",
      "lifestyle"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 38,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-mind-help",
    "name": "Mind",
    "url": "https://mind.help/",
    "niche": "Mental Health / Psychology",
    "tags": [
      "health",
      "psychology"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 38,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-thoracickey-com",
    "name": "Thoracickey",
    "url": "https://thoracickey.com/",
    "niche": "Medical Reference",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 37,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-awwwards-com",
    "name": "Awwwards",
    "url": "https://www.awwwards.com/",
    "niche": "Web Design / Awards",
    "tags": [
      "webdesign"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 35,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Submit project",
    "paid": false
  },
  {
    "id": "dir-localsolution-com",
    "name": "Localsolution",
    "url": "https://localsolution.com",
    "niche": "Local Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 35,
    "dr": 40,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Business listing",
    "paid": false
  },
  {
    "id": "dir-amodadoflavio-pt",
    "name": "Amodadoflavio",
    "url": "https://amodadoflavio.pt/contacto/",
    "niche": "Lifestyle / Fashion Blog",
    "tags": [
      "fashion",
      "lifestyle"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 35,
    "dr": 40,
    "organicTraffic": 15000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-dicasetricas-com",
    "name": "Dicasetricas",
    "url": "https://www.dicasetricas.com/",
    "niche": "Lifestyle / Tips Blog",
    "tags": [
      "lifestyle"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 35,
    "dr": 40,
    "organicTraffic": 12000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-leca-palmeira-com",
    "name": "Leca-palmeira",
    "url": "https://www.leca-palmeira.com/",
    "niche": "Local Community / Tourism Portal",
    "tags": [
      "business",
      "expat",
      "travel"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 35,
    "dr": 40,
    "organicTraffic": 8000,
    "spamScore": "low",
    "submission": "Paid",
    "paid": true
  },
  {
    "id": "dir-counselingnow-com",
    "name": "Counselingnow",
    "url": "https://counselingnow.com/",
    "niche": "Counseling / Therapy Directory",
    "tags": [
      "health",
      "psychology"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "US"
    ],
    "da": 35,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Therapist profile / outreach",
    "paid": false
  },
  {
    "id": "dir-psicologos-com-pt",
    "name": "Psicologos",
    "url": "https://psicologos.com.pt/",
    "niche": "Psychologists Directory",
    "tags": [
      "health",
      "psychology"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 33,
    "dr": 35,
    "organicTraffic": 2000,
    "spamScore": "low",
    "submission": "Register psychologist profile",
    "paid": false
  },
  {
    "id": "dir-guianet-pt",
    "name": "Guianet",
    "url": "https://www.guianet.pt/pt",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 33,
    "dr": 35,
    "organicTraffic": 2500,
    "spamScore": "low",
    "submission": "Free business listing",
    "paid": false
  },
  {
    "id": "dir-unisaude-pt",
    "name": "Unisaude",
    "url": "https://unisaude.pt/",
    "niche": "Health / Medical Directory",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 33,
    "dr": 35,
    "organicTraffic": 3000,
    "spamScore": "low",
    "submission": "Professional registration",
    "paid": false
  },
  {
    "id": "dir-superpages-com-au",
    "name": "Superpages",
    "url": "https://www.superpages.com.au/",
    "niche": "Local Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "en"
    ],
    "countries": [
      "AU"
    ],
    "da": 33,
    "dr": 35,
    "organicTraffic": null,
    "spamScore": "low",
    "submission": "Free business listing",
    "paid": false
  },
  {
    "id": "dir-psico-org",
    "name": "Psico",
    "url": "https://www.psico.org/",
    "niche": "Psychology Organization",
    "tags": [
      "health",
      "psychology"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 32,
    "dr": 35,
    "organicTraffic": 800,
    "spamScore": "low",
    "submission": "Member or professional profile",
    "paid": false
  },
  {
    "id": "dir-hotfrog-pt",
    "name": "Hotfrog",
    "url": "https://www.hotfrog.pt/",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT",
      "GLOBAL"
    ],
    "da": 32,
    "dr": 40,
    "organicTraffic": 8000,
    "spamScore": "low",
    "submission": "Free business listing",
    "paid": false
  },
  {
    "id": "dir-classi4u-com",
    "name": "Classi4u",
    "url": "https://pt.classi4u.com/",
    "niche": "Classifieds / Directory",
    "tags": [
      "classifieds"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 32,
    "dr": 35,
    "organicTraffic": 2000,
    "spamScore": "medium",
    "submission": "Free classified submission",
    "paid": false
  },
  {
    "id": "dir-healthsciencesforum-co-uk",
    "name": "Healthsciencesforum",
    "url": "https://healthsciencesforum.co.uk/",
    "niche": "Health Sciences Forum",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "UK"
    ],
    "da": 32,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-expatsportugal-com",
    "name": "Expatsportugal",
    "url": "https://expatsportugal.com/",
    "niche": "Expat / Community Directory",
    "tags": [
      "expat"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 30,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Account registration",
    "paid": false
  },
  {
    "id": "dir-rigorbiz-pt",
    "name": "Rigorbiz",
    "url": "https://www.rigorbiz.pt/",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 30,
    "dr": 35,
    "organicTraffic": 1500,
    "spamScore": "low",
    "submission": "Submit company details",
    "paid": false
  },
  {
    "id": "dir-portuguesetherapists-com",
    "name": "Portuguesetherapists",
    "url": "https://portuguesetherapists.com/",
    "niche": "Therapist Directory",
    "tags": [
      "health",
      "psychology"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 30,
    "dr": 35,
    "organicTraffic": 900,
    "spamScore": "low",
    "submission": "Therapist profile submission",
    "paid": false
  },
  {
    "id": "dir-greenheal-net",
    "name": "Greenheal",
    "url": "https://greenheal.net/",
    "niche": "Health & Wellness Blog",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "en"
    ],
    "countries": [
      "GLOBAL"
    ],
    "da": 30,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": false
  },
  {
    "id": "dir-guiaempresas-pt",
    "name": "Guiaempresas",
    "url": "https://guiaempresas.pt/",
    "niche": "Company Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 28,
    "dr": 32,
    "organicTraffic": 1400,
    "spamScore": "low",
    "submission": "Free submission",
    "paid": false
  },
  {
    "id": "dir-cognitivas-org",
    "name": "Cognitivas",
    "url": "https://www.cognitivas.org/",
    "niche": "Psychology / Therapy Organization",
    "tags": [
      "health",
      "psychology"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 28,
    "dr": 30,
    "organicTraffic": 600,
    "spamScore": "low",
    "submission": "Professional membership",
    "paid": false
  },
  {
    "id": "dir-cylex-pt",
    "name": "Cylex",
    "url": "https://www.cylex.pt/",
    "niche": "Local Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 28,
    "dr": 35,
    "organicTraffic": 9000,
    "spamScore": "low",
    "submission": "Free listing submission",
    "paid": false
  },
  {
    "id": "dir-portugal-com-pt",
    "name": "Portugal",
    "url": "https://www.portugal.com.pt/",
    "niche": "Business / Services Directory",
    "tags": [
      "business",
      "services"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 28,
    "dr": 30,
    "organicTraffic": 2200,
    "spamScore": "low",
    "submission": "Free registration",
    "paid": false
  },
  {
    "id": "dir-portugalbusinessnews-com",
    "name": "Portugalbusinessnews",
    "url": "https://www.portugalbusinessnews.com/",
    "niche": "Business / News",
    "tags": [
      "business",
      "news"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 27,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Submit / editorial",
    "paid": false
  },
  {
    "id": "dir-heyportugal-com",
    "name": "Heyportugal",
    "url": "https://www.heyportugal.com/index.php/directory",
    "niche": "Business / Tourism Directory",
    "tags": [
      "business",
      "travel"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 27,
    "dr": 30,
    "organicTraffic": 900,
    "spamScore": "low",
    "submission": "Business profile submission",
    "paid": false
  },
  {
    "id": "dir-sptf-org-pt",
    "name": "Sptf",
    "url": "https://sptf.org.pt/",
    "niche": "Professional Therapy Organization",
    "tags": [
      "health",
      "psychology"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 27,
    "dr": 30,
    "organicTraffic": 700,
    "spamScore": "low",
    "submission": "Member registration",
    "paid": false
  },
  {
    "id": "dir-portugalempresas-pt",
    "name": "Portugalempresas",
    "url": "https://www.portugalempresas.pt/",
    "niche": "Company Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 27,
    "dr": 30,
    "organicTraffic": 1800,
    "spamScore": "low",
    "submission": "Business registration",
    "paid": false
  },
  {
    "id": "dir-bussola-pt-com",
    "name": "Bussola-pt",
    "url": "https://bussola-pt.com/",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 25,
    "dr": 30,
    "organicTraffic": 800,
    "spamScore": "low",
    "submission": "Free business listing form",
    "paid": false
  },
  {
    "id": "dir-portugaldirectory-pt",
    "name": "Portugaldirectory",
    "url": "https://portugaldirectory.pt/",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 25,
    "dr": 30,
    "organicTraffic": 1000,
    "spamScore": "low",
    "submission": "Free listing form",
    "paid": false
  },
  {
    "id": "dir-horario-loja-pt",
    "name": "Horario-loja",
    "url": "https://horario-loja.pt/",
    "niche": "Store / Business Listings",
    "tags": [
      "business",
      "local"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 24,
    "dr": 28,
    "organicTraffic": 1600,
    "spamScore": "low",
    "submission": "Add business account",
    "paid": false
  },
  {
    "id": "dir-acompio-pt",
    "name": "Acompio",
    "url": "https://www.acompio.pt/",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 22,
    "dr": 25,
    "organicTraffic": 600,
    "spamScore": "low",
    "submission": "Free business listing",
    "paid": false
  },
  {
    "id": "dir-rotanacional-pt",
    "name": "Rotanacional",
    "url": "http://www.rotanacional.pt/",
    "niche": "Local Business Listings",
    "tags": [
      "business",
      "local"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 22,
    "dr": 27,
    "organicTraffic": 600,
    "spamScore": "low",
    "submission": "Manual submission",
    "paid": false
  },
  {
    "id": "dir-guiadooeste-pt",
    "name": "Guiadooeste",
    "url": "https://www.guiadooeste.pt/",
    "niche": "Regional Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 22,
    "dr": 25,
    "organicTraffic": 500,
    "spamScore": "low",
    "submission": "Manual listing submission",
    "paid": false
  },
  {
    "id": "dir-servicospt-com",
    "name": "Servicospt",
    "url": "https://servicospt.com/",
    "niche": "Services Directory",
    "tags": [
      "services"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 22,
    "dr": 25,
    "organicTraffic": 700,
    "spamScore": "low",
    "submission": "Free service listing",
    "paid": false
  },
  {
    "id": "dir-aveiro-com-pt",
    "name": "Aveiro",
    "url": "https://www.vougagourmet.aveiro.com.pt/",
    "niche": "Local Food / Business Directory",
    "tags": [
      "business",
      "food"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 22,
    "dr": 25,
    "organicTraffic": 400,
    "spamScore": "low",
    "submission": "Manual listing",
    "paid": false
  },
  {
    "id": "dir-portugalxxi-pt",
    "name": "Portugalxxi",
    "url": "https://www.portugalxxi.pt/index.php",
    "niche": "Business & Tourism Directory",
    "tags": [
      "business",
      "travel"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 22,
    "dr": 25,
    "organicTraffic": 600,
    "spamScore": "low",
    "submission": "Manual submission",
    "paid": false
  },
  {
    "id": "dir-colist-eu",
    "name": "Colist",
    "url": "https://www.colist.eu/companylist.php?lang=pt&land_id=34",
    "niche": "Company Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT",
      "EU"
    ],
    "da": 21,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Company listing",
    "paid": false
  },
  {
    "id": "dir-enests-co",
    "name": "Enests",
    "url": "https://enests.co/",
    "niche": "Business Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 20,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Free listing",
    "paid": false
  },
  {
    "id": "dir-guiadigitaldeportugal-pt",
    "name": "Guiadigitaldeportugal",
    "url": "https://guiadigitaldeportugal.pt/",
    "niche": "Business / Digital Directory",
    "tags": [
      "business"
    ],
    "general": true,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": 20,
    "dr": 25,
    "organicTraffic": 500,
    "spamScore": "low",
    "submission": "Registration required",
    "paid": false
  },
  {
    "id": "dir-noticiasdeaveiro-pt",
    "name": "Noticiasdeaveiro",
    "url": "https://noticiasdeaveiro.pt/",
    "niche": "Regional News / Media",
    "tags": [
      "news"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": null,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": true
  },
  {
    "id": "dir-asenhoradomonte-com",
    "name": "Asenhoradomonte",
    "url": "https://www.asenhoradomonte.com/",
    "niche": "Lifestyle / Wellness Blog",
    "tags": [
      "health",
      "lifestyle"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": null,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": true
  },
  {
    "id": "dir-profissionaisdesaude-pt",
    "name": "Profissionaisdesaude",
    "url": "https://www.profissionaisdesaude.pt/",
    "niche": "Health Professionals Directory",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": null,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Professional registration",
    "paid": false
  },
  {
    "id": "dir-ordemdosmedicos-pt",
    "name": "Ordemdosmedicos",
    "url": "https://ordemdosmedicos.pt/",
    "niche": "Official Medical Association",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": null,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Professional membership",
    "paid": false
  },
  {
    "id": "dir-saudebemestar-pt",
    "name": "Saudebemestar",
    "url": "https://www.saudebemestar.pt/",
    "niche": "Health & Wellness Portal",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": null,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": true
  },
  {
    "id": "dir-agilcare-pt",
    "name": "Agilcare",
    "url": "https://www.agilcare.pt/blog/",
    "niche": "Health & Wellness Blog",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": null,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": true
  },
  {
    "id": "dir-nutriama-pt",
    "name": "Nutriama",
    "url": "https://nutriama.pt/",
    "niche": "Nutrition / Health",
    "tags": [
      "health"
    ],
    "general": false,
    "languages": [
      "pt"
    ],
    "countries": [
      "PT"
    ],
    "da": null,
    "dr": null,
    "organicTraffic": null,
    "spamScore": null,
    "submission": "Guest post / outreach",
    "paid": true
  }
];
