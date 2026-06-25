// GET / PUT the set of completed "próximas ações". Admin-gated. PUT
// replaces the whole list (client sends the full array after a tick /
// undo) — low volume, single admin team.

import { NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import { getDoneActions, saveDoneActions } from "@/lib/actions-done-store";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const done = await getDoneActions();
  return NextResponse.json({ done });
}

export async function PUT(req: Request) {
  if (!(await isCurrentUserAdmin())) {
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
    : body && typeof body === "object" && Array.isArray((body as { done?: unknown }).done)
      ? (body as { done: unknown[] }).done
      : null;
  if (!list) {
    return NextResponse.json(
      { error: "Body must be an array or { done: [...] }" },
      { status: 400 },
    );
  }
  try {
    const saved = await saveDoneActions(list);
    return NextResponse.json({ ok: true, done: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${message}` }, { status: 500 });
  }
}
