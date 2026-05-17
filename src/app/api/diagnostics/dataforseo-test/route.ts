// Quick smoke test for DataforSEO credentials. Hits a single cheap endpoint
// (domain_rank_overview against a known domain) and returns the raw upstream
// response so we can see auth / quota errors directly. Public-safe: no
// credentials are leaked, only the API's own status + message.

import { NextResponse } from "next/server";
import { isDataforSeoConfigured } from "@/lib/seo-tools/dataforseo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isDataforSeoConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        reason: "env-missing",
        message:
          "DATAFORSEO_LOGIN and/or DATAFORSEO_PASSWORD are not set in this deployment's env.",
      },
      { status: 200 },
    );
  }

  const url = new URL(req.url);
  const target = url.searchParams.get("target") || "wonder-ads.com";

  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString("base64");

  const t0 = Date.now();
  let upstreamStatus = 0;
  let upstreamBody = "";
  try {
    const res = await fetch(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          { target, location_code: 2620, language_code: "pt" },
        ]),
        cache: "no-store",
      },
    );
    upstreamStatus = res.status;
    upstreamBody = await res.text();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        reason: "fetch-failed",
        message: err instanceof Error ? err.message : String(err),
        elapsedMs: Date.now() - t0,
      },
      { status: 200 },
    );
  }

  // Parse DataforSEO's outer status — they always return 200 HTTP, but the
  // body contains their own status_code (20000 = ok, 40xxx = client error).
  let parsedSummary: unknown = null;
  let topLevelStatus: { code?: number; message?: string } = {};
  try {
    const json = JSON.parse(upstreamBody);
    topLevelStatus = {
      code: json?.status_code,
      message: json?.status_message,
    };
    parsedSummary = {
      status_code: json?.status_code,
      status_message: json?.status_message,
      tasks_count: json?.tasks_count,
      tasks_error: json?.tasks_error,
      tasks: json?.tasks?.map((t: { id?: string; status_code?: number; status_message?: string }) => ({
        id: t.id,
        status_code: t.status_code,
        status_message: t.status_message,
      })),
      cost: json?.cost,
    };
  } catch {
    /* leave raw body */
  }

  const ok =
    upstreamStatus === 200 &&
    typeof topLevelStatus.code === "number" &&
    topLevelStatus.code >= 20000 &&
    topLevelStatus.code < 30000;

  return NextResponse.json(
    {
      ok,
      target,
      httpStatus: upstreamStatus,
      elapsedMs: Date.now() - t0,
      apiStatus: topLevelStatus,
      summary: parsedSummary,
      rawBodyPreview: upstreamBody.slice(0, 800),
    },
    { status: 200 },
  );
}
