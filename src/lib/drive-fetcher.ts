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
 *  - `https://drive.usercontent.google.com/download?id=<id>&export=...`
 *  Returns null for folder URLs (use extractDriveFolderId for those). */
export function extractDriveFileId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!DRIVE_HOSTS.has(parsed.hostname)) return null;
  // Folder URLs explicitly disqualified — they have their own listing
  // flow (you can't `?alt=media` a folder).
  if (/\/folders\//.test(parsed.pathname)) return null;
  const idParam = parsed.searchParams.get("id");
  if (idParam && /^[\w-]{10,}$/.test(idParam)) return idParam;
  const m = parsed.pathname.match(/\/file\/d\/([\w-]{10,})/);
  if (m) return m[1];
  const m2 = parsed.pathname.match(/\/d\/([\w-]{10,})/);
  if (m2) return m2[1];
  return null;
}

/** Pull the Drive FOLDER id out of `/drive/folders/<id>` URLs. Folders
 *  need a different flow (list contents, recurse into sub-folders,
 *  download each image) — they can't be fetched as bytes directly. */
export function extractDriveFolderId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!DRIVE_HOSTS.has(parsed.hostname)) return null;
  const m = parsed.pathname.match(/\/folders\/([\w-]{10,})/);
  return m ? m[1] : null;
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
 *  raw bytes Gemini can ingest. Folder URLs are NOT handled here —
 *  use fetchImagesFromDriveFolder for those. */
