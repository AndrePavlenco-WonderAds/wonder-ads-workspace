import { PageShell } from "@/components/page-shell";
import { AdminEmployeesPanel } from "@/components/admin-employees-panel";
import type { EmployeePortfolio } from "@/components/admin-employee-row";
import {
  listEmployees,
  SEED_EMPLOYEES,
  defaultEmployeeRecord,
} from "@/lib/admin-employees-store";
import {
  getAdminRecords,
  defaultAdminRecord,
} from "@/lib/admin-clients-store";
import { getSeoClients } from "@/lib/notion";
import { ADS_CLIENTS } from "@/lib/ads-clients";
import { WEB_CLIENTS } from "@/lib/web-clients";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Employees · SuperAdmin — Wonder Ads Workspace",
};

export default async function EmployeesAdminPage() {
  // KV may be unconfigured locally — fall back to the seed roster so
  // the page always renders.
  let employees = await listEmployees().catch(() => []);
  if (employees.length === 0) {
    employees = SEED_EMPLOYEES.map(defaultEmployeeRecord);
  }

  // Build the consultant → portfolio map. Source = every client admin
  // record (SEO + ADS + Web rosters merged), filtered to `status === "active"`.
  // Each client contributes its monthly value to every consultant listed
  // in `consultants[]`.
  type Title = { slug: string; title: string };
  let seoClients: Title[] = [];
  try {
    const fetched = await getSeoClients();
    seoClients = fetched.map((c) => ({ slug: c.slug, title: c.title }));
  } catch {
    /* Notion down — admin still loads */
  }
  const adsClients: Title[] = ADS_CLIENTS.map((c) => ({
    slug: c.slug,
    title: c.title,
  }));
  const webClients: Title[] = WEB_CLIENTS.map((c) => ({
    slug: c.slug,
    title: c.title,
  }));
  const titleBySlug = new Map<string, string>();
  for (const c of [...seoClients, ...adsClients, ...webClients]) {
    if (!titleBySlug.has(c.slug)) titleBySlug.set(c.slug, c.title);
  }
  const slugs = Array.from(titleBySlug.keys());
  const records = await getAdminRecords(slugs).catch(() =>
    Object.fromEntries(slugs.map((s) => [s, defaultAdminRecord(s)])),
  );

  const portfolios: Record<string, EmployeePortfolio> = {};
  for (const slug of slugs) {
    const r = records[slug] ?? defaultAdminRecord(slug);
    if (r.status !== "active") continue;
    const title = titleBySlug.get(slug) ?? slug;
    for (const name of r.consultants) {
      const existing = portfolios[name] ?? {
        activeClients: 0,
        totalEur: 0,
        sampleTitles: [],
      };
      existing.activeClients += 1;
      if (r.currency === "EUR" && r.monthlyValue) {
        existing.totalEur += r.monthlyValue;
      }
      existing.sampleTitles.push(title);
      portfolios[name] = existing;
    }
  }

  return (
    <PageShell wide>
      <AdminEmployeesPanel employees={employees} portfolios={portfolios} />
    </PageShell>
  );
}
