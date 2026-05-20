// Gemini 2.5 Flash Image (Nano Banana) wrapper for GMB post image
// generation. Pulls in a list of brand reference images (uploaded client
// files + Drive files) and tells the model to keep the generated image
// on-brand — same palette, same photographic style as the client's
// existing material.
//
// We use the official @google/genai SDK (not @ai-sdk/google) because
// the multimodal image-output flow is clearer there: ask for an image,
// receive image bytes back as a `inlineData` part on the response.

import { GoogleGenAI, Modality } from "@google/genai";
import { put } from "@vercel/blob";

// Gemini image-gen model. Canonical name first (what the API returns
// in error messages as the resolved model), then the older aliases
// in case Google renames again. All three currently route to the same
// underlying model.
const PREFERRED_MODELS = [
  "gemini-2.5-flash-preview-image",
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-image-preview",
];

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
  const hasReferences = opts.referenceImages.length > 0;
  const fullPrompt = [
    opts.prompt.trim(),
    paletteNote,
    "Output as a SQUARE image (1080x1080 ideal) suitable for posting to a Google Business Profile.",
    "The image must look polished and professional, like a real piece of brand creative — never AI-stocky.",
    // HARD RULE on logos — the v71.3 build invented a wrong logo because
    // Gemini was inferring from the brand name. Never let that happen
    // again: only reuse logos that ACTUALLY appear in the references.
    "**ABSOLUTE RULE — logos & text:** Do NOT generate, invent, or guess a logo or brand mark. " +
      (hasReferences
        ? "If a logo or brand mark appears clearly in one of the reference images attached to this message, you may reuse THAT EXACT logo. If you can't reproduce it accurately, leave the image logo-free entirely — a clean logo-free image is FAR better than a distorted or invented logo."
        : "No reference images were attached, so produce a clean LOGO-FREE image. A wrong logo is worse than no logo."),
    "**No text overlays** (no headlines, no captions, no slogans printed on the image) unless the prompt explicitly asks for a specific word.",
    hasReferences
      ? "Honour the reference images attached: match their photographic style, lighting, subject matter (real people, real spaces — not stock-style), and brand palette."
      : "Use a clean, modern, photographic style appropriate to a healthcare / professional service business — natural lighting, real-looking subjects, no AI-stocky over-saturation.",
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

  let lastError: Error | null = null;
  for (const model of PREFERRED_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        // SDK auto-wraps a Part[] into a single user-role Content.
        // Avoid the explicit { role: "user", parts } shape because
        // @google/genai's union types inferred it as Part[] not
        // Content[] and choked on the `role` key.
        contents: parts,
        // CRITICAL: without responseModalities including IMAGE, the
        // model returns text-only describing what the image would look
        // like — not bytes. We include TEXT too because some Gemini
        // versions reject IMAGE-only configs with "Modality IMAGE not
        // supported alone".
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });
      // Log full response shape to Vercel logs so we can diagnose
      // permission/region/safety issues. Strip the actual image bytes
      // before logging — they're huge and noisy.
      console.info(
        `[gmb-image-gen] ${model} →`,
        JSON.stringify(
          {
            promptFeedback: response.promptFeedback,
            candidatesCount: response.candidates?.length ?? 0,
            firstCandidate: response.candidates?.[0]
              ? {
                  finishReason: response.candidates[0].finishReason,
                  partsCount: response.candidates[0].content?.parts?.length,
                  partTypes: response.candidates[0].content?.parts?.map((p) => {
                    const part = p as {
                      text?: string;
                      inlineData?: { mimeType?: string };
                    };
                    if (part.text) return "text";
                    if (part.inlineData) return `image:${part.inlineData.mimeType ?? "?"}`;
                    return "unknown";
                  }),
                }
              : null,
          },
          null,
          0,
        ).slice(0, 800),
      );
      const candidateParts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of candidateParts) {
        const inline = (part as {
          inlineData?: { mimeType?: string; data?: string };
        }).inlineData;
        if (inline?.data) {
          return {
            bytes: Buffer.from(inline.data, "base64"),
            mimeType: inline.mimeType ?? "image/png",
          };
        }
      }
      // Got a response but no image bytes — capture as much diagnostic
      // info as possible before trying the next model. Three common
      // root causes:
      // 1. Safety filter blocked the prompt (promptFeedback.blockReason).
      // 2. Model finished early (finishReason: SAFETY / RECITATION / OTHER).
      // 3. Model returned text-only describing what it WOULD draw
      //    (responseModalities misconfigured / API tier doesn't allow
      //    image gen on this key).
      const blockReason = response.promptFeedback?.blockReason;
      const finishReason = response.candidates?.[0]?.finishReason;
      const textPart = candidateParts
        .map((p) => (p as { text?: string }).text)
        .filter(Boolean)
        .join(" ")
        .slice(0, 200);
      const diag: string[] = [];
      if (blockReason) diag.push(`promptBlockReason=${blockReason}`);
      if (finishReason && finishReason !== "STOP")
        diag.push(`finishReason=${finishReason}`);
      if (textPart) diag.push(`model said: "${textPart}"`);
      lastError = new Error(
        `${model} returned no image bytes. ${
          diag.length > 0
            ? diag.join(" · ")
            : "Likely your API key tier doesn't have image generation enabled — enable billing on the Google Cloud project linked to this key, or get a fresh key at aistudio.google.com."
        }`,
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // 429 / RESOURCE_EXHAUSTED on this model is a billing setup
      // issue — the free tier limit for Gemini 2.5 Flash Image is 0,
      // so this fires until billing is enabled on the Google Cloud
      // project the key is linked to. Re-throw with an actionable
      // hint instead of opaque API text so consultants don't have to
      // grok JSON to know what to do.
      if (/RESOURCE_EXHAUSTED|429|quota/i.test(lastError.message)) {
        throw new Error(
          "Google AI quota exhausted — Gemini image generation has NO free tier. " +
            "Enable billing on the Google Cloud project this API key is linked to at " +
            "https://console.cloud.google.com/billing (then regenerate; same key keeps working). " +
            "At your volume the cost is ~$0.04 per image. " +
            "Original error: " +
            lastError.message.slice(0, 240),
        );
      }
      // 404/unknown-model → try next; other errors → break immediately.
      if (!/not found|unknown model|404/i.test(lastError.message)) {
        throw lastError;
      }
    }
  }
  throw lastError ?? new Error("Gemini image generation failed.");
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
