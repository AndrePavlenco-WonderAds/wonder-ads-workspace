// Campaign Vault — ADS-DPT-only, one per client. Distinct from the
// shared Client Files: this holds campaign briefings, ad docs (copy +
// creatives) and past monthly reports for the paid-media engagement.
// Keyed `ads-vault:<slug>` in KV. File bytes live in Vercel Blob; we
// store the metadata + URL here.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "ads-vault:";
const MAX_ITEMS = 300;

export const adsVaultStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export const VAULT_KINDS = [
  "brief",
  "creative",
  "report",
  "doc",
  "other",
] as const;
export type VaultKind = (typeof VAULT_KINDS)[number];

export const VAULT_KIND_LABEL: Record<VaultKind, string> = {
  brief: "Briefing",
  creative: "Criativos",
  report: "Report",
  doc: "Documento",
  other: "Outro",
};

export type VaultItem = {
  id: string;
  kind: VaultKind;
  title: string;
  description: string;
  url: string;
  /** Optional platform tag — google / meta / null (cross-platform). */
  platform: "google" | "meta" | null;
  addedAt: number;
};

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

export function sanitizeVault(arr: unknown): VaultItem[] {
  if (!Array.isArray(arr)) return [];
  const out: VaultItem[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const v = raw as Record<string, unknown>;
    if (typeof v.url !== "string" || !/^https?:\/\//i.test(v.url)) continue;
    const kind = (VAULT_KINDS as readonly string[]).includes(v.kind as string)
      ? (v.kind as VaultKind)
      : "doc";
    out.push({
      id: typeof v.id === "string" && v.id ? v.id : crypto.randomUUID(),
      kind,
      title:
        typeof v.title === "string" && v.title.trim()
          ? v.title.trim().slice(0, 200)
          : v.url,
      description:
        typeof v.description === "string" ? v.description.slice(0, 1000) : "",
      url: v.url,
      platform:
        v.platform === "google" || v.platform === "meta" ? v.platform : null,
      addedAt: typeof v.addedAt === "number" ? v.addedAt : Date.now(),
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out.sort((a, b) => b.addedAt - a.addedAt);
}

export async function getVault(slug: string): Promise<VaultItem[]> {
  if (!adsVaultStorageConfigured) return [];
  try {
    return sanitizeVault(await kv.get<unknown>(key(slug)));
  } catch (err) {
    console.error("ads-vault KV read failed:", err);
    return [];
  }
}

export async function saveVault(
  slug: string,
  items: unknown,
): Promise<VaultItem[]> {
  if (!adsVaultStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const clean = sanitizeVault(items);
  await kv.set(key(slug), clean);
  return clean;
}
