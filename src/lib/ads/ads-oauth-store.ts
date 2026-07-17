// Agency-level OAuth tokens for Google Ads + Meta, obtained in-app by the ads
// manager (who has access to the client accounts). Stored once and reused for
// every client (Google via login-customer-id + per-client customer id; Meta
// via the per-client ad account id). The dev only provides the app-level
// credentials in env; the actual account access is granted here by OAuth.
//
// Security: tokens stored plaintext in Vercel KV (encrypted at rest), and every
// route that reads/writes them is behind the workspace session.

import { kv } from "@vercel/kv";

const KEY = "ads-oauth";

export type AdsOAuth = {
  google?: {
    refreshToken: string;
    connectedAt: number;
    connectedBy?: string;
  };
  meta?: {
    accessToken: string;
    /** Epoch ms when the long-lived token expires (Meta user tokens ~60 days). */
    expiresAt: number | null;
    connectedAt: number;
    connectedBy?: string;
  };
};

export const adsOAuthStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getAdsOAuth(): Promise<AdsOAuth> {
  if (!adsOAuthStorageConfigured) return {};
  try {
    return (await kv.get<AdsOAuth>(KEY)) ?? {};
  } catch (err) {
    console.error("KV ads-oauth read failed:", err);
    return {};
  }
}

export async function setGoogleOAuth(
  refreshToken: string,
  connectedBy: string | undefined,
  nowMs: number,
): Promise<void> {
  const cur = await getAdsOAuth();
  await kv.set(KEY, {
    ...cur,
    google: { refreshToken, connectedAt: nowMs, connectedBy },
  } satisfies AdsOAuth);
}

export async function setMetaOAuth(
  accessToken: string,
  expiresAt: number | null,
  connectedBy: string | undefined,
  nowMs: number,
): Promise<void> {
  const cur = await getAdsOAuth();
  await kv.set(KEY, {
    ...cur,
    meta: { accessToken, expiresAt, connectedAt: nowMs, connectedBy },
  } satisfies AdsOAuth);
}

export async function clearAdsOAuth(platform: "google" | "meta"): Promise<void> {
  if (!adsOAuthStorageConfigured) return;
  const cur = await getAdsOAuth();
  delete cur[platform];
  await kv.set(KEY, cur);
}

/** The effective refresh/access tokens, preferring the in-app OAuth over the
 *  optional env fallbacks. */
export async function getAgencyTokens(): Promise<{
  googleRefreshToken: string | null;
  metaAccessToken: string | null;
  google: AdsOAuth["google"] | null;
  meta: AdsOAuth["meta"] | null;
}> {
  const o = await getAdsOAuth();
  return {
    googleRefreshToken:
      o.google?.refreshToken ?? process.env.GOOGLE_ADS_REFRESH_TOKEN ?? null,
    metaAccessToken:
      o.meta?.accessToken ?? process.env.META_ADS_ACCESS_TOKEN ?? null,
    google: o.google ?? null,
    meta: o.meta ?? null,
  };
}
