// POST → add a new employee to the SuperAdmin roster.
// Auth-gated by the admin cookie.

import { NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import {
  addEmployee,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_STATUSES,
  type EmployeeStatus,
} from "@/lib/admin-employees-store";

export const runtime = "nodejs";

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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";
  const rawDepts = Array.isArray(body.departments) ? body.departments : [];
  const departments = Array.from(
    new Set(
      rawDepts
        .filter((d): d is string => typeof d === "string")
        .map((d) => d.trim())
        .filter(
          (d) =>
            d.length > 0 &&
            (EMPLOYEE_DEPARTMENTS as readonly string[]).includes(d),
        ),
    ),
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

  // Optional operational fields — validated the same way the [id] PUT
  // route does so the Add form can set everything up front.
  let startingDate: string | null = null;
  if ("startingDate" in body) {
    const raw = body.startingDate;
    if (raw === null || raw === "") {
      startingDate = null;
    } else if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      startingDate = raw;
    } else {
      return NextResponse.json(
        { error: "startingDate must be yyyy-mm-dd or null" },
        { status: 400 },
      );
    }
  }

  let monthlyValue: number | null = null;
  if ("monthlyValue" in body) {
    const raw = body.monthlyValue;
    if (raw === null || raw === "") {
      monthlyValue = null;
    } else {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "monthlyValue must be a non-negative number or null" },
          { status: 400 },
        );
      }
      monthlyValue = Math.round(n * 100) / 100;
    }
  }

  let status: EmployeeStatus = "onboarding";
  if (typeof body.status === "string") {
    const v = body.status as EmployeeStatus;
    if (!(EMPLOYEE_STATUSES as readonly string[]).includes(v)) {
      return NextResponse.json(
        { error: `status must be one of ${EMPLOYEE_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    status = v;
  }

  const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : "";

  try {
    const record = await addEmployee({
      name,
      email,
      role,
      departments,
      startingDate,
      monthlyValue,
      status,
      notes,
    });
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Add failed: ${message}` },
      { status: 500 },
    );
  }
}
