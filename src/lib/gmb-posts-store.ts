// Per-client GMB Posts library — generations + per-post edits.
//
// A single "generation" produces 1-3 posts (consultant chooses count
// per run). We store the whole batch under one resultId so the result
// page can render them as a grid the consultant moves through. Each
// individual post is independently editable (caption, CTA, status,
// regen) without disturbing siblings.

import { kv } from "@vercel/kv";

const RESULT_PREFIX = "gmb-posts:result:";
const INDEX_PREFIX = "gmb-posts:index:";
const MAX_RESULTS = 60;

export const gmbStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export const GMB_POST_TYPES = ["Update", "Offer", "Event", "Product"] as const;
export type GmbPostType = (typeof GMB_POST_TYPES)[number];

export const GMB_POST_STATUSES = [
  "draft",
  "approved",
  "published",
] as const;
export type GmbPostStatus = (typeof GMB_POST_STATUSES)[number];

export const GMB_CTAS = [
  "Learn more",
  "Book",
  "Order online",
  "Buy",
  "Sign up",
  "Call now",
] as const;
export type GmbCta = (typeof GMB_CTAS)[number] | null;

/** Localised display label for a GMB CTA. We store the English enum
 *  value in KV (so consultants can change languages later without
 *  losing data) and translate at render time based on the client's
 *  language. European Portuguese specifically — agency operates in
 *  Portugal, so "Reservar" (not "Agendar"), "Subscrever" (not "Inscrever-se" /
 *  "Se inscrever"), etc. */
const CTA_LABELS: Record<string, Record<NonNullable<GmbCta>, string>> = {
  pt: {
    "Learn more": "Saber mais",
    Book: "Reservar",
    "Order online": "Encomendar online",
    Buy: "Comprar",
    "Sign up": "Subscrever",
    "Call now": "Ligar agora",
  },
  es: {
    "Learn more": "Más información",
    Book: "Reservar",
    "Order online": "Pedir online",
    Buy: "Comprar",
    "Sign up": "Suscribirse",
    "Call now": "Llamar ahora",
  },
  fr: {
    "Learn more": "En savoir plus",
    Book: "Réserver",
    "Order online": "Commander en ligne",
    Buy: "Acheter",
    "Sign up": "S'inscrire",
    "Call now": "Appeler",
  },
  it: {
    "Learn more": "Scopri di più",
    Book: "Prenota",
    "Order online": "Ordina online",
    Buy: "Acquista",
    "Sign up": "Iscriviti",
    "Call now": "Chiama ora",
  },
  de: {
    "Learn more": "Mehr erfahren",
    Book: "Buchen",
    "Order online": "Online bestellen",
    Buy: "Kaufen",
    "Sign up": "Registrieren",
    "Call now": "Jetzt anrufen",
  },
};

export function localizeCta(
  cta: GmbCta,
  languageCode: string,
): string | null {
  if (!cta) return null;
  const table = CTA_LABELS[languageCode];
  return table?.[cta] ?? cta;
}

export type GmbPost = {
  id: string;
  postType: GmbPostType;
  caption: string;
  cta: GmbCta;
  ctaUrl: string | null;
  imageUrl: string | null;
  /** The prompt the image generator used — handy for "regenerate" + debugging. */
  imagePrompt: string;
  /** When image generation fails, the exact error message from Gemini /
   *  the SDK so consultants (and the dev tools) can diagnose. Null when
   *  the image succeeded. */
  imageError: string | null;
  /** Target keywords this post tries to seed. */
  targetKeywords: string[];
  /** One-line "why this angle" — useful for the consultant scanning the grid. */
  reasoning: string;
  status: GmbPostStatus;
  createdAt: number;
  updatedAt: number;
};

export type GmbReferenceFile = {
  /** Display name of the file as stored in Client Files. */
  name: string;
  /** Source URL (Vercel Blob, Google Drive, etc.). */
  url: string;
  status: "used" | "failed" | "skipped";
  /** Human reason when status !== "used". */
  reason?: string;
};

