"use client";

// Client-facing read-only view of an SEO result (Audit, Keyword Research,
// Client Roadmap, Monthly Report, etc.). Rendered from
// /(public-review)/[slug]/preview/[action]/[resultId].
//
// Why this exists: previously the docLink we shared with clients via the
// Pending Review table pointed straight at the .docx download. Clients on
// mobile got a useless ".docx" save dialog; on desktop they had to open
// Word just to read the report. This page renders the same content as a
// branded webpage — they read it in the browser, and a "Download PDF"
// button at the top fires window.print() so they can save a PDF if they
// want one. DOCX is now an internal-only artefact (consultants still get
// the .docx download on the result page for editing).

import { useState } from "react";
import { Download, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DomainSummary,
  CoreWebVitalsSummary,
  KeywordUniverseSummary,
} from "./report-summaries";
import type { DomainMetrics } from "@/lib/seo-tools/dataforseo";
import type { SiteVitals } from "@/lib/audit-prep-store";
import type { KwResearchPack } from "@/lib/seo-tools/keyword-research";

export function PublicReportView({
  clientName,
  clientLogo,
  actionLabel,
  resultIdDisplay,
  generatedDate,
  consultantName,
  consultantEmail,
  analysisText,
  badgeLabel,
  footerTagline,
  footerQuestionsHtml,
  backToPendingReviewLabel,
  backToPendingReviewHref,
  downloadPdfLabel,
  commentsSlot,
  metrics = null,
  vitals = null,
  kwResearch = null,
  showDomainSummary = false,
  showKeywordResearchSummary = false,
  bodySlot,
}: {
  clientName: string;
  clientLogo: string | null;
  actionLabel: string;
  resultIdDisplay: string;
  generatedDate: string;
  consultantName: string;
  consultantEmail: string;
  analysisText: string;
  badgeLabel: string;
  /** Structured data shown above the written analysis — so the client
   *  sees the same dashboard the PDF + internal page show, not just prose.
   *  Audit: metrics + vitals; Keyword Research: the keyword pack. */
  metrics?: DomainMetrics | null;
  vitals?: SiteVitals | null;
  kwResearch?: KwResearchPack | null;
  showDomainSummary?: boolean;
  showKeywordResearchSummary?: boolean;
  footerTagline: string;
  /** Pre-substituted HTML for the footer "Questions?" line. */
  footerQuestionsHtml: string;
  backToPendingReviewLabel: string;
  backToPendingReviewHref: string;
  downloadPdfLabel: string;
  /** Slot below the report body, above the footer — used to drop in
   *  the comments thread tied to the matching Pending Review row.
   *  Hidden when printing (the @media print CSS pulls `.no-print`
   *  out of flow). */
  commentsSlot?: React.ReactNode;
  /** Custom report body. When provided it replaces the markdown
   *  `analysisText` rendering — used by deliverables that want a richer,
   *  bespoke layout (e.g. the SEO Roadmap's week cards) while keeping the
   *  shared branded chrome (header, Download PDF, comments, footer). */
  bodySlot?: React.ReactNode;
}) {
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    setPrinting(true);
    // Name the saved PDF "Action - Client - Wonder Ads" instead of the raw
    // URL — browsers default the Save-as-PDF filename to document.title.
    const prevTitle = document.title;
    document.title = `${actionLabel} - ${clientName} - Wonder Ads`;
    // Give React a tick to apply the .printing class (which hides nav/buttons
    // via the global print CSS below) before opening the dialog.
    requestAnimationFrame(() => {
      window.print();
      // The print dialog blocks synchronously in some browsers; reset
      // state once the user dismisses it.
      setTimeout(() => {
        setPrinting(false);
        document.title = prevTitle;
      }, 500);
    });
  }

  return (
    <main
      className={`public-report mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-8 ${printing ? "printing" : ""}`}
    >
      {/* Markdown / print styles. Scoped via the `public-report` class
          on the wrapping <main>, so they can't bleed into the internal
          dark-themed `seo-markdown` blocks elsewhere in the app. */}
      <style
        dangerouslySetInnerHTML={{ __html: PUBLIC_REPORT_CSS }}
      />

      {/* ----- Screen-only top bar with Download + back link ----- */}
      <div className="public-report-toolbar mb-6 flex flex-wrap items-center justify-between gap-3">
        <a
          href={backToPendingReviewHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-black/55 hover:text-black/85"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backToPendingReviewLabel}
        </a>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 hover:shadow-[#783DF5]/40"
          style={{
            background:
              "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
          }}
        >
          <Download className="h-3.5 w-3.5" />
          {downloadPdfLabel}
        </button>
      </div>

      {/* ----- Header (client identity) ----- */}
      <header className="mb-8 flex items-center gap-4">
        {clientLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clientLogo}
            alt={`${clientName} logo`}
            className="h-12 w-12 rounded-lg border border-black/8 bg-white object-contain p-1"
          />
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ backgroundColor: "#f3e8ff", color: "#581c87" }}
            >
              {badgeLabel}
            </span>
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}
            >
              SEO DPT
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-black/85 sm:text-3xl">
            {actionLabel}
          </h1>
          <p className="mt-1 text-xs text-black/55">
            {clientName} · {generatedDate} ·{" "}
            <span className="font-mono">{resultIdDisplay}</span>
          </p>
        </div>
      </header>

      {/* ----- Body: custom slot, or structured dashboard + markdown ----- */}
      {bodySlot ? (
        <div className="report-body">{bodySlot}</div>
      ) : (
      <article className="report-body">
        {showDomainSummary && metrics && <DomainSummary metrics={metrics} />}
        {showDomainSummary && vitals && (
          <CoreWebVitalsSummary vitals={vitals} />
        )}
        {showKeywordResearchSummary && kwResearch && (
          <KeywordUniverseSummary pack={kwResearch} />
        )}
        {analysisText.trim() ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {analysisText}
          </ReactMarkdown>
        ) : (
          <p className="text-sm text-black/55">
            This report hasn&apos;t finished generating yet. Please check
            back in a few minutes.
          </p>
        )}
      </article>
      )}

      {/* ----- Comments slot (rendered by the page) ----- */}
      {commentsSlot && <div className="no-print">{commentsSlot}</div>}

      {/* ----- Footer ----- */}
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
          · {footerTagline}
        </p>
        <p className="mt-1.5">
          {consultantName && consultantName !== "Unassigned" ? (
            <span dangerouslySetInnerHTML={{ __html: footerQuestionsHtml }} />
          ) : (
            <span
              dangerouslySetInnerHTML={{
                __html: `Questions? <a href="mailto:${consultantEmail}" class="font-medium text-black/65 underline-offset-2 hover:text-black/85 hover:underline">${consultantEmail}</a>`,
              }}
            />
          )}
        </p>
      </footer>
    </main>
  );
}

