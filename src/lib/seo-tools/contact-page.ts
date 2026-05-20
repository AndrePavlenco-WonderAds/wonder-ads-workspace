// Auto-discover a client's "Contact us" page so the GMB Posts CTA URL
// pre-fills with the right destination. Saves consultants from pasting
// the same URL 14 times across 14 clients.
//
// Strategy: try a list of common contact-page slugs (PT + EN + ES + FR)
// against the client's website with HEAD requests. First 200 wins.
// Falls back to homepage when nothing answers. Cached in-process per
// website to keep page renders fast.

const HEAD_TIMEOUT_MS = 3500;

// Order matters — slugs are tried sequentially and the first 200-OK
// wins. PT-PT variants first (the agency's main market), then EN, then
// other Latin languages, then variations.
const COMMON_CONTACT_SLUGS = [
  "/contactos",
  "/contacto",
  "/contactar",
  "/contact",
  "/contact-us",
  "/contacts",
  "/contacta",
  "/contato",
  "/kontakt",
  "/get-in-touch",
  "/reach-us",
];

type CacheEntry = { url: string; cachedAt: number };
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6h
const cache = new Map<string, CacheEntry>();

/** Resolve the best Contact-us page URL for a given website. Returns
 *  the homepage URL when no contact page can be confirmed. */
export async function detectContactPage(websiteUrl: string): Promise<string> {
  const base = normaliseHomepage(websiteUrl);
  if (!base) return websiteUrl;

  const cached = cache.get(base);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.url;
  }

  for (const slug of COMMON_CONTACT_SLUGS) {
    const candidate = base.replace(/\/$/, "") + slug;
    if (await urlExists(candidate)) {
      cache.set(base, { url: candidate, cachedAt: Date.now() });
      return candidate;
    }
  }

  // Nothing answered — cache the homepage so we don't probe again for 6h.
  cache.set(base, { url: base, cachedAt: Date.now() });
  return base;
}

function normaliseHomepage(u: string): string | null {
  if (!u) return null;
  const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    const url = new URL(withScheme);
    return `${url.origin}/`;
  } catch {
    return null;
  }
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
    // HEAD with redirect:follow — many sites 301 from /contact → /contactos,
    // we still count that as a hit.
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WonderAdsWorkspace/1.0; +https://wonder-ads.com)",
      },
    });
    clearTimeout(timeout);
    // Some hosts (e.g. those behind Cloudflare) return 405 for HEAD but
    // 200 for GET. Treat 200-399 as existing; 405 → retry as GET.
    if (res.status >= 200 && res.status < 400) return true;
    if (res.status === 405) {
      const getRes = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
      });
      return getRes.ok;
    }
    return false;
  } catch {
    return false;
  }
}
