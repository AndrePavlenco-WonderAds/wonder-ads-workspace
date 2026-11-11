import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getFleetSnapshot } from "@/lib/report/ai-fleet";
import { getFleetClients } from "@/lib/report/ai-fleet-roster";
import { IA_PLUGIN_RELEASE } from "@/lib/report/wp-plugin-release";
import { AiFleetView } from "@/components/report/ai-fleet-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "IA no site — Wonder Ads Workspace",
};

export default async function AiFleetPage() {
  const employee = await getCurrentEmployee();
  if (!employee || !editableDepts(employee).includes("seo")) {
    return (
      <PageShell>
        <AccessDenied
          title="Sem acesso"
          description="O painel «IA no site» é da equipa de SEO e dos SuperAdmins."
          username={employee?.username}
        />
      </PageShell>
    );
  }
  const [clients, snapshot] = await Promise.all([getFleetClients(), getFleetSnapshot()]);
  return (
    <PageShell wide>
      <Link
        href="/seo"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        SEO DPT
      </Link>
      <AiFleetView
        clients={clients.map((c) => ({
          slug: c.slug,
          title: c.title,
          site: c.site,
          connected: Boolean(c.pluginSite && c.pluginKey),
        }))}
        initial={snapshot}
        latestPlugin={IA_PLUGIN_RELEASE.version}
      />
    </PageShell>
  );
}
