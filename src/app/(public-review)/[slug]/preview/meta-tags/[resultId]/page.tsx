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
import { pickLang, t, plural } from "@/lib/public-i18n";
import { findReviewItemByDocPath, listReviewItems } from "@/lib/review-store";
import { CommentsThread } from "@/components/comments-thread";

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
  const lang = pickLang(slug);
  // Resolve the matching Pending Review row by docLink so the panel
  // and the table share the same thread.
  const items = await listReviewItems(slug);
  const reviewItem = findReviewItemByDocPath(
    items,
    `/${slug}/preview/meta-tags/${resultId}`,
  );
  const introHtml = t(lang, "metaTagsIntro", {
    linkOpen: `<a href="/${slug}/pendingreview" class="font-medium text-black/85 underline-offset-2 hover:underline">`,
    linkClose: "</a>",
  });

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
              {t(lang, "metaTagsBadge")}
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
            {t(lang, "metaTagsStats", {
              n: result.rows.length,
              plural: plural(result.rows.length),
              date: formatDate(result.createdAt),
              depth: result.inputs.depth,
            })}
          </p>
        </div>
      </header>

      <p
        className="mb-6 max-w-2xl text-sm leading-relaxed text-black/65"
        // Intro contains a localised link (linkOpen / linkClose) so we
        // inject the substituted HTML. Source is hard-coded in
        // src/lib/public-i18n.ts — no untrusted input flows in.
        dangerouslySetInnerHTML={{ __html: introHtml }}
      />

      <MetaTagsTable
        clientSlug={slug}
        resultId={result.id}
        initialRows={result.rows}
        readonly={true}
      />

      {reviewItem ? (
        <CommentsThread
          clientSlug={slug}
          itemId={reviewItem.id}
          initialComments={reviewItem.comments ?? []}
          defaultAuthor="client"
          lang={lang}
          variant="panel"
        />
      ) : (
        <section className="mx-auto mt-12 max-w-3xl rounded-2xl border border-dashed border-black/10 bg-white/60 p-5 text-center text-xs text-black/55 sm:p-7">
          {t(lang, "commentsPanelHelpNoThread")}
        </section>
      )}

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
          · {t(lang, "footerTagline")}
        </p>
        <p className="mt-1.5">
          {consultantName && consultantName !== "Unassigned" ? (
            <span
              dangerouslySetInnerHTML={{
                __html: t(lang, "footerQuestions", {
                  consultant: consultantName,
                  emailLink: `<a href="mailto:${consultantEmail}" class="font-medium text-black/65 underline-offset-2 hover:text-black/85 hover:underline">${consultantEmail}</a>`,
                }),
              }}
            />
          ) : (
            <span
              dangerouslySetInnerHTML={{
                __html: t(lang, "footerQuestionsNoName", {
                  emailLink: `<a href="mailto:${consultantEmail}" class="font-medium text-black/65 underline-offset-2 hover:text-black/85 hover:underline">${consultantEmail}</a>`,
                }),
              }}
            />
          )}
        </p>
      </footer>
    </main>
  );
}
