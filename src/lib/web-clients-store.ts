// Web Dept client registry — KV-backed, slug-keyed profiles that let the
// team store a client's data ONCE (default designer, accesses/credentials,
// branding, links, notes) and reuse it every time a new project or ticket
// is created for that client.
//
// Storage layout (under the `web:` namespace, alongside projects):
//   web:client:<slug>     → WebClientRecord JSON (credential secrets are
//                           ciphertext, exactly like a project's vault)
//   web:clients:index     → Redis SET of client slugs
//
// We deliberately REUSE the project asset machinery — `normaliseAssets`
// (encrypt-on-write, preserve-ciphertext-on-edit) and `toPublicAssets`
// (strip ciphertext on read) — so a client's vault has the same security
// guarantees as a project's, with zero duplicated crypto.

import { kv } from "@vercel/kv";
import { slugify, type PublicWebClient } from "./web-shared";
import {
  normaliseAssets,
  toPublicAssets,
  webStorageConfigured,
  type WebProjectAssets,
} from "./web-projects-store";

const CLIENT_PREFIX = "web:client:";
const INDEX_KEY = "web:clients:index";

export { webStorageConfigured };

// ---------------------------------------------------------------------------
// Type — the stored shape carries credential ciphertext (server-only).
// ---------------------------------------------------------------------------

export type WebClientRecord = {
  slug: string;
  name: string;
  defaultAssigneeUsername: string;
  defaultAssigneeName: string;
  assets: WebProjectAssets;
  createdAt: number;
  updatedAt: number;
};

function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}
function num(v: unknown, fb = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}

/** Sanitise a full client payload. `slug` is authoritative (taken from the
 *  route / derived from the name, never trusted from the body). `prev`
 *  preserves credential ciphertext + createdAt across edits. */
export function normaliseClient(
  v: unknown,
  slug: string,
  prev?: WebClientRecord | null,
): WebClientRecord {
  const o = (v ?? {}) as Record<string, unknown>;
  const now = Date.now();
  return {
    slug,
    name: str(o.name).trim() || prev?.name || slug,
    defaultAssigneeUsername: str(o.defaultAssigneeUsername).trim(),
    defaultAssigneeName: str(o.defaultAssigneeName).trim(),
    assets: normaliseAssets(o.assets, prev?.assets),
    createdAt: prev?.createdAt ?? num(o.createdAt, now),
    updatedAt: now,
  };
}

export function toPublicClient(c: WebClientRecord): PublicWebClient {
  return {
    slug: c.slug,
    name: c.name,
    defaultAssigneeUsername: c.defaultAssigneeUsername,
    defaultAssigneeName: c.defaultAssigneeName,
    assets: toPublicAssets(c.assets),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** Derive the canonical slug for a client name. Empty name → "". */
export function clientSlug(name: string): string {
  return slugify(name);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getClient(slug: string): Promise<WebClientRecord | null> {
  if (!webStorageConfigured || !slug) return null;
  return (await kv.get<WebClientRecord>(CLIENT_PREFIX + slug)) ?? null;
}

export async function getAllClients(): Promise<WebClientRecord[]> {
  if (!webStorageConfigured) return [];
  const slugs = await kv.smembers(INDEX_KEY);
  if (!slugs || slugs.length === 0) return [];
  const keys = slugs.map((s) => CLIENT_PREFIX + s);
  const rows = await kv.mget<WebClientRecord[]>(...keys);
  return rows
    .filter((r): r is WebClientRecord => Boolean(r))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveClient(c: WebClientRecord): Promise<void> {
  if (!webStorageConfigured) return;
  await kv.set(CLIENT_PREFIX + c.slug, c);
  await kv.sadd(INDEX_KEY, c.slug);
}

export async function deleteClient(slug: string): Promise<void> {
  if (!webStorageConfigured) return;
  await kv.del(CLIENT_PREFIX + slug);
  await kv.srem(INDEX_KEY, slug);
}
