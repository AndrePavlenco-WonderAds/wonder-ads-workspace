// PUT a single admin client record. Auth-gated by the admin cookie.

import { NextResponse } from "next/server";
import { isAdminUnlocked } from "@/lib/admin-auth";
import {
  saveAdminRecord,
  BILLING_CADENCES,
  CLIENT_STATUSES,
  CURRENCIES,
  type BillingCadence,
  type ClientStatus,
  type Currency,
  type AdminClientRecord,
} from "@/lib/admin-clients-store";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await isAdminUnlocked())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Build a sanitised patch — only let through the fields we know about,
  // each validated to their respective shape. Skip undefined fields so
  // the client can submit partial patches.
  const patch: Partial<Omit<AdminClientRecord, "slug" | "updatedAt">> = {};

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
    // Dedupe while preserving order — the array is small (≤ ~6 names)
    // so a Set-based pass is fine.
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

  if (typeof body.notes === "string") {
    patch.notes = body.notes.slice(0, 2000);
  }

  try {
    const saved = await saveAdminRecord(slug, patch);
    return NextResponse.json({ ok: true, record: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Save failed: ${message}` },
      { status: 500 },
    );
  }
}
