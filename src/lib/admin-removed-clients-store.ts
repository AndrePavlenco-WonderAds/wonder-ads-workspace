// Clients cancelled/removed from the Admin → Clients (finances) roster.
// A hard-removed slug is filtered out of `buildAdminClientViews`, so the
// client (and all its department rows) disappears from the finance table.
// Notion/ADS/Web-sourced clients can't be deleted at source, so this KV
// set is how a cancellation is reflected in the admin roster.

import { kv } from "@vercel/kv";

const KEY = "admin-removed-clients";
const MAX = 1000;

export const removedClientsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getRemovedSlugs(): Promise<string[]> {
  if (!removedClientsStorageConfigured) return [];
  try {
    const raw = await kv.get<unknown>(KEY);
    if (!Array.isArray(raw)) return [];
    return raw.filter((s): s is string => typeof s === "string");
  } catch (err) {
    console.error("admin-removed-clients read failed:", err);
    return [];
  }
}

export async function getRemovedSlugSet(): Promise<Set<string>> {
  return new Set(await getRemovedSlugs());
}

/** Mark a client slug as removed. Idempotent. */
export async function addRemovedSlug(slug: string): Promise<string[]> {
  if (!removedClientsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getRemovedSlugs();
  if (current.includes(slug)) return current;
  const next = [slug, ...current].slice(0, MAX);
  await kv.set(KEY, next);
  return next;
}

/** Restore a previously removed client (undo a cancellation). */
export async function removeRemovedSlug(slug: string): Promise<string[]> {
  if (!removedClientsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const next = (await getRemovedSlugs()).filter((s) => s !== slug);
  await kv.set(KEY, next);
  return next;
}
