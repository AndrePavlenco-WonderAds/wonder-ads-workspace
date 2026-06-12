// Per-client file library — uploaded images/videos/documents plus
// Google Drive / URL links. Keyed by client slug (same slugs as
// briefs) so shared clients see the same files across the SEO and
// ADS departments.
//
// v74.28: "document" kind added so PDFs / DOCX / XLSX / CSV / TXT
// etc. render with a file icon instead of falling through to the
// generic "link" tile, and so the SEO action runner can pick them
// out of the library for inline text extraction in the prompt.

export type ClientFileKind = "image" | "video" | "document" | "link";

export type ClientFile = {
  id: string;
  kind: ClientFileKind;
  /** Display name. */
  name: string;
  /** Vercel Blob URL for uploads, or the pasted URL for links. */
  url: string;
  /** Epoch ms — used for newest-first ordering. */
  addedAt: number;
};

export const EMPTY_FILES: ClientFile[] = [];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|heic|heif)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i;
const DOCUMENT_EXT =
  /\.(pdf|docx?|xlsx?|pptx?|csv|tsv|txt|md|markdown|rtf|json|xml|yml|yaml|zip|rar|7z)(\?|#|$)/i;

/** Best-effort kind detection from a filename or URL. Anything that
 *  isn't an obvious image/video/document extension (e.g. a Google
 *  Drive link without a `.ext`) becomes a link. */
export function detectKind(nameOrUrl: string): ClientFileKind {
  if (IMAGE_EXT.test(nameOrUrl)) return "image";
  if (VIDEO_EXT.test(nameOrUrl)) return "video";
  if (DOCUMENT_EXT.test(nameOrUrl)) return "document";
  return "link";
}

/** True when `kind` is a file type whose contents we can extract to
 *  plain text for inclusion in Claude prompts. Used by the live-context
 *  builder to decide which files to fetch + run through `extractFromUrl`. */
export function isExtractableKind(kind: ClientFileKind): boolean {
  return kind === "document";
}
