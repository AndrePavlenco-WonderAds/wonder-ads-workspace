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
import { getPromotedOnboardingClients } from "./onboarding-clients-store";

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
/** Synthetic SEO clients merged into the result of `_fetchSeoClients`.
 *  Used when a client should appear across the workspace but doesn't have
 *  its own Notion child page yet. Each entry shares the same shape as a
 *  Notion-sourced client so every downstream consumer (action pages,
 *  briefs, admin board) works without conditional branching. */
const EXTRA_SEO_CLIENTS: Array<{
  title: string;
  icon: string;
  /** Explicit slug — overrides slugify(title). Used to rename a client's
   *  display title while keeping its stable data slug. */
  slug?: string;
}> = [
  { title: "Spine Center", icon: "🦴" },
  // André Pereira's first two clients (v74.31) — not in Notion yet.
  { title: "Sentir Saúde", icon: "💆" },
  // v74.71: renamed from "Clínica Fernando Almeida" → "Prof. Fernando
  // Almeida" (the Web duplicate was removed). Slug stays pinned so all
  // the existing SEO data (brief, tier, NPS, admin records) is kept.
  {
    title: "Prof. Fernando Almeida",
    slug: "clinica-fernando-almeida",
    icon: "🦷",
  },
  // CuidaMais (Cuida+) — André Pereira (v74.38). Portuguese e-commerce
  // for orthopedic / rehab / mobility products. Not in Notion yet.
  { title: "CuidaMais", icon: "🩺" },
  // Kings Gyms (kingsgyms.com) — André Pereira (v74.59). Not in Notion yet.
  { title: "Kings Gyms", icon: "🏋️" },
];

const _fetchSeoClients = unstable_cache(
  async (): Promise<NotionClient[]> => {
    const columns = await listChildren(SEO_PROJECTS_COLUMN_LIST_ID);
    const clients: NotionClient[] = [];
    const seenSlugs = new Set<string>();

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
        seenSlugs.add(slug);
      }
    }

    // Append synthetic extras that should appear in the SEO roster even
    // though they don't have a Notion child page. Skips silently if a
    // matching slug was already pulled from Notion.
    for (const extra of EXTRA_SEO_CLIENTS) {
      const slug = extra.slug ?? slugify(extra.title);
      if (seenSlugs.has(slug) || EXCLUDED_SLUGS.has(slug)) continue;
      clients.push({
        id: `synthetic:${slug}`,
        title: extra.title,
        slug,
        icon: extra.icon,
        consultant: getConsultantForSlug(slug),
        palette: getClientPalette(slug),
        tier: getClientTier(slug),
      });
      seenSlugs.add(slug);
    }

    // Clients who came in through the onboarding flow and have submitted the
    // form are promoted into the roster here ("auto-create the SEO project on
    // submit"). Existing clients are skipped by the seenSlugs guard.
    try {
      for (const oc of await getPromotedOnboardingClients()) {
        if (seenSlugs.has(oc.slug) || EXCLUDED_SLUGS.has(oc.slug)) continue;
        clients.push({
          id: `onboarding:${oc.slug}`,
          title: oc.title,
          slug: oc.slug,
          icon: oc.icon,
          consultant: oc.consultant ?? getConsultantForSlug(oc.slug),
          palette: getClientPalette(oc.slug),
          tier: getClientTier(oc.slug),
        });
        seenSlugs.add(oc.slug);
      }
    } catch (err) {
      console.error("Onboarding client merge failed:", err);
    }

    return clients;
  },
  // v5 cache key — bumped for André Pereira joining as a new consultant
  // and the addition of Sentir Saúde + Clínica Fernando Almeida to the
  // synthetic roster (v74.31). Bump whenever the shape of NotionClient or
  // any of its derived fields changes meaningfully. v7: added CuidaMais
  // (v74.38). v9: offboarded Senior Resort (excluded slug).
  // v11: merge promoted onboarding-flow clients into the roster.
  ["seo-clients-v11"],
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
