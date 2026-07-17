// Per-client ADS connection config. Stores which platform accounts a client's
// campaigns live in, so the app can pull real metrics. The app-level API
// credentials (developer token, OAuth client + refresh token, Meta system-user
// token) live in env vars, shared across clients; here we only keep the
// per-client account identifiers.
//
// Security: stored plaintext in Vercel KV (encrypted at rest), gated behind
// the workspace session on every route — same model as client-accesses-store.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "ads-connections:";

export type AdsConnectionConfig = {
  /** Google Ads customer id (digits only, no dashes). */
  googleCustomerId: string | null;
  /** Meta ad account id ("act_123..." or bare digits). */
  metaAdAccountId: string | null;
  updatedAt: number;
};

export const adsConnectionsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

const EMPTY: AdsConnectionConfig = {
  googleCustomerId: null,
  metaAdAccountId: null,
  updatedAt: 0,
};

/** Normalise a Google customer id to digits only (accepts "123-456-7890"). */
export function normalizeGoogleCustomerId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digits = v.replace(/[^0-9]/g, "");
  return digits.length >= 8 ? digits : null;
}

/** Normalise a Meta ad account id to the "act_<digits>" form. */
export function normalizeMetaAdAccountId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digits = v.replace(/[^0-9]/g, "");
  return digits.length >= 6 ? `act_${digits}` : null;
}

export async function getAdsConnectionConfig(
  slug: string,
): Promise<AdsConnectionConfig> {
  if (!adsConnectionsStorageConfigured) return EMPTY;
  try {
    const stored = await kv.get<AdsConnectionConfig>(key(slug));
    if (!stored) return EMPTY;
    return {
      googleCustomerId:
        typeof stored.googleCustomerId === "string"
          ? stored.googleCustomerId
          : null,
      metaAdAccountId:
        typeof stored.metaAdAccountId === "string"
          ? stored.metaAdAccountId
          : null,
      updatedAt: typeof stored.updatedAt === "number" ? stored.updatedAt : 0,
    };
  } catch (err) {
    console.error("KV ads-connections read failed:", err);
    return EMPTY;
  }
}

export async function saveAdsConnectionConfig(
  slug: string,
  patch: { googleCustomerId?: unknown; metaAdAccountId?: unknown },
  nowMs: number,
): Promise<AdsConnectionConfig> {
  if (!adsConnectionsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getAdsConnectionConfig(slug);
  const next: AdsConnectionConfig = {
    googleCustomerId:
      "googleCustomerId" in patch
        ? normalizeGoogleCustomerId(patch.googleCustomerId)
        : current.googleCustomerId,
    metaAdAccountId:
      "metaAdAccountId" in patch
        ? normalizeMetaAdAccountId(patch.metaAdAccountId)
        : current.metaAdAccountId,
    updatedAt: nowMs,
  };
  await kv.set(key(slug), next);
  return next;
}
