// Markdown → DOCX converter.
//
// Walks the mdast tree produced by unified + remark-parse + remark-gfm and
// emits a flat list of docx primitives (Paragraph, Table). The caller
// wraps these in a Document, prepending a branded title page.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent, PhrasingContent, TableRow as MdTableRow } from "mdast";
import {
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ExternalHyperlink,
} from "docx";

type Block = Paragraph | Table;

const HEADING_LEVELS: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

type InlineStyle = {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
};

/** Convert a markdown string into a list of docx blocks. */
export function markdownToDocxBlocks(markdown: string): Block[] {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(markdown) as Root;
  const out: Block[] = [];
  for (const node of tree.children) {
    walkBlock(node, out);
  }
  return out;
}

function walkBlock(node: RootContent, out: Block[]) {
  switch (node.type) {
    case "heading": {
      out.push(
        new Paragraph({
          heading: HEADING_LEVELS[node.depth] ?? HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 80 },
          children: phrasingToRuns(node.children, {}),
        }),
      );
      return;
    }
    case "paragraph": {
      out.push(
        new Paragraph({
          spacing: { after: 120 },
          children: phrasingToRuns(node.children, {}),
        }),
      );
      return;
    }
    case "thematicBreak": {
      out.push(
        new Paragraph({
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: "CCCCCC",
              space: 1,
            },
          },
          spacing: { before: 120, after: 120 },
        }),
      );
      return;
    }
    case "blockquote": {
      for (const child of node.children) {
        if (child.type === "paragraph") {
          out.push(
            new Paragraph({
              indent: { left: 360 },
              border: {
                left: {
                  style: BorderStyle.SINGLE,
                  size: 18,
                  color: "783DF5",
                  space: 12,
                },
              },
              spacing: { before: 120, after: 120 },
              children: phrasingToRuns(child.children, { italic: true }),
            }),
          );
        } else {
          walkBlock(child, out);
        }
      }
      return;
    }
    case "list": {
      walkList(node, out, 0);
      return;
    }
    case "code": {
      const lines = node.value.split("\n");
      for (const line of lines) {
        out.push(
          new Paragraph({
            spacing: { after: 0 },
            shading: { type: "clear", fill: "F5F5F5", color: "auto" },
            children: [
              new TextRun({
                text: line || " ",
                font: "Consolas",
                size: 18,
              }),
            ],
          }),
        );
      }
      out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      return;
    }
    case "table": {
      out.push(buildTable(node.children));
      return;
    }
    case "html": {
      // Skip raw HTML — best effort, can't render arbitrary html in docx.
      return;
    }
    default:
      return;
  }
}

type ListNode = Extract<RootContent, { type: "list" }>;
type ListItemNode = ListNode["children"][number];

function walkList(node: ListNode, out: Block[], depth: number) {
  const ordered = node.ordered === true;
  let i = 1;
  for (const item of node.children) {
    const marker = ordered ? `${i}.` : "•";
    renderListItem(item, out, depth, marker);
    i += 1;
  }
}

function renderListItem(
  item: ListItemNode,
  out: Block[],
  depth: number,
  marker: string,
) {
  let firstParagraphDone = false;
  for (const child of item.children) {
    if (child.type === "paragraph" && !firstParagraphDone) {
      out.push(
        new Paragraph({
          indent: { left: 360 + depth * 360, hanging: 240 },
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `${marker}  `, bold: false }),
            ...phrasingToRuns(child.children, {}),
          ],
        }),
      );
      firstParagraphDone = true;
    } else if (child.type === "list") {
      walkList(child, out, depth + 1);
    } else if (child.type === "paragraph") {
      // Continuation paragraph in the same list item.
      out.push(
        new Paragraph({
          indent: { left: 360 + depth * 360 + 240 },
          spacing: { after: 80 },
          children: phrasingToRuns(child.children, {}),
        }),
      );
    } else {
      walkBlock(child, out);
    }
  }
}

function buildTable(rows: MdTableRow[]): Table {
  const headerCells = rows[0]?.children ?? [];
  const bodyRows = rows.slice(1);
  const colCount = headerCells.length;
  const docRows: TableRow[] = [];
  docRows.push(
    new TableRow({
      tableHeader: true,
      children: headerCells.map(
        (cell) =>
          new TableCell({
            shading: { type: "clear", fill: "F3F0FA", color: "auto" },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: phrasingToRuns(cell.children, { bold: true }),
              }),
            ],
          }),
      ),
    }),
  );
  for (const row of bodyRows) {
    const cells = row.children;
    docRows.push(
      new TableRow({
        children: cells.map(
          (cell) =>
            new TableCell({
              margins: { top: 50, bottom: 50, left: 100, right: 100 },
              children: [
                new Paragraph({
                  spacing: { after: 0 },
                  children: phrasingToRuns(cell.children, {}),
                }),
              ],
            }),
        ),
      }),
    );
  }
  return new Table({
    columnWidths: new Array(colCount).fill(Math.floor(9000 / Math.max(colCount, 1))),
    width: { size: 9000, type: WidthType.DXA },
    rows: docRows,
  });
}

function phrasingToRuns(
  nodes: PhrasingContent[],
  style: InlineStyle,
): (TextRun | ExternalHyperlink)[] {
  const out: (TextRun | ExternalHyperlink)[] = [];
  for (const node of nodes) {
    appendPhrasing(node, style, out);
  }
  return out;
}

function appendPhrasing(
  node: PhrasingContent,
  style: InlineStyle,
  out: (TextRun | ExternalHyperlink)[],
) {
  switch (node.type) {
    case "text":
      out.push(makeRun(node.value, style));
      return;
    case "strong":
      for (const child of node.children) {
        appendPhrasing(child, { ...style, bold: true }, out);
      }
      return;
    case "emphasis":
      for (const child of node.children) {
        appendPhrasing(child, { ...style, italic: true }, out);
      }
      return;
    case "inlineCode":
      out.push(makeRun(node.value, { ...style, code: true }));
      return;
    case "break":
      out.push(new TextRun({ break: 1 }));
      return;
    case "link": {
      out.push(
        new ExternalHyperlink({
          link: node.url,
          children: node.children.length > 0
            ? node.children
                .filter((c): c is { type: "text"; value: string } => c.type === "text")
                .map(
                  (c) =>
                    new TextRun({
                      text: c.value,
                      style: "Hyperlink",
                      color: "5b34c9",
                    }),
                )
            : [new TextRun({ text: node.url, color: "5b34c9" })],
        }),
      );
      return;
    }
    case "delete":
      for (const child of node.children) {
        appendPhrasing(child, style, out);
      }
      return;
    default:
      return;
  }
}

function makeRun(text: string, style: InlineStyle): TextRun {
  if (style.code) {
    return new TextRun({
      text,
      font: "Consolas",
      size: 20,
      color: "5b34c9",
    });
  }
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italic,
  });
}

/** Helper used by the cover page builder. */
export function coverParagraph(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    color?: string;
    align?: "left" | "right" | "center";
    spacingAfter?: number;
    spacingBefore?: number;
  } = {},
): Paragraph {
  const alignment =
    opts.align === "right"
      ? AlignmentType.RIGHT
      : opts.align === "center"
        ? AlignmentType.CENTER
        : AlignmentType.LEFT;
  return new Paragraph({
    alignment,
    spacing: { after: opts.spacingAfter ?? 0, before: opts.spacingBefore ?? 0 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: opts.size,
        color: opts.color,
      }),
    ],
  });
}
