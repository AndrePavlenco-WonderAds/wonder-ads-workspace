import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AdminGate } from "@/components/admin-gate";
import { isAdminUnlocked } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Admin section layout — runs the gate once for every page under
 * `/admin/*` so the children render only when the superadmin cookie
 * is valid. Eliminates per-page `if (!unlocked) return <Gate />`
 * boilerplate AND guarantees the gate can't be bypassed by hitting a
 * subpage URL directly.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await isAdminUnlocked())) {
    return (
      <PageShell>
        <Link
          href="/"
          className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to workspace
        </Link>
        <AdminGate />
      </PageShell>
    );
  }
  return <>{children}</>;
}
