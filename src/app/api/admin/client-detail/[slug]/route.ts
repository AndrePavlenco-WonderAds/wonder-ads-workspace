// GET / PUT the per-client billing detail (contacts, email templates,
// notes, past invoices) behind the Clients-table pop-up. Auth-gated by
// the admin cookie. Keyed by slug only — shared across departments.

import { NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import {
  getClientDetail,
  saveClientDetail,
  normaliseDetail,
} from "@/lib/admin-client-detail-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  const detail = await getClientDetail(slug);
  return NextResponse.json({ detail });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // normaliseDetail clamps + sanitises every field, so we can hand the
  // posted body straight through as the patch.
  const clean = normaliseDetail(body, slug);
  try {
    const saved = await saveClientDetail(slug, {
      contacts: clean.contacts,
      accountingEmail: clean.accountingEmail,
      clientEmail: clean.clientEmail,
      notes: clean.notes,
      invoices: clean.invoices,
    });
    return NextResponse.json({ ok: true, detail: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Save failed: ${message}` },
      { status: 500 },
    );
  }
}
