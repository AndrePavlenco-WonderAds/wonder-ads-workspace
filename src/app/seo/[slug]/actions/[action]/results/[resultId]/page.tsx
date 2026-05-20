import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LogoChip } from "@/components/logo-chip";
import { ResultRunner } from "@/components/result-runner";
import { GmbPostsRunner } from "@/components/gmb-posts-runner";
import { SendToReviewButton } from "@/components/send-to-review-button";
import { PrintLayout } from "@/components/print-layout";
import { getGmbResult } from "@/lib/gmb-posts-store";
import { getClientGeo } from "@/lib/client-geo";
import { findAction } from "@/lib/seo-pillars";
import { getClientBySlug } from "@/lib/notion";
import { getHistoryEntry, formatDisplayResultId } from "@/lib/action-history";
import {
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";
import {
  getConsultantForSlug,
  getConsultantEmailForSlug,
} from "@/lib/client-overrides";
import { formatDate, formatDateLong } from "@/lib/dates";
import { listTargetKeywords } from "@/lib/target-keywords-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; action: string; resultId: string }>;
}) {
  const { slug, action, resultId } = await params;
  const entry = findAction(action);
  const client = await getClientBySlug(slug).catch(() => null);
  if (!entry || !client) return { title: "Result — Wonder Ads Workspace" };
  return {
    title: `${entry.action.label} · ${resultId} · ${client.title} — Wonder Ads`,
  };
}

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; action: string; resultId: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { slug, action: actionSlug, resultId } = await params;
  const { print } = await searchParams;
  const printMode = print === "true";

  const entry = findAction(actionSlug);
  if (!entry) notFound();

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();

  const existing = await getHistoryEntry(slug, actionSlug, resultId);
  const { action, pillar } = entry;
  // GMB Posts has its own KV store separate from action-history. Fetch
  // it ahead of time so the top-of-page download button knows whether a
  // batch is ready (replacing the otherwise-permanent "Download
  // available soon" placeholder).
  const gmbResult =
    action.slug === "gmb-posts" ? await getGmbResult(slug, resultId) : null;

  // -- PRINT MODE: bypass PageShell entirely. Render the branded WonderAds
  //    PDF document straight from the server. The PrintLayout component
  //    renders <html>/<body> itself so the app chrome can't sneak in. --
  if (printMode) {
    // Strip the tool-progress blockquote prefix from the analysis (if any).
    const sep = "\n---\n\n";
    const raw = existing?.output ?? "";
    const sepIdx = raw.indexOf(sep);
    const analysisText =
      sepIdx >= 0
        ? raw.slice(sepIdx + sep.length)
        : raw.trim().startsWith(">")
          ? ""
          : raw;
    return (
      <PrintLayout
        clientName={client.title}
        actionLabel={action.label}
        resultId={resultId}
        generatedDate={
          existing ? formatDateLong(existing.createdAt) : formatDateLong(new Date())
        }
        consultant={getConsultantForSlug(slug)}
        consultantEmail={getConsultantEmailForSlug(slug)}
        analysisText={analysisText}
        metrics={existing?.metrics ?? null}
        vitals={existing?.vitals ?? null}
        kwResearch={existing?.kwResearch ?? null}
        showDomainSummary={action.slug === "seo-audit"}
        showKeywordResearchSummary={action.slug === "keyword-research"}
      />
    );
  }

  const logo = getClientLogo(slug);
  const logoBgMode = getLogoBgMode(slug);
  const logoSizing = getLogoSizing(slug);
  const gradient = paletteToGradient(getClientPalette(slug));
  const { Icon: PillarIcon } = pillar;

  const generatedDate = existing ? formatDate(existing.createdAt) : null;

  return (
    <PageShell
      wide
      backHref={`/seo/${slug}/actions/${actionSlug}`}
      backLabel={action.label}
    >
      <div className="mt-2 flex items-start gap-4">
        {/* Send to Pending Review — appears the instant a result has
            been saved, regardless of action type. Pre-fills the task
            label, category, and a back-link to this page. */}
        {(action.slug === "gmb-posts" ? gmbResult : existing) && (
          <SendToReviewButton
            clientSlug={slug}
            task={
              action.slug === "gmb-posts"
                ? `${gmbResult?.posts.length ?? 0} GMB post${
                    (gmbResult?.posts.length ?? 0) === 1 ? "" : "s"
                  } · ${client.title}`
                : `${action.label} · ${client.title}`
            }
            category={
              action.slug === "gmb-posts"
                ? "GMB Posts"
                : action.slug === "keyword-research"
                  ? "Keyword Research"
                  : action.slug === "seo-audit"
                    ? "SEO Audit"
                    : action.slug === "client-roadmap"
                      ? "Roadmap"
                      : "Other"
            }
            docLink={`/seo/${slug}/actions/${actionSlug}/results/${resultId}`}
            sourceType={action.slug}
          />
        )}
        {action.slug === "gmb-posts" ? (
          gmbResult ? (
            <a
              href={`/api/seo-actions/${slug}/${actionSlug}/gmb-download?resultId=${encodeURIComponent(resultId)}&batch=1`}
              className="ml-auto inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 hover:shadow-[#783DF5]/40"
              title="Download every image in this batch + a captions.txt file as a ZIP."
            >
              <Download className="h-3.5 w-3.5" />
              Download batch ({gmbResult.posts.length} post
              {gmbResult.posts.length === 1 ? "" : "s"})
            </a>
          ) : (
            <span
              title="Becomes active once the GMB posts are generated."
              className="ml-auto inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/50"
            >
              <Download className="h-3.5 w-3.5" />
              Download available soon
            </span>
          )
        ) : existing ? (
          <div className="ml-auto flex flex-col items-stretch gap-2">
            <a
              href={`/seo/${slug}/actions/${actionSlug}/results/${resultId}?print=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 hover:shadow-[#783DF5]/40"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </a>
            <a
              href={`/api/seo-actions/${slug}/${actionSlug}/results/${resultId}/docx`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/[0.08] hover:text-white"
              title="Download as a Word document so you can edit before sending."
            >
              <Download className="h-3.5 w-3.5" />
              Download DOCX
            </a>
          </div>
        ) : (
          <span
            title="Becomes active once the audit completes and the result is saved."
            className="ml-auto inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/50"
          >
            <Download className="h-3.5 w-3.5" />
            Download available soon
          </span>
        )}
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
          <Link href={`/seo/${slug}`} className="transition hover:text-white">
            {client.title}
          </Link>
          <span className="text-white/25">·</span>
          <span className="inline-flex items-center gap-1.5">
            <PillarIcon className="h-3 w-3" strokeWidth={2.25} />
            {pillar.name}
          </span>
          <span className="text-white/25">·</span>
          <Link
            href={`/seo/${slug}/actions/${actionSlug}`}
            className="transition hover:text-white"
          >
            {action.label}
          </Link>
        </div>
        <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          <span className="brand-gradient-text">{action.label}</span>
          <span className="ml-2 font-mono text-base text-white/45">
            · {formatDisplayResultId(resultId)}
          </span>
        </h1>
        {generatedDate && (
          <p className="mt-1 text-xs text-white/45">
            Generated {generatedDate} · model {existing!.model}
          </p>
        )}
      </header>

      <section className="mt-8">
        {action.slug === "gmb-posts" ? (
          <GmbPostsRunner
            clientSlug={slug}
            clientName={client.title}
            action={action}
            resultId={resultId}
            existing={gmbResult}
            languageCode={getClientGeo(slug).languageCode}
          />
        ) : (
          <ResultRunner
            clientSlug={slug}
            clientName={client.title}
            action={action}
            resultId={resultId}
            existing={existing}
            targetedKeywords={
              action.slug === "keyword-research"
                ? (await listTargetKeywords(slug)).map((k) => k.keyword)
                : []
            }
          />
        )}
      </section>
    </PageShell>
  );
}
