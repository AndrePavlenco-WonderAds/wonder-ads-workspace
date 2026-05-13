import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ClientBrief } from "@/components/client-brief";
import { getClientBrief } from "@/lib/client-briefs";
import { ADS_CLIENTS, getAdsClient } from "@/lib/ads-clients";

export async function generateStaticParams() {
  return ADS_CLIENTS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = getAdsClient(slug);
  return {
    title: client
      ? `${client.title} — ADS DPT · Wonder Ads`
      : "Client — Wonder Ads Workspace",
  };
}

export default async function AdsClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = getAdsClient(slug);
  if (!client) notFound();

  const brief = getClientBrief(slug);

  return (
    <PageShell>
      <Link
        href="/ads"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to ADS DPT
      </Link>

      <section className="animate-fade-up mt-10 flex items-center gap-5 sm:mt-14">
        <div className="relative shrink-0">
          <div
            className="brand-gradient-bg flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-[0_10px_40px_-8px_rgba(120,61,245,0.7)]"
            aria-hidden
          >
            <span className="leading-none">{client.icon}</span>
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-2xl opacity-60 blur-2xl"
            style={{ background: "var(--brand-gradient)" }}
          />
        </div>

        <div>
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
            ADS DPT · Client
          </span>
          <h1 className="mt-2 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
            {client.title}
          </h1>
        </div>
      </section>

      <section className="animate-fade-up mt-10 sm:mt-14">
        <ClientBrief brief={brief} clientName={client.title} />
      </section>

      <section className="animate-fade-up mt-12 sm:mt-16">
        <div className="brand-gradient-border rounded-2xl bg-white/[0.035] p-8 backdrop-blur-md sm:p-12">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">
            Coming soon
          </p>
          <p className="mt-3 max-w-xl text-lg text-white/70 sm:text-xl">
            Campaign briefs, creative, performance and reporting for{" "}
            {client.title} will live here.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
