import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AdminPanel } from "@/components/admin-panel";
import { buildAdminClientViews } from "@/lib/admin-roster";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Clients · SuperAdmin — Wonder Ads Workspace",
};

export default async function ProjectsAdminPage() {
  const clients = await buildAdminClientViews();

  return (
    <PageShell wide>
      <Link
        href="/admin"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Admin
      </Link>
      <AdminPanel clients={clients} />
    </PageShell>
  );
}
