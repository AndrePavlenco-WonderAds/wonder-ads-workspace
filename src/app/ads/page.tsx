import { Megaphone } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DepartmentHeader } from "@/components/department-header";
import { ClientCard } from "@/components/client-card";
import { ADS_CLIENTS } from "@/lib/ads-clients";
import { getClientPalette } from "@/lib/client-colors";
import { getClientTier } from "@/lib/client-tiers";
import { getConsultantForSlug } from "@/lib/client-overrides";

export const metadata = {
  title: "ADS DPT — Wonder Ads Workspace",
};

export default function AdsPage() {
  return (
    <PageShell>
      <DepartmentHeader
        title="ADS DPT"
        tagline="Paid media, performance campaigns and creative. Strategy, launch plans, creative briefs and active campaign monitoring all live here."
        Icon={Megaphone}
        count={ADS_CLIENTS.length}
        countLabel="clients"
      />

      <section className="mt-12 sm:mt-16" aria-label="Clients">
        <header className="mb-5 flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
            Clients
          </h2>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADS_CLIENTS.map((c, i) => (
            <ClientCard
              key={c.slug}
              title={c.title}
              icon={c.icon}
              href={`/ads/${c.slug}`}
              consultant={getConsultantForSlug(c.slug)}
              palette={getClientPalette(c.slug)}
              tier={getClientTier(c.slug)}
              index={i}
            />
          ))}
        </div>
      </section>
    </PageShell>
  );
}
