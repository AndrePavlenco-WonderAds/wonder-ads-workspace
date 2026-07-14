import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, RefreshCw, Gauge, Heart } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ClientBrief } from "@/components/client-brief";
import { ClientFiles } from "@/components/client-files";
import { ClientAccesses } from "@/components/client-accesses";
import { OnboardingForm } from "@/components/onboarding-form";
import { TargetKeywordsPanel } from "@/components/target-keywords-panel";
import { CurrentRoadmapStrip } from "@/components/current-roadmap-strip";
import { PendingReviewChip } from "@/components/pending-review-chip";
import { SeoProjectContainers } from "@/components/seo-project-containers";
import { SeoActions } from "@/components/seo-actions";
import { ProjectSectionNav } from "@/components/project-section-nav";
import { LogoChip } from "@/components/logo-chip";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { isSharedWithSeo } from "@/lib/ads-clients";
import { getClientBySlug, getSeoClients } from "@/lib/notion";
import {
  getClientWebsite,
  displayDomain,
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";
import { getNpsRecord, npsSendDue } from "@/lib/nps-store";
import { npsScoreColor } from "@/lib/nps-questions";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { SeoReadOnlyProvider, ReadOnlyBanner } from "@/components/seo-readonly";

export const revalidate = 60;

export async function generateStaticParams() {
  if (!process.env.NOTION_API_KEY) return [];
  try {
    const clients = await getSeoClients();
    return clients.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  return {
    title: client
      ? `${client.title} — SEO DPT · Wonder Ads`
      : "Client — Wonder Ads Workspace",
  };
}

export default async function ClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!process.env.NOTION_API_KEY) {
    return (
      <PageShell wide backHref="/seo" backLabel="SEO DPT">
        <NotConfigured />
      </PageShell>
    );
  }

  const client = await getClientBySlug(slug);
  if (!client) notFound();

  // Read-only for anyone who can view but not edit the SEO dept (Web
  // designers). SEO consultants + SuperAdmins keep full edit. The server
  // still enforces this in middleware; this flag only tidies the UI.
  const employee = await getCurrentEmployee();
  const readOnly = !employee || !editableDepts(employee).includes("seo");

  const brief = await getBriefForSlug(slug);
  const website = getClientWebsite(slug);
  const logo = getClientLogo(slug);
  const logoBgMode = getLogoBgMode(slug);
  const logoSizing = getLogoSizing(slug);
  const gradient = paletteToGradient(getClientPalette(slug));
  const shared = isSharedWithSeo(slug);
  const npsRecord = await getNpsRecord(slug);
  const latestNps = npsRecord.submissions[0] ?? null;
  const npsScore = latestNps?.scores.overall ?? null;
  // When a send is due (never sent, or within 3 days / overdue), the pill
  // turns red and pulses like a heartbeat to nudge the consultant.
  const npsDue = npsSendDue(npsRecord, Date.now());
  // 0–5 → colour bucket for the pill. Neutral when no survey yet.
  const npsColor =
    npsScore === null
      ? "rgba(255,255,255,0.55)"
      : npsScoreColor(npsScore);

  return (
    <SeoReadOnlyProvider value={readOnly}>
    <PageShell wide sessionTimer backHref="/seo" backLabel="SEO DPT">
      {readOnly && <ReadOnlyBanner />}
      <section className="animate-fade-up mt-4 flex flex-wrap items-start justify-between gap-5 sm:mt-8">
        <div className="flex items-center gap-5">
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
                {shared ? "SEO & ADS Client" : "SEO DPT · Client"}
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
              <Link
                href={`/seo/${slug}/nps`}
                title={
                  npsDue
                    ? "NPS a precisar de envio — clica para enviar ao cliente"
                    : latestNps
                      ? `Satisfação do cliente: ${npsScore?.toFixed(1)}/5 · Recomendação ${latestNps.scores.nps}/5`
                      : "Avaliação de satisfação do cliente (NPS)"
                }
                className={
                  npsDue
                    ? "nps-heartbeat inline-flex items-center gap-1.5 rounded-full border border-rose-400/60 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-500/25"
                    : "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-white/65 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
                }
              >
                {npsDue ? (
                  <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />
                ) : (
                  <Gauge className="h-3 w-3" style={{ color: npsColor }} />
                )}
                <span
                  className={
                    npsDue
                      ? "uppercase tracking-[0.08em] text-rose-200/80"
                      : "uppercase tracking-[0.08em] text-white/45"
                  }
                >
                  NPS
                </span>
                {npsDue ? (
                  <span className="font-semibold text-rose-100">Enviar</span>
                ) : npsScore !== null ? (
                  <span className="font-semibold" style={{ color: npsColor }}>
                    {npsScore.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-white/40">—</span>
                )}
              </Link>
            </div>
            <h1 className="mt-2 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              <span className="brand-gradient-text">{client.title}</span>
            </h1>
            <CurrentRoadmapStrip slug={slug} />
            <div className="mt-2.5">
              <PendingReviewChip slug={slug} readOnly={readOnly} />
            </div>
          </div>
        </div>

        <ProjectSectionNav />
      </section>

      <div className="animate-fade-up mt-10 sm:mt-14">
        <OnboardingForm slug={slug} clientName={client.title} />
      </div>

      <div
        id="section-brief"
        className="animate-fade-up mt-6 grid scroll-mt-8 grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]"
      >
        <ClientBrief
          brief={brief}
          slug={slug}
          clientName={client.title}
        />
        <ClientFiles slug={slug} clientName={client.title} />
      </div>

      <div className="animate-fade-up mt-6">
        <TargetKeywordsPanel slug={slug} clientName={client.title} />
      </div>

      <section
        id="section-data"
        className="animate-fade-up mt-10 scroll-mt-8 sm:mt-14"
      >
        <SeoProjectContainers slug={slug} clientName={client.title} clientSlug={slug} />
      </section>

      <section className="animate-fade-up mt-10 sm:mt-14">
        <SeoActions clientName={client.title} clientSlug={slug} />
      </section>

      <section className="animate-fade-up mt-10 sm:mt-14">
        <ClientAccesses slug={slug} clientName={client.title} />
      </section>
    </PageShell>
    </SeoReadOnlyProvider>
  );
}

function NotConfigured() {
  return (
    <section className="animate-fade-up mt-10">
      <div className="brand-gradient-border rounded-2xl bg-white/[0.035] p-6 backdrop-blur-md">
        <p className="text-sm uppercase tracking-[0.18em] text-white/45">
          Notion not connected
        </p>
        <p className="mt-3 max-w-xl text-white/70">
          Add{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
            NOTION_API_KEY
          </code>{" "}
          as a Vercel environment variable and redeploy to view this client.
        </p>
      </div>
    </section>
  );
}
