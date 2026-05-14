import { NextResponse } from "next/server";
import { getGa4Data } from "@/lib/ga4";
import { GA4_CHANNELS, type Ga4Channel } from "@/lib/analytics";

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const url = new URL(req.url);

  const daysParam = Number(url.searchParams.get("days"));
  const days =
    Number.isFinite(daysParam) && daysParam > 0
      ? Math.min(Math.round(daysParam), 480)
      : 28;

  const channelParam = url.searchParams.get("channel");
  const channel: Ga4Channel = GA4_CHANNELS.some((c) => c.value === channelParam)
    ? (channelParam as Ga4Channel)
    : "all";

  const data = await getGa4Data(slug, days, channel);
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
