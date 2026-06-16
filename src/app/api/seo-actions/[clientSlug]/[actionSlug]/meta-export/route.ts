// CSV + DOCX export for a Meta Tags result.
//   ?id=<resultId>&format=csv  — for the dev team (drops into Yoast / WP / Webflow)
//   ?id=<resultId>&format=docx — for the client packet
//
// Both are public (no auth) — the URL is the share secret, same model
// as the rest of the public review surface.

import { NextResponse } from "next/server";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from "docx";
import { getMetaTagsResult } from "@/lib/meta-tags-store";
import { getClientBySlug } from "@/lib/notion";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ clientSlug: string; actionSlug: string }> },
) {
  const { clientSlug } = await ctx.params;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const result = await getMetaTagsResult(clientSlug, id);
  if (!result) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }
  const client = await getClientBySlug(clientSlug).catch(() => null);
  // Branded, human filename: "Meta Tags - Client - Wonder Ads.<ext>".
  const safeClient = (client?.title ?? clientSlug)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);

  if (format === "csv") {
    const header = [
      "url",
      "current_title",
      "current_title_length",
      "optimized_title",
      "optimized_title_length",
      "current_meta",
      "current_meta_length",
      "optimized_meta",
      "optimized_meta_length",
      "primary_keyword",
      "secondary_keywords",
      "reasoning",
      "issues",
    ];
    const lines = [header.join(",")];
    for (const r of result.rows) {
      lines.push(
        [
          csvEscape(r.url),
          csvEscape(r.currentTitle ?? ""),
          r.currentTitleLength,
          csvEscape(r.optimizedTitle),
          r.optimizedTitleLength,
          csvEscape(r.currentMeta ?? ""),
          r.currentMetaLength,
          csvEscape(r.optimizedMeta),
          r.optimizedMetaLength,
          csvEscape(r.primaryKeyword ?? ""),
          csvEscape(r.secondaryKeywords.join(" | ")),
          csvEscape(r.reasoning),
          csvEscape(r.issues.join(" | ")),
        ].join(","),
      );
    }
    const filename = `Meta Tags - ${safeClient} - Wonder Ads.csv`;
    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  }

  // DOCX
  const blocks: (Paragraph | Table)[] = [];
  blocks.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: `Meta Tags — ${client?.title ?? clientSlug}`,
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${result.rows.length} pages · depth: ${result.inputs.depth} · drafted ${new Date(result.createdAt).toISOString().slice(0, 10)}`,
          size: 20,
          color: "666666",
        }),
      ],
    }),
    new Paragraph({ children: [], spacing: { after: 200 } }),
  );
  for (const r of result.rows) {
    blocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: r.url, bold: true })],
      }),
    );
    blocks.push(buildTagTable("Title", r.currentTitle, r.optimizedTitle));
    blocks.push(new Paragraph({ children: [], spacing: { after: 80 } }));
    blocks.push(buildTagTable("Meta", r.currentMeta, r.optimizedMeta));
    if (r.primaryKeyword || r.reasoning) {
      blocks.push(
        new Paragraph({
          spacing: { before: 80, after: 60 },
          children: [
            ...(r.primaryKeyword
              ? [
                  new TextRun({
                    text: `Primary keyword: ${r.primaryKeyword}`,
                    size: 18,
                    bold: true,
                  }),
                  new TextRun({ text: " · ", size: 18, color: "999999" }),
                ]
              : []),
            new TextRun({
              text: r.reasoning,
              size: 18,
              italics: true,
              color: "555555",
            }),
          ],
        }),
      );
    }
  }
  const doc = new Document({
    creator: "Wonder Ads · SEO DPT",
    title: `Meta Tags — ${client?.title ?? clientSlug}`,
    sections: [{ children: blocks }],
  });
  const buffer = await Packer.toBuffer(doc);
  const filename = `Meta Tags - ${safeClient} - Wonder Ads.docx`;
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

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildTagTable(
  label: string,
  current: string | null,
  optimized: string,
): Table {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [1800, 3600, 3600],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            shading: { type: "clear", fill: "f3f0fa", color: "auto" },
            children: [
              new Paragraph({
                children: [new TextRun({ text: label, bold: true, size: 18 })],
              }),
            ],
          }),
          new TableCell({
            shading: { type: "clear", fill: "f3f0fa", color: "auto" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Current", bold: true, size: 18 }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: { type: "clear", fill: "e8f5e9", color: "auto" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Optimised",
                    bold: true,
                    size: 18,
                    color: "1b5e20",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${(current ?? "").length} chars`,
                    size: 16,
                    color: "777777",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: current ?? "(missing)",
                    size: 20,
                    italics: !current,
                    color: current ? "333333" : "999999",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: optimized, size: 20, color: "1b5e20" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "dddddd" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "dddddd" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "dddddd" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "dddddd" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "dddddd" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "dddddd" },
    },
  });
}
