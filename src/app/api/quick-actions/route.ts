// Persistent Quick Actions selection — backed by Vercel KV so the order
// persists across deployments (Vercel preview URLs each get their own
// origin, so localStorage was being lost every push) and across all team
// members + devices.

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { ALL_ACTIONS } from "@/lib/seo-pillars";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "quick-actions:global";

const DEFAULT_SLUGS = [
  "write-blog-article",
  "meta-title-description",
  "keyword-research",
  "seo-audit",
  "backlink-directories",
  "schema-markup",
];

const VALID_SLUGS = new Set(ALL_ACTIONS.map((a) => a.action.slug));

function sanitize(slugs: unknown): string[] {
  if (!Array.isArray(slugs)) return [...DEFAULT_SLUGS];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of slugs) {
    if (typeof item !== "string") continue;
    if (!VALID_SLUGS.has(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export async function GET() {
  try {
    const stored = await kv.get<string[]>(KEY);
    const slugs = stored === null ? [...DEFAULT_SLUGS] : sanitize(stored);
    return NextResponse.json(
      { slugs },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[quick-actions] GET failed:", err);
    return NextResponse.json(
      { slugs: [...DEFAULT_SLUGS], error: String(err) },
      { headers: { "cache-control": "no-store" } },
    );
  }
}

export async function POST(req: Request) {
  let body: { slugs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const next = sanitize(body.slugs);
  try {
    await kv.set(KEY, next);
    return NextResponse.json({ ok: true, slugs: next });
  } catch (err) {
    console.error("[quick-actions] POST failed:", err);
    return NextResponse.json(
      { error: `Persist failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
