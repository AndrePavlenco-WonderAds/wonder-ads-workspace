import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LogoChip } from "@/components/logo-chip";
import { ActionRunner } from "@/components/action-runner";
import { IntegrationChips } from "@/components/integration-chips";
import { findAction, PILLARS, type ActionToolName } from "@/lib/seo-pillars";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientBySlug } from "@/lib/notion";
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

  const { action, pillar } = entry;
  const { Icon: PillarIcon } = pillar;

  const briefHasContent =
    brief.dos.length + brief.donts.length + brief.notes.length > 0;
  const showBriefPanel = action.usesBrief !== false && briefHasContent;

  // Per-action defaults computed from client context. Extend as new actions
  // benefit from prefilled inputs (e.g. blog audience from client tier).
  const defaults: Record<string, string> = {};
  if (action.slug === "seo-audit" && website) defaults.pageUrl = website;

  return (
    <PageShell wide>
      <div className="mt-6">
        <Link
          href={`/seo/${slug}#section-actions`}
          className="inline-flex items-center gap-1 text-xs text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {client.title}
        </Link>
      </div>

      <header className="animate-fade-up mt-6">
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
        />
      </section>

      <nav
        aria-label="Other actions"
        className="mt-12 border-t border-white/8 pt-6"
      >
        <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
          More actions for {client.title}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {PILLARS.flatMap((p) =>
            p.actions.map((a) => ({ pillar: p, action: a })),
          )
            .filter((x) => x.action.slug !== action.slug)
            .map(({ pillar: p, action: a }) => {
              const Ic = p.Icon;
              return (
                <Link
                  key={a.slug}
                  href={`/seo/${slug}/actions/${a.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5 text-xs text-white/70 transition hover:border-[color:var(--brand-purple)]/45 hover:bg-white/[0.06] hover:text-white"
                >
                  <Ic className="h-3 w-3" strokeWidth={2.25} />
                  {a.label}
                </Link>
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
