// Server-side text extraction for the Onboarding Form.
//
// Uses `unpdf` — a serverless-friendly fork of PDF.js without the legacy
// build-tool baggage. Works on Vercel Functions out of the box.
//
// For non-PDF text formats (txt, md) we just fetch + decode. DOC/DOCX is
// not text-extracted today — those files are still passed to Claude via
// the doc URL but won't populate extractedText.

const COMPETITOR_FIELD_HINTS = [
  /competitor[s]?:?[\s\S]{0,400}/i,
  /main\s+competitor[s]?:?[\s\S]{0,400}/i,
  /concorrente[s]?:?[\s\S]{0,400}/i, // PT
  /principa(?:l|is)\s+concorrente[s]?:?[\s\S]{0,400}/i, // PT
];

const URL_REGEX =
  /https?:\/\/[^\s,;)<>"'\]]+|(?:^|[^a-zA-Z0-9-])(www\.[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s,;)<>"'\]]*)?)/g;
const BARE_DOMAIN_REGEX =
  /(?:^|[\s,])([a-zA-Z0-9-]+\.(?:com|net|org|io|co|pt|es|fr|de|it|uk|us|br|ca|au|nz|info|biz|app|ai|dev|nl|be|ch|se|no|dk|fi|pl|cz|gr|tr|jp|cn|kr|in|mx|ar|cl|co|pe|ve))(?:\/|\b)/gi;

export type ExtractResult = {
  text: string;
  /** Competitor URLs/domains mined from "competitor" fields if present;
   *  otherwise falls back to all URLs found in the doc capped to 10. */
  competitors: string[];
  /** Approximate page count for PDFs. null for other formats. */
  pageCount: number | null;
  /** Best-guess seed topic mined from "main services" / "primary
   *  keywords" / "principais serviços" fields. Used to pre-populate the
   *  Keyword Research form's seedTopic field so consultants don't start
   *  from a blank box. Null when nothing reasonable was found. */
  suggestedSeed: string | null;
};

export async function extractFromUrl(
  url: string,
  contentType: string,
): Promise<ExtractResult> {
  if (
    contentType === "application/pdf" ||
    url.toLowerCase().endsWith(".pdf")
  ) {
    return extractPdf(url);
  }
  if (
    contentType === "text/plain" ||
    contentType === "text/markdown" ||
    /\.(txt|md)$/i.test(url)
  ) {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    return {
      text,
      competitors: mineCompetitors(text),
      pageCount: null,
      suggestedSeed: mineSuggestedSeed(text),
    };
  }
  // DOC/DOCX — leave extraction unimplemented for now. Claude can still see
  // the doc via the URL; we just won't have text in the prompt.
  return {
    text: "",
    competitors: [],
    pageCount: null,
    suggestedSeed: null,
  };
}

async function extractPdf(url: string): Promise<ExtractResult> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`PDF fetch failed: HTTP ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());

  // Dynamic import — unpdf ships an ESM bundle that's heavy. Loading it on
  // demand keeps the cold-start light on routes that don't need it.
  const { extractText, getDocumentProxy } = await import("unpdf");

  const pdf = await getDocumentProxy(buf);
  const pageCount = pdf.numPages ?? null;

  // Pass the PDFDocumentProxy to extractText, NOT the raw buffer.
  //
  // The raw-buffer code path goes through worker postMessage which uses
  // Node's structuredClone — that throws `Unable to deserialize cloned
  // data` on Node 20.6.1+ (and on Vercel runtime), and the throw is
  // swallowed by the upload route's "non-fatal" try/catch, leaving every
  // onboarding record with empty extractedText. Caught 2026-06-11 when
  // an audit found 15/15 onboarding forms in KV had textChars=0.
  //
  // Passing the proxy reuses the already-loaded document and skips the
  // problematic worker round-trip. Verified end-to-end on IHN's 15-page
  // 202kb PDF: 0 chars → 18,981 chars extracted in ~290ms.
  const result = await extractText(pdf, { mergePages: true });
  const raw = (result as { text: unknown }).text;
  const text =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.join("\n")
        : "";
  return {
    text: text.trim(),
    competitors: mineCompetitors(text),
    pageCount,
    suggestedSeed: mineSuggestedSeed(text),
  };
}

