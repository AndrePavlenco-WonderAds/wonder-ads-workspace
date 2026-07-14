// Set / clear a client's custom logo (Blob URL). Admin-gated. The file
// itself is uploaded to Vercel Blob via /api/files/upload on the client;
// this endpoint only stores the resulting URL as an override.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import { setClientLogo, removeClientLogo } from "@/lib/admin-client-logos-store";

export const runtime = "nodejs";

function revalidate(slug: string) {
  revalidatePath("/admin/projects");
  revalidatePath("/admin/finances");
  revalidatePath("/seo");
  revalidatePath(`/seo/${slug}`);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url : "";
  try {
    const saved = await setClientLogo(slug, url);
    revalidate(slug);
    return NextResponse.json({ ok: true, url: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  try {
    await removeClientLogo(slug);
    revalidate(slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
