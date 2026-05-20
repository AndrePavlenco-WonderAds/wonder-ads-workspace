// Server-side image downscaler. We only need this for one specific
// case: feeding a real client photo into Claude Haiku's vision input
// for caption matching. Anthropic's vision endpoint rejects images
// over ~5MB, and the agency's clinic photos are typically 4-8MB
// full-resolution JPEGs. We shrink to a 1024px-longest-edge JPEG (~150-
// 400KB) which is plenty for caption-writing comprehension and stays
// well under the API ceiling.
//
// `sharp` is already a transitive dep of Next.js (used by the Image
// optimizer); no separate install.

import sharp from "sharp";

/** Downscale an image to a Claude-vision-safe size. The ORIGINAL bytes
 *  are still saved to Vercel Blob for the actual post image — this
 *  output is only used as a vision input for caption generation. */
export async function shrinkForVisionInput(
  bytes: Uint8Array,
  opts: { maxDimension?: number; quality?: number } = {},
): Promise<{ bytes: Uint8Array; mimeType: "image/jpeg" }> {
  const maxDim = opts.maxDimension ?? 1024;
  const quality = opts.quality ?? 80;
  const out = await sharp(bytes)
    .rotate() // honour EXIF orientation so portrait phone photos don't end up sideways
    .resize({
      width: maxDim,
      height: maxDim,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  return { bytes: new Uint8Array(out), mimeType: "image/jpeg" };
}
