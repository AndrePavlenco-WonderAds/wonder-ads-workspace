// PUT a single per-(slug, department) admin client record. Auth-gated
// by the admin cookie. Replaces the v74.13 `/api/admin/clients/[slug]`
// endpoint which couldn't disambiguate shared SEO + ADS clients into
// their per-department budget rows.

import { NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import {
  saveAdminRecord,
  BILLING_CADENCES,
  CLIENT_DEPARTMENTS,
  CLIENT_STATUSES,
  CURRENCIES,
  INVOICE_TYPES,
  type AdminClientRecord,
  type BillingCadence,
  type ClientDepartment,
  type ClientStatus,
  type Currency,
  type InvoiceType,
} from "@/lib/admin-clients-store";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string; department: string }> },
) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { slug, department: rawDept } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  const department = CLIENT_DEPARTMENTS.find(
    (d) => d.toLowerCase() === rawDept.toLowerCase(),
  );
  if (!department) {
    return NextResponse.json(
      {
        error: `department must be one of ${CLIENT_DEPARTMENTS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Partial<
    Omit<AdminClientRecord, "slug" | "department" | "updatedAt">
  > = {};

  if (typeof body.billingCadence === "string") {
    const v = body.billingCadence as BillingCadence;
    if (!(BILLING_CADENCES as readonly string[]).includes(v)) {
      return NextResponse.json(
        { error: `billingCadence must be one of ${BILLING_CADENCES.join(", ")}` },
        { status: 400 },
      );
    }
    patch.billingCadence = v;
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

  if ("consultants" in body) {
    const raw = body.consultants;
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: "consultants must be an array of strings" },
        { status: 400 },
      );
    }
    const cleaned = raw
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim().slice(0, 80))
      .filter((v) => v.length > 0);
    patch.consultants = Array.from(new Set(cleaned));
  }

  if (typeof body.status === "string") {
    const v = body.status as ClientStatus;
    if (!(CLIENT_STATUSES as readonly string[]).includes(v)) {
      return NextResponse.json(
        { error: `status must be one of ${CLIENT_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    patch.status = v;
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

  if (typeof body.invoiceType === "string") {
    const v = body.invoiceType as InvoiceType;
    if (!(INVOICE_TYPES as readonly string[]).includes(v)) {
      return NextResponse.json(
        { error: `invoiceType must be one of ${INVOICE_TYPES.join(", ")}` },
        { status: 400 },
      );
    }
    patch.invoiceType = v;
  }

  if ("invoiceDate" in body) {
    const raw = body.invoiceDate;
    if (raw === null || raw === "") {
      patch.invoiceDate = null;
    } else if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      patch.invoiceDate = raw;
    } else {
      return NextResponse.json(
        { error: "invoiceDate must be yyyy-mm-dd or null" },
        { status: 400 },
      );
    }
  }

  if ("iva" in body) {
    const raw = body.iva;
    if (raw === null || raw === "") {
      patch.iva = null;
    } else {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "iva must be a non-negative number or null" },
          { status: 400 },
        );
      }
      patch.iva = Math.round(n * 100) / 100;
    }
  }

  if (typeof body.notes === "string") {
    patch.notes = body.notes.slice(0, 2000);
  }

  // The caller can optionally tell us which departments this client
  // belongs to so the legacy-record migration knows which dept owns
  // the legacy monthlyValue. When omitted we fall back to [department]
  // which preserves the same row's value as-is.
  const clientDepartments =
    Array.isArray(body.clientDepartments)
      ? (body.clientDepartments.filter((d): d is ClientDepartment =>
          (CLIENT_DEPARTMENTS as readonly string[]).includes(d as string),
        ) as ClientDepartment[])
      : [department];

  try {
    const saved = await saveAdminRecord(
      slug,
      department,
      patch,
      clientDepartments,
    );
    return NextResponse.json({ ok: true, record: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Save failed: ${message}` },
      { status: 500 },
    );
  }
}
