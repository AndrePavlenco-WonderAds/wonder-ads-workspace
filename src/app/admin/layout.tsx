import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Admin section layout — guards every page under `/admin/*` against
 * non-SuperAdmin users. As of v74.23 there's no password challenge:
 * the gate is decided by the username on the workspace session cookie
 * (set at /login). Only `andre`, `alex`, and `alice` have `isAdmin:
 * true` in credentials.ts — everyone else gets the friendly Access
 * Denied screen instead of the old password form.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const employee = await getCurrentEmployee();
  // Middleware ensures `employee` is non-null by the time we get here —
  // a missing session would have already been redirected to /login. If
  // we somehow reach this with no session, treat it as denied too.
  if (!employee || !employee.isAdmin) {
    return (
      <PageShell>
        <AccessDenied
          title="SuperAdmin only"
          description="This area is reserved for the SuperAdmin Control Suite (Andre, Alex, Alice). Consultants can't open /admin — if you need access, ping Andre directly."
          username={employee?.username ?? null}
        />
      </PageShell>
    );
  }
  return <>{children}</>;
}