export type GmbPostsResult = {
  id: string;
  clientSlug: string;
  createdAt: number;
  /** Inputs the consultant submitted — kept so the consultant can see
   *  WHY the AI angled the posts the way it did. */
  inputs: {
    postCount: number;
    postType?: GmbPostType;
    theme?: string;
    ctaUrlDefault?: string;
  };
  /** Which client files were actually fed to Gemini as reference images
   *  (and which failed). Shown on the result header so consultants know
   *  whether the brand was anchored or the image gen ran "freehand". */
  referencesUsed?: GmbReferenceFile[];
  posts: GmbPost[];
};

function resultKey(clientSlug: string, resultId: string): string {
  return `${RESULT_PREFIX}${clientSlug}:${resultId}`;
}

function indexKey(clientSlug: string): string {
  return `${INDEX_PREFIX}${clientSlug}`;
}

export async function getGmbResult(
  clientSlug: string,
  resultId: string,
): Promise<GmbPostsResult | null> {
  if (!gmbStorageConfigured) return null;
  try {
    const v = await kv.get<GmbPostsResult>(resultKey(clientSlug, resultId));
    return v ?? null;
  } catch (err) {
    console.error("gmb result read failed:", err);
    return null;
  }
}

export async function saveGmbResult(result: GmbPostsResult): Promise<void> {
  if (!gmbStorageConfigured) return;
  await kv.set(resultKey(result.clientSlug, result.id), result);
  // Maintain a slim index of recent result ids per client so the action's
  // history grid can list them without scanning every KV key.
  try {
    const index =
      (await kv.get<{ id: string; createdAt: number; postCount: number }[]>(
        indexKey(result.clientSlug),
      )) ?? [];
    const filtered = index.filter((e) => e.id !== result.id);
    filtered.unshift({
      id: result.id,
      createdAt: result.createdAt,
      postCount: result.posts.length,
    });
    await kv.set(indexKey(result.clientSlug), filtered.slice(0, MAX_RESULTS));
  } catch (err) {
    console.error("gmb index write failed:", err);
  }
}

export async function listGmbResults(
  clientSlug: string,
): Promise<{ id: string; createdAt: number; postCount: number }[]> {
  if (!gmbStorageConfigured) return [];
  try {
    const v = await kv.get<{ id: string; createdAt: number; postCount: number }[]>(
      indexKey(clientSlug),
    );
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function updateGmbPost(
  clientSlug: string,
  resultId: string,
  postId: string,
  patch: Partial<GmbPost>,
): Promise<GmbPostsResult | null> {
  if (!gmbStorageConfigured) return null;
  const existing = await getGmbResult(clientSlug, resultId);
  if (!existing) return null;
  const now = Date.now();
  const next: GmbPostsResult = {
    ...existing,
    posts: existing.posts.map((p) =>
      p.id === postId ? { ...p, ...patch, updatedAt: now } : p,
    ),
  };
  await kv.set(resultKey(clientSlug, resultId), next);
  return next;
}

export async function deleteGmbResult(
  clientSlug: string,
  resultId: string,
): Promise<void> {
  if (!gmbStorageConfigured) return;
  try {
    await kv.del(resultKey(clientSlug, resultId));
    const index =
      (await kv.get<{ id: string; createdAt: number; postCount: number }[]>(
        indexKey(clientSlug),
      )) ?? [];
    await kv.set(
      indexKey(clientSlug),
      index.filter((e) => e.id !== resultId),
    );
  } catch (err) {
    console.error("gmb delete failed:", err);
  }
}

export function newGmbResultId(when: Date = new Date()): string {
  const date = when.toISOString().slice(0, 10);
  const hh = String(when.getHours()).padStart(2, "0");
  const mm = String(when.getMinutes()).padStart(2, "0");
  return `${date}-${hh}${mm}-${Math.random().toString(36).slice(2, 4)}`;
}

export function newGmbPostId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
