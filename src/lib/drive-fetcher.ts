// Fetch a public Google Drive file as binary data.
//
// The consultant pastes Drive share links in the Client Files panel
// (`Add link`). For GMB post image generation we need to feed those
// files into Gemini as reference images, so we need the raw bytes.
//
// Drive serves a viewer page at `https://drive.google.com/file/d/<id>/view`
// — fetching THAT returns the HTML page, not the file. The trick is to
// transform to the direct-download URL `https://drive.google.com/uc?...`
// which streams the actual file as long as the link is shared publicly
// (anyone-with-link). Private files 403 — we leave those to the caller.

const DRIVE_HOSTS = new Set([
  "drive.google.com",
  "drive.usercontent.google.com",
  "www.googleapis.com",
]);

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

/** Fetch a single Drive file. Returns null on any failure (private file,
 *  not-found, quota, network). Caller decides whether to keep going
 *  without it — we don't want a single broken link to abort the whole
 *  GMB post generation. */
export async function fetchDriveFile(url: string): Promise<DriveFile | null> {
  const direct = driveDirectDownloadUrl(url);
  if (!direct) return null;
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
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    // If Drive served us the HTML virus-scan-warning page, the content-type
    // will be text/html — bail rather than feeding HTML into Gemini as a
    // reference image.
    if (contentType.startsWith("text/html")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const dispo = res.headers.get("content-disposition") ?? "";
    const nameMatch = dispo.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const filename = nameMatch ? decodeURIComponent(nameMatch[1]) : "drive-file";
    return { bytes: buf, mimeType: contentType.split(";")[0].trim(), filename };
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
