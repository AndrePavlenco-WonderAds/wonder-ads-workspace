// Begin the Meta OAuth consent (ads manager grants ads_read on the ad accounts
// they manage). Session-gated. The dev only sets META_APP_ID/SECRET in env.

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";

export const runtime = "nodejs";

const META_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

export async function GET(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: "META_APP_ID em falta nas env vars." },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const origin = url.origin;
  const returnTo = url.searchParams.get("returnTo") || "/ads";
  const redirectUri = `${origin}/api/ads/oauth/meta/callback`;
  const state = crypto.randomUUID();

  const auth = new URL(`https://www.facebook.com/${META_VERSION}/dialog/oauth`);
  auth.searchParams.set("client_id", appId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "ads_read,business_management");
  auth.searchParams.set("state", state);

  const res = NextResponse.redirect(auth.toString());
  res.cookies.set("ads_oauth_state", `${state}|${returnTo}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
