import { PageShell } from "@/components/page-shell";
import { AdminEmployeesPanel } from "@/components/admin-employees-panel";
import {
  listEmployees,
  SEED_EMPLOYEES,
  defaultEmployeeRecord,
} from "@/lib/admin-employees-store";

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

  return (
    <PageShell wide>
      <AdminEmployeesPanel employees={employees} />
    </PageShell>
  );
}
