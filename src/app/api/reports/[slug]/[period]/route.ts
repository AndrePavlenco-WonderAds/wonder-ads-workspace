// Manual edits to a stored monthly report: fill / clear / N/A the lead channels
// that couldn't be pulled (GBP + non-instrumented events), edit the notes, and
// move the status. After any edit the derived parts (consolidated total, exec
// summary, GBP mirror, status) are recomputed so the report is always coherent.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getReport, saveReport } from "@/lib/report/report-store";
import { recomputeDerived } from "@/lib/report/report-build";
import {
  manualMetric,
  naMetric,
  pendingMetric,
  type LeadChannelKey,
  type MonthlyReportSnapshot,
  type ReportStatus,
} from "@/lib/report/report-types";

export const runtime = "nodejs";

const GBP_KEYS: LeadChannelKey[] = ["gbpWebsite", "gbpDirections", "gbpCall"];

/** One channel edit: a number fills it, "na" marks N/A, null resets to pending. */
type ChannelEdit = number | "na" | null;

export async function PUT(
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

  const body = (await req.json().catch(() => ({}))) as {
    channels?: Partial<Record<LeadChannelKey, ChannelEdit>>;
    notes?: unknown;
    status?: unknown;
  };

  let next: MonthlyReportSnapshot = { ...snap };

  // Apply per-channel manual edits.
  if (body.channels && typeof body.channels === "object") {
    next = {
      ...next,
      leads: {
        ...next.leads,
        channels: next.leads.channels.map((c) => {
          if (!(c.key in body.channels!)) return c;
          const edit = body.channels![c.key];
          const resetSource = GBP_KEYS.includes(c.key) ? "manual" : "na";
          let metric = c.metric;
          if (typeof edit === "number" && Number.isFinite(edit) && edit >= 0) {
            metric = manualMetric(Math.round(edit), "count");
          } else if (edit === "na") {
            metric = naMetric("count");
          } else if (edit === null) {
            metric = pendingMetric("count", resetSource);
          }
          return { ...c, metric };
        }),
      },
    };
  }

  if (typeof body.notes === "string") {
    next = { ...next, notes: body.notes.slice(0, 4000) };
  }

  // Recompute derived fields (total, exec summary, GBP mirror, status).
  next = recomputeDerived(next);

  // Explicit status override (e.g. mark "sent"). Never allow "ready" while
  // something is still unresolved — recompute already forced "draft" there.
  const wanted = body.status as ReportStatus | undefined;
  if (wanted === "sent") next = { ...next, status: "sent" };
  else if (wanted === "draft") next = { ...next, status: "draft" };

  try {
    await saveReport(next);
    revalidatePath(`/seo/${slug}/report/${period}`);
    revalidatePath(`/${slug}/preview/report/${period}`);
    return NextResponse.json({ ok: true, status: next.status });
  } catch (err) {
    console.error("report patch failed:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
