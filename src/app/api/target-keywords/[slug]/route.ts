import { NextResponse } from "next/server";
import {
  addTargetKeywords,
  listTargetKeywords,
  removeTargetKeyword,
  targetKwStorageConfigured,
  type TargetKeyword,
} from "@/lib/target-keywords-store";
import { getClientGeo } from "@/lib/client-geo";
import { enrichKeywordsComprehensive } from "@/lib/seo-tools/keyword-research";

export const runtime = "nodejs";
// DataForSEO enrichment on manual adds can pull from 3 endpoints
// (Labs overview → bulk KD → Google Ads volume) — for a 30-keyword
// paste this comfortably fits under 60s, but a 200-keyword paste at the
// MAX_TARGETS ceiling could brush 90s. Match the meta-generate cap.
export const maxDuration = 300;

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
  // Enrich any keyword still missing vol/KD/intent against DataForSEO,
  // using the client's geo. Manual adds always arrive bare from the panel
  // and would otherwise render as "—" forever; pushes from Keyword
  // Research already carry enrichment so they fall through untouched.
  // Best-effort — if DataForSEO is down, we save the bare keywords
  // rather than 500ing the add.
  const needEnrichment = incoming.filter(
    (k) =>
      k.searchVolume === null || k.searchVolume === undefined ||
      k.difficulty === null || k.difficulty === undefined ||
      k.intent === null || k.intent === undefined,
  );
  if (needEnrichment.length > 0) {
    const geo = getClientGeo(slug);
    try {
      const enrichment = await enrichKeywordsComprehensive(
        needEnrichment.map((k) => k.keyword),
        geo.locationCode,
        geo.languageCode,
      );
      for (const k of incoming) {
        const hit = enrichment.get(k.keyword.toLowerCase());
        if (!hit) continue;
        if (k.searchVolume === null || k.searchVolume === undefined) {
          k.searchVolume = hit.searchVolume;
        }
        if (
          k.difficulty === null || k.difficulty === undefined ||
          k.difficulty === 0
        ) {
          k.difficulty = hit.difficulty;
        }
        if ((k.intent === null || k.intent === undefined) && hit.intent) {
          k.intent = hit.intent;
        }
      }
    } catch (err) {
      console.warn("target-keywords enrichment failed (saving bare):", err);
    }
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
