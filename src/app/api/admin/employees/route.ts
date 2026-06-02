// POST → add a new employee to the SuperAdmin roster.
// Auth-gated by the admin cookie.

import { NextResponse } from "next/server";
import { isAdminUnlocked } from "@/lib/admin-auth";
import {
  addEmployee,
  EMPLOYEE_DEPARTMENTS,
} from "@/lib/admin-employees-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isAdminUnlocked())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";
  const rawDepts = Array.isArray(body.departments) ? body.departments : [];
  const departments = rawDepts
    .filter((d): d is string => typeof d === "string")
    .map((d) => d.trim())
    .filter(
      (d) =>
        d.length > 0 && (EMPLOYEE_DEPARTMENTS as readonly string[]).includes(d),
    );

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 },
    );
  }

  try {
    const record = await addEmployee({ name, email, role, departments });
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Add failed: ${message}` },
      { status: 500 },
    );
  }
}
