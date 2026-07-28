// Why is a client's GA4 panel showing "Not connected"?
//
// Reports the whole resolution chain — auth configured, how many stream
// hosts got indexed, whether any property's dataStreams call failed (an
// incomplete index is the usual cause of a false "Not connected"), and
// which hosts share the client's registrable domain.
//
//   /api/diagnostics/ga4-test                → every SEO client
//   /api/diagnostics/ga4-test?slug=safe-away → one client
//
// Session-gated by middleware (/api/diagnostics/:path*).

import { NextResponse } from "next/server";
import { explainGa4Resolution } from "@/lib/ga4";
import { googleAuthConfigured } from "@/lib/google-auth";
import { CLIENT_WEBSITES } from "@/lib/client-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!googleAuthConfigured) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          "GOOGLE_SERVICE_ACCOUNT_JSON is not set on this deployment — every client will read as Not connected.",
      },
      { status: 200 },
    );
  }

  const slug = new URL(req.url).searchParams.get("slug");
  const slugs = slug
    ? [slug]
    : Object.entries(CLIENT_WEBSITES)
        .filter(([, url]) => url)
        .map(([s]) => s);

  try {
    const results = [];
    for (const s of slugs) {
      results.push(await explainGa4Resolution(s));
    }
    const unresolved = results.filter((r) => !r.propertyId).map((r) => r.slug);
    const failed = results[0]?.failedProperties ?? [];
    return NextResponse.json({
      ok: true,
      indexedHosts: results[0]?.indexedHosts ?? 0,
      // Non-empty ⇒ the index is incomplete and any client whose property
      // is in here is a FALSE "Not connected".
      failedProperties: failed,
      indexComplete: failed.length === 0,
      unresolved,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        reason: err instanceof Error ? err.message : "GA4 diagnostics failed",
      },
      { status: 200 },
    );
  }
}
