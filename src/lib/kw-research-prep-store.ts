// Temporary KV slot holding the KwResearchPack between the catch-all /run
// call (which generates it + streams Claude) and the /save call (which
// persists it into action-history). Same architecture as audit-prep-store
// for the SEO Audit — keeps the structured data alive across function
// boundaries without bloating the streamed response body.

import { kv } from "@vercel/kv";
import type { KwResearchPack } from "./seo-tools/keyword-research";

const KEY_PREFIX = "kw-research-prep:";
const TTL_SECONDS = 60 * 60; // 1h — generous; /save clears after consuming

export const kwResearchPrepConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function key(clientSlug: string, actionSlug: string, resultId: string): string {
  return `${KEY_PREFIX}${clientSlug}:${actionSlug}:${resultId}`;
}

export async function saveKwResearchPrep(
  clientSlug: string,
  actionSlug: string,
  resultId: string,
  pack: KwResearchPack,
): Promise<void> {
  if (!kwResearchPrepConfigured) return;
  await kv.set(key(clientSlug, actionSlug, resultId), pack, { ex: TTL_SECONDS });
}

export async function loadKwResearchPrep(
  clientSlug: string,
  actionSlug: string,
  resultId: string,
): Promise<KwResearchPack | null> {
  if (!kwResearchPrepConfigured) return null;
  try {
    const stored = await kv.get<KwResearchPack>(
      key(clientSlug, actionSlug, resultId),
    );
    return stored ?? null;
  } catch (err) {
    console.error("kw-research prep read failed:", err);
    return null;
  }
}

export async function clearKwResearchPrep(
  clientSlug: string,
  actionSlug: string,
  resultId: string,
): Promise<void> {
  if (!kwResearchPrepConfigured) return;
  try {
    await kv.del(key(clientSlug, actionSlug, resultId));
  } catch {
    /* non-fatal */
  }
}
