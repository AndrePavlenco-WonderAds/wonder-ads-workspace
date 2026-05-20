// Per-client "Pending Review" table — the bridge between internal
// consultant work and client sign-off.
//
// One KV blob per client (slug-keyed). The public review page (no
// auth, no app chrome) renders + edits the same data the internal
// consultant view does. Consultants append items by clicking
// "Send to Review" on result pages (GMB post batches, Keyword
// Research results, SEO Audits, etc.); clients flip Status, set
// dates, paste back-and-forth docs.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "reviews:";
const MAX_ITEMS = 200;

export const reviewStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export const REVIEW_STATUSES = [
  "For Approval",
  "Approved",
  "Rejected",
  "Changes Requested",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_CATEGORIES = [
  "SEO Audit",
  "On-Page SEO",
  "Off-Page SEO",
  "Local SEO",
  "Technical SEO",
  "Content",
  "GMB Posts",
  "Keyword Research",
  "Roadmap",
  "Other",
] as const;
export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

export type ReviewItem = {
  id: string;
  /** What the client is approving. Editable. */
  task: string;
  /** Current approval state — colored pill in the table. Editable by
   *  client; this is the main interaction the table exists for. */
  status: ReviewStatus;
  /** Which pillar this work falls under — colored pill (informational
   *  for the client, useful for filtering long lists). Editable. */
  category: ReviewCategory;
  /** When the client approved (or was meant to approve). Editable. */
  approvalDate: string | null; // YYYY-MM-DD
  /** When the work should go live. Editable. */
  publishingDate: string | null; // YYYY-MM-DD
  /** Link to the asset — Google Doc, PDF, internal result page, etc. Editable. */
  docLink: string | null;
  /** Free-form notes a consultant or client might leave. Editable. */
  notes: string | null;
  // ---- tracking (not displayed in the public table) ----
  createdAt: number;
  updatedAt: number;
  /** Where the item came from. Helps the internal view show "this was
   *  auto-sent from GMB Posts result 2026-05-20-1437-h5". */
  sourceType?: string;
  sourceUrl?: string;
};

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

export async function listReviewItems(slug: string): Promise<ReviewItem[]> {
  if (!reviewStorageConfigured) return [];
  try {
    const v = await kv.get<ReviewItem[]>(key(slug));
    return Array.isArray(v) ? v : [];
  } catch (err) {
    console.error("review list failed:", err);
    return [];
  }
}

/** Replace the entire list — used for batch reorders or bulk imports.
 *  Per-item edits should go through `updateReviewItem` to preserve
 *  the createdAt and avoid clobbering parallel edits. */
export async function saveAllReviewItems(
  slug: string,
  items: ReviewItem[],
): Promise<void> {
  if (!reviewStorageConfigured) return;
  await kv.set(key(slug), items.slice(0, MAX_ITEMS));
}

export async function appendReviewItem(
  slug: string,
  partial: Omit<ReviewItem, "id" | "createdAt" | "updatedAt">,
): Promise<ReviewItem> {
  const now = Date.now();
  const item: ReviewItem = {
    ...partial,
    id: newReviewItemId(),
    createdAt: now,
    updatedAt: now,
  };
  if (!reviewStorageConfigured) return item;
  const current = await listReviewItems(slug);
  const next = [item, ...current].slice(0, MAX_ITEMS);
  await kv.set(key(slug), next);
  return item;
}

export async function updateReviewItem(
  slug: string,
  id: string,
  patch: Partial<Omit<ReviewItem, "id" | "createdAt">>,
): Promise<ReviewItem | null> {
  if (!reviewStorageConfigured) return null;
  const current = await listReviewItems(slug);
  const idx = current.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const updated: ReviewItem = {
    ...current[idx],
    ...patch,
    updatedAt: Date.now(),
  };
  current[idx] = updated;
  await kv.set(key(slug), current);
  return updated;
}

export async function deleteReviewItem(
  slug: string,
  id: string,
): Promise<boolean> {
  if (!reviewStorageConfigured) return false;
  const current = await listReviewItems(slug);
  const next = current.filter((r) => r.id !== id);
  if (next.length === current.length) return false;
  await kv.set(key(slug), next);
  return true;
}

export function newReviewItemId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Validation + sanitisation ----

/** Sanitise a payload coming in from the public PUT endpoint. The
 *  public page is unauthenticated, so we never trust the body — we
 *  whitelist editable fields and clamp lengths. */
export function sanitiseReviewItemPatch(
  raw: unknown,
): Partial<Omit<ReviewItem, "id" | "createdAt">> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Omit<ReviewItem, "id" | "createdAt">> = {};
  if (typeof o.task === "string") out.task = o.task.slice(0, 240);
  if (
    typeof o.status === "string" &&
    (REVIEW_STATUSES as readonly string[]).includes(o.status)
  )
    out.status = o.status as ReviewStatus;
  if (
    typeof o.category === "string" &&
    (REVIEW_CATEGORIES as readonly string[]).includes(o.category)
  )
    out.category = o.category as ReviewCategory;
  if (typeof o.approvalDate === "string" || o.approvalDate === null) {
    out.approvalDate = isIsoDateOrNull(o.approvalDate) ? (o.approvalDate as string | null) : null;
  }
  if (typeof o.publishingDate === "string" || o.publishingDate === null) {
    out.publishingDate = isIsoDateOrNull(o.publishingDate)
      ? (o.publishingDate as string | null)
      : null;
  }
  if (typeof o.docLink === "string" || o.docLink === null) {
    if (o.docLink === null || o.docLink === "") {
      out.docLink = null;
    } else if (typeof o.docLink === "string" && /^https?:\/\//i.test(o.docLink)) {
      out.docLink = o.docLink.slice(0, 1000);
    }
  }
  if (typeof o.notes === "string" || o.notes === null) {
    out.notes = typeof o.notes === "string" ? o.notes.slice(0, 4000) : null;
  }
  return out;
}

function isIsoDateOrNull(v: unknown): boolean {
  if (v === null || v === "") return true;
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// ---- Color mapping (used by both public + internal tables) ----

export const STATUS_PILL: Record<
  ReviewStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  "For Approval": {
    bg: "#dbeafe",
    text: "#1e3a8a",
    border: "#bfdbfe",
    label: "For Approval",
  },
  Approved: {
    bg: "#d1fae5",
    text: "#065f46",
    border: "#a7f3d0",
    label: "Approved",
  },
  Rejected: {
    bg: "#fee2e2",
    text: "#991b1b",
    border: "#fecaca",
    label: "Rejected",
  },
  "Changes Requested": {
    bg: "#fef3c7",
    text: "#92400e",
    border: "#fde68a",
    label: "Changes Requested",
  },
};

export const CATEGORY_PILL: Record<
  ReviewCategory,
  { bg: string; text: string; border: string }
> = {
  "SEO Audit": { bg: "#f3e8ff", text: "#581c87", border: "#e9d5ff" },
  "On-Page SEO": { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
  "Off-Page SEO": { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  "Local SEO": { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0" },
  "Technical SEO": { bg: "#cffafe", text: "#155e75", border: "#a5f3fc" },
  Content: { bg: "#fce7f3", text: "#9d174d", border: "#fbcfe8" },
  "GMB Posts": { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
  "Keyword Research": { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" },
  Roadmap: { bg: "#e0e7ff", text: "#3730a3", border: "#c7d2fe" },
  Other: { bg: "#e5e7eb", text: "#374151", border: "#d1d5db" },
};
