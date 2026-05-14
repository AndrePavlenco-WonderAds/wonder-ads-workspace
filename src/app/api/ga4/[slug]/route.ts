import { NextResponse } from "next/server";
import { getGa4Data } from "@/lib/ga4";

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const data = await getGa4Data(slug);
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
