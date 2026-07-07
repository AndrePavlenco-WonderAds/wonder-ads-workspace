// Public, read-only preview of just the CURRENT MONTH of a client's SEO
// roadmap (the 4 weeks the consultant is working through right now). Sent
// via "Send current month" on the roadmap board. Same branded chrome +
// rich week-card layout as the full roadmap preview.

import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/notion";
import { getClientLogo } from "@/lib/client-meta";
import {
  getConsultantEmailForSlug,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import {
  getCurrentRoadmap,
  currentWeekIndex,
  roadmapWeeks,
} from "@/lib/roadmap-store";
import { formatDate } from "@/lib/dates";
import { pickLang, t } from "@/lib/public-i18n";
import { PublicReportView } from "@/components/public-report-view";
import { RoadmapReportBody } from "@/components/roadmap-report-body";
import { findReviewItemByDocPath, listReviewItems } from "@/lib/review-store";
import { CommentsThread } from "@/components/comments-thread";

export const dynamic = "force-dynamic";

/** Current month + its 4 week numbers, from the live current week. Clamped
 *  into the roadmap's real span so a plan that's run past its final week
 *  still sends the last month rather than an out-of-range one. */
function currentMonth(
  week: number,
  totalWeeks: number,
): { month: number; weeks: number[] } {
  const clampedWeek = Math.min(totalWeeks, Math.max(1, week || 1));
  const month = Math.ceil(clampedWeek / 4);
  const start = (month - 1) * 4 + 1;
  return { month, weeks: [start, start + 1, start + 2, start + 3] };
}

export default async function PublicRoadmapMonthPreviewPage({
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
  const cw = currentWeekIndex(roadmap);
  const { month, weeks } = currentMonth(cw, roadmapWeeks(roadmap));

  const logo = getClientLogo(slug);
  const consultantEmail = getConsultantEmailForSlug(slug);
  const consultantName = getConsultantForSlug(slug);
  const actionLabel =
    lang === "pt" ? `Roadmap SEO — Mês ${month}` : `SEO Roadmap — Month ${month}`;

  const footerQuestionsHtml = t(lang, "footerQuestions", {
    consultant: consultantName,
    emailLink: `<a href="mailto:${consultantEmail}" class="font-medium text-black/65 underline-offset-2 hover:text-black/85 hover:underline">${consultantEmail}</a>`,
  });

  const items = await listReviewItems(slug);
  const reviewItem = findReviewItemByDocPath(
    items,
    `/${slug}/preview/roadmap/current-month`,
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
      analysisText=""
      bodySlot={
        <RoadmapReportBody
          roadmap={roadmap}
          weeks={weeks}
          currentWeek={cw}
          lang={lang}
        />
      }
      badgeLabel={lang === "pt" ? "Plano do mês" : "Month plan"}
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
