// Per-client credentials vault — host login, WordPress backend,
// CMS / DNS / email / analytics, anything the consultant needs to
// access on the client's behalf.
//
// Storage model:
//   - KV-only (private to authenticated app users; KV is encrypted
//     at rest by Vercel/Upstash).
//   - Plaintext for v73.2. Passwords are masked in the UI with a
//     click-to-reveal toggle + copy button. KV access still requires
//     the workspace's auth token — no public read path.
//
// Future v73.n: server-side envelope encryption with a master key.
// Out of scope for now — the threat model is "someone on the
// consultant's machine accidentally sees a screen", not "KV is
// compromised". The UI masking handles the first case.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "accesses:";
const MAX_ENTRIES = 50;

export const accessesStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type ClientAccess = {
  id: string;
  /** What this credential is for. Free-form so consultants can name
   *  it anything ("WordPress admin", "cPanel", "Mailchimp", "Hostgator
   *  FTP", "GA4 — billing owner", etc.). */
  label: string;
  /** Login URL where the credentials apply. */
  url: string | null;
  username: string | null;
  password: string | null;
  /** Free-form notes — 2FA hints, billing contact, "use email X for
   *  recovery", etc. */
  notes: string | null;
  addedAt: number;
  updatedAt: number;
};

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

export async function listClientAccesses(
  slug: string,
): Promise<ClientAccess[]> {
  if (!accessesStorageConfigured) return [];
  try {
    const v = await kv.get<ClientAccess[]>(key(slug));
    return Array.isArray(v) ? v : [];
  } catch (err) {
    console.error("accesses read failed:", err);
    return [];
  }
}

export async function saveAllClientAccesses(
  slug: string,
  entries: ClientAccess[],
): Promise<void> {
  if (!accessesStorageConfigured) return;
  await kv.set(key(slug), entries.slice(0, MAX_ENTRIES));
}

export async function appendClientAccess(
  slug: string,
  partial: Omit<ClientAccess, "id" | "addedAt" | "updatedAt">,
): Promise<ClientAccess> {
  const now = Date.now();
  const entry: ClientAccess = {
    ...partial,
    id: newClientAccessId(),
    addedAt: now,
    updatedAt: now,
  };
  if (!accessesStorageConfigured) return entry;
  const current = await listClientAccesses(slug);
  const next = [entry, ...current].slice(0, MAX_ENTRIES);
  await kv.set(key(slug), next);
  return entry;
}

export async function updateClientAccess(
  slug: string,
  id: string,
  patch: Partial<Omit<ClientAccess, "id" | "addedAt">>,
): Promise<ClientAccess | null> {
  if (!accessesStorageConfigured) return null;
  const current = await listClientAccesses(slug);
  const idx = current.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const updated: ClientAccess = {
    ...current[idx],
    ...patch,
    updatedAt: Date.now(),
  };
  current[idx] = updated;
  await kv.set(key(slug), current);
  return updated;
}

export async function deleteClientAccess(
  slug: string,
  id: string,
): Promise<boolean> {
  if (!accessesStorageConfigured) return false;
  const current = await listClientAccesses(slug);
  const next = current.filter((a) => a.id !== id);
  if (next.length === current.length) return false;
  await kv.set(key(slug), next);
  return true;
}

export function newClientAccessId(): string {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Sanitise an incoming POST/PATCH body. Whitelisted fields only;
 *  string length caps to keep KV blobs sane. */
export function sanitiseClientAccessPatch(
  raw: unknown,
): Partial<Omit<ClientAccess, "id" | "addedAt">> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Omit<ClientAccess, "id" | "addedAt">> = {};
  if (typeof o.label === "string") out.label = o.label.slice(0, 120);
  if (typeof o.url === "string" || o.url === null) {
    out.url = typeof o.url === "string" ? o.url.slice(0, 600) : null;
  }
  if (typeof o.username === "string" || o.username === null) {
    out.username =
      typeof o.username === "string" ? o.username.slice(0, 200) : null;
  }
  if (typeof o.password === "string" || o.password === null) {
    out.password =
      typeof o.password === "string" ? o.password.slice(0, 400) : null;
  }
  if (typeof o.notes === "string" || o.notes === null) {
    out.notes = typeof o.notes === "string" ? o.notes.slice(0, 2000) : null;
  }
  return out;
}
