import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// Client-upload token endpoint for @vercel/blob/client. The browser uploads
// the file straight to Blob storage — this route only mints the upload token,
// so it isn't bound by the serverless request-body size limit (mp4s welcome).
// The file list itself is persisted separately via /api/files/[slug].

// v74.28 — open the gate to all common business file types. This
// route is auth-gated behind the workspace login (middleware), so
// the allowlist is a defense-in-depth filter against accidental
// uploads (executables, system files) rather than a hard security
// boundary. Wildcards cover the long tail of variants Vercel Blob
// sees in the wild without us having to enumerate every MIME type.
//
// Categories included:
//   image/*        — png/jpeg/gif/webp/avif/svg/heic/heif/etc.
//   video/*        — mp4/webm/quicktime/avi/mkv/etc.
//   audio/*        — mp3/wav/ogg/m4a/etc. (rare for SEO, useful for podcasts)
//   application/*  — PDF, DOCX, XLSX, PPTX, ZIP, JSON, octet-stream, etc.
//   text/*         — plain, markdown, csv, html, xml, yaml, etc.
const ALLOWED_CONTENT_TYPES = [
  "image/*",
  "video/*",
  "audio/*",
  "application/*",
  "text/*",
];

const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_SIZE_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // No-op — the client persists the file list once the upload resolves.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
