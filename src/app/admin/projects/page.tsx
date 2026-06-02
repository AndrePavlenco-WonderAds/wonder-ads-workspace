import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AdminPanel, type AdminClientView } from "@/components/admin-panel";
import { getSeoClients } from "@/lib/notion";
import { ADS_CLIENTS } from "@/lib/ads-clients";
import { WEB_CLIENTS } from "@/lib/web-clients";
import {
  adminRecordKey,
  defaultAdminRecord,
  getAdminRecords,
  type ClientDepartment,
} from "@/lib/admin-clients-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Projects · SuperAdmin — Wonder Ads Workspace",
};

export default async function ProjectsAdminPage() {
  // SEO department — pulled from Notion; degrade gracefully so admin
  // always loads even if Notion is unreachable.
  let seoClients: Array<{ slug: string; title: string; icon: string | null }> = [];
  try {
    const fetched = await getSeoClients();
    seoClients = fetched.map((c) => ({
      slug: c.slug,
      title: c.title,
      icon: c.icon ?? "•",
    }));
  } catch (err) {
    console.error("Admin: getSeoClients failed:", err);
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

  // Merge by slug, tracking which departments each client appears in
  // so we materialise one row per (slug, dept) pair.
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
    const m: Merged = { slug: c.slug, title: c.title, icon: c.icon, departments: [] };
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

  // Fetch one record per (slug, dept).
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

  // Materialise one AdminClientView per (slug, dept). Sort:
  // alphabetical client name first, then SEO → ADS → Web inside a
  // shared client so the rows are predictable.
  const deptOrder: ClientDepartment[] = ["SEO", "ADS", "Web"];
  const clients: AdminClientView[] = Array.from(merged.values())
    .sort((a, b) => a.title.localeCompare(b.title))
    .flatMap((m) =>
      [...m.departments]
        .sort((x, y) => deptOrder.indexOf(x) - deptOrder.indexOf(y))
        .map((dept) => {
          const key = adminRecordKey(m.slug, dept);
          const record =
            records[key] ?? defaultAdminRecord(m.slug, dept);
          return {
            slug: m.slug,
            title: m.title,
            icon: m.icon,
            department: dept,
            clientDepartments: m.departments,
            record,
          };
        }),
    );

  return (
    <PageShell wide>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Admin
      </Link>
      <AdminPanel clients={clients} />
    </PageShell>
  );
}