export async function fetchImageBytes(url: string): Promise<DriveFile | null> {
  if (extractDriveFolderId(url)) return null;
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

export type DriveImageRef = {
  fileId: string;
  name: string;
  mimeType: string;
  /** Breadcrumb path for diagnostics — e.g. "Sessão 9 → IMG_5612.jpg". */
  breadcrumb: string;
};

/** Walk a Drive folder breadth-first up to depth 2 and return metadata
 *  for every image inside (no bytes downloaded). The result is the
 *  "image pool" the client-files mode samples from — we list once,
 *  pick N, download only N. */
export async function listImageRefsInDriveFolder(
  folderId: string,
  opts: { maxDepth?: number; rootLabel?: string } = {},
): Promise<{ refs: DriveImageRef[]; error: string | null }> {
  if (!googleAuthConfigured) {
    return {
      refs: [],
      error:
        "Drive auth not configured — set GOOGLE_SERVICE_ACCOUNT_JSON and grant the drive.readonly scope.",
    };
  }
  let token: string;
  try {
    token = await getGoogleAccessToken([DRIVE_READONLY_SCOPE]);
  } catch (err) {
    return {
      refs: [],
      error: `Drive auth failed: ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
    };
  }
  const refs: DriveImageRef[] = [];
  const maxDepth = opts.maxDepth ?? 2;
  const rootLabel = opts.rootLabel ?? "Drive";
  // Breadth-first traversal, each queue entry carrying the path so we
  // can build a breadcrumb for diagnostics.
  const queue: { id: string; depth: number; path: string }[] = [
    { id: folderId, depth: 0, path: rootLabel },
  ];
  while (queue.length > 0) {
    const { id, depth, path } = queue.shift()!;
    const listed = await listDriveFolderContents(id, token);
    for (const f of listed) {
      if (f.mimeType?.startsWith("image/")) {
        refs.push({
          fileId: f.id,
          name: f.name,
          mimeType: f.mimeType,
          breadcrumb: `${path} → ${f.name}`,
        });
      } else if (
        f.mimeType === "application/vnd.google-apps.folder" &&
        depth < maxDepth
      ) {
        queue.push({ id: f.id, depth: depth + 1, path: `${path}/${f.name}` });
      }
    }
  }
  return { refs, error: null };
}

/** Download a single Drive image by id. Handles auth + mime gate.
 *  Used by both the AI-generated reference flow (downloads as many as
 *  the cap allows) and the client-files mode (downloads only what was
 *  picked after sampling). */
export async function downloadDriveImageById(
  ref: DriveImageRef,
): Promise<DriveFile | null> {
  if (!ref.mimeType.startsWith("image/")) return null;
  let token: string;
  try {
    token = await getGoogleAccessToken([DRIVE_READONLY_SCOPE]);
  } catch {
    return null;
  }
  return downloadDriveFileById(ref.fileId, token, ref.name, ref.mimeType);
}

/** List + download images inside a Drive folder. Recurses into
 *  sub-folders up to a small depth (consultants nest by session / month
 *  in practice, so depth 2 covers Mimus's "FOTOS / Sessão 9 / file.jpg"
 *  shape without going pathological). Stops as soon as `maxImages`
 *  images have been downloaded. Returns:
 *    images:      successfully downloaded image files
 *    totalFound:  total image files visible in the folder tree (so the
 *                 result page can say "used N of M")
 *    error:       null when at least one image came back, a string when
 *                 nothing worked (missing scope, empty folder, etc.) */
export async function fetchImagesFromDriveFolder(
  folderId: string,
  opts: { maxImages: number; maxDepth?: number } = { maxImages: 4 },
): Promise<{
  images: DriveFile[];
  totalFound: number;
  error: string | null;
}> {
  if (!googleAuthConfigured) {
    return {
      images: [],
      totalFound: 0,
      error:
        "Drive auth not configured — set GOOGLE_SERVICE_ACCOUNT_JSON and grant the drive.readonly scope in Workspace Admin Console.",
    };
  }
  let token: string;
  try {
    token = await getGoogleAccessToken([DRIVE_READONLY_SCOPE]);
  } catch (err) {
    return {
      images: [],
      totalFound: 0,
      error: `Drive auth token request failed (the drive.readonly scope likely isn't authorized for the service account yet in Workspace Admin Console): ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
    };
  }
  const maxDepth = opts.maxDepth ?? 2;
  const allImageRefs: { id: string; name: string; mimeType: string }[] = [];
  // Breadth-first traversal: enumerate folders in waves so we collect
  // images-per-folder before going deeper.
  const queue: { id: string; depth: number }[] = [{ id: folderId, depth: 0 }];
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    const listed = await listDriveFolderContents(id, token);
    for (const f of listed) {
      if (f.mimeType?.startsWith("image/")) {
        allImageRefs.push(f);
      } else if (
        f.mimeType === "application/vnd.google-apps.folder" &&
        depth < maxDepth
      ) {
        queue.push({ id: f.id, depth: depth + 1 });
      }
    }
  }
  if (allImageRefs.length === 0) {
    return {
      images: [],
      totalFound: 0,
      error:
        "Drive folder contains no image files (looked recursively up to depth 2). Upload JPG/PNG/WebP photos to the folder.",
    };
  }
  // Download just the first N — we don't need 47 photos when Gemini
  // only takes 4 references. Keeps the function comfortably under the
  // 60s Vercel ceiling.
  const toDownload = allImageRefs.slice(0, opts.maxImages);
  const images: DriveFile[] = [];
  for (const ref of toDownload) {
    const file = await downloadDriveFileById(ref.id, token, ref.name, ref.mimeType);
    if (file) images.push(file);
  }
  return {
    images,
    totalFound: allImageRefs.length,
    error:
      images.length > 0
        ? null
        : "Listed images but couldn't download any (permission or quota issue).",
  };
}

/** Single Drive API list call for one folder. Returns the raw file
 *  records (images + sub-folders) — the caller decides what to do. */
async function listDriveFolderContents(
  folderId: string,
  token: string,
): Promise<{ id: string; name: string; mimeType: string }[]> {
  const q = `'${folderId}' in parents and trashed = false`;
  const url =
    `https://www.googleapis.com/drive/v3/files?` +
    `q=${encodeURIComponent(q)}` +
    `&fields=files(id,name,mimeType)` +
    `&pageSize=100` +
    `&supportsAllDrives=true&includeItemsFromAllDrives=true` +
    `&orderBy=name`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(
        `[drive-fetcher] folder list HTTP ${res.status} for ${folderId}`,
      );
      return [];
    }
    const data = (await res.json()) as {
      files?: { id: string; name: string; mimeType: string }[];
    };
    return data.files ?? [];
  } catch (err) {
    console.warn(
      `[drive-fetcher] folder list threw for ${folderId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

/** Download a single Drive file by id with an existing token. Used by
 *  the folder traversal so we can reuse the cached token. */
async function downloadDriveFileById(
  fileId: string,
  token: string,
  name: string,
  mimeType: string,
): Promise<DriveFile | null> {
  if (!mimeType.startsWith("image/")) return null;
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    fileId,
  )}?alt=media&supportsAllDrives=true`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(
        `[drive-fetcher] media HTTP ${res.status} for ${name} (${fileId})`,
      );
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    return { bytes: buf, mimeType, filename: name };
  } catch (err) {
    console.warn(
      `[drive-fetcher] media fetch threw for ${name}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}
