// Image-download proxy for GMB posts. The image is stored on Vercel
// Blob which serves with `content-disposition: inline` by default —
// meaning clicking a blob URL opens the image in a new tab instead of
// downloading. We re-stream the bytes here with an `attachment`
// disposition so the browser saves the file.
//
// Also exposes a batch mode (?batch=1) that ZIPs every image in a
// result + a captions.txt summary into one download. JSZip handles
// the ZIP — small library, well-supported in Node.

import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getGmbResult } from "@/lib/gmb-posts-store";
import { getClientBySlug } from "@/lib/notion";
import { localizeCta } from "@/lib/gmb-posts-store";
import { getClientGeo } from "@/lib/client-geo";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug } = await ctx.params;
  const url = new URL(req.url);
  const resultId = url.searchParams.get("resultId");
  const postId = url.searchParams.get("postId");
  const batch = url.searchParams.get("batch") === "1";

  if (!resultId) {
    return NextResponse.json({ error: "resultId required" }, { status: 400 });
  }

  const result = await getGmbResult(clientSlug, resultId);
  if (!result) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  const client = await getClientBySlug(clientSlug).catch(() => null);
  const safeClient = (client?.title ?? clientSlug)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
  const languageCode = getClientGeo(clientSlug).languageCode;

  // ---------- Batch mode: ZIP everything ----------
  if (batch) {
    const zip = new JSZip();
    const captions: string[] = [
      `GMB Posts batch — ${client?.title ?? clientSlug}`,
      `Generated: ${new Date(result.createdAt).toISOString().slice(0, 10)}`,
      `Result ID: ${result.id}`,
      "",
      `--- ${result.posts.length} post${result.posts.length === 1 ? "" : "s"} ---`,
      "",
    ];
    for (let i = 0; i < result.posts.length; i++) {
      const p = result.posts[i];
      const num = i + 1;
      if (p.imageUrl) {
        try {
          const res = await fetch(p.imageUrl);
          if (res.ok) {
            const buf = new Uint8Array(await res.arrayBuffer());
            const mime =
              res.headers.get("content-type") ?? "application/octet-stream";
            const ext =
              (mime.split("/")[1]?.split("+")[0] ?? "png").replace(
                /[^a-z0-9]/gi,
                "",
              ) || "png";
            zip.file(`${num}-${p.postType.toLowerCase()}.${ext}`, buf);
          }
        } catch {
          /* skip image fetch failures — the captions file still ships */
        }
      }
      captions.push(`[${num}] ${p.postType.toUpperCase()}`);
      captions.push(p.caption);
      const ctaLabel = localizeCta(p.cta, languageCode);
      if (ctaLabel && p.ctaUrl) {
        captions.push(`CTA: ${ctaLabel} → ${p.ctaUrl}`);
      }
      if (p.targetKeywords.length > 0) {
        captions.push(`Keywords: ${p.targetKeywords.join(", ")}`);
      }
      captions.push("");
    }
    zip.file("captions.txt", captions.join("\n"));

    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    const filename = `GMB Posts - ${safeClient} - Wonder Ads.zip`;
    return new NextResponse(zipBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  }

  // ---------- Single-image mode ----------
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }
  const post = result.posts.find((p) => p.id === postId);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (!post.imageUrl) {
    return NextResponse.json(
      { error: "This post has no image (generation failed)." },
      { status: 404 },
    );
  }
  try {
    const upstream = await fetch(post.imageUrl);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed: HTTP ${upstream.status}` },
        { status: 502 },
      );
    }
    const buf = new Uint8Array(await upstream.arrayBuffer());
    const mime =
      upstream.headers.get("content-type") ?? "application/octet-stream";
    const ext =
      (mime.split("/")[1]?.split("+")[0] ?? "png").replace(
        /[^a-z0-9]/gi,
        "",
      ) || "png";
    const idx = result.posts.findIndex((p) => p.id === postId);
    const filename = `${safeClient}-gmb-${idx + 1}-${post.postType.toLowerCase()}.${ext}`;
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": mime,
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Download failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 502 },
    );
  }
}
