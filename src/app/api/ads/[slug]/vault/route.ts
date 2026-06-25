// GET / PUT the per-client ADS Campaign Vault. Gated behind the
// workspace session. PUT replaces the whole list (client sends the full
// array after add/remove).

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";
import { getVault, saveVault } from "@/lib/ads/ads-vault-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const items = await getVault(slug);
  return NextResponse.json({ items });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const list = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)
      ? (body as { items: unknown[] }).items
      : null;
  if (!list) {
    return NextResponse.json(
      { error: "Body must be an array or { items: [...] }" },
      { status: 400 },
    );
  }
  try {
    const items = await saveVault(slug, list);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${message}` }, { status: 500 });
  }
}
