// DOCX export for any SEO action result.
//
// Mirrors the structure of the PDF (see src/components/print-layout.tsx)
// but emits a Word document the consultant can edit before sending. Same
// cover info, same body markdown — just as a .docx instead of a .pdf.

import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageBreak,
  AlignmentType,
  BorderStyle,
} from "docx";
import { findAction } from "@/lib/seo-pillars";
import { getClientBySlug } from "@/lib/notion";
import { getHistoryEntry, formatDisplayResultId } from "@/lib/action-history";
import { extractAnalysis } from "@/lib/strip-tool-progress";
import {
  getConsultantForSlug,
  getConsultantEmailForSlug,
} from "@/lib/client-overrides";
import { formatDateLong } from "@/lib/dates";
import { markdownToDocxBlocks } from "@/lib/md-to-docx";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _req: Request,
  ctx: {
    params: Promise<{
      clientSlug: string;
      actionSlug: string;
      resultId: string;
    }>;
  },
) {
  const { clientSlug, actionSlug, resultId } = await ctx.params;

  const entry = findAction(actionSlug);
  if (!entry) {
    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }
  const client = await getClientBySlug(clientSlug).catch(() => null);
  if (!client) {
    return NextResponse.json({ error: "Unknown client" }, { status: 404 });
  }
  const existing = await getHistoryEntry(clientSlug, actionSlug, resultId);
  if (!existing) {
    return NextResponse.json({ error: "Result not saved yet" }, { status: 404 });
  }

  const { action } = entry;
  const consultant = getConsultantForSlug(clientSlug);
  const consultantEmail = getConsultantEmailForSlug(clientSlug);
  const generatedDate = formatDateLong(existing.createdAt);
  const displayResultId = formatDisplayResultId(resultId);

  // Strip the tool-progress blockquote prefix from the analysis without
  // cutting at "---" section rules inside it (see extractAnalysis).
  const analysisText = extractAnalysis(existing.output);

  const coverBlocks: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "WONDER ADS",
          bold: true,
          size: 36,
          color: "343ED7",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: "SEO Department · Audit Report",
          size: 18,
          color: "5b34c9",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `${action.label} · ${client.title}`,
          size: 18,
          color: "5b34c9",
        }),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: action.label,
          bold: true,
          size: 64,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 320 },
      children: [
        new TextRun({
          text: existing.metrics?.target ?? "",
          size: 26,
          color: "555555",
        }),
      ],
    }),
    new Paragraph({
      border: {
        top: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: "CCCCCC",
          space: 10,
        },
      },
      spacing: { before: 60, after: 100 },
      children: [
        new TextRun({ text: "Audited: ", bold: true, size: 22 }),
        new TextRun({ text: generatedDate, size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: "Head SEO Consultant: ", bold: true, size: 22 }),
        new TextRun({ text: consultant, size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: "Report ID: ", bold: true, size: 22 }),
        new TextRun({ text: displayResultId, font: "Consolas", size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: "Questions? ", bold: true, size: 22 }),
        new TextRun({
          text: consultantEmail,
          size: 22,
          color: "5b34c9",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "wonder-ads.com", size: 22, color: "5b34c9" }),
      ],
    }),
    new Paragraph({
      children: [new PageBreak()],
    }),
  ];

  const bodyBlocks = markdownToDocxBlocks(analysisText || "_No analysis content saved._");

  const doc = new Document({
    creator: "Wonder Ads SEO Department",
    title: `${action.label} · ${client.title}`,
    description: `Generated ${generatedDate}`,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: [...coverBlocks, ...bodyBlocks],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  const safeClient = client.title.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  const filename = `${safeClient}-${action.slug}-${displayResultId}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
