// Finalise a monthly report: the explicit step the consultant takes AFTER
// filling in the manual data. Only here (never on generate) do we announce the
// month's wins to #client-wins, and only here does the report unlock its
// client-facing actions (PDF, public link, send-for-approval). Finalising is
// re-runnable — every finalise re-announces (Andre: "em todas as gerações").

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getReport, saveReport } from "@/lib/report/report-store";
import { recomputeDerived } from "@/lib/report/report-build";
import { notifyClientWin } from "@/lib/report/report-win-slack";
import { isUnresolved } from "@/lib/report/report-types";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; period: string }> },
) {
  const { slug, period } = await params;

  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const snap = await getReport(slug, period);
  if (!snap) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Recompute first so the completeness check sees the latest manual edits, then
  // refuse to finalise while any lead metric is still unresolved (not filled,
  // not N/A) — that's exactly the data the consultant must complete first.
  const recomputed = recomputeDerived(snap);
  const pending = recomputed.leads.channels.filter((c) => isUnresolved(c.metric));
  if (pending.length > 0) {
    return NextResponse.json(
      {
        error: "incomplete",
        pending: pending.map((c) => c.label),
      },
      { status: 400 },
    );
  }

  const finalized = { ...recomputed, finalizedAt: Date.now() };

  try {
    await saveReport(finalized);
    revalidatePath(`/seo/${slug}/report/${period}`);
    revalidatePath(`/${slug}/preview/report/${period}`);
  } catch (err) {
    console.error("report finalize save failed:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  // Announce the month's wins. Fires on EVERY finalise. Never throws and is a
  // silent no-op until SLACK_CLIENT_WINS_WEBHOOK_URL is set, so a Slack outage
  // (or an unconfigured webhook) can never fail the finalise.
  const announced = await notifyClientWin(finalized, new URL(req.url).origin);

  return NextResponse.json({
    ok: true,
    announced,
    finalizedAt: finalized.finalizedAt,
    status: finalized.status,
  });
}
