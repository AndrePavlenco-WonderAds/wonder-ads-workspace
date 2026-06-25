// List / add / delete admin-added clients (the "Add client" row on the
// Clients table). Admin-gated.

import { NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import {
  getExtraClients,
  addExtraClient,
  deleteExtraClient,
} from "@/lib/admin-extra-clients-store";
import { CLIENT_DEPARTMENTS, type ClientDepartment } from "@/lib/admin-clients-store";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  return NextResponse.json({ clients: await getExtraClients() });
}

export async function POST(req: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const departments = Array.isArray(body.departments)
    ? (body.departments.filter((d): d is ClientDepartment =>
        (CLIENT_DEPARTMENTS as readonly string[]).includes(d as string),
      ) as ClientDepartment[])
    : [];
  const icon = typeof body.icon === "string" ? body.icon : undefined;
  const website = typeof body.website === "string" ? body.website : undefined;
  try {
    const client = await addExtraClient({ title, departments, icon, website });
    return NextResponse.json({ ok: true, client });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  try {
    const clients = await deleteExtraClient(slug);
    return NextResponse.json({ ok: true, clients });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
