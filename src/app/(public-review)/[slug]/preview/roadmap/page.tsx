// Public, read-only preview of a client's 12-week SEO Roadmap.
//
// The internal board at /seo/[slug]/roadmap is fully editable (drag,
// add, regenerate). This page renders the SAME roadmap as a branded,
// read-only document for the client — sent via "Send for approval" on
// the board, opened from the Pending Review table. The client reads the
// plan + a Download PDF button; they can't touch the tasks.
//
// Reuses PublicReportView (same chrome as every other client report) by
// rendering the roadmap as markdown — see roadmapToMarkdown.

import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/notion";
import { getClientLogo } from "@/lib/client-meta";
import {
  getConsultantEmailForSlug,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import { getCurrentRoadmap } from "@/lib/roadmap-store";
import { roadmapToMarkdown } from "@/lib/roadmap-to-markdown";
import { formatDate } from "@/lib/dates";
import { pickLang, t } from "@/lib/public-i18n";
import { PublicReportView } from "@/components/public-report-view";
import { findReviewItemByDocPath, listReviewItems } from "@/lib/review-store";
import { CommentsThread } from "@/components/comments-thread";

export const dynamic = "force-dynamic";

export default async function PublicRoadmapPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();

  const roadmap = await getCurrentRoadmap(slug);
  if (!roadmap) notFound();

  const lang = pickLang(slug);
  const analysisText = roadmapToMarkdown(roadmap, lang);

  const logo = getClientLogo(slug);
  const consultantEmail = getConsultantEmailForSlug(slug);
  const consultantName = getConsultantForSlug(slug);
  const actionLabel = lang === "pt" ? "Roadmap SEO — 12 semanas" : "SEO Roadmap — 12 weeks";

  const footerQuestionsHtml = t(lang, "footerQuestions", {
    consultant: consultantName,
    emailLink: `<a href="mailto:${consultantEmail}" class="font-medium text-black/65 underline-offset-2 hover:text-black/85 hover:underline">${consultantEmail}</a>`,
  });

  // Comments tie to the Pending Review row whose docLink points at this
  // exact URL — `/${slug}/preview/roadmap`.
  const items = await listReviewItems(slug);
  const reviewItem = findReviewItemByDocPath(
    items,
    `/${slug}/preview/roadmap`,
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
      actionLabel={actionLabel}
      resultIdDisplay={formatDate(roadmap.generatedAt)}
      generatedDate={formatDate(roadmap.generatedAt)}
      consultantName={consultantName}
      consultantEmail={consultantEmail}
      analysisText={analysisText}
      badgeLabel={lang === "pt" ? "Plano" : "Plan"}
      footerTagline={t(lang, "footerTagline")}
      footerQuestionsHtml={footerQuestionsHtml}
      backToPendingReviewLabel={
        lang === "pt" ? "Voltar às Aprovações Pendentes" : "Back to Pending Review"
      }
      backToPendingReviewHref={`/${slug}/pendingreview`}
      downloadPdfLabel={lang === "pt" ? "Descarregar PDF" : "Download PDF"}
      commentsSlot={commentsSlot}
    />
  );
}