// Plain global CSS — scoped to .public-report so nothing leaks. Injected
// via <style dangerouslySetInnerHTML> so we don't need styled-jsx (the
// rest of the codebase styles via Tailwind utilities).
const PUBLIC_REPORT_CSS = `
.public-report .report-body {
  color: rgba(0, 0, 0, 0.78);
  font-size: 14px;
  line-height: 1.65;
}
.public-report .report-body h1,
.public-report .report-body h2,
.public-report .report-body h3,
.public-report .report-body h4 {
  color: rgba(0, 0, 0, 0.88);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.public-report .report-body h1 { font-size: 1.4rem; margin: 1.5rem 0 0.75rem; }
.public-report .report-body h2 {
  font-size: 1.25rem;
  margin: 2.25rem 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.public-report .report-body h3 { font-size: 1.05rem; margin: 1.5rem 0 0.5rem; }
.public-report .report-body h4 { font-size: 0.95rem; margin: 1.25rem 0 0.35rem; }
.public-report .report-body p { margin: 0 0 0.85rem; }
.public-report .report-body strong { color: rgba(0, 0, 0, 0.9); font-weight: 600; }
.public-report .report-body a {
  color: #5b21b6;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.public-report .report-body ul,
.public-report .report-body ol { margin: 0 0 0.85rem 1.25rem; }
.public-report .report-body li { margin: 0.2rem 0; }
.public-report .report-body blockquote {
  border-left: 3px solid rgba(120, 61, 245, 0.4);
  padding: 0.25rem 0 0.25rem 1rem;
  color: rgba(0, 0, 0, 0.65);
  margin: 1rem 0;
}
.public-report .report-body code {
  background: rgba(0, 0, 0, 0.05);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-size: 0.85em;
}
.public-report .report-body pre {
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 0.85rem;
  overflow-x: auto;
  font-size: 0.85em;
}
.public-report .report-body pre code { background: transparent; padding: 0; }
.public-report .report-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.9em;
}
.public-report .report-body th,
.public-report .report-body td {
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 0.5rem 0.65rem;
  text-align: left;
}
.public-report .report-body th { background: rgba(0, 0, 0, 0.04); font-weight: 600; }
.public-report .report-body hr {
  border: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  margin: 1.5rem 0;
}
/* Structured-summary stat cards (Domain intelligence / Keyword universe /
   Core Web Vitals) — shared markup from report-summaries.tsx, styled here
   for the light client-facing preview. */
.public-report .report-body .pdf-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin: 0.5rem 0 1.5rem;
}
.public-report .report-body .pdf-stat {
  border: 1px solid #e0e0e0;
  border-left: 3px solid #783df5;
  border-radius: 8px;
  padding: 0.75rem 0.9rem;
  background: #fff;
}
.public-report .report-body .pdf-stat-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #666;
}
.public-report .report-body .pdf-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0a0a0a;
  margin-top: 0.2rem;
  line-height: 1.1;
}
.public-report .report-body .pdf-stat-sub {
  font-size: 0.68rem;
  color: #777;
  margin-top: 0.2rem;
}
@media (max-width: 640px) {
  .public-report .report-body .pdf-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media print {
  .public-report .public-report-toolbar { display: none !important; }
  .public-report .no-print { display: none !important; }
  .public-report { max-width: none; padding: 0; }
  body { background: #fff !important; }
}
`;
