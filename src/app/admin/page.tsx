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
  title: "Admin Control Panel — Wonder Ads Workspace",
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

  // Slugs that exist in both departments — tagged with both badges.
  const sharedSlugs = new Set(
    adsClients
      .filter((a) => seoClients.some((s) => s.slug === a.slug))
      .map((a) => a.slug),
  );

  function deptsFor(slug: string, dept: "SEO" | "ADS"): string[] {
    if (sharedSlugs.has(slug)) return ["SEO", "ADS"];
    return [dept];
  }

  const allSlugs = Array.from(
    new Set([
      ...seoClients.map((c) => c.slug),
      ...adsClients.map((c) => c.slug),
    ]),
  );
  const records = await getAdminRecords(allSlugs).catch(() =>
    // KV not configured locally — fall back to defaults so the page still renders.
    Object.fromEntries(allSlugs.map((s) => [s, defaultAdminRecord(s)])),
  );

  const buildView = (
    c: { slug: string; title: string; icon: string | null },
    dept: "SEO" | "ADS",
  ): AdminClientView => {
    // Ensure the consultant field reflects the per-department override
    // when admin record is still using the SEO-side default.
    const record =
      records[c.slug] ?? defaultAdminRecord(c.slug);
    let consultant = record.consultant;
    if (dept === "ADS") {
      const adsHit = ADS_CLIENTS.find((a) => a.slug === c.slug);
      if (adsHit?.consultant && record.consultant === getConsultantForSlug(c.slug)) {
        // No bespoke admin override yet — bias the displayed default
        // toward the ADS roster consultant for ADS rows.
        consultant = adsHit.consultant;
      }
    }
    return {
      slug: c.slug,
      title: c.title,
      icon: c.icon,
      departments: deptsFor(c.slug, dept),
      record: { ...record, consultant },
    };
  };

  const sortedSeo = [...seoClients]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((c) => buildView(c, "SEO"));
  const sortedAds = [...adsClients]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((c) => buildView(c, "ADS"));

  return (
    <PageShell wide>
      <BackToWorkspace />
      <AdminPanel
        departments={[
          {
            id: "seo",
            name: "SEO Department",
            blurb:
              "Every client on the SEO roster (pulled from Notion). Shared clients also appear in ADS.",
            clients: sortedSeo,
          },
          {
            id: "ads",
            name: "ADS Department",
            blurb:
              "Paid-media clients (Google + Meta). Shared clients keep one billing record across both DPTs.",
            clients: sortedAds,
          },
        ]}
      />
    </PageShell>
  );
}
