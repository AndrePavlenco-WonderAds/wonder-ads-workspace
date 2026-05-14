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
  // Only cache successful responses — caching a transient error (e.g. an auth
  // blip during delegation propagation) would freeze it for the whole TTL.
  const cacheControl =
    data.status === "ok"
      ? "public, s-maxage=3600, max-age=600"
      : "no-store";
  return NextResponse.json(data, {
    headers: { "Cache-Control": cacheControl },
  });
}
