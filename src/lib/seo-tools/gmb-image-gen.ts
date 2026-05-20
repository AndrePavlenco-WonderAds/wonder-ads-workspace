// Gemini 2.5 Flash Image (Nano Banana) wrapper for GMB post image
// generation. Pulls in a list of brand reference images (uploaded client
// files + Drive files) and tells the model to keep the generated image
// on-brand — same palette, same photographic style as the client's
// existing material.
//
// We use the official @google/genai SDK (not @ai-sdk/google) because
// the multimodal image-output flow is clearer there: ask for an image,
// receive image bytes back as a `inlineData` part on the response.

import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";

const MODEL = "gemini-2.5-flash-image-preview";

export const imageGenConfigured = Boolean(process.env.GEMINI_API_KEY);

export type ReferenceImage = {
  bytes: Uint8Array;
  mimeType: string;
};

/** Generate a single GMB post image. Reference images keep the result
 *  on-brand — pass the client's logo + 2-4 photos from their existing
 *  uploads / Drive files. The prompt should describe the SCENE, not the
 *  brand (brand comes through via the references). */
export async function generateGmbImage(opts: {
  prompt: string;
  referenceImages: ReferenceImage[];
  brandPalette?: string[];
}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (!imageGenConfigured) {
    throw new Error(
      "GEMINI_API_KEY is not set — add it to the Vercel project env and redeploy.",
    );
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const paletteNote =
    opts.brandPalette && opts.brandPalette.length > 0
      ? ` Brand palette to honour: ${opts.brandPalette.join(", ")}.`
      : "";
  const fullPrompt = [
    opts.prompt.trim(),
    paletteNote,
    "Output as a SQUARE image (1080x1080 ideal) suitable for posting to a Google Business Profile.",
    "The image must look polished and professional, like a real piece of brand creative — never AI-stocky, never crowded with text overlays unless the prompt explicitly asks for them.",
    "Honour the reference images attached to this message: match their photographic style, lighting, and brand palette. Reuse logo / brand marks visible in the references. Do NOT invent new logos.",
  ].join(" ");

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [{ text: fullPrompt }];
  for (const ref of opts.referenceImages) {
    parts.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: Buffer.from(ref.bytes).toString("base64"),
      },
    });
  }

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
  });

  const candidateParts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of candidateParts) {
    const inline = (part as { inlineData?: { mimeType?: string; data?: string } })
      .inlineData;
    if (inline?.data) {
      return {
        bytes: Buffer.from(inline.data, "base64"),
        mimeType: inline.mimeType ?? "image/png",
      };
    }
  }
  throw new Error(
    `Gemini returned no image (${candidateParts.length} parts, none with image data). Try regenerating, or simplify the prompt.`,
  );
}

/** Persist a generated GMB image to Vercel Blob and return its public URL.
 *  Keyed by clientSlug/resultId/index so old generations don't collide
 *  with new ones and the blob URLs stay stable across consultant edits. */
export async function saveGmbImageToBlob(opts: {
  bytes: Uint8Array;
  mimeType: string;
  clientSlug: string;
  resultId: string;
  index: number;
}): Promise<string> {
  const extFromMime = opts.mimeType.split("/")[1]?.split("+")[0] ?? "png";
  const safeExt = extFromMime.replace(/[^a-z0-9]/gi, "") || "png";
  const pathname = `gmb-posts/${opts.clientSlug}/${opts.resultId}/${opts.index}.${safeExt}`;
  const blob = await put(pathname, opts.bytes as unknown as Blob, {
    access: "public",
    contentType: opts.mimeType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}
