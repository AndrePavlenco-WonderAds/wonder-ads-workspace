import { NextResponse } from "next/server";
import {
  addTargetKeywords,
  listTargetKeywords,
  removeTargetKeyword,
  targetKwStorageConfigured,
  type TargetKeyword,
} from "@/lib/target-keywords-store";

export const runtime = "nodejs";

const ALLOWED_INTENTS = new Set([
  "informational",
  "commercial",
  "transactional",
  "navigational",
]);

function sanitize(raw: unknown): TargetKeyword[] {
  if (!Array.isArray(raw)) return [];
  const out: TargetKeyword[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const keyword = typeof o.keyword === "string" ? o.keyword.trim() : "";
    if (!keyword) continue;
    const source =
      o.source === "manual" || o.source === "import" || o.source === "keyword-research"
        ? o.source
        : "manual";
    out.push({
      keyword: keyword.slice(0, 200),
      addedAt: typeof o.addedAt === "number" ? o.addedAt : Date.now(),
      source,
      resultId: typeof o.resultId === "string" ? o.resultId : undefined,
      intent:
        typeof o.intent === "string" && ALLOWED_INTENTS.has(o.intent)
          ? (o.intent as TargetKeyword["intent"])
          : null,
      searchVolume:
        typeof o.searchVolume === "number" ? o.searchVolume : null,
      difficulty: typeof o.difficulty === "number" ? o.difficulty : null,
    });
  }
  return out;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const list = await listTargetKeywords(slug);
  return NextResponse.json(list);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!targetKwStorageConfigured) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 },
    );
  }
  const { slug } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Accept either { keywords: [...] } or a bare array.
  const raw = Array.isArray(body)
    ? body
    : ((body as { keywords?: unknown }).keywords ?? []);
  const incoming = sanitize(raw);
  if (incoming.length === 0) {
    return NextResponse.json(
      { error: "No valid keywords in payload" },
      { status: 400 },
    );
  }
  try {
    const result = await addTargetKeywords(slug, incoming);
    return NextResponse.json(result);
  } catch (err) {
    console.error("target-keywords add failed:", err);
    return NextResponse.json(
      { error: "Storage write failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const keyword = new URL(req.url).searchParams.get("keyword");
  if (!keyword) {
    return NextResponse.json({ error: "keyword query required" }, { status: 400 });
  }
  const remaining = await removeTargetKeyword(slug, keyword);
  return NextResponse.json({ ok: true, remaining: remaining.length });
}
