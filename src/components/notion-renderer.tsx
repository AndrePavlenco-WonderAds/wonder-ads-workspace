import Link from "next/link";
import type { NotionBlock } from "@/lib/notion";
import { slugify } from "@/lib/notion";

type RichText = {
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
};

function RichTextSpan({ rich }: { rich: RichText[] }) {
  return (
    <>
      {rich.map((r, i) => {
        let el: React.ReactNode = r.plain_text;
        if (r.annotations.code) {
          el = (
            <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-white/90">
              {el}
            </code>
          );
        }
        if (r.annotations.bold) el = <strong className="text-white">{el}</strong>;
        if (r.annotations.italic) el = <em>{el}</em>;
        if (r.annotations.strikethrough) el = <s>{el}</s>;
        if (r.annotations.underline) el = <u>{el}</u>;
        if (r.href) {
          el = (
            <a
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="brand-gradient-text font-medium underline-offset-4 hover:underline"
            >
              {el}
            </a>
          );
        }
        return <span key={i}>{el}</span>;
      })}
    </>
  );
}

function getRich(block: NotionBlock, key: string): RichText[] {
  const data = block[block.type] as Record<string, unknown> | undefined;
  if (!data) return [];
  const arr = (data[key] ?? data.rich_text) as RichText[] | undefined;
  return Array.isArray(arr) ? arr : [];
}

export function NotionRenderer({
  blocks,
  childSlugBase,
}: {
  blocks: NotionBlock[];
  childSlugBase?: string;
}) {
  // Group consecutive list items
  type ListGroup = { kind: "list"; tag: "ul" | "ol"; items: NotionBlock[] };
  type Single = { kind: "single"; block: NotionBlock };
  const grouped: Array<ListGroup | Single> = [];
  for (const b of blocks) {
    const top = grouped[grouped.length - 1];
    if (b.type === "bulleted_list_item") {
      if (top?.kind === "list" && top.tag === "ul") top.items.push(b);
      else grouped.push({ kind: "list", tag: "ul", items: [b] });
    } else if (b.type === "numbered_list_item") {
      if (top?.kind === "list" && top.tag === "ol") top.items.push(b);
      else grouped.push({ kind: "list", tag: "ol", items: [b] });
    } else {
      grouped.push({ kind: "single", block: b });
    }
  }

  return (
    <div className="space-y-4">
      {grouped.map((node, i) => {
        if (node.kind === "list") {
          const Tag = node.tag;
          return (
            <Tag
              key={i}
              className={`space-y-1.5 pl-1 ${
                Tag === "ul" ? "list-none" : "list-decimal pl-5"
              } text-white/80`}
            >
              {node.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  {Tag === "ul" && (
                    <span
                      aria-hidden
                      className="brand-gradient-bg mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    />
                  )}
                  <span>
                    <RichTextSpan rich={getRich(item, "rich_text")} />
                  </span>
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <Block
            key={node.block.id}
            block={node.block}
            childSlugBase={childSlugBase}
          />
        );
      })}
    </div>
  );
}

function Block({
  block,
  childSlugBase,
}: {
  block: NotionBlock;
  childSlugBase?: string;
}) {
  switch (block.type) {
    case "heading_1":
      return (
        <h2 className="mt-8 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          <RichTextSpan rich={getRich(block, "rich_text")} />
        </h2>
      );
    case "heading_2":
      return (
        <h3 className="mt-6 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          <RichTextSpan rich={getRich(block, "rich_text")} />
        </h3>
      );
    case "heading_3":
      return (
        <h4 className="mt-4 text-lg font-semibold tracking-tight text-white">
          <RichTextSpan rich={getRich(block, "rich_text")} />
        </h4>
      );
    case "paragraph": {
      const rich = getRich(block, "rich_text");
      if (rich.length === 0) return null;
      return (
        <p className="leading-relaxed text-white/75">
          <RichTextSpan rich={rich} />
        </p>
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-2 border-white/20 pl-4 italic text-white/70">
          <RichTextSpan rich={getRich(block, "rich_text")} />
        </blockquote>
      );
    case "callout": {
      const data = block.callout as { icon?: { emoji?: string } } | undefined;
      const emoji = data?.icon?.emoji;
      return (
        <div className="brand-gradient-border rounded-xl bg-white/[0.04] p-4 backdrop-blur-md">
          <div className="flex gap-3 text-sm text-white/85">
            {emoji && (
              <span aria-hidden className="text-lg leading-tight">
                {emoji}
              </span>
            )}
            <div>
              <RichTextSpan rich={getRich(block, "rich_text")} />
            </div>
          </div>
        </div>
      );
    }
    case "divider":
      return <hr className="my-6 border-white/10" />;
    case "to_do": {
      const data = block.to_do as { checked: boolean };
      return (
        <div className="flex gap-3 text-white/80">
          <input
            type="checkbox"
            checked={data.checked}
            readOnly
            className="mt-1 h-4 w-4 accent-fuchsia-500"
          />
          <span className={data.checked ? "line-through opacity-60" : ""}>
            <RichTextSpan rich={getRich(block, "rich_text")} />
          </span>
        </div>
      );
    }
    case "code": {
      const data = block.code as { language?: string };
      return (
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-white/85">
          <code className={`language-${data.language ?? "text"}`}>
            <RichTextSpan rich={getRich(block, "rich_text")} />
          </code>
        </pre>
      );
    }
    case "child_page": {
      const data = block.child_page as { title: string };
      const title = data.title.trim();
      const slug = slugify(title);
      const href = childSlugBase ? `${childSlugBase}/${slug}` : null;
      const content = (
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium text-white">
            📄 {title || "Untitled"}
          </span>
          <span className="text-xs text-white/40">Notion</span>
        </span>
      );
      const className =
        "brand-gradient-border block rounded-xl bg-white/[0.035] px-4 py-3 backdrop-blur-md transition hover:bg-white/[0.06]";
      return href ? (
        <Link href={href} className={className}>
          {content}
        </Link>
      ) : (
        <div className={className}>{content}</div>
      );
    }
    case "child_database": {
      const data = block.child_database as { title: string };
      return (
        <div className="brand-gradient-border rounded-xl bg-white/[0.035] px-4 py-3 backdrop-blur-md">
          <p className="text-sm font-medium text-white">
            🗂 {data.title || "Database"}
          </p>
          <p className="mt-1 text-xs text-white/50">
            Database content not yet rendered — view it in Notion.
          </p>
        </div>
      );
    }
    case "image": {
      const data = block.image as {
        external?: { url: string };
        file?: { url: string };
        caption?: RichText[];
      };
      const src = data.external?.url ?? data.file?.url;
      if (!src) return null;
      return (
        <figure className="my-4 overflow-hidden rounded-xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={data.caption?.map((c) => c.plain_text).join("") ?? ""}
            className="w-full"
          />
          {data.caption && data.caption.length > 0 && (
            <figcaption className="bg-black/20 px-3 py-2 text-xs text-white/55">
              <RichTextSpan rich={data.caption} />
            </figcaption>
          )}
        </figure>
      );
    }
    case "table":
    case "column_list":
    case "column":
    case "synced_block":
    case "toggle":
      return (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-3 text-xs text-white/40">
          [{block.type}] — open in Notion to view
        </div>
      );
    default:
      return null;
  }
}
