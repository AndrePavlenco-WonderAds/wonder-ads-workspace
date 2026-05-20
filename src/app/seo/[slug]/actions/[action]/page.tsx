import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { LogoChip } from "@/components/logo-chip";
import { ActionRunner } from "@/components/action-runner";
import { IntegrationChips } from "@/components/integration-chips";
import { findAction, PILLARS, type ActionToolName } from "@/lib/seo-pillars";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientBySlug } from "@/lib/notion";
import { getOnboardingForSlug } from "@/lib/onboarding-store";
import {
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
  getClientWebsite,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; action: string }>;
}) {
  const { slug, action } = await params;
  const entry = findAction(action);
  const client = await getClientBySlug(slug).catch(() => null);
  if (!entry || !client) {
    return { title: "Action — Wonder Ads Workspace" };
  }
  return {
    title: `${entry.action.label} · ${client.title} — Wonder Ads`,
  };
}

export default async function ActionPage({
  params,
}: {
  params: Promise<{ slug: string; action: string }>;
}) {
  const { slug, action: actionSlug } = await params;

  const entry = findAction(actionSlug);
  if (!entry) notFound();

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();

  const brief = await getBriefForSlug(slug);
  const logo = getClientLogo(slug);
  const logoBgMode = getLogoBgMode(slug);
  const logoSizing = getLogoSizing(slug);
  const gradient = paletteToGradient(getClientPalette(slug));
  const website = getClientWebsite(slug);
  const onboarding = await getOnboardingForSlug(slug);
  const hasOnboarding = !!onboarding;
  const onboardingName = onboarding?.name ?? null;
  const onboardingCompetitorCount = onboarding?.competitors?.length ?? 0;

  const { action, pillar } = entry;
  const { Icon: PillarIcon } = pillar;

  const briefHasContent =
    brief.dos.length + brief.donts.length + brief.notes.length > 0;
  const showBriefPanel = action.usesBrief !== false && briefHasContent;

  // Per-action defaults computed from client context. Extend as new actions
  // benefit from prefilled inputs (e.g. blog audience from client tier).
  const defaults: Record<string, string> = {};
  if (action.slug === "seo-audit" && website) defaults.pageUrl = website;
  if (action.slug === "keyword-research" && onboarding?.suggestedSeed) {
    defaults.seedTopic = onboarding.suggestedSeed;
  }
  if (action.slug === "gmb-posts" && website) {
    // Pre-fill the CTA URL with the client's actual Contact-us page
    // (each clinic has different slugs — /contactos for PT, /contact for
    // EN, etc.). Detection is cached server-side per website so the
    // first hit on this page does the probing; subsequent hits are
    // instant.
    const { detectContactPage } = await import("@/lib/seo-tools/contact-page");
    defaults.ctaUrl = await detectContactPage(website);
  }

  return (
    <PageShell
      wide
      backHref={`/seo/${slug}#section-actions`}
      backLabel={client.title}
    >
      <header className="animate-fade-up mt-2">
        <div className="flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
          <LogoChip
            logo={logo}
            emoji={client.icon}
            alt={`${client.title} logo`}
            gradient={gradient}
            size="md"
            bgMode={logoBgMode}
            sizing={logoSizing}
          />
          <Link
            href={`/seo/${slug}`}
            className="transition hover:text-white"
          >
            {client.title}
          </Link>
          <span className="text-white/25">·</span>
          <span className="inline-flex items-center gap-1.5">
            <PillarIcon className="h-3 w-3" strokeWidth={2.25} />
            {pillar.name}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">{action.label}</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/55">{action.blurb}</p>
        {action.tools && action.tools.length > 0 && (
          <IntegrationChips tools={action.tools as ActionToolName[]} />
        )}
      </header>

      {showBriefPanel && (
        <section
          aria-label="Client brief snapshot"
          className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] p-4"
        >
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
            What SEO Claude knows about {client.title}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            <BriefColumn title="Do's" items={brief.dos} accent="text-emerald-300/85" />
            <BriefColumn title="Don'ts" items={brief.donts} accent="text-red-300/85" />
            <BriefColumn title="Notes" items={brief.notes} accent="text-white/65" />
          </div>
        </section>
      )}

      <section className="mt-8">
        <ActionRunner
          clientSlug={slug}
          clientName={client.title}
          action={action}
          defaults={defaults}
          hasOnboarding={hasOnboarding}
          onboardingName={onboardingName}
          onboardingCompetitorCount={onboardingCompetitorCount}
        />
      </section>

      <nav
        aria-label="Other actions"
        className="mt-14 border-t border-white/8 pt-8"
      >
        <header className="mb-5 flex items-baseline justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
            More actions for {client.title}
          </h2>
          <Link
            href={`/seo/${slug}#section-actions`}
            className="text-[11px] uppercase tracking-[0.13em] text-white/35 transition hover:text-white"
          >
            All actions →
          </Link>
        </header>
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-5">
          {PILLARS.map((p) => {
            const PIcon = p.Icon;
            const others = p.actions.filter((a) => a.slug !== action.slug);
            if (others.length === 0) return null;
            return (
              <div key={p.slug} className="space-y-2.5">
                <div className="flex items-center gap-1.5 border-b border-white/8 pb-2">
                  <PIcon
                    className="h-3.5 w-3.5 text-[color:var(--brand-purple)]"
                    strokeWidth={2.25}
                  />
                  <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">
                    {p.name}
                  </h3>
                </div>
                <ul className="space-y-1">
                  {others.map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/seo/${slug}/actions/${a.slug}`}
                        className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-white/65 transition hover:bg-white/[0.04] hover:text-white"
                      >
                        <span className="h-1 w-1 shrink-0 rounded-full bg-white/20 transition group-hover:bg-[color:var(--brand-purple)]" />
                        <span className="leading-snug">{a.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>
    </PageShell>
  );
}

function BriefColumn({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: string;
}) {
  return (
    <div>
      <h3 className={`text-[11px] font-semibold uppercase tracking-[0.13em] ${accent}`}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-1.5 text-xs text-white/35">—</p>
      ) : (
        <ul className="mt-1.5 space-y-1 text-xs text-white/75">
          {items.map((it, i) => (
            <li key={i} className="leading-relaxed">
              • {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
