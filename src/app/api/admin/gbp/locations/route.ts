// GBP diagnostics + location pinning (SEO editors only).
//
// GET  → every Business Profile location the service account can see, each with
//        its websiteUri + host, plus the host we auto-match per client. Use it
//        to confirm the API is live and to see WHY a client didn't match (wrong
//        or missing website on the listing).
// POST → pin a client's GBP location id override: { slug, locationId }. Pass an
//        empty/"null" locationId to clear the override (back to auto-match).

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { listGbpLocationsForDiagnostics } from "@/lib/gbp";
import { CLIENT_WEBSITES } from "@/lib/client-meta";
import { getReportConfig, saveReportConfig } from "@/lib/report/report-config-store";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireSeoEditor() {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) return null;
  return employee;
}

export async function GET() {
  if (!(await requireSeoEditor())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await listGbpLocationsForDiagnostics();
  return NextResponse.json({
    ...result,
    // The website host we try to auto-match against, per client — so a mismatch
    // is obvious side by side with the listings above.
    clientWebsites: CLIENT_WEBSITES,
  });
}

export async function POST(req: Request) {
  if (!(await requireSeoEditor())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    slug?: unknown;
    locationId?: unknown;
  };
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  // Empty string / "null" clears the override (back to website auto-match).
  const raw = typeof body.locationId === "string" ? body.locationId.trim() : "";
  const gbpLocationId = raw && raw.toLowerCase() !== "null" ? raw : null;

  try {
    const config = await saveReportConfig(slug, { gbpLocationId }, Date.now());
    return NextResponse.json({ ok: true, slug, gbpLocationId: config.gbpLocationId });
  } catch (err) {
    console.error("gbp pin save failed:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}

// Surface the current override too, so a GET on ?slug= can confirm what's pinned.
export async function PATCH(req: Request) {
  if (!(await requireSeoEditor())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const config = await getReportConfig(slug);
  return NextResponse.json({ slug, gbpLocationId: config.gbpLocationId });
}
