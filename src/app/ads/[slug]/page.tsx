import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCw, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ClientBrief } from "@/components/client-brief";
import { ClientFiles } from "@/components/client-files";
import { LogoChip } from "@/components/logo-chip";
import { AdsDashboard } from "@/components/ads-dashboard";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { ADS_CLIENTS, getAdsClient } from "@/lib/ads-clients";
import { getAdsPerformance, type AdsPlatform } from "@/lib/ads/ads-data";
import { getAdsReports } from "@/lib/ads/ads-reports-store";
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

  const channels: AdsPlatform[] = (client.channels as AdsPlatform[]) ?? [];
  const [brief, performance, reports] = await Promise.all([
    getBriefForSlug(slug),
    getAdsPerformance(slug, { platform: "all", window: { mode: "week" } }),
    getAdsReports(slug),
  ]);
  const website = getClientWebsite(slug);
  const logo = getClientLogo(slug);
  const logoBgMode = getLogoBgMode(slug);
  const logoSizing = getLogoSizing(slug);
  const gradient = paletteToGradient(getClientPalette(slug));
  const shared = client.sharedWithSeo === true;
  const tier = client.tier;

  const PLATFORM_BADGE: Record<AdsPlatform, { label: string; color: string }> = {
    google: { label: "Google Ads", color: "#4285F4" },
    meta: { label: "Meta Ads", color: "#E1306C" },
  };

  return (
    <PageShell wide sessionTimer>
      <Link
        href="/ads"
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to ADS DPT
      </Link>

      {/* Full-width client header */}
      <section className="animate-fade-up mt-8 flex flex-wrap items-center gap-4">
        <div className="shrink-0">
          <LogoChip
            logo={logo}
            emoji={client.icon}
            alt={`${client.title} logo`}
            gradient={gradient}
            size="lg"
            bgMode={logoBgMode}
            sizing={logoSizing}
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            {client.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> Active
            </span>
            {channels.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                style={{
                  borderColor: `${PLATFORM_BADGE[c].color}66`,
                  background: `${PLATFORM_BADGE[c].color}1a`,
                  color: PLATFORM_BADGE[c].color,
                }}
              >
                {PLATFORM_BADGE[c].label}
              </span>
            ))}
            {tier && (
              <span className="inline-flex items-center rounded-full border border-[#783DF5]/40 bg-[#783DF5]/12 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-[#d4c4ff]">
                {tier}
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
        </div>
      </section>

      {/* Full-width performance dashboard (real data only) */}
      <AdsDashboard
        slug={slug}
        channels={channels}
        initialPerformance={performance}
        initialReports={reports}
      />

      {/* Brief / Files moved to the bottom */}
      <section className="animate-fade-up mt-12">
        <div className="mb-5 flex items-center gap-2">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
            Do&apos;s, Don&apos;ts, Notas &amp; Ficheiros
          </h2>
          {shared && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.13em] text-white/45"
              title="Do's, Don'ts and Notes are kept in sync between the SEO and ADS departments for this client."
            >
              <RefreshCw className="h-2.5 w-2.5" />
              Synced across SEO &amp; ADS
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
          <ClientBrief brief={brief} slug={slug} clientName={client.title} />
          <ClientFiles slug={slug} clientName={client.title} />
        </div>
      </section>
    </PageShell>
  );
}
