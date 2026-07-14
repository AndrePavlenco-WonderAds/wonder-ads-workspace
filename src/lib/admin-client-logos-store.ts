// Per-client logo overrides — custom brand logos uploaded by SuperAdmins
// from the client ficha, stored as Blob URLs in a single KV blob so the
// whole roster resolves with one read. Overrides the static CLIENT_LOGOS
// map in client-meta.ts wherever the resolver below is used (admin roster,
// SEO grid, SEO client page).

import { kv } from "@vercel/kv";

const KEY = "admin-client-logos";

export const logoOverridesConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getLogoOverrides(): Promise<Record<string, string>> {
  if (!logoOverridesConfigured) return {};
  try {
    const raw = await kv.get<Record<string, unknown>>(KEY);
    if (!raw || typeof raw !== "object") return {};
    const out: Record<string, string> = {};
    for (const [slug, url] of Object.entries(raw)) {
      if (typeof url === "string" && /^https?:\/\//i.test(url)) out[slug] = url;
    }
    return out;
  } catch (err) {
    console.error("admin-client-logos read failed:", err);
    return {};
  }
}

/** Resolve one client's logo override (Blob URL) or null. */
export async function getLogoOverride(slug: string): Promise<string | null> {
  const all = await getLogoOverrides();
  return all[slug] ?? null;
}

export async function setClientLogo(
  slug: string,
  url: string,
): Promise<string> {
  if (!logoOverridesConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  if (!/^https?:\/\//i.test(url)) throw new Error("Invalid logo URL.");
  const current = (await kv.get<Record<string, string>>(KEY)) ?? {};
  await kv.set(KEY, { ...current, [slug]: url });
  return url;
}

/** Remove a client's custom logo (revert to the static default/emoji). */
export async function removeClientLogo(slug: string): Promise<void> {
  if (!logoOverridesConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = (await kv.get<Record<string, string>>(KEY)) ?? {};
  delete current[slug];
  await kv.set(KEY, current);
}
