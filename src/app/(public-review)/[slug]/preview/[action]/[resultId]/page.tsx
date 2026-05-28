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

export const dynamic = "force-dynamic";

const SEPARATOR = "\n---\n\n";

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
  // before Claude's analysis. Same logic as PrintLayout's printMode.
  const sepIdx = history.output.indexOf(SEPARATOR);
  const analysisText =
    sepIdx >= 0
      ? history.output.slice(sepIdx + SEPARATOR.length)
      : history.output.trim().startsWith(">")
        ? ""
        : history.output;

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
    />
  );
}
