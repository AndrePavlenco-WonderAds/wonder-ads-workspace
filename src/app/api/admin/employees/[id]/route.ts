// PUT a single employee record (partial patch) + DELETE remove.
// Auth-gated by the admin cookie.

import { NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import {
  saveEmployeeRecord,
  deleteEmployee,
  EMPLOYEE_STATUSES,
  EMPLOYEE_DEPARTMENTS,
  type EmployeeStatus,
  type AdminEmployeeRecord,
} from "@/lib/admin-employees-store";
import {
  BILLING_CADENCES,
  CURRENCIES,
  type BillingCadence,
  type Currency,
} from "@/lib/admin-clients-store";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Partial<Omit<AdminEmployeeRecord, "id" | "updatedAt">> = {};

  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (v) patch.name = v.slice(0, 80);
  }
  if (typeof body.email === "string") {
    const v = body.email.trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    patch.email = v.slice(0, 120);
  }
  if (typeof body.role === "string") {
    patch.role = body.role.trim().slice(0, 80);
  }
  if (Array.isArray(body.departments)) {
    const cleaned = body.departments
      .filter((d): d is string => typeof d === "string")
      .map((d) => d.trim())
      .filter(
        (d) =>
          d.length > 0 &&
          (EMPLOYEE_DEPARTMENTS as readonly string[]).includes(d),
      );
    patch.departments = Array.from(new Set(cleaned));
  }
  if ("startingDate" in body) {
    const raw = body.startingDate;
    if (raw === null || raw === "") {
      patch.startingDate = null;
    } else if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      patch.startingDate = raw;
    } else {
      return NextResponse.json(
        { error: "startingDate must be yyyy-mm-dd or null" },
        { status: 400 },
      );
    }
  }
  if (typeof body.paymentCadence === "string") {
    const v = body.paymentCadence as BillingCadence;
    if (!(BILLING_CADENCES as readonly string[]).includes(v)) {
      return NextResponse.json(
        { error: `paymentCadence must be one of ${BILLING_CADENCES.join(", ")}` },
        { status: 400 },
      );
    }
    patch.paymentCadence = v;
  }
  if (typeof body.currency === "string") {
    const v = body.currency as Currency;
    if (!(CURRENCIES as readonly string[]).includes(v)) {
      return NextResponse.json(
        { error: `currency must be one of ${CURRENCIES.join(", ")}` },
        { status: 400 },
      );
    }
    patch.currency = v;
  }
  if ("monthlyValue" in body) {
    const raw = body.monthlyValue;
    if (raw === null || raw === "") {
      patch.monthlyValue = null;
    } else {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "monthlyValue must be a non-negative number or null" },
          { status: 400 },
        );
      }
      patch.monthlyValue = Math.round(n * 100) / 100;
    }
  }
  if (typeof body.status === "string") {
    const v = body.status as EmployeeStatus;
    if (!(EMPLOYEE_STATUSES as readonly string[]).includes(v)) {
      return NextResponse.json(
        { error: `status must be one of ${EMPLOYEE_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    patch.status = v;
  }
  if (typeof body.notes === "string") {
    patch.notes = body.notes.slice(0, 2000);
  }

  try {
    const record = await saveEmployeeRecord(id, patch);
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Save failed: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    await deleteEmployee(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Delete failed: ${message}` },
      { status: 500 },
    );
  }
}
