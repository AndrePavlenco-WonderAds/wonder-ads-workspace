// Matching engine: rank the directory database against one client.
//
// Pure + isomorphic (runs on the server for the initial render and in the
// browser when the consultant tweaks the niche live). Two HARD gates, then a
// score for ranking:
//
//   1. Language gate — a directory only fits a client in the SAME market
//      language. A Portuguese clinic never gets English-only directories and
//      a London gym never gets Portuguese ones (this is the core of the
//      "gym in London → English + fitness" requirement).
//   2. Niche gate — a NICHE-SPECIFIC directory (health, fitness, travel…)
//      only fits when its tags overlap the client's niche. GENERAL business
//      directories (business / local / reviews / maps / classifieds) always
//      pass — they're valid citations for anyone.
//
// Country + authority (DA / traffic / spam) then rank what survives. Country
// is a ranking signal, NOT a gate: a same-language directory in another
// country still appears, just lower.

import type { SeoDirectory } from "./seo-directories";

export type ClientMatchProfile = {
  slug: string;
  title: string;
  /** Market language, e.g. "pt" | "en". */
  language: string;
  /** Country token (PT, UK, US, …) — see countryToken(). */
  country: string;
  /** Niche tags (e.g. ["fitness","health"]). */
  niches: string[];
};

export type DirFit = "strong" | "good" | "weak";

export type ScoredDirectory = {
  dir: SeoDirectory;
  score: number;
  fit: DirFit;
  reasons: string[];
};

const EUROPE = new Set(["PT", "ES", "UK", "EU"]);

/** Map a client-geo countryLabel to the token used on directories. */
export function countryToken(label: string): string {
  const l = label.trim().toLowerCase();
  if (l.includes("portugal")) return "PT";
  if (l.includes("spain") || l.includes("espanha")) return "ES";
  if (l.includes("kingdom") || l === "uk") return "UK";
  if (l.includes("united states") || l === "usa" || l === "us") return "US";
  if (l.includes("australia")) return "AU";
  if (l.includes("canada")) return "CA";
  if (l.includes("brazil") || l.includes("brasil")) return "BR";
  if (l.includes("india")) return "IN";
  if (l.includes("emirates") || l === "uae") return "AE";
  if (l.includes("europe")) return "EU";
  return "GLOBAL";
}

function spamPoints(dir: SeoDirectory): number {
  switch (dir.spamScore) {
    case "very-low":
      return 8;
    case "low":
      return 4;
    case "medium":
      return -12;
    case "high":
      return -30;
    default:
      return 0;
  }
}

function qualityPoints(dir: SeoDirectory): number {
  let q = 0;
  if (dir.da != null) q += (dir.da / 100) * 25;
  if (dir.organicTraffic != null && dir.organicTraffic > 0) {
    q += Math.min(15, Math.log10(dir.organicTraffic + 1) * 2.2);
  }
  q += spamPoints(dir);
  if (dir.paid) q -= 3; // all else equal, prefer free
  return q;
}

/** Rank every directory that passes the gates, best first. */
export function matchDirectories(
  profile: ClientMatchProfile,
  directories: SeoDirectory[],
): ScoredDirectory[] {
  const out: ScoredDirectory[] = [];
  const clientNiches = new Set(profile.niches);
  const europeanClient = EUROPE.has(profile.country);

  for (const dir of directories) {
    // Gate 1 — language.
    if (!dir.languages.includes(profile.language)) continue;

    // Gate 2 — niche-specific directories must overlap the client's niche.
    const overlap = dir.tags.filter((t) => clientNiches.has(t));
    const nicheMatch = overlap.length > 0;
    if (!dir.general && !nicheMatch) continue;

    const countryMatch = dir.countries.includes(profile.country);
    const isGlobal = dir.countries.includes("GLOBAL");
    const euMatch =
      !countryMatch && europeanClient && dir.countries.includes("EU");

    const reasons: string[] = [];
    let score = 10; // language (gated)

    if (countryMatch) {
      score += 30;
      reasons.push(profile.country === "GLOBAL" ? "Global" : "Local market");
    } else if (euMatch) {
      score += 24;
      reasons.push("Europe");
    } else if (isGlobal) {
      score += 12;
      reasons.push("Global");
    }

    if (nicheMatch) {
      score += 35;
      reasons.push(`Niche: ${overlap.join(" / ")}`);
    } else if (dir.general) {
      score += 12;
      reasons.push("General citation");
    }

    score += qualityPoints(dir);

    if (dir.da != null) reasons.push(`DA ${dir.da}`);
    if (dir.spamScore === "very-low" || dir.spamScore === "low") {
      reasons.push("clean profile");
    }

    const local = countryMatch || euMatch;
    let fit: DirFit;
    if (nicheMatch && local) fit = "strong";
    else if ((nicheMatch && isGlobal) || (dir.general && (local || isGlobal)))
      fit = "good";
    else fit = "weak";

    out.push({ dir, score: Math.round(score), fit, reasons });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}
