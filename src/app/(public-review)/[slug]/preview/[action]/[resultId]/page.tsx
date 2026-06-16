// Public, read-only preview of a generic SEO action result (SEO Audit,
// Keyword Research, Client Roadmap, Monthly Report, etc.). Catches every
// markdown-text action that doesn't have a more-specific preview route —
// Next.js routes the static segments `/preview/gmb-posts/...` and
// `/preview/meta-tags/...` to their own pages first, so this dynamic
// [action] route only fires for everything else.
//
// Replaces the previous flow where the client's "Open" button in the
// Pending Review table linked straight to the .docx download. DOCX is
// now an internal-only artefact (consultants still get the Download
// DOCX button on the result page for editing); clients see a branded
// HTML report they can read in the browser + a Download PDF button.

import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/notion";
import { getClientLogo } from "@/lib/client-meta";
import {
  getConsultantEmailForSlug,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import {
  getHistoryEntry,
  formatDisplayResultId,
} from "@/lib/action-history";
import { findAction } from "@/lib/seo-pillars";
import { formatDate } from "@/lib/dates";
import { pickLang, t } from "@/lib/public-i18n";
import { PublicReportView } from "@/components/public-report-view";
import { findReviewItemByDocPath, listReviewItems } from "@/lib/review-store";
import { CommentsThread } from "@/components/comments-thread";
import { extractAnalysis } from "@/lib/strip-tool-progress";

export const dynamic = "force-dynamic";

export default async function PublicActionPreviewPage({
  params,
}: {
  params: Promise<{ slug: string; action: string; resultId: string }>;
}) {
  const { slug, action: actionSlug, resultId } = await params;

  const entry = findAction(actionSlug);
  if (!entry) notFound();

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();

  const history = await getHistoryEntry(slug, actionSlug, resultId);
  if (!history) notFound();

  // Strip the tool-progress blockquote prefix that the runner emits
  // before Claude's analysis — without cutting at "---" section rules
  // inside the analysis itself (see extractAnalysis).
  const analysisText = extractAnalysis(history.output);

  const logo = getClientLogo(slug);
  const consultantEmail = getConsultantEmailForSlug(slug);
  const consultantName = getConsultantForSlug(slug);
  const lang = pickLang(slug);

  // Footer phrasing — same helpers used by the meta-tags / gmb / pending-
  // review pages so PT clients get European Portuguese automatically.
  const footerQuestionsHtml = t(lang, "footerQuestions", {
    consultant: consultantName,
    emailLink: `<a href="mailto:${consultantEmail}" class="font-medium text-black/65 underline-offset-2 hover:text-black/85 hover:underline">${consultantEmail}</a>`,
  });

  // Comments are tied to the Pending Review row whose docLink points
  // at this exact preview URL — so notes left here show up next to
  // the row in the table, and vice versa. If no row matches (consultant
  // sent the link without going through SendToReview), we render a
  // friendly hint instead.
  const items = await listReviewItems(slug);
  const reviewItem = findReviewItemByDocPath(
    items,
    `/${slug}/preview/${actionSlug}/${resultId}`,
  );
  const commentsSlot = reviewItem ? (
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
  );

  return (
    <PublicReportView
      clientName={client.title}
      clientLogo={logo}
      actionLabel={entry.action.label}
      resultIdDisplay={formatDisplayResultId(resultId)}
      generatedDate={formatDate(history.createdAt)}
      consultantName={consultantName}
      consultantEmail={consultantEmail}
      analysisText={analysisText}
      badgeLabel={lang === "pt" ? "Relatório" : "Report"}
      footerTagline={t(lang, "footerTagline")}
      footerQuestionsHtml={footerQuestionsHtml}
      backToPendingReviewLabel={
        lang === "pt"
          ? "Voltar às Aprovações Pendentes"
          : "Back to Pending Review"
      }
      backToPendingReviewHref={`/${slug}/pendingreview`}
      downloadPdfLabel={lang === "pt" ? "Descarregar PDF" : "Download PDF"}
      commentsSlot={commentsSlot}
      metrics={history.metrics ?? null}
      vitals={history.vitals ?? null}
      kwResearch={history.kwResearch ?? null}
      showDomainSummary={actionSlug === "seo-audit"}
      showKeywordResearchSummary={actionSlug === "keyword-research"}
    />
  );
}
