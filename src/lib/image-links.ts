// Classifies a pasted Client Files link BEFORE the GMB photo flows try to
// use it as an image. Consultants paste whatever the client sent them —
// Drive folders, Dropbox folders, Google Photos albums, a website — and
// until v76.91 anything that wasn't Drive went straight into the image
// pool as if it were a direct image URL. In client-files mode the random
// draw could then land on a Dropbox FOLDER, the download came back as
// HTML, and the post slot was lost ("0 GMB posts for B-Life", 2026-08-27).
//
// Drive links keep their own flow in drive-fetcher.ts (authenticated
// listing + download). This module covers everything else.

const DROPBOX_HOSTS = new Set(["dropbox.com", "www.dropbox.com", "dl.dropboxusercontent.com"]);

export type ImageLinkKind =
  | "dropbox-folder"
  | "dropbox-file"
  /** Any other http(s) URL — may or may not be an image; probe it. */
  | "url"
  | "invalid";

export type ImageLink = {
  kind: ImageLinkKind;
  /** URL that returns the raw bytes (Dropbox `dl=1`), or the input URL. */
  directUrl: string;
};

/** Dropbox share links come in two families:
 *    folders — /scl/fo/<id>/<key>/…  or  /sh/<id>/<key>
 *    files   — /scl/fi/<id>/<name>  or  /s/<id>/<name>
 *  A folder can't be listed without a Dropbox API token (we have none);
 *  a file downloads as bytes once `dl=1` is set. */
export function classifyImageLink(url: string): ImageLink {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "invalid", directUrl: url };
  }
  if (DROPBOX_HOSTS.has(parsed.hostname)) {
    if (/^\/(scl\/fo|sh)\//.test(parsed.pathname)) {
      return { kind: "dropbox-folder", directUrl: url };
    }
    if (/^\/(scl\/fi|s)\//.test(parsed.pathname) || parsed.hostname === "dl.dropboxusercontent.com") {
      parsed.searchParams.set("dl", "1");
      return { kind: "dropbox-file", directUrl: parsed.toString() };
    }
    return { kind: "dropbox-folder", directUrl: url };
  }
  return { kind: "url", directUrl: url };
}

/** Cheap check that a URL actually serves an image, done once at pool-build
 *  time so the random draw only ever sees real candidates. HEAD first
 *  (no body); some hosts refuse HEAD, so fall back to a GET whose body we
 *  cancel as soon as the headers are in. */
export async function probeImageUrl(
  url: string,
  timeoutMs = 8000,
): Promise<{ ok: true; mimeType: string } | { ok: false; reason: string }> {
  const attempt = async (method: "HEAD" | "GET") => {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (method === "GET") await res.body?.cancel().catch(() => undefined);
    return { status: res.status, ok: res.ok, mime };
  };
  try {
    let r = await attempt("HEAD");
    if (!r.ok || !r.mime) r = await attempt("GET");
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    if (!r.mime.startsWith("image/")) {
      return { ok: false, reason: r.mime ? `returns ${r.mime}, not an image` : "no content-type" };
    }
    return { ok: true, mimeType: r.mime };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: /abort|timeout/i.test(msg) ? "timed out" : msg.slice(0, 80) };
  }
}

