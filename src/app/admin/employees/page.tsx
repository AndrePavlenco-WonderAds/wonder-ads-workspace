import { PageShell } from "@/components/page-shell";
import { AdminEmployeesPanel } from "@/components/admin-employees-panel";
import type { EmployeePortfolio } from "@/components/admin-employee-row";
import {
  listEmployees,
  SEED_EMPLOYEES,
  defaultEmployeeRecord,
} from "@/lib/admin-employees-store";
import {
  adminRecordKey,
  defaultAdminRecord,
  getAdminRecords,
  type ClientDepartment,
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

  // Build the consultant → portfolio map. Source = every per-(slug, dept)
  // client record (SEO + ADS + Web rosters merged). Each consultant's
  // budget reflects only the rows they own, so shared SEO + ADS
  // clients no longer double-count toward both consultants.
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
  const departmentsBySlug = new Map<string, ClientDepartment[]>();
  function addDept(slug: string, dept: ClientDepartment) {
    const list = departmentsBySlug.get(slug) ?? [];
    if (!list.includes(dept)) list.push(dept);
    departmentsBySlug.set(slug, list);
  }
  for (const c of seoClients) {
    if (!titleBySlug.has(c.slug)) titleBySlug.set(c.slug, c.title);
    addDept(c.slug, "SEO");
  }
  for (const c of adsClients) {
    if (!titleBySlug.has(c.slug)) titleBySlug.set(c.slug, c.title);
    addDept(c.slug, "ADS");
  }
  for (const c of webClients) {
    if (!titleBySlug.has(c.slug)) titleBySlug.set(c.slug, c.title);
    addDept(c.slug, "Web");
  }
  const rows = Array.from(departmentsBySlug.entries()).map(
    ([slug, departments]) => ({ slug, departments }),
  );
  const records = await getAdminRecords(rows).catch(() => {
    const fallback: Record<string, ReturnType<typeof defaultAdminRecord>> = {};
    for (const row of rows) {
      for (const d of row.departments) {
        fallback[adminRecordKey(row.slug, d)] = defaultAdminRecord(
          row.slug,
          d,
        );
      }
    }
    return fallback;
  });

  const portfolios: Record<string, EmployeePortfolio> = {};
  for (const row of rows) {
    const title = titleBySlug.get(row.slug) ?? row.slug;
    for (const dept of row.departments) {
      const r =
        records[adminRecordKey(row.slug, dept)] ??
        defaultAdminRecord(row.slug, dept);
      if (r.status !== "active") continue;
      const valueEur =
        r.currency === "EUR" && r.monthlyValue ? r.monthlyValue : 0;
      for (const name of r.consultants) {
        const existing = portfolios[name] ?? {
          activeClients: 0,
          totalEur: 0,
          breakdown: [],
        };
        existing.activeClients += 1;
        existing.totalEur += valueEur;
        existing.breakdown.push({
          // Use a composite slug so the breakdown lists each (slug,
          // dept) row separately even for shared clients.
          slug: `${row.slug}:${dept.toLowerCase()}`,
          title: row.departments.length > 1 ? `${title} · ${dept}` : title,
          valueEur,
          departments: [dept],
        });
        portfolios[name] = existing;
      }
    }
  }

  return (
    <PageShell wide>
      <AdminEmployeesPanel employees={employees} portfolios={portfolios} />
    </PageShell>
  );
}
