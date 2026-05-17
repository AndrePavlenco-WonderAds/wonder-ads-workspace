import { Client } from "@notionhq/client";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getClientPalette, type ClientPalette } from "./client-colors";
import {
  EXCLUDED_SLUGS,
  TITLE_OVERRIDES,
  getConsultantForSlug,
} from "./client-overrides";
import { getClientTier, type ClientTier } from "./client-tiers";

const SEO_SPACE_PAGE_ID = "aa162d6cc35b458e8f5e8452406593a0";
const SEO_PROJECTS_COLUMN_LIST_ID = "23cc892b-a7ef-487e-8b85-9fdc36074aa1";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export type NotionClient = {
  id: string;
  title: string;
  slug: string;
  icon: string | null;
  consultant: string;
  palette: ClientPalette;
  tier: ClientTier;
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

// Heavy lift: list every SEO project from Notion. Wrapped in unstable_cache so
// the result is shared across requests (per-request React cache wasn't enough —
// every direct hit on /seo/<client>/actions/<action> was paying the full Notion
// roundtrip). React.cache() still wraps the public export below to dedupe
// concurrent calls within a single request.
const _fetchSeoClients = unstable_cache(
  async (): Promise<NotionClient[]> => {
    const columns = await listChildren(SEO_PROJECTS_COLUMN_LIST_ID);
    const clients: NotionClient[] = [];

    for (const column of columns) {
      if (column.type !== "column") continue;
      const items = await listChildren(column.id);
      for (const block of items) {
        if (block.type !== "child_page") continue;
        const rawTitle = (
          (block as unknown as { child_page: { title: string } }).child_page
            .title
        ).trim();
        if (!rawTitle) continue;
        const title = TITLE_OVERRIDES[rawTitle] ?? rawTitle;
        const page = await notion.pages.retrieve({ page_id: block.id });
        const icon =
          "icon" in page && page.icon && page.icon.type === "emoji"
            ? page.icon.emoji
            : null;
        const slug = slugify(title);
        if (EXCLUDED_SLUGS.has(slug)) continue;
        clients.push({
          id: block.id,
          title,
          slug,
          icon,
          consultant: getConsultantForSlug(slug),
          palette: getClientPalette(slug),
          tier: getClientTier(slug),
        });
      }
    }

    return clients;
  },
  // v2 cache key — bumped after the "Yenisey" → "Yenisey R." rename so any
  // stale unstable_cache entries from before the rename get evicted on the
  // next request instead of waiting up to an hour. Bump again whenever the
  // shape of NotionClient or any of its derived fields changes meaningfully.
  ["seo-clients-v2"],
  { revalidate: 3600, tags: ["seo-clients"] },
);

export const getSeoClients = cache(
  (): Promise<NotionClient[]> => _fetchSeoClients(),
);

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
