import { Client } from "@notionhq/client";
import { kv } from "@vercel/kv";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getClientPalette, type ClientPalette } from "./client-colors";
import {
  EXCLUDED_SLUGS,
  TITLE_OVERRIDES,
  defaultConsultantForSlug,
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
  // João B.'s first book (v75.4). Both are still in the onboarding phase
  // (SuperAdmin filling the forms). Surfaced here so they show under João B.
  // now; when they submit the onboarding form the SAME slug promotes
  // seamlessly (seenSlugs dedupes) and the intake PDF attaches to /seo/<slug>.
  { title: "Cidália Cabeleireiros", icon: "💇" },
  { title: "MyMedic", icon: "🏥" },
  // Maratona Clube de Portugal (v76.39) — organizador da EDP Maratona de
  // Lisboa, Meia Maratona e restantes provas. João B., onboarding 01/09/2026.
  { title: "Maratona Clube de Portugal", icon: "🏃" },
  // PhysioHub (physiohub.pt, v77.44) — rede de clínicas de fisioterapia do
  // grupo do António Gaspar; Manuel Silva, onboarding 23/09/2026 (a mesma
  // data e o mesmo formulário do AG). O slug fica «physio-hub» porque o
  // registo do fluxo de onboarding já existia com esse nome — assim a
  // página pública /physio-hub/onboarding e a ficha SEO são o mesmo cliente.
  { title: "PhysioHub", slug: "physio-hub", icon: "🏥" },
  // Real Hotels Group (realhotelsgroup.com, v77.44) — João B., onboarding
  // 24/09/2026, formulário ainda por preencher. v77.45: o registo de
  // onboarding chamava-se «(Santa Eulália)»; passou a ser o grupo, sem a
  // unidade no nome nem no slug.
  { title: "Real Hotels Group", slug: "real-hotels-group", icon: "🏨" },
  // ATN Medical (atnmedical.pt, v77.47) — o primeiro cliente da Maria Assena.
  // Já existia no registo do fluxo de onboarding com este slug (formulário
  // por preencher); fica aqui para aparecer na coluna dela desde já.
  { title: "ATN Medical", slug: "atn-medical", icon: "🏥" },
];

// v5 cache key — bumped for André Pereira joining as a new consultant
// and the addition of Sentir Saúde + Clínica Fernando Almeida to the
// synthetic roster (v74.31). Bump whenever the shape of NotionClient or
// any of its derived fields changes meaningfully. v7: added CuidaMais
// (v74.38). v9: offboarded Senior Resort (excluded slug).
// v11: merge promoted onboarding-flow clients into the roster.
// v12: uma consultora saiu e a carteira foi redistribuída; João B. joins with
// Cidália Cabeleireiros + MyMedic (synthetic, still in onboarding) (v75.4).
// v13: Maratona Clube de Portugal entra na carteira do João B. (v76.39).
// v14: PhysioHub (Manuel Silva) + Real Hotels Group (João B.) entram na
// carteira (v77.44).
// v15: Real Hotels Group renomeado — slug «real-hotels-group» (v77.45).
// v16: Maria Assena entra com a ATN Medical (v77.47).
// v17: os clientes do onboarding saem da cache e passam a ser juntados a cada
// pedido (v77.86) — o bump deita fora a lista que ficou em cache sem eles
// durante a falha do KV de 12/10/2026.
const SEO_CLIENTS_CACHE_KEY = "seo-clients-v17";

/** Última lista que a Notion devolveu inteira (v77.83). Quando o
 *  unstable_cache falha (cache miss — p.ex. depois de um revalidatePath da
 *  rota — e a Notion responde 429 ou dá timeout), servimos esta em vez de
 *  rebentar a página com «Application error». Fica de propósito na chave
 *  v16: é a rede de segurança e tem de existir já no primeiro pedido depois
 *  de um bump (a forma do NotionClient não mudou). */
const SEO_CLIENTS_LAST_GOOD_KEY = "seo:clients-last-good:seo-clients-v16";

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
          consultant: defaultConsultantForSlug(slug),
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
        consultant: defaultConsultantForSlug(slug),
        palette: getClientPalette(slug),
        tier: getClientTier(slug),
      });
      seenSlugs.add(slug);
    }

    // Os clientes do onboarding NÃO entram aqui (v77.86): vêm do KV e são
    // juntados a cada pedido em getSeoClients. Dentro desta cache, uma leitura
    // falhada ficava guardada 1 h e os clientes desapareciam do board.

    // Só se chega aqui com a Notion a responder a tudo — guardar como rede.
    // Uma falha a gravar nunca estraga a lista que já temos.
    await kv
      .set(SEO_CLIENTS_LAST_GOOD_KEY, clients)
      .catch((err) => console.error("seo clients last-good save failed:", err));

    return clients;
  },
  [SEO_CLIENTS_CACHE_KEY],
  { revalidate: 3600, tags: ["seo-clients"] },
);

async function notionSeoClients(): Promise<NotionClient[]> {
  try {
    return await _fetchSeoClients();
  } catch (err) {
    const lastGood = await kv
      .get<NotionClient[]>(SEO_CLIENTS_LAST_GOOD_KEY)
      .catch(() => null);
    if (lastGood?.length) {
      console.warn(
        "Notion indisponível — a servir a última lista de clientes guardada:",
        err,
      );
      return lastGood;
    }
    throw err;
  }
}

/** Clients who came in through the onboarding flow and have submitted the
 *  form are promoted into the roster here ("auto-create the SEO project on
 *  submit"). Lido a cada pedido (uma leitura KV), fora do unstable_cache:
 *  se o KV falhar, só ESTE pedido fica sem eles — nada fica guardado. */
async function withOnboardingClients(
  base: NotionClient[],
): Promise<NotionClient[]> {
  let promoted: Awaited<ReturnType<typeof getPromotedOnboardingClients>>;
  try {
    promoted = await getPromotedOnboardingClients();
  } catch (err) {
    console.error("Onboarding client merge failed:", err);
    return base;
  }
  const seenSlugs = new Set(base.map((c) => c.slug));
  const clients = [...base];
  for (const oc of promoted) {
    if (seenSlugs.has(oc.slug) || EXCLUDED_SLUGS.has(oc.slug)) continue;
    clients.push({
      id: `onboarding:${oc.slug}`,
      title: oc.title,
      slug: oc.slug,
      icon: oc.icon,
      consultant: oc.consultant ?? defaultConsultantForSlug(oc.slug),
      palette: getClientPalette(oc.slug),
      tier: getClientTier(oc.slug),
    });
    seenSlugs.add(oc.slug);
  }
  return clients;
}

export const getSeoClients = cache(
  async (): Promise<NotionClient[]> =>
    withOnboardingClients(await notionSeoClients()),
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
