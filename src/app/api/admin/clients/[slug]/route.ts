// PUT a single admin client record. Auth-gated by the admin cookie.

import { NextResponse } from "next/server";
import { isAdminUnlocked } from "@/lib/admin-auth";
import {
  saveAdminRecord,
  BILLING_CADENCES,
  CLIENT_STATUSES,
  type BillingCadence,
  type ClientStatus,
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

  if (typeof body.consultant === "string") {
    patch.consultant = body.consultant.trim().slice(0, 80);
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

  if ("monthlyValueEur" in body) {
    const raw = body.monthlyValueEur;
    if (raw === null || raw === "") {
      patch.monthlyValueEur = null;
    } else {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "monthlyValueEur must be a non-negative number or null" },
          { status: 400 },
        );
      }
      patch.monthlyValueEur = Math.round(n * 100) / 100;
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
