// Generate a real ad-creative IMAGE with Gemini Flash Image (same engine
// as the SEO GMB-posts action), grounded in the client's brand: brand
// palette + a few of the client's own images/vault assets as references,
// plus the user's direction. Saves the result to Vercel Blob and returns
// its URL.

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentSession } from "@/lib/auth/server";
import { getAdsClient } from "@/lib/ads-clients";
import {
  generateGmbImage,
  imageGenConfigured,
  type ReferenceImage,
} from "@/lib/seo-tools/gmb-image-gen";
import { getFilesForSlug } from "@/lib/files-storage";
import { getVault } from "@/lib/ads/ads-vault-store";
import { getClientPalette } from "@/lib/client-colors";
import { shrinkForVisionInput } from "@/lib/seo-tools/thumbnail";

export const runtime = "nodejs";
export const maxDuration = 120;

const IMG_RE = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i;
const MAX_REFS = 4;

async function fetchRef(url: string): Promise<ReferenceImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = new Uint8Array(await res.arrayBuffer());
    const shrunk = await shrinkForVisionInput(raw, { maxDimension: 1024 });
    return { bytes: shrunk.bytes, mimeType: shrunk.mimeType };
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const client = getAdsClient(slug);
  if (!client) {
    return NextResponse.json({ error: "Unknown client" }, { status: 404 });
  }
  if (!imageGenConfigured) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY não está configurada. Adiciona-a no Vercel → Settings → Environment Variables para gerar imagens.",
      },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }
  const useBrandRefs = body.useBrandRefs !== false;

  // Gather a few brand references (client image files + vault images) so
  // the result stays on-brand.
  const refImages: ReferenceImage[] = [];
  if (useBrandRefs) {
    const [files, vault] = await Promise.all([getFilesForSlug(slug), getVault(slug)]);
    const urls: string[] = [
      ...files.filter((f) => f.kind === "image").map((f) => f.url),
      ...vault.filter((v) => IMG_RE.test(v.url)).map((v) => v.url),
    ].slice(0, MAX_REFS);
    for (const u of urls) {
      const ref = await fetchRef(u);
      if (ref) refImages.push(ref);
    }
  }

  const palette = getClientPalette(slug);
  const brandPalette = [palette.from, palette.via, palette.to].filter(
    (c): c is string => Boolean(c),
  );

  try {
    const { bytes, mimeType } = await generateGmbImage({
      prompt,
      referenceImages: refImages,
      brandPalette,
    });
    const ext = (mimeType.split("/")[1]?.split("+")[0] ?? "png").replace(
      /[^a-z0-9]/gi,
      "",
    );
    const pathname = `ads-creatives/${slug}/${crypto.randomUUID()}.${ext || "png"}`;
    const blob = await put(pathname, bytes as unknown as Blob, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
    });
    return NextResponse.json({ ok: true, url: blob.url, refsUsed: refImages.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
