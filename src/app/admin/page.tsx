import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AdminLanding } from "@/components/admin-landing";
import { getSeoClients } from "@/lib/notion";
import { ADS_CLIENTS } from "@/lib/ads-clients";
import { WEB_CLIENTS } from "@/lib/web-clients";
import { listEmployees, SEED_EMPLOYEES } from "@/lib/admin-employees-store";
import { countRoadmaps } from "@/lib/roadmap-admin-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "SuperAdmin Control Suite — Wonder Ads Workspace",
};

export default async function AdminPage() {
  // Live counts feed the two chooser blocks.
  let seoClients: Array<{ slug: string }> = [];
  try {
    const fetched = await getSeoClients();
    seoClients = fetched.map((c) => ({ slug: c.slug }));
  } catch {
    /* Notion down — count what we have */
  }
  const projectsCount = new Set([
    ...seoClients.map((c) => c.slug),
    ...ADS_CLIENTS.map((c) => c.slug),
    ...WEB_CLIENTS.map((c) => c.slug),
  ]).size;

  let employees: Array<unknown> = [];
  try {
    employees = await listEmployees();
  } catch {
    employees = SEED_EMPLOYEES;
  }
  const employeesCount = employees.length || SEED_EMPLOYEES.length;

  // Roadmaps card count — clients with a roadmap on file. Falls back
  // to 0 silently if Notion or KV is unavailable so the landing page
  // still renders.
  const roadmapsCount = await countRoadmaps();

  return (
    <PageShell>
      <Link
        href="/"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to workspace
      </Link>
      <AdminLanding
        projectsCount={projectsCount}
        employeesCount={employeesCount}
        roadmapsCount={roadmapsCount}
      />
    </PageShell>
  );
}
