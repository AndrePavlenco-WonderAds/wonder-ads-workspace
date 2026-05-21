// List + create endpoints for the per-client credentials vault.
// GET returns the full list. POST appends a new entry (label is
// required; everything else is optional and free-form).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  appendClientAccess,
  listClientAccesses,
  sanitiseClientAccessPatch,
} from "@/lib/client-accesses-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const entries = await listClientAccesses(slug);
  return NextResponse.json({ entries });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const cleaned = sanitiseClientAccessPatch(raw);
  if (!cleaned.label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  const entry = await appendClientAccess(slug, {
    label: cleaned.label,
    url: cleaned.url ?? null,
    username: cleaned.username ?? null,
    password: cleaned.password ?? null,
    notes: cleaned.notes ?? null,
  });
  revalidatePath(`/seo/${slug}`);
  return NextResponse.json({ entry });
}
