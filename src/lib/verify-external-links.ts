// Post-stream URL verification for the Blog Article Writer Pro output.
//
// The writer agent has a strict whitelist + a "use these or mark
// unverified" rule baked into its system prompt, but model-generated
// URLs can still be hallucinated (the spor.pt incident). This module
// extracts every external URL from the markdown, HEAD-checks them in
// parallel with a tight timeout, and returns the broken set so the
// route can prepend a warning callout to the saved output.

const URL_REGEX = /\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g;

/** Strip the markdown so we can parse without comment-block noise. */
function stripCodeBlocks(md: string): string {
  return md.replace(/```[\s\S]*?```/g, "");
}

export function extractExternalUrls(markdown: string): string[] {
  const cleaned = stripCodeBlocks(markdown);
  const seen = new Set<string>();
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = URL_REGEX.exec(cleaned))) {
    const raw = m[1].replace(/[).,;!?'"]+$/, ""); // trim trailing punctuation
    if (!seen.has(raw)) {
      seen.add(raw);
      urls.push(raw);
    }
  }
  // Reset the regex's lastIndex for the next call.
  URL_REGEX.lastIndex = 0;
  return urls;
}

export type LinkCheck = {
  url: string;
  ok: boolean;
  status: number | null;
  reason?: string;
};

async function checkOne(url: string, timeoutMs: number): Promise<LinkCheck> {
  // Some sites refuse HEAD — fall back to a tiny GET (Range: bytes=0-0).
  // We treat any 2xx/3xx as OK, 4xx/5xx as broken, network errors as
  // broken with a reason.
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          // Some CDNs serve different content to "bot" user-agents — a
          // realistic UA gets past most of those filters.
          "user-agent":
            "Mozilla/5.0 (compatible; WonderAdsLinkCheck/1.0; +https://wonder-ads.com)",
          accept: "*/*",
        },
      });
      if (res.status === 405 || res.status === 403) {
        // HEAD unsupported (or blocked) — retry as a ranged GET.
        res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "user-agent":
              "Mozilla/5.0 (compatible; WonderAdsLinkCheck/1.0; +https://wonder-ads.com)",
            accept: "*/*",
            range: "bytes=0-0",
          },
        });
      }
    } finally {
      clearTimeout(t);
    }
    const ok = res.status >= 200 && res.status < 400;
    return {
      url,
      ok,
      status: res.status,
      ...(ok ? {} : { reason: `HTTP ${res.status}` }),
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? `timeout after ${timeoutMs}ms`
          : err.message
        : String(err);
    return { url, ok: false, status: null, reason: message.slice(0, 120) };
  }
}

export async function verifyExternalUrls(
  urls: string[],
  opts: { timeoutMs?: number; concurrency?: number } = {},
): Promise<LinkCheck[]> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  const concurrency = opts.concurrency ?? 8;
  const results: LinkCheck[] = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const next = i++;
      results[next] = await checkOne(urls[next], timeoutMs);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, worker),
  );
  return results;
}

/** Render a warning callout listing every URL that failed verification.
 *  Returns null when every URL resolved — caller prepends nothing. */
export function renderBrokenLinkWarning(checks: LinkCheck[]): string | null {
  const broken = checks.filter((c) => !c.ok);
  if (broken.length === 0) return null;
  const lines = broken.map(
    (c) => `- ${c.url} — ${c.reason ?? `HTTP ${c.status ?? "—"}`}`,
  );
  return `> ⚠️ **${broken.length} external link${broken.length === 1 ? "" : "s"} failed verification.** Replace or remove before publishing:\n>\n${lines.map((l) => `> ${l}`).join("\n")}\n\n---\n\n`;
}
