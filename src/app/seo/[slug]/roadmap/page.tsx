import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LogoChip } from "@/components/logo-chip";
import { RoadmapBoard } from "@/components/roadmap-board";
import { SendToReviewButton } from "@/components/send-to-review-button";
import { WeeklyUpdateButton } from "@/components/weekly-update-button";
import { getClientBySlug } from "@/lib/notion";
import {
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";
import { computeWarnings, ensureRoadmap } from "@/lib/roadmap-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  return {
    title: client
      ? `SEO Roadmap — ${client.title} · Wonder Ads`
      : "SEO Roadmap · Wonder Ads",
  };
}

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();

  const logo = getClientLogo(slug);
  const logoBgMode = getLogoBgMode(slug);
  const logoSizing = getLogoSizing(slug);
  const gradient = paletteToGradient(getClientPalette(slug));

  const roadmap = await ensureRoadmap(slug);
  const initialWarnings = computeWarnings(roadmap).filter(
    (w) => !new Set(roadmap.dismissedWarnings.map((d) => d.id)).has(w.id),
  );

  return (
    <PageShell wide backHref={`/seo/${slug}`} backLabel={client.title}>
      <header className="animate-fade-up mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LogoChip
            logo={logo}
            emoji={client.icon}
            alt={`${client.title} logo`}
            gradient={gradient}
            size="md"
            bgMode={logoBgMode}
            sizing={logoSizing}
          />
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
              <Link
                href={`/seo/${slug}`}
                className="inline-flex items-center gap-1 transition hover:text-white"
              >
                <ArrowLeft className="h-3 w-3" />
                {client.title}
              </Link>
              <span className="text-white/25">·</span>
              <span>SEO Roadmap</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              <span className="brand-gradient-text">12-week roadmap</span>
            </h1>
          </div>
        </div>
        {roadmap.tasks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <WeeklyUpdateButton clientSlug={slug} clientName={client.title} />
            <SendToReviewButton
              variant="default"
              clientSlug={slug}
              task={`SEO Roadmap — current month · ${client.title}`}
              category="Roadmap"
              docLink={`/${slug}/preview/roadmap/current-month`}
              sourceType="roadmap-month"
              label="Send current month"
            />
            <SendToReviewButton
              variant="prominent"
              clientSlug={slug}
              task={`SEO Roadmap (12 weeks) · ${client.title}`}
              category="Roadmap"
              docLink={`/${slug}/preview/roadmap`}
              sourceType="roadmap"
              label="Send full roadmap"
            />
          </div>
        )}
      </header>

      <section className="mt-6">
        <RoadmapBoard
          clientSlug={slug}
          clientName={client.title}
          initialRoadmap={roadmap}
          initialWarnings={initialWarnings}
        />
      </section>
    </PageShell>
  );
}
