// GET / PUT the shared SEO directory database.
//
// Any logged-in workspace user can read AND edit — it's a working tool for
// the SEO team, not an admin-only resource. PUT replaces the whole array
// (the client sends the full list after any add / edit / delete), matching
// the calendar-events store pattern.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  getDirectories,
  saveDirectories,
} from "@/lib/seo-directories-store";

export const runtime = "nodejs";

export async function GET() {
  if (!(await getCurrentEmployee())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const directories = await getDirectories();
  return NextResponse.json({ directories });
}

export async function PUT(req: Request) {
  if (!(await getCurrentEmployee())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const list = Array.isArray(body)
    ? body
    : body &&
        typeof body === "object" &&
        Array.isArray((body as { directories?: unknown }).directories)
      ? (body as { directories: unknown[] }).directories
      : null;
  if (!list) {
    return NextResponse.json(
      { error: "Body must be an array or { directories: [...] }" },
      { status: 400 },
    );
  }
  try {
    const saved = await saveDirectories(list);
    return NextResponse.json({ ok: true, directories: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${message}` }, { status: 500 });
  }
}
