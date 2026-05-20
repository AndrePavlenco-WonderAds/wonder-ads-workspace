// Fetch a Google Drive file as binary data.
//
// Two paths, in order:
//   1. Authenticated Drive API (preferred) — uses the existing
//      seo@wonder-ads.com service-account impersonation that already
//      powers GSC + GA4. As long as the client shares the file with
//      seo@wonder-ads.com (which is how the agency operates by
//      default), this works without the file ever being made public.
//   2. Public direct-download URL (fallback) — for any file that IS
//      anyone-with-link. Keeps working for clients who happen to share
//      that way.
//
// The viewer page at /file/d/<id>/view returns HTML, not file bytes,
// so we never just fetch the share URL directly — we either hit the
// API or transform to /uc?id=<id>.

import { getGoogleAccessToken, googleAuthConfigured } from "./google-auth";

const DRIVE_HOSTS = new Set([
  "drive.google.com",
  "drive.usercontent.google.com",
  "www.googleapis.com",
]);

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/** Pull the Drive file id out of any of the common share-link shapes:
 *  - `https://drive.google.com/file/d/<id>/view`
 *  - `https://drive.google.com/file/d/<id>/edit`
 *  - `https://drive.google.com/open?id=<id>`
 *  - `https://drive.google.com/uc?id=<id>` (already a direct link)
 *  - `https://drive.usercontent.google.com/download?id=<id>&export=...` */
export function extractDriveFileId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!DRIVE_HOSTS.has(parsed.hostname)) return null;
  const idParam = parsed.searchParams.get("id");
  if (idParam && /^[\w-]{10,}$/.test(idParam)) return idParam;
  const m = parsed.pathname.match(/\/file\/d\/([\w-]{10,})/);
  if (m) return m[1];
  const m2 = parsed.pathname.match(/\/d\/([\w-]{10,})/);
  if (m2) return m2[1];
  return null;
}

/** Convert any Drive share URL into a direct-download URL that streams
 *  the raw file bytes. Returns null when the URL doesn't look like Drive. */
export function driveDirectDownloadUrl(url: string): string | null {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0`;
}

export type DriveFile = {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
};

/** Fetch a single Drive file. Tries authenticated Drive API first (works
 *  for files shared with the impersonated Workspace user — typically
 *  seo@wonder-ads.com), then falls back to the public direct-download
 *  URL for anyone-with-link files. Returns null on any failure. */
export async function fetchDriveFile(url: string): Promise<DriveFile | null> {
  const id = extractDriveFileId(url);
  if (!id) return null;

  // 1) Authenticated path — requires GOOGLE_SERVICE_ACCOUNT_JSON +
  //    domain-wide-delegation for the drive.readonly scope.
  if (googleAuthConfigured) {
    const authed = await fetchDriveFileAuthenticated(id);
    if (authed) return authed;
    // fall through to public path
  }

  // 2) Public path — works for anyone-with-link files only.
  return fetchDriveFilePublic(id);
}

/** Try to download via the Drive v3 API using the impersonated
 *  service-account token. Returns null on any failure so the caller
 *  can fall back to the public URL. */
async function fetchDriveFileAuthenticated(
  fileId: string,
): Promise<DriveFile | null> {
  let token: string;
  try {
    token = await getGoogleAccessToken([DRIVE_READONLY_SCOPE]);
  } catch (err) {
    // Most common cause: domain-wide delegation hasn't authorized the
    // drive.readonly scope yet (Workspace admin step). Log so the dev
    // tab makes it visible; null tells the caller to try the public
    // fallback.
    console.warn(
      `[drive-fetcher] auth token request failed (likely the drive.readonly scope isn't authorized in Workspace Admin Console domain-wide delegation): ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
  try {
    // Fetch file metadata first to get the real name + mime-type. Then
    // GET the bytes with alt=media. supportsAllDrives covers Shared
    // Drives in case a clinic puts files there instead of My Drive.
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId,
    )}?fields=name,mimeType&supportsAllDrives=true`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!metaRes.ok) {
      console.warn(
        `[drive-fetcher] meta HTTP ${metaRes.status} for ${fileId}`,
      );
      return null;
    }
    const meta = (await metaRes.json()) as {
      name?: string;
      mimeType?: string;
    };
    // Only accept image mimes — Gemini can't use PDFs / docs / videos
    // as reference images.
    if (!meta.mimeType?.startsWith("image/")) {
      console.info(
        `[drive-fetcher] skipping ${meta.name ?? fileId}: mime=${meta.mimeType ?? "?"} is not an image`,
      );
      return null;
    }
    const mediaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId,
    )}?alt=media&supportsAllDrives=true`;
    const mediaRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!mediaRes.ok) {
      console.warn(
        `[drive-fetcher] media HTTP ${mediaRes.status} for ${fileId}`,
      );
      return null;
    }
    const buf = new Uint8Array(await mediaRes.arrayBuffer());
    return {
      bytes: buf,
      mimeType: meta.mimeType,
      filename: meta.name ?? "drive-file",
    };
  } catch (err) {
    console.warn(
      `[drive-fetcher] authenticated fetch failed for ${fileId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/** Public anyone-with-link fallback. Works for files marked as such;
 *  returns null for private files (Drive serves the access-denied
 *  HTML, which we detect and reject). */
async function fetchDriveFilePublic(fileId: string): Promise<DriveFile | null> {
  const direct = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`;
  try {
    const res = await fetch(direct, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        // Pretend to be a normal browser — Drive sometimes serves a
        // virus-scan-warning interstitial otherwise on larger files.
        "User-Agent":
          "Mozilla/5.0 (compatible; WonderAdsWorkspace/1.0; +https://wonder-ads.com)",
      },
    });
    if (!res.ok) return null;
    const contentType =
      res.headers.get("content-type") ?? "application/octet-stream";
    // If Drive served us the HTML virus-scan-warning page, the content-type
    // will be text/html — bail rather than feeding HTML into Gemini as a
    // reference image.
    if (contentType.startsWith("text/html")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const dispo = res.headers.get("content-disposition") ?? "";
    const nameMatch = dispo.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const filename = nameMatch
      ? decodeURIComponent(nameMatch[1])
      : "drive-file";
    return {
      bytes: buf,
      mimeType: contentType.split(";")[0].trim(),
      filename,
    };
  } catch {
    return null;
  }
}

/** Fetch ANY image-like URL (Drive, Vercel Blob, public CDN) as bytes
 *  for use as a reference image. Returns null on any failure. Used by
 *  the GMB image generator to materialise the client file list into
 *  raw bytes Gemini can ingest. */
export async function fetchImageBytes(url: string): Promise<DriveFile | null> {
  if (extractDriveFileId(url)) return fetchDriveFile(url);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const filename = url.split("/").pop()?.split("?")[0] || "image";
    return { bytes: buf, mimeType: contentType.split(";")[0].trim(), filename };
  } catch {
    return null;
  }
}
