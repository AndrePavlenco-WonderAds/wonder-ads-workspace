// Internal Pending Review view — same table as the public page but
// inside PageShell, with the public-link share buttons (copy URL +
// open in new tab) and the per-row delete control enabled.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LogoChip } from "@/components/logo-chip";
import { ReviewTable } from "@/components/review-table";
import { CopyPublicLinkButton } from "@/components/copy-public-link-button";
import { AddReviewItemButton } from "@/components/add-review-item-button";
import { getClientBySlug } from "@/lib/notion";
import {
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";
import { listReviewItems } from "@/lib/review-store";

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
      ? `Pending Review — ${client.title} · Wonder Ads`
      : "Pending Review · Wonder Ads",
  };
}

export default async function InternalReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();
  const items = await listReviewItems(slug);
  const logo = getClientLogo(slug);
  const logoBgMode = getLogoBgMode(slug);
  const logoSizing = getLogoSizing(slug);
  const gradient = paletteToGradient(getClientPalette(slug));
  const publicPath = `/${slug}/pendingreview`;

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
              <span>Pending Review</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              <span className="brand-gradient-text">
                {items.length} item{items.length === 1 ? "" : "s"} pending
              </span>
            </h1>
            <p className="mt-1 text-xs text-white/55">
              Same table the client sees — every change saves to both views
              instantly.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open public link
          </a>
          <CopyPublicLinkButton path={publicPath} />
        </div>
      </header>

      <div className="mt-6 flex justify-end">
        <AddReviewItemButton clientSlug={slug} />
      </div>

      <section className="mt-3">
        {/* Wrap the white-table component on the dark app background. */}
        <div className="overflow-hidden rounded-2xl">
          <ReviewTable
            clientSlug={slug}
            initialItems={items}
            allowDelete={true}
          />
        </div>
      </section>
    </PageShell>
  );
}
