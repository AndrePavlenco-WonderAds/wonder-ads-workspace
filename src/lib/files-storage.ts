import { kv } from "@vercel/kv";
import { type ClientFile, EMPTY_FILES } from "./client-files";

const KEY_PREFIX = "files:";

export const filesStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

/** Fetch a client's file list from KV. Returns an empty list when storage
 *  isn't configured or nothing has been saved yet. */
export async function getFilesForSlug(slug: string): Promise<ClientFile[]> {
  if (!filesStorageConfigured) return EMPTY_FILES;
  try {
    const stored = await kv.get<ClientFile[]>(`${KEY_PREFIX}${slug}`);
    if (Array.isArray(stored)) return stored;
  } catch (err) {
    console.error("KV files read failed:", err);
  }
  return EMPTY_FILES;
}

/** Replace the whole file list for a slug. Returns the saved array. */
export async function saveFilesForSlug(
  slug: string,
  files: ClientFile[],
): Promise<ClientFile[]> {
  if (!filesStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  await kv.set(`${KEY_PREFIX}${slug}`, files);
  return files;
}
