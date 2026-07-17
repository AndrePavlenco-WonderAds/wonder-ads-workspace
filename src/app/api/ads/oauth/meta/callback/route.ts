// Meta OAuth callback — exchanges the code for a short-lived token, upgrades it
// to a long-lived token, and stores it for the agency.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentSession } from "@/lib/auth/server";
import { setMetaOAuth } from "@/lib/ads/ads-oauth-store";

export const runtime = "nodejs";

const META_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

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
    return back("?ads_connect=meta_error");
  }

  try {
    const appId = process.env.META_APP_ID ?? "";
    const appSecret = process.env.META_APP_SECRET ?? "";
    const redirectUri = `${url.origin}/api/ads/oauth/meta/callback`;

    // 1) code → short-lived token
    const shortUrl = new URL(
      `https://graph.facebook.com/${META_VERSION}/oauth/access_token`,
    );
    shortUrl.searchParams.set("client_id", appId);
    shortUrl.searchParams.set("client_secret", appSecret);
    shortUrl.searchParams.set("redirect_uri", redirectUri);
    shortUrl.searchParams.set("code", code);
    const shortRes = await fetch(shortUrl.toString());
    if (!shortRes.ok) throw new Error(`short token ${shortRes.status}: ${await shortRes.text()}`);
    const shortJson = (await shortRes.json()) as { access_token?: string };
    if (!shortJson.access_token) throw new Error("no short access_token");

    // 2) short-lived → long-lived token
    const longUrl = new URL(
      `https://graph.facebook.com/${META_VERSION}/oauth/access_token`,
    );
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", appId);
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("fb_exchange_token", shortJson.access_token);
    const longRes = await fetch(longUrl.toString());
    if (!longRes.ok) throw new Error(`long token ${longRes.status}: ${await longRes.text()}`);
    const longJson = (await longRes.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    const token = longJson.access_token ?? shortJson.access_token;
    const expiresAt =
      typeof longJson.expires_in === "number"
        ? Date.now() + longJson.expires_in * 1000
        : null;

    const session = await getCurrentSession();
    await setMetaOAuth(token, expiresAt, session?.u, Date.now());
    return back("?ads_connect=meta_ok");
  } catch (err) {
    console.error("Meta OAuth callback failed:", err);
    return back("?ads_connect=meta_error");
  }
}
