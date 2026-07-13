// Internal endpoint: log that the consultant sent the survey link, or
// change the reminder cadence. Auth-gated in-route because the /api/nps
// prefix is NOT matched by middleware (the sibling /submit route must stay
// public for clients).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import {
  recordNpsSend,
  setNpsCadence,
  CADENCE_OPTIONS,
} from "@/lib/nps-store";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Empty body is fine — treated as a plain "log a send".
  }

  const now = Date.now();

  // Cadence-only update (from the cadence selector).
  if (body.action === "cadence") {
    const months = Number(body.cadenceMonths);
    if (!(CADENCE_OPTIONS as readonly number[]).includes(months)) {
      return NextResponse.json(
        { error: "Invalid cadence" },
        { status: 400 },
      );
    }
    const meta = await setNpsCadence(slug, months, now);
    revalidatePath(`/seo/${slug}/nps`);
    return NextResponse.json({ ok: true, meta });
  }

  const meta = await recordNpsSend(slug, employee.name ?? null, now);
  revalidatePath(`/seo/${slug}/nps`);
  return NextResponse.json({ ok: true, meta });
}
