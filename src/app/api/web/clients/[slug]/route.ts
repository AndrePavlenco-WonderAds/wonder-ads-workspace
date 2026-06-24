// Web Dept client registry — single-client endpoints.
//
// GET    → one client (browser-safe).
// PUT    → replace the client record (profile edits, vault changes).
// DELETE → remove the client record (does NOT touch its projects/tickets;
//          those keep their free-text name + slug and simply stop pointing
//          at a registered profile).

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import {
  deleteClient,
  getClient,
  normaliseClient,
  saveClient,
  toPublicClient,
  webStorageConfigured,
} from "@/lib/web-clients-store";

export const runtime = "nodejs";

async function gate() {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) return null;
  return employee;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await gate())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { slug } = await ctx.params;
  const client = await getClient(slug);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ client: toPublicClient(client) });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await gate())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!webStorageConfigured) {
    return NextResponse.json(
      { error: "KV storage is not configured." },
      { status: 503 },
    );
  }
  const { slug } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  // Upsert against the existing record so a PUT to an as-yet-unregistered
  // slug (promoted from a project-derived name) creates it cleanly.
  const prev = await getClient(slug);
  const next = normaliseClient(body, slug, prev);
  await saveClient(next);
  return NextResponse.json({ client: toPublicClient(next) });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await gate())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { slug } = await ctx.params;
  await deleteClient(slug);
  return NextResponse.json({ ok: true });
}
