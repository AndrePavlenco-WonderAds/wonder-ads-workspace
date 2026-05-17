// Env-presence diagnostic. Returns whether each expected integration is
// configured at the function runtime — no actual values, just presence +
// length so the user can confirm a paste wasn't empty.
//
// Public on purpose (no values leak); useful for the user to debug "why isn't
// DataforSEO connecting" without having to dig in Vercel logs.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function check(name: string) {
  const v = process.env[name];
  return {
    present: typeof v === "string" && v.length > 0,
    length: typeof v === "string" ? v.length : 0,
  };
}

export async function GET() {
  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      anthropic: {
        ANTHROPIC_API_KEY: check("ANTHROPIC_API_KEY"),
      },
      dataforseo: {
        DATAFORSEO_LOGIN: check("DATAFORSEO_LOGIN"),
        DATAFORSEO_PASSWORD: check("DATAFORSEO_PASSWORD"),
      },
      pagespeed: {
        PAGESPEED_API_KEY: check("PAGESPEED_API_KEY"),
      },
      google: {
        GOOGLE_SERVICE_ACCOUNT_JSON: check("GOOGLE_SERVICE_ACCOUNT_JSON"),
        GOOGLE_IMPERSONATE_SUBJECT: check("GOOGLE_IMPERSONATE_SUBJECT"),
      },
      kv: {
        KV_REST_API_URL: check("KV_REST_API_URL"),
        KV_REST_API_TOKEN: check("KV_REST_API_TOKEN"),
      },
      notion: {
        NOTION_API_KEY: check("NOTION_API_KEY"),
      },
    },
    {
      headers: { "cache-control": "no-store" },
    },
  );
}
