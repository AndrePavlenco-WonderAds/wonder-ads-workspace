import { NextResponse } from "next/server";
import type { ClientBrief } from "@/lib/client-briefs";
import {
  getBriefForSlug,
  saveBriefForSlug,
  briefsStorageConfigured,
} from "@/lib/briefs-storage";

const MAX_ITEM_LENGTH = 500;
const MAX_ITEMS_PER_KIND = 50;

function sanitizeStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => x.slice(0, MAX_ITEM_LENGTH))
    .slice(0, MAX_ITEMS_PER_KIND);
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const brief = await getBriefForSlug(slug);
  return NextResponse.json(brief);
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!briefsStorageConfigured) {
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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const incoming = body as Partial<ClientBrief>;
  const clean: ClientBrief = {
    dos: sanitizeStringArray(incoming.dos),
    donts: sanitizeStringArray(incoming.donts),
    notes: sanitizeStringArray(incoming.notes),
  };
  try {
    const saved = await saveBriefForSlug(slug, clean);
    return NextResponse.json(saved);
  } catch (err) {
    console.error("brief save failed", err);
    return NextResponse.json(
      { error: "Storage write failed" },
      { status: 500 },
    );
  }
}
