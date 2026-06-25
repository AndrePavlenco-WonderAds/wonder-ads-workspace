// Live ADS performance for a client + window + platform filter. Returns
// real platform data only (or the not-connected state) — never invented
// figures. Gated behind the workspace session (middleware also enforces).

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";
import {
  getAdsPerformance,
  parseWindow,
  type PlatformFilter,
} from "@/lib/ads/ads-data";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const platformRaw = url.searchParams.get("platform");
  const platform: PlatformFilter =
    platformRaw === "google" || platformRaw === "meta" ? platformRaw : "all";
  const window = parseWindow(
    url.searchParams.get("window"),
    url.searchParams.get("days"),
  );
  const performance = await getAdsPerformance(slug, { platform, window });
  return NextResponse.json({ performance });
}
