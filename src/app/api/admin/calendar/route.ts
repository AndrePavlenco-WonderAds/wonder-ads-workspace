// GET / PUT the custom calendar events behind the Overview Calendário.
// Admin-gated. PUT replaces the whole list (the client sends the full
// array after any add / edit / delete) — low volume, single admin team.

import { NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import {
  getCalendarEvents,
  saveCalendarEvents,
} from "@/lib/calendar-events-store";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const events = await getCalendarEvents();
  return NextResponse.json({ events });
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
    : body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events)
      ? (body as { events: unknown[] }).events
      : null;
  if (!list) {
    return NextResponse.json(
      { error: "Body must be an array of events or { events: [...] }" },
      { status: 400 },
    );
  }
  try {
    const saved = await saveCalendarEvents(list);
    return NextResponse.json({ ok: true, events: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Save failed: ${message}` },
      { status: 500 },
    );
  }
}
