import { NextResponse } from "next/server";
import type { ClientFile, ClientFileKind } from "@/lib/client-files";
import {
  getFilesForSlug,
  saveFilesForSlug,
  filesStorageConfigured,
} from "@/lib/files-storage";

const MAX_FILES = 200;
const MAX_NAME_LENGTH = 200;
const VALID_KINDS: readonly ClientFileKind[] = [
  "image",
  "video",
  "document",
  "link",
];

function sanitizeFiles(arr: unknown): ClientFile[] {
  if (!Array.isArray(arr)) return [];
  const out: ClientFile[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    const { id, kind, name, url, addedAt } = f;
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue;
    if (typeof kind !== "string" || !VALID_KINDS.includes(kind as ClientFileKind)) {
      continue;
    }
    out.push({
      id: typeof id === "string" && id.length > 0 ? id : crypto.randomUUID(),
      kind: kind as ClientFileKind,
      name:
        typeof name === "string" && name.trim().length > 0
          ? name.trim().slice(0, MAX_NAME_LENGTH)
          : url,
      url,
      addedAt: typeof addedAt === "number" ? addedAt : Date.now(),
    });
    if (out.length >= MAX_FILES) break;
  }
  return out;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const files = await getFilesForSlug(slug);
  return NextResponse.json(files);
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!filesStorageConfigured) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 },
    );
  }
  const { slug } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const clean = sanitizeFiles(body);
  try {
    const saved = await saveFilesForSlug(slug, clean);
    return NextResponse.json(saved);
  } catch (err) {
    console.error("files save failed", err);
    return NextResponse.json(
      { error: "Storage write failed" },
      { status: 500 },
    );
  }
}
