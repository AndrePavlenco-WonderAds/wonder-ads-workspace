import { Client } from "@notionhq/client";
import { cache } from "react";

const SEO_SPACE_PAGE_ID = "aa162d6cc35b458e8f5e8452406593a0";
const SEO_PROJECTS_COLUMN_LIST_ID = "23cc892b-a7ef-487e-8b85-9fdc36074aa1";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export type NotionClient = {
  id: string;
  title: string;
  slug: string;
  icon: string | null;
};

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function listChildren(blockId: string) {
  const out: unknown[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    out.push(...res.results);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out as Array<{ id: string; type: string; [k: string]: unknown }>;
}

export const getSeoClients = cache(async (): Promise<NotionClient[]> => {
  const columns = await listChildren(SEO_PROJECTS_COLUMN_LIST_ID);
  const clients: NotionClient[] = [];

  for (const column of columns) {
    if (column.type !== "column") continue;
    const items = await listChildren(column.id);
    for (const block of items) {
      if (block.type !== "child_page") continue;
      const title = (
        (block as unknown as { child_page: { title: string } }).child_page.title
      ).trim();
      if (!title) continue;
      const page = await notion.pages.retrieve({ page_id: block.id });
      const icon =
        "icon" in page && page.icon && page.icon.type === "emoji"
          ? page.icon.emoji
          : null;
      clients.push({
        id: block.id,
        title,
        slug: slugify(title),
        icon,
      });
    }
  }

  return clients;
});

export const getClientBySlug = cache(
  async (slug: string): Promise<NotionClient | null> => {
    const clients = await getSeoClients();
    return clients.find((c) => c.slug === slug) ?? null;
  },
);

export type NotionBlock = Record<string, unknown> & { id: string; type: string };

export const getPageBlocks = cache(
  async (pageId: string): Promise<NotionBlock[]> => {
    return (await listChildren(pageId)) as NotionBlock[];
  },
);

export const SEO_SPACE_NOTION_URL = `https://www.notion.so/${SEO_SPACE_PAGE_ID}`;
export { SEO_SPACE_PAGE_ID, SEO_PROJECTS_COLUMN_LIST_ID };
