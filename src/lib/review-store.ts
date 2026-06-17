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
/** Cap per-item comment thread length so the KV blob doesn't grow
 *  without bound. 200 comments per row is well past any realistic
 *  client back-and-forth; anything older gets trimmed when we append. */
const MAX_COMMENTS_PER_ITEM = 200;
const MAX_COMMENT_BODY_CHARS = 4000;
const MAX_COMMENT_AUTHOR_CHARS = 60;

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
  "Brief",
  "Other",
] as const;
export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

/** A single message on a row's comment thread. Behaves like a
 *  Google-Docs side-thread: anyone with the share link can post (same
 *  trust model as the rest of the public review surface — the URL is
 *  the access control). Posts can be resolved (✓) to gray them out
 *  without deletion so the audit trail survives. */
export type ReviewComment = {
  id: string;
  /** Whether the author is approving from the client side or replying
   *  from the agency side. Drives bubble alignment + colour. */
  author: "client" | "consultant";
  /** Optional display name. The internal table prefills the
   *  consultant's resolved name from `client-overrides`; the public
   *  side asks the visitor once and remembers it in localStorage. */
  authorName: string | null;
  /** Free-form body. No markdown processing yet — plain text + line
   *  breaks (clients paste short notes, not essays). */
  body: string;
  createdAt: number;
  /** When set, the thread renders this comment as a strike-through with
   *  a "Resolved" pill — same affordance Google Docs uses. */
  resolvedAt?: number | null;
  resolvedBy?: "client" | "consultant" | null;
};

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
  /** Comment thread for this row — both sides post here and the table
   *  auto-poll fans new ones in within ~12s. Optional / defaulted to
   *  `[]` so existing KV rows from before v74.22 don't break on read. */
  comments?: ReviewComment[];
  /** True when the consultant moved the row to the Archive tab. Only
   *  allowed once status is `Approved` or `Rejected` — enforced both
   *  client-side (UX) and server-side (sanitiser). Public client
   *  view never sees archived rows. Defaults to false. */
  archived?: boolean;
  /** Tracks WHEN the row was archived — useful for sorting the
   *  Archive tab newest-first and for any future audit needs. */
  archivedAt?: number | null;
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

export function newCommentId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Comments ----

/** Append a new comment to a row's thread. Returns the created
 *  comment + the updated item. Returns null if the row doesn't exist. */
export async function appendReviewComment(
  slug: string,
  itemId: string,
  partial: Omit<ReviewComment, "id" | "createdAt">,
): Promise<{ comment: ReviewComment; item: ReviewItem } | null> {
  if (!reviewStorageConfigured) return null;
  const current = await listReviewItems(slug);
  const idx = current.findIndex((r) => r.id === itemId);
  if (idx < 0) return null;
  const comment: ReviewComment = {
    ...partial,
    id: newCommentId(),
    createdAt: Date.now(),
  };
  const existing = current[idx].comments ?? [];
  // Newest at the END (chronological top-down feed, like a chat). Cap
  // the thread length defensively.
  const nextComments = [...existing, comment].slice(-MAX_COMMENTS_PER_ITEM);
  const updated: ReviewItem = {
    ...current[idx],
    comments: nextComments,
    updatedAt: Date.now(),
  };
  current[idx] = updated;
  await kv.set(key(slug), current);
  return { comment, item: updated };
}

/** Patch a single comment — used for resolve/unresolve. Returns the
 *  updated comment + item, or null if either is missing. */
export async function updateReviewComment(
  slug: string,
  itemId: string,
  commentId: string,
  patch: Partial<Pick<ReviewComment, "body" | "resolvedAt" | "resolvedBy">>,
): Promise<{ comment: ReviewComment; item: ReviewItem } | null> {
  if (!reviewStorageConfigured) return null;
  const current = await listReviewItems(slug);
  const idx = current.findIndex((r) => r.id === itemId);
  if (idx < 0) return null;
  const comments = current[idx].comments ?? [];
  const cIdx = comments.findIndex((c) => c.id === commentId);
  if (cIdx < 0) return null;
  const nextComments = [...comments];
  nextComments[cIdx] = { ...nextComments[cIdx], ...patch };
  const updated: ReviewItem = {
    ...current[idx],
    comments: nextComments,
    updatedAt: Date.now(),
  };
  current[idx] = updated;
  await kv.set(key(slug), current);
  return { comment: nextComments[cIdx], item: updated };
}

