// Generate (or regenerate) a client's monthly report for a given period.
// Pulls GA4 + GSC live, assembles the snapshot, persists it. GBP + any
// non-instrumented lead events come back as "pending" and are filled via the
// manual-input step (PUT ../[period]) before the report is client-ready.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getClientBySlug } from "@/lib/notion";
import { buildMonthlyReport } from "@/lib/report/report-build";
import { saveReport } from "@/lib/report/report-store";
import { isValidPeriodKey, previousCompleteMonth } from "@/lib/report/report-dates";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) {
    return NextResponse.json({ error: "unknown client" }, { status: 404 });
  }

  let period: string;
  try {
    const body = (await req.json().catch(() => ({}))) as { period?: unknown };
    period =
      typeof body.period === "string" && isValidPeriodKey(body.period)
        ? body.period
        : previousCompleteMonth().key;
  } catch {
    period = previousCompleteMonth().key;
  }

  try {
    // Generating only pulls data + persists the draft. The #client-wins
    // announcement is deliberately NOT fired here — it fires when the
    // consultant clicks "Finalizar" (see ../[period]/finalize), after the
    // manual data is filled in.
    const snapshot = await buildMonthlyReport(slug, client.title, period);
    await saveReport(snapshot);
    revalidatePath(`/seo/${slug}`);
    revalidatePath(`/seo/${slug}/report/${period}`);
    return NextResponse.json({
      ok: true,
      period,
      status: snapshot.status,
      fetch: snapshot.fetch,
    });
  } catch (err) {
    console.error("monthly report generate failed:", err);
    return NextResponse.json(
      { error: "generate_failed", message: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
