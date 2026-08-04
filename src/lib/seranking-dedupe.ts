// Near-duplicate collapse for the SE Ranking tracked set.
//
// Tracked keywords are a metered resource (the plan caps how many we can
// check), and the Target Keywords lists accumulate variants of the same query:
// "cabeleireiro em sintra" / "cabeleireiro sintra", "does stainless steel
// jewellery tarnish" / "will stainless steel jewelry tarnish". Those return the
// same SERP, so tracking both spends quota twice to learn one fact — and pads
// the client's report with rows that say the same thing.
//
// Two keywords are near-duplicates when they carry the same content words once
// accents, function words, plurals, spelling variants and word order are
// normalised away.
//
// Deliberately NOT collapsed, because the SERP genuinely differs:
//   "gym london"                vs  "best gyms in london"
//   "seafood restaurant lisbon" vs  "best seafood restaurant lisbon"
// Qualifiers (best, top, cheap, near, online, …) are content words here.

/** Function words only. Anything that changes the SERP belongs out of this. */
const STOP = new Set([
  // pt — articles, prepositions, conjunctions, question words
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "para", "pra",
  "a", "o", "as", "os", "com", "e", "por", "um", "uma", "ao", "aos", "que",
  "se", "ou", "qual", "quais", "como", "quanto", "quanta", "ser", "meu",
  "minha", "seu", "sua",
  // en — articles, prepositions, conjunctions
  "the", "an", "in", "for", "of", "to", "and", "at", "on", "by", "with",
  "from", "out",
  // en — auxiliaries + question words: "does X tarnish" == "will X tarnish"
  "do", "does", "did", "will", "would", "can", "could", "should", "is", "are",
  "was", "were", "be", "been", "has", "have", "had", "what", "how", "why",
  "when", "which", "it", "its", "i", "my", "you", "your", "there", "am",
]);

/** Spelling / locale variants that resolve to the same SERP. */
const SPELLING: Record<string, string> = {
  jewellery: "jewelry", jewelleries: "jewelry", jewelries: "jewelry",
  colour: "color", colours: "color", colourful: "colorful",
  favourite: "favorite", organise: "organize", organised: "organized",
  sterilise: "sterilize", customise: "customize", personalise: "personalize",
  analyse: "analyze", centre: "center", grey: "gray",
  womens: "women", woman: "women", mens: "men", man: "men",
  ladies: "lady", kids: "kid", childrens: "children", child: "children",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Crude pt/en plural fold — only applied to tokens long enough to be words. */
function singular(tok: string): string {
  if (tok.length > 4 && tok.endsWith("oes")) return `${tok.slice(0, -3)}ao`;
  if (tok.length > 4 && tok.endsWith("ais")) return `${tok.slice(0, -3)}al`;
  if (tok.length > 4 && tok.endsWith("eis")) return `${tok.slice(0, -3)}el`;
  if (tok.length > 4 && tok.endsWith("ies")) return `${tok.slice(0, -3)}y`;
  if (tok.length > 4 && tok.endsWith("es")) return tok.slice(0, -2);
  if (tok.length > 3 && tok.endsWith("s")) return tok.slice(0, -1);
  return tok;
}

/** Order-independent fingerprint of a keyword's content words. */
export function keywordSignature(keyword: string): string {
  const cleaned = stripAccents(keyword.toLowerCase()).replace(
    /[^a-z0-9\s]/g,
    " ",
  );
  const toks: string[] = [];
  for (const raw of cleaned.split(/\s+/)) {
    if (!raw) continue;
    // Drop apostrophe debris ("women's" → "women", "s") but never a lone
    // digit: "ecografia 1 trimestre" ≠ "ecografia 3 trimestre", and
    // "all on 4" lives or dies by the 4.
    if (raw.length < 2 && !/^\d$/.test(raw)) continue;
    let t = SPELLING[raw] ?? raw;
    if (STOP.has(t)) continue;
    t = singular(t);
    t = SPELLING[t] ?? t;
    if (STOP.has(t)) continue;
    toks.push(t);
  }
  return [...new Set(toks)].sort().join(" ");
}

export type DedupeCandidate = {
  keyword: string;
  searchVolume?: number | null;
};

export type DroppedKeyword = {
  /** The variant we're not tracking. */
  dropped: string;
  /** The variant we kept in its place. */
  kept: string;
};

export type DedupeResult<T extends DedupeCandidate> = {
  kept: T[];
  dropped: DroppedKeyword[];
};

/** Within a cluster, the keyword we keep: highest search volume wins; ties go
 *  to the shortest form (the canonical head term), then alphabetical so the
 *  outcome is stable across runs. */
function betterFirst(a: DedupeCandidate, b: DedupeCandidate): number {
  const av = a.searchVolume ?? null;
  const bv = b.searchVolume ?? null;
  if ((av === null) !== (bv === null)) return av === null ? 1 : -1;
  if ((av ?? 0) !== (bv ?? 0)) return (bv ?? 0) - (av ?? 0);
  if (a.keyword.length !== b.keyword.length)
    return a.keyword.length - b.keyword.length;
  return a.keyword.localeCompare(b.keyword);
}

/** Collapse SEO near-duplicates, keeping one representative per cluster. */
export function dedupeKeywords<T extends DedupeCandidate>(
  keywords: T[],
): DedupeResult<T> {
  const clusters = new Map<string, T[]>();
  for (const k of keywords) {
    const sig = keywordSignature(k.keyword);
    const group = clusters.get(sig);
    if (group) group.push(k);
    else clusters.set(sig, [k]);
  }

  const kept: T[] = [];
  const dropped: DroppedKeyword[] = [];
  for (const group of clusters.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    const sorted = [...group].sort(betterFirst);
    kept.push(sorted[0]);
    for (const d of sorted.slice(1)) {
      dropped.push({ dropped: d.keyword, kept: sorted[0].keyword });
    }
  }
  kept.sort((a, b) => a.keyword.localeCompare(b.keyword));
  return { kept, dropped };
}
