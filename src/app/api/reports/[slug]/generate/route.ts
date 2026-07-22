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
import { getReport, saveReport } from "@/lib/report/report-store";
import { notifyClientWin } from "@/lib/report/report-win-slack";
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
    // First generation for this client+period? Checked BEFORE saveReport
    // overwrites it, so the #client-wins announcement fires once (on creation)
    // and never again on the many re-generations / manual edits that follow.
    const isFirstGeneration = !(await getReport(slug, period));

    const snapshot = await buildMonthlyReport(slug, client.title, period);
    await saveReport(snapshot);
    revalidatePath(`/seo/${slug}`);
    revalidatePath(`/seo/${slug}/report/${period}`);

    // Announce the month's wins to #client-wins. Awaited (a Vercel function
    // can freeze after the response and kill a fire-and-forget promise) but
    // never throws and is a no-op until SLACK_CLIENT_WINS_WEBHOOK_URL is set,
    // so it can't slow down or break report generation.
    if (isFirstGeneration) {
      await notifyClientWin(snapshot, new URL(req.url).origin);
    }

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
