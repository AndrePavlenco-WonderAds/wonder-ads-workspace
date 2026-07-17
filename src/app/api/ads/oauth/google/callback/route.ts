// Google Ads OAuth callback — exchanges the code for a refresh token and stores
// it for the agency. Verifies the state cookie set by /start.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentSession } from "@/lib/auth/server";
import { setGoogleOAuth } from "@/lib/ads/ads-oauth-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const raw = store.get("ads_oauth_state")?.value ?? "";
  const [expectedState, returnToRaw] = raw.split("|");
  const returnTo = returnToRaw || "/ads";
  const back = (params: string) => {
    const res = NextResponse.redirect(new URL(`${returnTo}${params}`, url.origin));
    res.cookies.delete("ads_oauth_state");
    return res;
  };

  if (!code || !state || !expectedState || state !== expectedState) {
    return back("?ads_connect=google_error");
  }

  try {
    const redirectUri = `${url.origin}/api/ads/oauth/google/callback`;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) throw new Error(`token exchange ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { refresh_token?: string };
    if (!json.refresh_token) throw new Error("no refresh_token returned");

    const session = await getCurrentSession();
    await setGoogleOAuth(json.refresh_token, session?.u, Date.now());
    return back("?ads_connect=google_ok");
  } catch (err) {
    console.error("Google Ads OAuth callback failed:", err);
    return back("?ads_connect=google_error");
  }
}
