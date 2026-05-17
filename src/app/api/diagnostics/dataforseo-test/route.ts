// Smoke test for DataforSEO credentials. Hits all three endpoints we use
// in the audit (domain_rank_overview, backlinks/summary, ranked_keywords)
// and returns each upstream response so we can see exactly what comes back.

import { NextResponse } from "next/server";
import { isDataforSeoConfigured } from "@/lib/seo-tools/dataforseo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestResult = {
  endpoint: string;
  ok: boolean;
  httpStatus: number;
  elapsedMs: number;
  apiStatus?: { code?: number; message?: string };
  resultCount?: number;
  cost?: number;
  summary?: unknown;
  rawBodyPreview?: string;
  error?: string;
};

async function hit(
  path: string,
  body: unknown,
  auth: string,
): Promise<TestResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`https://api.dataforseo.com/v3${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: { status_code?: number; status_message?: string; cost?: number; tasks?: { result?: unknown[] }[] } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      /* leave empty */
    }
    return {
      endpoint: path,
      ok:
        res.status === 200 &&
        typeof parsed.status_code === "number" &&
        parsed.status_code >= 20000 &&
        parsed.status_code < 30000,
      httpStatus: res.status,
      elapsedMs: Date.now() - t0,
      apiStatus: {
        code: parsed.status_code,
        message: parsed.status_message,
      },
      resultCount: parsed.tasks?.[0]?.result?.length ?? 0,
      cost: parsed.cost,
      summary: parsed.tasks?.[0]?.result?.[0] ?? null,
      rawBodyPreview: text.slice(0, 600),
    };
  } catch (err) {
    return {
      endpoint: path,
      ok: false,
      httpStatus: 0,
      elapsedMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

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
  const target = url.searchParams.get("target") || "whiteclinic.pt";

  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString("base64");

  const [rankOverview, backlinksSummary, rankedKeywords] = await Promise.all([
    hit(
      "/dataforseo_labs/google/domain_rank_overview/live",
      [{ target, location_code: 2620, language_code: "pt" }],
      auth,
    ),
    hit("/backlinks/summary/live", [{ target, include_subdomains: true }], auth),
    hit(
      "/dataforseo_labs/google/ranked_keywords/live",
      [
        {
          target,
          location_code: 2620,
          language_code: "pt",
          limit: 5,
          order_by: ["ranked_serp_element.serp_item.etv,desc"],
        },
      ],
      auth,
    ),
  ]);

  return NextResponse.json(
    { target, rankOverview, backlinksSummary, rankedKeywords },
    { status: 200 },
  );
}
