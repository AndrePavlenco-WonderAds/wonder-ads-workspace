// Clients paused / suspended on the SEO department board.
// A paused slug is filtered out of the main "Clients by Head Consultant"
// grid on /seo and rendered instead in a separate "Clientes Pausados /
// Suspensos" section below it — same column structure, dimmed. Only
// SuperAdmins can pause/reactivate (enforced in the API route).
//
// Mirrors admin-removed-clients-store.ts: a single KV array of slugs.

import { kv } from "@vercel/kv";

const KEY = "seo-paused-clients";
const MAX = 1000;

export const pausedClientsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getPausedSlugs(): Promise<string[]> {
  if (!pausedClientsStorageConfigured) return [];
  try {
    const raw = await kv.get<unknown>(KEY);
    if (!Array.isArray(raw)) return [];
    return raw.filter((s): s is string => typeof s === "string");
  } catch (err) {
    console.error("seo-paused-clients read failed:", err);
    return [];
  }
}

export async function getPausedSlugSet(): Promise<Set<string>> {
  return new Set(await getPausedSlugs());
}

/** Mark a client slug as paused / suspended. Idempotent. */
export async function addPausedSlug(slug: string): Promise<string[]> {
  if (!pausedClientsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getPausedSlugs();
  if (current.includes(slug)) return current;
  const next = [slug, ...current].slice(0, MAX);
  await kv.set(KEY, next);
  return next;
}

/** Reactivate a previously paused client (undo a pause). */
export async function removePausedSlug(slug: string): Promise<string[]> {
  if (!pausedClientsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const next = (await getPausedSlugs()).filter((s) => s !== slug);
  await kv.set(KEY, next);
  return next;
}
