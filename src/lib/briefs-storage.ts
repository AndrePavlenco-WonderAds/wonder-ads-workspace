import { kv } from "@vercel/kv";
import {
  getClientBrief as getStaticBrief,
  type ClientBrief,
} from "./client-briefs";

const KEY_PREFIX = "brief:";

export const briefsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

/** Fetch a brief — KV first (live edits), fall back to the static defaults. */
export async function getBriefForSlug(slug: string): Promise<ClientBrief> {
  if (!briefsStorageConfigured) return getStaticBrief(slug);
  try {
    const stored = await kv.get<ClientBrief>(`${KEY_PREFIX}${slug}`);
    if (stored && typeof stored === "object" && Array.isArray(stored.dos)) {
      return stored;
    }
  } catch (err) {
    console.error("KV read failed:", err);
  }
  return getStaticBrief(slug);
}

/** Replace the whole brief for a slug. Returns the saved object. */
export async function saveBriefForSlug(
  slug: string,
  brief: ClientBrief,
): Promise<ClientBrief> {
  if (!briefsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  await kv.set(`${KEY_PREFIX}${slug}`, brief);
  return brief;
}