export async function deleteReviewComment(
  slug: string,
  itemId: string,
  commentId: string,
): Promise<ReviewItem | null> {
  if (!reviewStorageConfigured) return null;
  const current = await listReviewItems(slug);
  const idx = current.findIndex((r) => r.id === itemId);
  if (idx < 0) return null;
  const comments = current[idx].comments ?? [];
  const nextComments = comments.filter((c) => c.id !== commentId);
  if (nextComments.length === comments.length) return null;
  const updated: ReviewItem = {
    ...current[idx],
    comments: nextComments,
    updatedAt: Date.now(),
  };
  current[idx] = updated;
  await kv.set(key(slug), current);
  return updated;
}

/** Sanitiser for POST /comments body. Same trust model as the rest of
 *  the public review API — the URL is the access control. We whitelist
 *  fields, clamp lengths, and reject anything that doesn't look right. */
export function sanitiseNewCommentBody(raw: unknown): Omit<
  ReviewComment,
  "id" | "createdAt"
> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const body = typeof o.body === "string" ? o.body.trim() : "";
  if (!body) return null;
  const author: ReviewComment["author"] =
    o.author === "consultant" ? "consultant" : "client";
  const authorNameRaw = typeof o.authorName === "string" ? o.authorName.trim() : "";
  return {
    body: body.slice(0, MAX_COMMENT_BODY_CHARS),
    author,
    authorName: authorNameRaw
      ? authorNameRaw.slice(0, MAX_COMMENT_AUTHOR_CHARS)
      : null,
    resolvedAt: null,
    resolvedBy: null,
  };
}

/** Find the most recent review row whose docLink points at the given
 *  public-preview path. Used by the preview/[action]/gmb-posts/
 *  meta-tags pages to look up "their" review item without anyone
 *  having to pass the id through the URL — the docLink already does.
 *
 *  We match the URL's PATH only (ignoring query / hash / origin) so
 *  the lookup tolerates `?thread=…` decorations, trailing slashes,
 *  and absolute-vs-relative variants on either side. Returns null
 *  when nothing matches, in which case the caller renders a friendly
 *  "open from the table" hint instead of the thread. */
export function findReviewItemByDocPath(
  items: ReviewItem[],
  expectedPath: string,
): ReviewItem | null {
  const want = normalisePathForMatch(expectedPath);
  if (!want) return null;
  // Newest-first iteration so duplicates resolve to the latest row.
  const candidates = items
    .filter(
      (i) =>
        typeof i.docLink === "string" &&
        i.docLink.length > 0 &&
        normalisePathForMatch(i.docLink) === want,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  return candidates[0] ?? null;
}

function normalisePathForMatch(input: string): string {
  let s = input;
  try {
    // Accept absolute URLs (https://wonder-ads-workspace.vercel.app/foo/bar?x=1)
    // and bare paths (/foo/bar). The URL constructor needs an origin
    // for the bare case, so we supply a placeholder.
    const u = new URL(input, "https://w.invalid");
    s = u.pathname;
  } catch {
    // Fallback: strip query / hash by hand.
    const q = s.indexOf("?");
    if (q >= 0) s = s.slice(0, q);
    const h = s.indexOf("#");
    if (h >= 0) s = s.slice(0, h);
  }
  // Strip trailing slash for stable comparison.
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s.toLowerCase();
}

/** Count of unresolved comments on a row — drives the table badge. */
export function unresolvedCount(item: ReviewItem): number {
  if (!item.comments) return 0;
  let n = 0;
  for (const c of item.comments) if (!c.resolvedAt) n++;
  return n;
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
  if (typeof o.archived === "boolean") {
    out.archived = o.archived;
    out.archivedAt = o.archived ? Date.now() : null;
  }
  return out;
}

/** Items the public client view shows — never archived ones. */
export function filterPublicItems(items: ReviewItem[]): ReviewItem[] {
  return items.filter((i) => !i.archived);
}

/** Statuses that a row may be archived from. Anything else is a
 *  guard error — the consultant tried to archive work that's still
 *  in-flight. Source of truth for the rule lives here so the row
 *  button + the API + future audit can stay in sync. */
export const ARCHIVABLE_STATUSES: ReadonlyArray<ReviewStatus> = [
  "Approved",
  "Rejected",
];

export function isArchivable(status: ReviewStatus): boolean {
  return ARCHIVABLE_STATUSES.includes(status);
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
  // Loud red with a leading "!" so the client can't ignore it.
  // This is the main visual cue that draws attention to the table.
  "For Approval": {
    bg: "#fecaca",
    text: "#7f1d1d",
    border: "#f87171",
    label: "! For Approval",
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
  Brief: { bg: "#ccfbf1", text: "#115e59", border: "#99f6e4" },
  Other: { bg: "#e5e7eb", text: "#374151", border: "#d1d5db" },
};
