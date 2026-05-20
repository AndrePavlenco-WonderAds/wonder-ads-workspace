// Lightweight site read used to anchor Claude in what the business
// ACTUALLY does — separate from the SEO Audit's heavy multi-page crawl
// pipeline. The trigger for this file was Sea Yourself (a mental
// health clinic) getting scuba-diving captions because Claude inferred
// from the brand name alone. **Hard rule:** every GMB Posts generation
// must run this audit first so the captions ground in reality.
//
// We pull:
//   - Homepage <title>, meta description, H1s
//   - A cleaned body-text excerpt (first ~2500 chars of visible text)
//   - Navigation labels + footer text (these reveal services + tone)
// And we follow ONE about-style sub-link when found (`/about`,
// `/sobre`, `/about-us`, etc.) for a second pass of body text. Total
// budget: ~3-6s. The output is a markdown block that prepends the
// Claude prompt.

import { load, type CheerioAPI } from "cheerio";

const TIMEOUT_MS = 8000;
const MAX_BODY_CHARS = 2500;

const ABOUT_SLUGS = [
  "/about",
  "/about-us",
  "/sobre",
  "/sobre-nos",
  "/quem-somos",
  "/sobre-a-clinica",
  "/sobre-nos",
  "/nosotros",
  "/qui-sommes-nous",
];

export type MiniSiteAudit = {
  homepageUrl: string;
  finalUrl: string;
  title: string | null;
  metaDescription: string | null;
  h1s: string[];
  /** Concatenated body text (homepage + about page when found), cleaned. */
  bodyExcerpt: string;
  navLabels: string[];
  footerExcerpt: string;
  /** When we successfully fetched an about-style page, the URL. */
  aboutUrl: string | null;
  errors: string[];
};

/** Drive a homepage + optional about-page fetch and return the audit. */
export async function runMiniSiteAudit(
  websiteUrl: string,
): Promise<MiniSiteAudit | null> {
  const base = normaliseUrl(websiteUrl);
  if (!base) return null;
  const errors: string[] = [];

  const homepage = await fetchHtml(base, errors);
  if (!homepage) return null;

  const $ = load(homepage.html);
  const title = textOrNull($("title").first().text());
  const metaDescription = textOrNull(
    $('meta[name="description"]').attr("content") ?? null,
  );
  const h1s = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 6);
  const navLabels = collectNavLabels($);
  const footerExcerpt = collectFooterText($);
  const homepageBody = cleanBodyText($, MAX_BODY_CHARS);

  // Try to find + fetch an about-style sub-page for a second pass.
  let aboutUrl: string | null = null;
  let aboutBody = "";
  const aboutCandidate = findAboutLink($, homepage.finalUrl);
  if (aboutCandidate) {
    const aboutHtml = await fetchHtml(aboutCandidate, errors);
    if (aboutHtml) {
      aboutUrl = aboutHtml.finalUrl;
      const $$ = load(aboutHtml.html);
      aboutBody = cleanBodyText($$, MAX_BODY_CHARS);
    }
  }

  const bodyParts: string[] = [];
  if (homepageBody) bodyParts.push(`[HOMEPAGE]\n${homepageBody}`);
  if (aboutBody) bodyParts.push(`[ABOUT PAGE]\n${aboutBody}`);

  return {
    homepageUrl: base,
    finalUrl: homepage.finalUrl,
    title,
    metaDescription,
    h1s,
    bodyExcerpt: bodyParts.join("\n\n").slice(0, MAX_BODY_CHARS * 2),
    navLabels,
    footerExcerpt,
    aboutUrl,
    errors,
  };
}

/** Format the audit as a markdown block for prompt injection. */
export function formatMiniSiteAuditForPrompt(audit: MiniSiteAudit): string {
  const lines: string[] = [];
  lines.push("## Site audit (ABSOLUTE-PRIORITY context — what the business actually does)");
  lines.push(
    "> ⚠️ HARD RULE: the homepage + about-page text below is THE source of truth. The brand name can be misleading (e.g. names with 'sea', 'sky', 'green', 'spark' that have nothing to do with diving, aviation, environmental services, electrical work). If the body text contradicts what the brand name suggests, **trust the body text** and reflect what the body text describes — never invent angles based on the name alone.",
  );
  lines.push("");
  lines.push(`- **Homepage fetched:** ${audit.finalUrl}`);
  if (audit.title) lines.push(`- **Title:** "${audit.title}"`);
  if (audit.metaDescription)
    lines.push(`- **Meta description:** "${audit.metaDescription}"`);
  if (audit.h1s.length > 0)
    lines.push(`- **H1(s):** ${audit.h1s.map((h) => `"${h}"`).join(" · ")}`);
  if (audit.navLabels.length > 0)
    lines.push(
      `- **Nav labels** (signal the services they offer): ${audit.navLabels.join(" · ")}`,
    );
  if (audit.aboutUrl)
    lines.push(`- **About page also crawled:** ${audit.aboutUrl}`);
  if (audit.footerExcerpt)
    lines.push(`- **Footer excerpt:** ${audit.footerExcerpt}`);
  lines.push("");
  lines.push("### Body text (cleaned, primary source)");
  lines.push("```");
  lines.push(audit.bodyExcerpt || "(no body text extracted)");
  lines.push("```");
  if (audit.errors.length > 0) {
    lines.push("");
    lines.push(
      `_Partial errors during the audit: ${audit.errors.join("; ")}._`,
    );
  }
  return lines.join("\n");
}

// ---------- internals ----------

function normaliseUrl(u: string): string | null {
  if (!u) return null;
  const trimmed = u.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(
  url: string,
  errors: string[],
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WonderAdsWorkspace/1.0; +https://wonder-ads.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) {
      errors.push(`${url} → HTTP ${res.status}`);
      return null;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) {
      errors.push(`${url} → non-HTML (${ct})`);
      return null;
    }
    return { html: await res.text(), finalUrl: res.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`${url} → ${msg.slice(0, 80)}`);
    return null;
  }
}

function textOrNull(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanBodyText($: CheerioAPI, max: number): string {
  // Drop noise.
  $(
    "script, style, noscript, svg, iframe, video, audio, picture source, link[rel=stylesheet]",
  ).remove();
  const text = $("body").text();
  return text
    .replace(/[\t\r]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ ]{2,}/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, max);
}

function collectNavLabels($: CheerioAPI): string[] {
  const labels = new Set<string>();
  $("nav a, header a").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 0 && text.length < 50) labels.add(text);
  });
  return Array.from(labels).slice(0, 20);
}

function collectFooterText($: CheerioAPI): string {
  const text = $("footer").first().text().replace(/\s+/g, " ").trim();
  return text.slice(0, 400);
}

function findAboutLink(
  $: CheerioAPI,
  homepageUrl: string,
): string | null {
  const base = new URL(homepageUrl);
  const links = $("a[href]")
    .map((_, el) => $(el).attr("href"))
    .get()
    .filter((h): h is string => Boolean(h));
  for (const href of links) {
    let absolute: URL;
    try {
      absolute = new URL(href, base);
    } catch {
      continue;
    }
    if (absolute.origin !== base.origin) continue;
    const path = absolute.pathname.toLowerCase().replace(/\/+$/, "");
    if (ABOUT_SLUGS.some((s) => path === s || path.endsWith(s))) {
      return absolute.toString();
    }
  }
  return null;
}
