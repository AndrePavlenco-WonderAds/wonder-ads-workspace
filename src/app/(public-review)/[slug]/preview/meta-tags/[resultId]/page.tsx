// Public, read-only preview of a Meta Tags optimisation result.
// Same locked-down layout as /(public-review) — no PageShell, no app
// chrome, noindex/nofollow. Clients see exactly which titles + metas
// are being proposed for every page on their site, side-by-side with
// the current ones, but can't edit anything (they approve via the
// Pending Review table).

import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/notion";
import { getClientLogo } from "@/lib/client-meta";
import {
  getConsultantEmailForSlug,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import { getMetaTagsResult } from "@/lib/meta-tags-store";
import { MetaTagsTable } from "@/components/meta-tags-table";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PublicMetaTagsPreview({
  params,
}: {
  params: Promise<{ slug: string; resultId: string }>;
}) {
  const { slug, resultId } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();
  const result = await getMetaTagsResult(slug, resultId);
  if (!result) notFound();
  const logo = getClientLogo(slug);
  const consultantEmail = getConsultantEmailForSlug(slug);
  const consultantName = getConsultantForSlug(slug);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-8">
      {/* Header */}
      <header className="mb-8 flex items-center gap-4">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={`${client.title} logo`}
            className="h-12 w-12 rounded-lg border border-black/8 bg-white object-contain p-1"
          />
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}
            >
              Meta Tags Preview
            </span>
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ backgroundColor: "#e9d5ff", color: "#581c87" }}
            >
              SEO DPT
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-black/85 sm:text-3xl">
            {client.title}
          </h1>
          <p className="mt-1 text-xs text-black/55">
            {result.rows.length} page
            {result.rows.length === 1 ? "" : "s"} · drafted{" "}
            {formatDate(result.createdAt)} · depth: {result.inputs.depth}
          </p>
        </div>
      </header>

      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-black/65">
        These are the optimised <strong>title tags</strong> and{" "}
        <strong>meta descriptions</strong> we&apos;ve drafted for every page
        on your site, based on the latest Keyword Research and your brand
        brief. Each row shows the current tag (left) next to the proposed
        rewrite (right, in green). To approve or request changes, head back
        to your{" "}
        <a
          href={`/${slug}/pendingreview`}
          className="font-medium text-black/85 underline-offset-2 hover:underline"
        >
          Pending Review table
        </a>
        .
      </p>

      <MetaTagsTable
        clientSlug={slug}
        resultId={result.id}
        initialRows={result.rows}
        readonly={true}
      />

      <footer className="mt-12 border-t border-black/8 pt-6 text-center text-[11px] text-black/45">
        <p>
          <span
            className="font-semibold"
            style={{
              background:
                "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            Wonder Ads
          </span>{" "}
          · Health &amp; Wellness Growth Agency · #1 SEO Provider in Portugal
        </p>
        <p className="mt-1.5">
          Questions?{" "}
          {consultantName && consultantName !== "Unassigned" ? (
            <>
              Email {consultantName} —{" "}
              <a
                href={`mailto:${consultantEmail}`}
                className="font-medium text-black/65 underline-offset-2 hover:text-black/85 hover:underline"
              >
                {consultantEmail}
              </a>
            </>
          ) : (
            <a
              href={`mailto:${consultantEmail}`}
              className="font-medium text-black/65 underline-offset-2 hover:text-black/85 hover:underline"
            >
              {consultantEmail}
            </a>
          )}
        </p>
      </footer>
    </main>
  );
}
