// Per-client department (service) overrides for the Admin → Clients roster.
//
// A client's departments are normally derived from Notion (SEO) + the ADS
// and Web static rosters. This KV layer lets a SuperAdmin add or remove
// services for an already-created client (e.g. Kings Gyms → SEO + ADS, or
// move Prof. Fernando Almeida from Web to SEO) without a code change.
//
// When an override exists for a slug it is AUTHORITATIVE — it replaces the
// derived department list for that client in the admin roster.

import { kv } from "@vercel/kv";
import { CLIENT_DEPARTMENTS, type ClientDepartment } from "./admin-clients-store";

const KEY = "admin-client-departments";

export const departmentOverridesConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function cleanDepartments(input: unknown): ClientDepartment[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<ClientDepartment>();
  for (const d of input) {
    if ((CLIENT_DEPARTMENTS as readonly string[]).includes(d as string)) {
      seen.add(d as ClientDepartment);
    }
  }
  // Keep canonical order.
  return CLIENT_DEPARTMENTS.filter((d) => seen.has(d));
}

export async function getDepartmentOverrides(): Promise<
  Record<string, ClientDepartment[]>
> {
  if (!departmentOverridesConfigured) return {};
  try {
    const raw = await kv.get<Record<string, unknown>>(KEY);
    if (!raw || typeof raw !== "object") return {};
    const out: Record<string, ClientDepartment[]> = {};
    for (const [slug, depts] of Object.entries(raw)) {
      const clean = cleanDepartments(depts);
      if (clean.length) out[slug] = clean;
    }
    return out;
  } catch (err) {
    console.error("admin-client-departments read failed:", err);
    return {};
  }
}

/** Set the authoritative department list for a client. An empty (or
 *  all-invalid) list is rejected — use the cancel-client flow to remove a
 *  client entirely. */
export async function setClientDepartments(
  slug: string,
  departments: ClientDepartment[],
): Promise<ClientDepartment[]> {
  if (!departmentOverridesConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const clean = cleanDepartments(departments);
  if (clean.length === 0) {
    throw new Error("A client must have at least one department.");
  }
  const current = (await kv.get<Record<string, ClientDepartment[]>>(KEY)) ?? {};
  const next = { ...current, [slug]: clean };
  await kv.set(KEY, next);
  return clean;
}
