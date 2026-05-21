// Public Pending Review table — no auth, no app chrome.
// The client lands here via a link the consultant shared. They see:
//   - Wonder Ads + their clinic name as the header
//   - The editable table
//   - A thin "any changes are auto-saved" reassurance line
// They do NOT see: any of the internal workspace navigation, any
// other client, a "back" button into the app, or anything else
// private.

import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/notion";
import { getClientLogo } from "@/lib/client-meta";
import {
  getConsultantEmailForSlug,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import { listReviewItems } from "@/lib/review-store";
import { ReviewTable } from "@/components/review-table";
import { pickLang, t } from "@/lib/public-i18n";

export const dynamic = "force-dynamic";

export default async function PublicReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Reject reserved slugs / paths so /seo/pendingreview etc. don't
  // accidentally resolve via the catch-all.
  if (
    [
      "seo",
      "ads",
      "web",
      "commercial",
      "changelog",
      "api",
      "review",
      "reviews",
      "_next",
      "static",
      "public",
    ].includes(slug)
  ) {
    notFound();
  }
  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();
  const items = await listReviewItems(slug);
  const logo = getClientLogo(slug);
  const lang = pickLang(slug);
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
              style={{
                backgroundColor: "#e9d5ff",
                color: "#581c87",
              }}
            >
              {t(lang, "pendingReviewBadge")}
            </span>
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{
                backgroundColor: "#dbeafe",
                color: "#1e3a8a",
              }}
            >
              SEO DPT
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-black/85 sm:text-3xl">
            {client.title}
          </h1>
        </div>
      </header>

      {/* Intro line — friendly, sets expectations */}
      <p
        className="mb-6 max-w-2xl text-sm leading-relaxed text-black/65"
        dangerouslySetInnerHTML={{
          __html: t(lang, "pendingReviewIntro"),
        }}
      />

      <ReviewTable
        clientSlug={slug}
        initialItems={items}
        allowDelete={false}
        hidePublishingDate={true}
        readonlyApprovalDate={true}
      />

      {/* Footer */}
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
