// Clients added manually from the Admin → Clients table (the "Add client"
// row). These don't exist in Notion / the ADS / Web rosters, so we keep
// them in KV and merge them into the admin roster. Each still gets a
// normal per-(slug, department) admin record for its billing fields.

import { kv } from "@vercel/kv";
import { CLIENT_DEPARTMENTS, type ClientDepartment } from "./admin-clients-store";

const KEY = "admin-extra-clients";
const MAX = 500;

export const extraClientsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type ExtraClient = {
  slug: string;
  title: string;
  icon: string | null;
  departments: ClientDepartment[];
  website: string;
  createdAt: number;
};

export function slugifyTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitize(arr: unknown): ExtraClient[] {
  if (!Array.isArray(arr)) return [];
  const out: ExtraClient[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    const title = typeof c.title === "string" ? c.title.trim().slice(0, 120) : "";
    if (!title) continue;
    const slug =
      typeof c.slug === "string" && c.slug ? c.slug : slugifyTitle(title);
    if (!slug || seen.has(slug)) continue;
    const departments = Array.isArray(c.departments)
      ? (c.departments.filter((d): d is ClientDepartment =>
          (CLIENT_DEPARTMENTS as readonly string[]).includes(d as string),
        ) as ClientDepartment[])
      : [];
    seen.add(slug);
    out.push({
      slug,
      title,
      icon: typeof c.icon === "string" && c.icon ? c.icon.slice(0, 8) : null,
      departments: departments.length > 0 ? departments : ["SEO"],
      website: typeof c.website === "string" ? c.website.slice(0, 300) : "",
      createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
    });
    if (out.length >= MAX) break;
  }
  return out;
}

export async function getExtraClients(): Promise<ExtraClient[]> {
  if (!extraClientsStorageConfigured) return [];
  try {
    return sanitize(await kv.get<unknown>(KEY));
  } catch (err) {
    console.error("admin-extra-clients KV read failed:", err);
    return [];
  }
}

export async function addExtraClient(input: {
  title: string;
  departments: ClientDepartment[];
  icon?: string | null;
  website?: string;
}): Promise<ExtraClient> {
  if (!extraClientsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getExtraClients();
  const slug = slugifyTitle(input.title);
  if (!slug) throw new Error("Title required.");
  if (current.some((c) => c.slug === slug)) {
    throw new Error(`A client with slug "${slug}" already exists.`);
  }
  const entry: ExtraClient = {
    slug,
    title: input.title.trim().slice(0, 120),
    icon: input.icon ?? "🏢",
    departments:
      input.departments.length > 0 ? input.departments : (["SEO"] as ClientDepartment[]),
    website: input.website?.trim().slice(0, 300) ?? "",
    createdAt: Date.now(),
  };
  await kv.set(KEY, sanitize([entry, ...current]));
  return entry;
}

export async function deleteExtraClient(slug: string): Promise<ExtraClient[]> {
  if (!extraClientsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getExtraClients();
  const next = current.filter((c) => c.slug !== slug);
  await kv.set(KEY, next);
  return next;
}
