// Pause / reactivate an SEO client on the /seo board. SuperAdmin only.
//   PUT    → pause / suspend the client (moves it to the paused section)
//   DELETE → reactivate the client (back to the main grid)

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import { addPausedSlug, removePausedSlug } from "@/lib/admin-paused-clients-store";

export const runtime = "nodejs";

function revalidate(slug: string) {
  revalidatePath("/seo");
  revalidatePath(`/seo/${slug}`);
}

export async function PUT(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json(
      { error: "Não há permissões suficientes." },
      { status: 403 },
    );
  }
  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  try {
    await addPausedSlug(slug);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
  revalidate(slug);
  return NextResponse.json({ ok: true, paused: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json(
      { error: "Não há permissões suficientes." },
      { status: 403 },
    );
  }
  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  try {
    await removePausedSlug(slug);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
  revalidate(slug);
  return NextResponse.json({ ok: true, paused: false });
}