/** Heuristic seed extractor — looks for the answers in the standard onboarding
 *  form fields (EN + PT) and returns the most useful one to pre-populate
 *  the seedTopic field with. Returns null when nothing clear is found.
 *
 *  Priority order: primary keywords > main services > business focus. */
export function mineSuggestedSeed(text: string): string | null {
  if (!text) return null;
  const candidates: { label: string; pattern: RegExp; max: number }[] = [
    // EN + PT: explicit primary/target keyword fields take priority.
    {
      label: "primary-keywords",
      pattern:
        /(?:primary\s+keyword|target\s+keyword|main\s+keyword|palavras?[-\s]?chave\s+(?:principa(?:l|is)|alvo))\s*:?\s*([^\n]{2,200})/i,
      max: 200,
    },
    // Main services / top services.
    {
      label: "main-services",
      pattern:
        /(?:main\s+services|top\s+services|principa(?:l|is)\s+servi(?:ç|c)os?)\s*:?\s*([^\n]{2,200})/i,
      max: 200,
    },
    // What's the business about / focus area.
    {
      label: "business-focus",
      pattern:
        /(?:business\s+focus|focus\s+area|área\s+de\s+foco|qual\s+(?:é|e)\s+o\s+foco)\s*:?\s*([^\n]{2,160})/i,
      max: 160,
    },
  ];
  for (const c of candidates) {
    const m = text.match(c.pattern);
    if (!m || !m[1]) continue;
    const raw = m[1].trim().replace(/[.;,]\s*$/, "");
    if (raw.length < 3) continue;
    // Tidy: collapse repeated whitespace, cap length.
    const tidy = raw.replace(/\s+/g, " ").slice(0, c.max).trim();
    if (tidy.length >= 3) return tidy;
  }
  return null;
}

/** Look for explicit "competitors" sections in the form; fall back to all
 *  URLs found in the doc capped to 10. Deduped + lowercased. */
export function mineCompetitors(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();

  // First pass: explicit "competitor" fields (EN + PT). Pull URLs/domains
  // appearing in the 400 chars after the field label.
  for (const re of COMPETITOR_FIELD_HINTS) {
    const m = text.match(re);
    if (!m) continue;
    const slice = m[0];
    for (const u of extractUrlsAndDomains(slice)) {
      found.add(normaliseDomain(u));
      if (found.size >= 10) break;
    }
    if (found.size >= 10) break;
  }

  // Fallback / supplement: all URLs in the doc, capped to 10 if we still
  // have room. (Helps when the form labels are non-standard.)
  if (found.size < 10) {
    for (const u of extractUrlsAndDomains(text)) {
      found.add(normaliseDomain(u));
      if (found.size >= 10) break;
    }
  }

  // Filter out the client's own / WonderAds / Google Form / social-media
  // noise — we don't want to ask DataforSEO about facebook.com or have
  // Claude treat drive.google.com (the form's storage host) as a real
  // competitor. v74.26 backfill turned up the social-media + g-suite
  // domains as a recurring source of false-positive "competitors".
  const NOISE = new Set([
    "wonder-ads.com",
    "wonderads.com",
    // Google ecosystem (the form lives on these).
    "docs.google.com",
    "google.com",
    "forms.gle",
    "gmail.com",
    "drive.google.com",
    "accounts.google.com",
    "goo.gl",
    // Major social platforms — almost never a real competitor for the
    // health/wellness roster (clients link to their OWN profiles).
    "facebook.com",
    "fb.com",
    "instagram.com",
    "linkedin.com",
    "youtube.com",
    "youtu.be",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "pinterest.com",
    "whatsapp.com",
    "wa.me",
    "telegram.org",
    "t.me",
  ]);
  return Array.from(found).filter((d) => !NOISE.has(d));
}

function extractUrlsAndDomains(slice: string): string[] {
  const out: string[] = [];
  const u1 = slice.matchAll(URL_REGEX);
  for (const m of u1) {
    const raw = (m[0] || m[1] || "").trim();
    if (raw) out.push(raw);
  }
  const u2 = slice.matchAll(BARE_DOMAIN_REGEX);
  for (const m of u2) {
    const raw = (m[1] || "").trim();
    if (raw) out.push(raw);
  }
  return out;
}

function normaliseDomain(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.split("/")[0];
  s = s.replace(/[.,;:!?)>\]]+$/, "");
  return s;
}
