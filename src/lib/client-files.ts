// Per-client file library — uploaded images/videos plus Google Drive / URL
// links. Keyed by client slug (same slugs as briefs) so shared clients see
// the same files across the SEO and ADS departments.

export type ClientFileKind = "image" | "video" | "link";

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

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/** Best-effort kind detection from a filename or URL. Anything that isn't an
 *  obvious image/video extension (e.g. a Google Drive link) becomes a link. */
export function detectKind(nameOrUrl: string): ClientFileKind {
  if (IMAGE_EXT.test(nameOrUrl)) return "image";
  if (VIDEO_EXT.test(nameOrUrl)) return "video";
  return "link";
}
