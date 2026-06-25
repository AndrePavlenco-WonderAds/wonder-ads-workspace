// List / save / delete generated-creative history for a client.

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";
import {
  getCreatives,
  addCreative,
  deleteCreative,
} from "@/lib/ads/ads-creatives-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const entries = await getCreatives(slug);
  return NextResponse.json({ entries });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const platform =
    body.platform === "google" || body.platform === "meta"
      ? body.platform
      : "all";
  const images = Array.isArray(body.images)
    ? body.images.filter(
        (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u),
      )
    : [];
  try {
    const entry = await addCreative(slug, {
      title: s(body.title) || "Criativo",
      idea: s(body.idea),
      direction: s(body.direction),
      copy: s(body.copy),
      platform,
      format: s(body.format),
      content: s(body.content),
      images,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${message}` }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const entries = await deleteCreative(slug, id);
    return NextResponse.json({ ok: true, entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${message}` }, { status: 500 });
  }
}
