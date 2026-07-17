// Begin the Google Ads OAuth consent (ads manager grants the app access to the
// accounts they manage). Session-gated. Redirects to Google; the callback
// stores the refresh token. The dev only sets GOOGLE_ADS_CLIENT_ID/SECRET in
// env — no client-account access needed on the dev side.

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_ADS_CLIENT_ID em falta nas env vars." },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const origin = url.origin;
  const returnTo = url.searchParams.get("returnTo") || "/ads";
  const redirectUri = `${origin}/api/ads/oauth/google/callback`;
  const state = crypto.randomUUID();

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");
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
