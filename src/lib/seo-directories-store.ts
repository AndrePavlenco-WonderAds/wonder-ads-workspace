// KV store for the shared SEO directory database.
//
// Single array under `seo-directories` (a get/set pair, never per-id key
// sprawl) — same shape as the calendar-events store. On first run (or when
// KV is unconfigured) reads fall back to SEED_DIRECTORIES so the page always
// has data; the first in-app edit writes the full array and from then on KV
// is the source of truth.

import { kv } from "@vercel/kv";
import {
  sanitizeDirectories,
  SEED_DIRECTORIES,
  type SeoDirectory,
} from "./seo-directories";

const KEY = "seo-directories";

export const directoriesStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getDirectories(): Promise<SeoDirectory[]> {
  if (!directoriesStorageConfigured) return SEED_DIRECTORIES;
  try {
    const stored = await kv.get<unknown>(KEY);
    if (stored == null) return SEED_DIRECTORIES;
    const clean = sanitizeDirectories(stored);
    // A present-but-empty array is a real state (user deleted everything);
    // only fall back to the seed when the key has never been written.
    return clean;
  } catch (err) {
    console.error("seo-directories KV read failed:", err);
    return SEED_DIRECTORIES;
  }
}

export async function saveDirectories(
  directories: unknown,
): Promise<SeoDirectory[]> {
  if (!directoriesStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const clean = sanitizeDirectories(directories);
  await kv.set(KEY, clean);
  return clean;
}
