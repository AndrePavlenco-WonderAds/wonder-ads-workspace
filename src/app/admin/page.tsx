import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AdminLanding } from "@/components/admin-landing";
import { getSeoClients } from "@/lib/notion";
import { ADS_CLIENTS } from "@/lib/ads-clients";
import { WEB_CLIENTS } from "@/lib/web-clients";
import { listEmployees, SEED_EMPLOYEES } from "@/lib/admin-employees-store";
import { countRoadmaps } from "@/lib/roadmap-admin-helpers";
import { buildAdminClientViews } from "@/lib/admin-roster";
import { getOnboardingClients } from "@/lib/onboarding-clients-store";

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

  // Onboarding card count — clients currently in an onboarding flow.
  let onboardingCount = 0;
  try {
    onboardingCount = (await getOnboardingClients()).length;
  } catch {
    /* KV unavailable — show 0 */
  }

  // Finances card count — scheduled invoices on file (clients with an
  // invoice date set). Falls back to 0 if the roster can't be built so
  // the landing still renders.
  let financesCount = 0;
  try {
    const clients = await buildAdminClientViews();
    financesCount = clients.filter((c) => c.record.invoiceDate).length;
  } catch {
    /* roster unavailable — show 0 */
  }

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
        financesCount={financesCount}
        onboardingCount={onboardingCount}
      />
    </PageShell>
  );
}
