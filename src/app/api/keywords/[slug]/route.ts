import { NextResponse } from "next/server";
import { getKeywordData } from "@/lib/gsc";

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const data = await getKeywordData(slug);
  return NextResponse.json(data, {
    // GSC data only refreshes daily — let the browser/CDN cache for an hour.
    headers: { "Cache-Control": "public, s-maxage=3600, max-age=600" },
  });
}
