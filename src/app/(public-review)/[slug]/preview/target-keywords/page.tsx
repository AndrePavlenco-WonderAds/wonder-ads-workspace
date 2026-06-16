// Public, read-only preview of a client's Target Keywords list.
//
// Sent via "Send for approval" on the Target Keywords panel of the SEO
// client page; opened from the Pending Review table. The client reviews
// the keyword targets as a branded table + Download PDF — no editing.
// Same chrome (PublicReportView) as every other deliverable.

import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/notion";
import { getClientLogo } from "@/lib/client-meta";
import {
  getConsultantEmailForSlug,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import { listTargetKeywords } from "@/lib/target-keywords-store";
import { targetKeywordsToMarkdown } from "@/lib/target-keywords-to-markdown";
import { formatDate } from "@/lib/dates";
import { pickLang, t } from "@/lib/public-i18n";
import { PublicReportView } from "@/components/public-report-view";
import { findReviewItemByDocPath, listReviewItems } from "@/lib/review-store";
import { CommentsThread } from "@/components/comments-thread";

export const dynamic = "force-dynamic";

export default async function PublicTargetKeywordsPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();

  const keywords = await listTargetKeywords(slug);
  const lang = pickLang(slug);
  const analysisText = targetKeywordsToMarkdown(keywords, lang);

  const logo = getClientLogo(slug);
  const consultantEmail = getConsultantEmailForSlug(slug);
  const consultantName = getConsultantForSlug(slug);
  const actionLabel = lang === "pt" ? "Palavras-chave Alvo" : "Target Keywords";

  const footerQuestionsHtml = t(lang, "footerQuestions", {
    consultant: consultantName,
    emailLink: `<a href="mailto:${consultantEmail}" class="font-medium text-black/65 underline-offset-2 hover:text-black/85 hover:underline">${consultantEmail}</a>`,
  });

  const items = await listReviewItems(slug);
  const reviewItem = findReviewItemByDocPath(
    items,
    `/${slug}/preview/target-keywords`,
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
      resultIdDisplay={formatDate(new Date())}
      generatedDate={formatDate(new Date())}
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
