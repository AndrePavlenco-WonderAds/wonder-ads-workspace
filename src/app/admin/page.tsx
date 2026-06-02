import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AdminGate } from "@/components/admin-gate";
import { AdminPanel, type AdminClientView } from "@/components/admin-panel";
import { isAdminUnlocked } from "@/lib/admin-auth";
import { getSeoClients } from "@/lib/notion";
import { ADS_CLIENTS } from "@/lib/ads-clients";
import {
  getAdminRecords,
  defaultAdminRecord,
} from "@/lib/admin-clients-store";
import { getConsultantForSlug } from "@/lib/client-overrides";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "SuperAdmin Control Suite — Wonder Ads Workspace",
};

function BackToWorkspace() {
  return (
    <Link
      href="/"
      className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      Back to workspace
    </Link>
  );
}

export default async function AdminPage() {
  if (!(await isAdminUnlocked())) {
    return (
      <PageShell>
        <BackToWorkspace />
        <AdminGate />
      </PageShell>
    );
  }

  // SEO department — pulled from Notion; degrade gracefully if Notion
  // is unreachable so admin always loads.
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

  // ADS department — explicit local roster.
  const adsClients = ADS_CLIENTS.map((c) => ({
    slug: c.slug,
    title: c.title,
    icon: c.icon,
  }));

  // Flatten into a single deduped list keyed by slug. Track which
  // departments each client appears in so the row renders the right
  // SEO / ADS badges.
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

  const allSlugs = Array.from(merged.keys());
  const records = await getAdminRecords(allSlugs).catch(() =>
    // KV not configured locally — fall back to defaults so the page still renders.
    Object.fromEntries(allSlugs.map((s) => [s, defaultAdminRecord(s)])),
  );

  const clients: AdminClientView[] = Array.from(merged.values())
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((c) => {
      const record = records[c.slug] ?? defaultAdminRecord(c.slug);
      // For ADS-only rows, seed the consultant from the ADS roster
      // when the saved record is still on the SEO-side default.
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
      <BackToWorkspace />
      <AdminPanel clients={clients} />
    </PageShell>
  );
}
