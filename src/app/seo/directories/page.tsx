import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { SeoDirectoriesView } from "@/components/seo-directories-view";
import { getDirectories } from "@/lib/seo-directories-store";
import { getSeoClients } from "@/lib/notion";
import { getClientGeo } from "@/lib/client-geo";
import { getClientIndustry } from "@/lib/client-industry";
import {
  countryToken,
  type ClientMatchProfile,
} from "@/lib/seo-directory-match";
import { getTargetsMap } from "@/lib/seo-backlink-targets-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "SEO Directories — Wonder Ads Workspace",
};

export default async function SeoDirectoriesPage() {
  // SEO-editor only — Web designers get read-only SEO project pages but
  // not the department directories/backlink tools.
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return (
      <PageShell>
        <AccessDenied
          title="No SEO access"
          description="The SEO directories are open to the SEO team and SuperAdmins."
          username={employee?.username}
        />
      </PageShell>
    );
  }

  // Build a match profile per SEO client: language + country from client-geo,
  // niche from client-industry. Notion down → empty list (manual browse + CRUD
  // still work).
  let clients: ClientMatchProfile[] = [];
  try {
    const seo = await getSeoClients();
    clients = seo
      .map((c) => {
        const geo = getClientGeo(c.slug);
        return {
          slug: c.slug,
          title: c.title,
          language: geo.languageCode,
          country: countryToken(geo.countryLabel),
          niches: getClientIndustry(c.slug),
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  } catch {
    /* Notion unavailable — directory database + CRUD still usable */
  }

  const [directories, targetsMap] = await Promise.all([
    getDirectories(),
    getTargetsMap(),
  ]);

  return (
    <PageShell wide>
      <Link
        href="/seo"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to SEO DPT
      </Link>
      <SeoDirectoriesView
        directories={directories}
        clients={clients}
        initialTargets={targetsMap}
      />
    </PageShell>
  );
}
