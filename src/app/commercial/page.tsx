import { Handshake } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DepartmentHeader } from "@/components/department-header";

export const metadata = {
  title: "COMMERCIAL DPT — Wonder Ads Workspace",
};

export default function CommercialPage() {
  return (
    <PageShell>
      <DepartmentHeader
        title="COMMERCIAL DPT"
        tagline="Sales pipeline, partnerships and client success. Lead flow, accounts, contracts and ongoing client work all live here."
        Icon={Handshake}
      />

      <section className="animate-fade-up mt-12 sm:mt-16">
        <div className="brand-gradient-border rounded-2xl bg-white/[0.035] p-8 backdrop-blur-md sm:p-12">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">
            Coming soon
          </p>
          <p className="mt-3 max-w-xl text-lg text-white/70 sm:text-xl">
            This department&apos;s workspace is under construction. Pipeline,
            accounts, contracts and active client work will live here.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
