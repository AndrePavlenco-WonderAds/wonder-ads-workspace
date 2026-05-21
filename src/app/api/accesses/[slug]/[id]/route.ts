// PATCH + DELETE for a single access entry.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  deleteClientAccess,
  sanitiseClientAccessPatch,
  updateClientAccess,
} from "@/lib/client-accesses-store";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch = sanitiseClientAccessPatch(raw);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No editable fields in patch" },
      { status: 400 },
    );
  }
  const updated = await updateClientAccess(slug, id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  revalidatePath(`/seo/${slug}`);
  return NextResponse.json({ entry: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  const ok = await deleteClientAccess(slug, id);
  if (!ok) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  revalidatePath(`/seo/${slug}`);
  return NextResponse.json({ ok: true });
}
