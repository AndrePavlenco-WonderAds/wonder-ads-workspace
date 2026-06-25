// Shared server-side builder for the Admin client roster — the merged,
// per-(slug, department) list of every client across SEO + ADS + Web,
// each carrying its KV admin record. Used by both the Clients table
// (/admin/projects) and the Overview Calendário (/admin/calendar) so
// they agree on the roster + invoice dates without duplicating the
// Notion/ADS/Web merge logic.

import "server-only";
import type { AdminClientView } from "@/components/admin-panel";
import { getSeoClients } from "@/lib/notion";
import { ADS_CLIENTS } from "@/lib/ads-clients";
import { WEB_CLIENTS } from "@/lib/web-clients";
import {
  adminRecordKey,
  defaultAdminRecord,
  getAdminRecords,
  type ClientDepartment,
} from "@/lib/admin-clients-store";
import {
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";

export async function buildAdminClientViews(): Promise<AdminClientView[]> {
  // SEO department — pulled from Notion; degrade gracefully so admin
  // always loads even if Notion is unreachable.
  let seoClients: Array<{ slug: string; title: string; icon: string | null }> =
    [];
  try {
    const fetched = await getSeoClients();
    seoClients = fetched.map((c) => ({
      slug: c.slug,
      title: c.title,
      icon: c.icon ?? "•",
    }));
  } catch (err) {
    console.error("Admin roster: getSeoClients failed:", err);
  }

  const adsClients = ADS_CLIENTS.map((c) => ({
    slug: c.slug,
    title: c.title,
    icon: c.icon,
  }));
  const webClients = WEB_CLIENTS.map((c) => ({
    slug: c.slug,
    title: c.title,
    icon: c.icon,
  }));

  type Merged = {
    slug: string;
    title: string;
    icon: string | null;
    departments: ClientDepartment[];
  };
  const merged = new Map<string, Merged>();
  function ensure(c: { slug: string; title: string; icon: string | null }) {
    const existing = merged.get(c.slug);
    if (existing) return existing;
    const m: Merged = {
      slug: c.slug,
      title: c.title,
      icon: c.icon,
      departments: [],
    };
    merged.set(c.slug, m);
    return m;
  }
  for (const c of seoClients) {
    const m = ensure(c);
    if (!m.departments.includes("SEO")) m.departments.push("SEO");
  }
  for (const c of adsClients) {
    const m = ensure(c);
    if (!m.departments.includes("ADS")) m.departments.push("ADS");
  }
  for (const c of webClients) {
    const m = ensure(c);
    if (!m.departments.includes("Web")) m.departments.push("Web");
  }

  const rows = Array.from(merged.values()).map((m) => ({
    slug: m.slug,
    departments: m.departments,
  }));
  const records = await getAdminRecords(rows).catch(() => {
    const fallback: Record<string, ReturnType<typeof defaultAdminRecord>> = {};
    for (const m of merged.values()) {
      for (const d of m.departments) {
        fallback[adminRecordKey(m.slug, d)] = defaultAdminRecord(m.slug, d);
      }
    }
    return fallback;
  });

  const deptOrder: ClientDepartment[] = ["SEO", "ADS", "Web"];
  return Array.from(merged.values())
    .sort((a, b) => a.title.localeCompare(b.title))
    .flatMap((m) =>
      [...m.departments]
        .sort((x, y) => deptOrder.indexOf(x) - deptOrder.indexOf(y))
        .map((dept) => {
          const key = adminRecordKey(m.slug, dept);
          const record = records[key] ?? defaultAdminRecord(m.slug, dept);
          return {
            slug: m.slug,
            title: m.title,
            icon: m.icon,
            logo: getClientLogo(m.slug),
            logoBgMode: getLogoBgMode(m.slug),
            logoSizing: getLogoSizing(m.slug),
            gradient: paletteToGradient(getClientPalette(m.slug)),
            department: dept,
            clientDepartments: m.departments,
            record,
          };
        }),
    );
}
