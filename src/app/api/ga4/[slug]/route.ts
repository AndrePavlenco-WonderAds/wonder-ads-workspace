import { NextResponse } from "next/server";
import { getGa4Data } from "@/lib/ga4";

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const data = await getGa4Data(slug);
  return NextResponse.json(data, {
    // GA4 data refreshes through the day — cache for an hour at the edge.
    headers: { "Cache-Control": "public, s-maxage=3600, max-age=600" },
  });
}
