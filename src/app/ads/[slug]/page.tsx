import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ClientBrief } from "@/components/client-brief";
import { ClientFiles } from "@/components/client-files";
import { TypewriterPrompt } from "@/components/typewriter-prompt";
import { LogoChip } from "@/components/logo-chip";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { ADS_CLIENTS, getAdsClient } from "@/lib/ads-clients";
import {
  getClientWebsite,
  displayDomain,
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";

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

  const brief = await getBriefForSlug(slug);
  const website = getClientWebsite(slug);
  const logo = getClientLogo(slug);
  const logoBgMode = getLogoBgMode(slug);
  const logoSizing = getLogoSizing(slug);
  const gradient = paletteToGradient(getClientPalette(slug));
  const shared = client.sharedWithSeo === true;

  return (
    <PageShell wide sessionTimer>
      <Link
        href="/ads"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to ADS DPT
      </Link>

      <section className="animate-fade-up mt-10 flex items-center gap-5 sm:mt-14">
        <div className="shrink-0">
          <LogoChip
            logo={logo}
            emoji={client.icon}
            alt={`${client.title} logo`}
            gradient={gradient}
            size="xl"
            bgMode={logoBgMode}
            sizing={logoSizing}
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
              {shared ? "SEO & ADS Client" : "ADS DPT · Client"}
            </span>
            {shared && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.13em] text-white/45"
                title="Do's, Don'ts and Notes are kept in sync between the SEO and ADS departments for this client."
              >
                <RefreshCw className="h-2.5 w-2.5" />
                Synced across SEO &amp; ADS
              </span>
            )}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-white/65 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
              >
                {displayDomain(website)}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <h1 className="mt-2 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
            {client.title}
          </h1>
          <div className="mt-3">
            <TypewriterPrompt text="What are we working on now, boss?" />
          </div>
        </div>
      </section>

      <div className="animate-fade-up mt-10 grid grid-cols-1 gap-6 sm:mt-14 lg:grid-cols-[3fr_2fr]">
        <ClientBrief
          brief={brief}
          slug={slug}
          clientName={client.title}
        />
        <ClientFiles slug={slug} clientName={client.title} />
      </div>
    </PageShell>
  );
}
