// List + create + delete stored ADS report metadata for a client.
// Gated behind the workspace session.

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";
import {
  getAdsReports,
  addAdsReport,
  deleteAdsReport,
} from "@/lib/ads/ads-reports-store";
import { getAdsPerformance, parseWindow, windowLabel, type AdsWindow, type PlatformFilter } from "@/lib/ads/ads-data";
import { getClientLocale } from "@/lib/client-locale";

function localizedWindowLabel(w: AdsWindow, locale: "pt" | "en"): string {
  if (locale === "pt") return windowLabel(w);
  switch (w.mode) {
    case "week":
      return "This week";
    case "month":
      return "This month";
    case "quarter":
      return "This quarter";
    case "days":
      return `Last ${w.days} days`;
  }
}

function reportKind(mode: string, locale: "pt" | "en"): string {
  const map = {
    pt: {
      week: "Report semanal",
      month: "Report mensal",
      quarter: "Report trimestral",
      days: "Report",
    },
    en: {
      week: "Weekly report",
      month: "Monthly report",
      quarter: "Quarterly report",
      days: "Report",
    },
  } as const;
  const m = (["week", "month", "quarter", "days"] as const).includes(
    mode as "week",
  )
    ? (mode as "week" | "month" | "quarter" | "days")
    : "days";
  return map[locale][m];
}

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const reports = await getAdsReports(slug);
  return NextResponse.json({ reports });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty body is fine — fall back to defaults below */
  }
  const platform: PlatformFilter =
    body.platform === "google" || body.platform === "meta"
      ? body.platform
      : "all";
  const windowMode = typeof body.windowMode === "string" ? body.windowMode : "week";
  const window = parseWindow(
    windowMode,
    typeof body.days === "number" ? String(body.days) : null,
  );
  // Localise the report label by the client's language (EN for English
  // clients like IHN, PT otherwise) rather than trusting the client body.
  const locale = getClientLocale(slug);
  const kind = reportKind(windowMode, locale);

  // Snapshot the CURRENT real performance (null KPIs when not connected —
  // we never snapshot invented numbers).
  const perf = await getAdsPerformance(slug, { platform, window });
  try {
    const report = await addAdsReport(slug, {
      kind,
      windowLabel: localizedWindowLabel(window, locale),
      platform,
      kpis: perf.kpis,
    });
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${message}` }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    const reports = await deleteAdsReport(slug, id);
    return NextResponse.json({ ok: true, reports });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${message}` }, { status: 500 });
  }
}
