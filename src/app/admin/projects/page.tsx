import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AdminPanel, type AdminClientView } from "@/components/admin-panel";
import { getSeoClients } from "@/lib/notion";
import { ADS_CLIENTS } from "@/lib/ads-clients";
import { WEB_CLIENTS } from "@/lib/web-clients";
import {
  getAdminRecords,
  defaultAdminRecord,
} from "@/lib/admin-clients-store";
import { getConsultantForSlug } from "@/lib/client-overrides";

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

  type Merged = {
    slug: string;
    title: string;
    icon: string | null;
    departments: Set<string>;
  };
  const merged = new Map<string, Merged>();
  for (const c of seoClients) {
    merged.set(c.slug, {
      slug: c.slug,
      title: c.title,
      icon: c.icon,
      departments: new Set(["SEO"]),
    });
  }
  for (const c of adsClients) {
    const existing = merged.get(c.slug);
    if (existing) {
      existing.departments.add("ADS");
    } else {
      merged.set(c.slug, {
        slug: c.slug,
        title: c.title,
        icon: c.icon,
        departments: new Set(["ADS"]),
      });
    }
  }
  for (const c of webClients) {
    const existing = merged.get(c.slug);
    if (existing) {
      existing.departments.add("Web");
    } else {
      merged.set(c.slug, {
        slug: c.slug,
        title: c.title,
        icon: c.icon,
        departments: new Set(["Web"]),
      });
    }
  }

  const allSlugs = Array.from(merged.keys());
  const records = await getAdminRecords(allSlugs).catch(() =>
    Object.fromEntries(allSlugs.map((s) => [s, defaultAdminRecord(s)])),
  );

  const clients: AdminClientView[] = Array.from(merged.values())
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((c) => {
      const record = records[c.slug] ?? defaultAdminRecord(c.slug);
      let consultants = record.consultants;
      if (
        c.departments.has("ADS") &&
        !c.departments.has("SEO") &&
        consultants.length === 1 &&
        consultants[0] === getConsultantForSlug(c.slug)
      ) {
        const adsHit = ADS_CLIENTS.find((a) => a.slug === c.slug);
        if (adsHit?.consultant) consultants = [adsHit.consultant];
      }
      return {
        slug: c.slug,
        title: c.title,
        icon: c.icon,
        departments: Array.from(c.departments).sort(),
        record: { ...record, consultants },
      };
    });

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
