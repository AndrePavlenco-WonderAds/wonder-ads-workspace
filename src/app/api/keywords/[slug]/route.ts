import { NextResponse } from "next/server";
import { getKeywordData } from "@/lib/gsc";

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const daysParam = Number(new URL(req.url).searchParams.get("days"));
  const days =
    Number.isFinite(daysParam) && daysParam > 0
      ? Math.min(Math.round(daysParam), 480)
      : 28;
  const data = await getKeywordData(slug, days);
  return NextResponse.json(data, {
    // GSC data only refreshes daily — let the browser/CDN cache for an hour.
    headers: { "Cache-Control": "public, s-maxage=3600, max-age=600" },
  });
}
