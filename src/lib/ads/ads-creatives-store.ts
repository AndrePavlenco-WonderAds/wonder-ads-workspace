// History of generated ad-creative concepts per client (ADS DPT). Each
// entry keeps the brief the user gave + the concept the Creatives agent
// produced, so past generations can be reopened. Keyed
// `ads-creatives:<slug>` in KV.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "ads-creatives:";
const MAX_ENTRIES = 200;

export const adsCreativesStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type CreativeEntry = {
  id: string;
  title: string;
  /** The brief inputs captured at generation time. */
  idea: string;
  direction: string;
  copy: string;
  platform: "google" | "meta" | "all";
  format: string;
  /** The agent's produced concept (markdown/plain text). */
  content: string;
  /** Generated creative image URLs (Vercel Blob), if any. */
  images: string[];
  createdAt: number;
};

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

function sanitize(arr: unknown): CreativeEntry[] {
  if (!Array.isArray(arr)) return [];
  const out: CreativeEntry[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const s = (v: unknown, max: number) =>
      typeof v === "string" ? v.slice(0, max) : "";
    out.push({
      id: typeof e.id === "string" && e.id ? e.id : crypto.randomUUID(),
      title: s(e.title, 200) || "Criativo",
      idea: s(e.idea, 4000),
      direction: s(e.direction, 4000),
      copy: s(e.copy, 4000),
      platform:
        e.platform === "google" || e.platform === "meta" ? e.platform : "all",
      format: s(e.format, 80),
      content: s(e.content, 20000),
      images: Array.isArray(e.images)
        ? e.images
            .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
            .slice(0, 12)
        : [],
      createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
    });
    if (out.length >= MAX_ENTRIES) break;
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCreatives(slug: string): Promise<CreativeEntry[]> {
  if (!adsCreativesStorageConfigured) return [];
  try {
    return sanitize(await kv.get<unknown>(key(slug)));
  } catch (err) {
    console.error("ads-creatives KV read failed:", err);
    return [];
  }
}

export async function addCreative(
  slug: string,
  entry: Omit<CreativeEntry, "id" | "createdAt"> & { createdAt?: number },
): Promise<CreativeEntry> {
  if (!adsCreativesStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getCreatives(slug);
  const created: CreativeEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: entry.createdAt ?? Date.now(),
  };
  const next = sanitize([created, ...current]).slice(0, MAX_ENTRIES);
  await kv.set(key(slug), next);
  return created;
}

export async function deleteCreative(
  slug: string,
  id: string,
): Promise<CreativeEntry[]> {
  if (!adsCreativesStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getCreatives(slug);
  const next = current.filter((c) => c.id !== id);
  await kv.set(key(slug), next);
  return next;
}
