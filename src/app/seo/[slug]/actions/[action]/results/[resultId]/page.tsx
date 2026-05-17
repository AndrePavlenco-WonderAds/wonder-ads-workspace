import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LogoChip } from "@/components/logo-chip";
import { ResultRunner } from "@/components/result-runner";
import { PrintLayout } from "@/components/print-layout";
import { findAction } from "@/lib/seo-pillars";
import { getClientBySlug } from "@/lib/notion";
import { getHistoryEntry } from "@/lib/action-history";
import {
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";
import { formatDateTime, formatDateLong } from "@/lib/dates";

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
        analysisText={analysisText}
        metrics={existing?.metrics ?? null}
        vitals={existing?.vitals ?? null}
        showDomainSummary={action.slug === "seo-audit"}
      />
    );
  }

  const logo = getClientLogo(slug);
  const logoBgMode = getLogoBgMode(slug);
  const logoSizing = getLogoSizing(slug);
  const gradient = paletteToGradient(getClientPalette(slug));
  const { Icon: PillarIcon } = pillar;

  const generatedDate = existing ? formatDateTime(existing.createdAt) : null;

  return (
    <PageShell wide>
      <div className="mt-6 flex items-center gap-4">
        <Link
          href={`/seo/${slug}/actions/${actionSlug}`}
          className="inline-flex items-center gap-1 text-xs text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {action.label}
        </Link>
        {existing ? (
          <a
            href={`/seo/${slug}/actions/${actionSlug}/results/${resultId}?print=true`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/75 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </a>
        ) : (
          <span
            title="Becomes active once the audit completes and the result is saved."
            className="ml-auto inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-white/35"
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
            · {resultId}
          </span>
        </h1>
        {generatedDate && (
          <p className="mt-1 text-xs text-white/45">
            Generated {generatedDate} · model {existing!.model}
          </p>
        )}
      </header>

      <section className="mt-8">
        <ResultRunner
          clientSlug={slug}
          clientName={client.title}
          action={action}
          resultId={resultId}
          existing={existing}
        />
      </section>
    </PageShell>
  );
}
