"use client";

// Google-Docs-style comment thread for a single Pending Review row.
//
// Used in two places:
//   • inline, under a row of <ReviewTable>      (variant="inline")
//   • as a panel on a public preview doc page   (variant="panel")
//
// Both surfaces post to /api/reviews/[slug]/items/[id]/comments and
// share the same data — comments left from the table show up on the
// doc page and vice versa, since the storage is keyed by review item
// id and the preview pages resolve themselves to that id via docLink.
//
// Authorship: the visitor picks a side once (Client / Wonder Ads) and
// optionally types a name. Both are persisted to localStorage so the
// next post auto-fills. The internal review page passes
// `defaultAuthor="consultant"` + the resolved consultant name so the
// consultant doesn't have to pick anything; the public side defaults
// to "client".
//
// Auto-polling: the ReviewTable already auto-polls the whole item
// list every 12s and re-renders the thread from props, so the inline
// variant doesn't need its own poll. The panel variant DOES poll
// (every 8s) since it lives on a separate page with no other refresh
// signal.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CornerDownRight,
  MessageSquare,
  Send,
  Trash2,
  X,
  ChevronUp,
} from "lucide-react";
import type { ReviewComment } from "@/lib/review-store";
import { t, type PublicLang } from "@/lib/public-i18n";

type Variant = "inline" | "panel";
type Author = "client" | "consultant";

type Props = {
  clientSlug: string;
  itemId: string;
  /** Initial thread shipped from the server — the inline variant
   *  refreshes via the parent's auto-poll passing a new array. */
  initialComments: ReviewComment[];
  /** Pre-selected role. The internal table passes "consultant"; the
   *  public surfaces pass "client". The user can flip via the role
   *  switcher but it auto-defaults to this. */
  defaultAuthor: Author;
  /** Pre-filled display name. Internal table fills with the resolved
   *  consultant name from `getConsultantForSlug`. */
  defaultAuthorName?: string | null;
  /** Whether the role switcher is shown. The internal page hides it
   *  (consultant only) for clarity. */
  allowRoleSwitch?: boolean;
  lang?: PublicLang;
  variant?: Variant;
  /** Inline variant: parent passes a key that changes when the row's
   *  comments arrived via auto-poll, so the component resets state if
   *  needed. Optional. */
  pollKey?: number;
  /** Inline variant: when provided, renders a close (×) button at the
   *  top-right of the thread + a "Fechar comentários" button at the
   *  bottom. The parent (ReviewTable) wires it to `setOpenCommentsFor(
   *  null)` so the user can collapse the row without scrolling back up
   *  to the chip in the table header. */
  onClose?: () => void;
};

const POLL_MS = 8000;
const ROLE_STORAGE_PREFIX = "review-role:";
const NAME_STORAGE_PREFIX = "review-name:";

export function CommentsThread({
  clientSlug,
  itemId,
  initialComments,
  defaultAuthor,
  defaultAuthorName,
  allowRoleSwitch = true,
  lang = "en",
  variant = "inline",
  onClose,
}: Props) {
  const [comments, setComments] = useState<ReviewComment[]>(initialComments);
  const [draft, setDraft] = useState("");
  const [author, setAuthor] = useState<Author>(defaultAuthor);
  const [authorName, setAuthorName] = useState<string>(defaultAuthorName ?? "");
  const [posting, setPosting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Local optimistic posts get an _optimistic flag so we can mark them
  // pending. Once the POST returns we replace them with the server copy.
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // Read persisted role/name on mount. Only override the defaultAuthor
  // if the user has explicitly chosen a different side previously; the
  // internal page never reads from storage (its defaultAuthor wins).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (allowRoleSwitch) {
      const storedRole = window.localStorage.getItem(
        `${ROLE_STORAGE_PREFIX}${clientSlug}`,
      );
      if (storedRole === "client" || storedRole === "consultant") {
        setAuthor(storedRole);
      }
      const storedName = window.localStorage.getItem(
        `${NAME_STORAGE_PREFIX}${clientSlug}`,
      );
      if (storedName) setAuthorName(storedName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSlug]);

  // Reflect new server-side data when the parent passes a fresh prop
  // (used by the inline variant when ReviewTable auto-polls). Avoid
  // clobbering optimistic local additions: keep any comment whose id
  // doesn't appear in the new array.
  useEffect(() => {
    setComments((prev) => {
      const serverIds = new Set(initialComments.map((c) => c.id));
      const localOnly = prev.filter((c) => !serverIds.has(c.id));
      return [...initialComments, ...localOnly];
    });
  }, [initialComments]);

  // Panel variant polls on its own — there's no parent table to
  // auto-refresh it.
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/reviews/${clientSlug}/items/${itemId}/comments`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { comments: ReviewComment[] };
      setComments(data.comments);
    } catch {
      /* silent — next poll will retry */
    }
  }, [clientSlug, itemId]);

  useEffect(() => {
    if (variant !== "panel") return;
    const timer = setInterval(() => {
      if (!document.hidden) void fetchComments();
    }, POLL_MS);
    function onVisibility() {
      if (!document.hidden) void fetchComments();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [variant, fetchComments]);

  const persistRole = useCallback(
    (role: Author, name: string) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(`${ROLE_STORAGE_PREFIX}${clientSlug}`, role);
      if (name) {
        window.localStorage.setItem(`${NAME_STORAGE_PREFIX}${clientSlug}`, name);
      }
    },
    [clientSlug],
  );

  const submit = useCallback(async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setErrorMsg(null);
    setPosting(true);
    // Optimistic add — temporary id, replaced when the POST returns.
    const tempId = `tmp_${Date.now().toString(36)}`;
    const optimistic: ReviewComment = {
      id: tempId,
      author,
      authorName: authorName.trim() || null,
      body,
      createdAt: Date.now(),
      resolvedAt: null,
      resolvedBy: null,
    };
    setComments((prev) => [...prev, optimistic]);
    setDraft("");
    persistRole(author, authorName.trim());
    try {
      const res = await fetch(
        `/api/reviews/${clientSlug}/items/${itemId}/comments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            author,
            authorName: authorName.trim() || null,
            body,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { comment: ReviewComment };
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? data.comment : c)),
      );
    } catch (err) {
      // Roll back optimistic add on failure.
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setErrorMsg(err instanceof Error ? err.message : String(err));
      // Restore the draft so the user doesn't lose what they typed.
      setDraft(body);
    } finally {
      setPosting(false);
    }
  }, [author, authorName, clientSlug, draft, itemId, persistRole, posting]);

  const resolve = useCallback(
    async (commentId: string, resolve: boolean) => {
      // Optimistic flip.
      const now = Date.now();
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                resolvedAt: resolve ? now : null,
                resolvedBy: resolve ? author : null,
              }
            : c,
        ),
      );
      try {
        await fetch(
          `/api/reviews/${clientSlug}/items/${itemId}/comments/${commentId}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ resolve, resolvedBy: author }),
          },
        );
      } catch {
        /* worst case: re-poll restores truth */
      }
    },
    [author, clientSlug, itemId],
  );

  const remove = useCallback(
    async (commentId: string) => {
      if (!confirm(t(lang, "commentsDeleteConfirm"))) return;
      const prev = comments;
      setComments((p) => p.filter((c) => c.id !== commentId));
      try {
        await fetch(
          `/api/reviews/${clientSlug}/items/${itemId}/comments/${commentId}`,
          { method: "DELETE" },
        );
      } catch {
        // Restore on failure.
        setComments(prev);
      }
    },
    [clientSlug, comments, itemId, lang],
  );

  const onComposerKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // ⌘/Ctrl+Enter to send — matches the Gmail / Linear / Notion
      // habit. Plain Enter inserts a newline (so multi-paragraph notes
      // are easy).
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    },
    [submit],
  );

  const unresolvedCount = useMemo(
    () => comments.filter((c) => !c.resolvedAt).length,
    [comments],
  );

  // --- Render ---------------------------------------------------------

  const Wrapper = variant === "panel" ? "section" : "div";
  return (
    <Wrapper
      className={
        variant === "panel"
          ? "mx-auto mt-12 max-w-3xl rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-7"
          : "rounded-xl border border-black/10 bg-white/95 p-3 shadow-inner"
      }
    >
      {variant === "panel" && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-black/85">
              {t(lang, "commentsPanelHeading")}
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-black/55">
              {t(lang, "commentsPanelHelp")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-[11px] font-medium text-black/65">
            <MessageSquare className="h-3 w-3" />
            {unresolvedCount}
          </div>
        </header>
      )}

      {/* Inline-variant header: tiny strip with the comment count + the
          close (×) button. Only renders when the parent passes onClose
          (i.e. the ReviewTable expanded sub-row); standalone usage
          stays clean. */}
      {variant === "inline" && onClose && (
        <header className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-black/55">
            <MessageSquare className="h-3 w-3" />
            {comments.length > 0
              ? `${comments.length} ${
                  comments.length === 1
                    ? t(lang, "commentsCountSingular")
                    : t(lang, "commentsCountPlural")
                }`
              : t(lang, "commentsHeading")}
          </span>
          <button
            type="button"
            onClick={onClose}
            title={t(lang, "commentsToggleClose")}
            aria-label={t(lang, "commentsToggleClose")}
            className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white p-1 text-black/55 transition hover:border-black/25 hover:bg-black/[0.05] hover:text-black/85"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>
      )}

      {/* Comment list */}
      {comments.length === 0 ? (
        <p
          className={`text-xs italic text-black/45 ${
            variant === "panel" ? "py-4 text-center" : "px-2 py-2"
          }`}
        >
          {t(lang, "commentsEmpty")}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {comments.map((c) => (
            <CommentBubble
              key={c.id}
              comment={c}
              currentAuthor={author}
              lang={lang}
              onResolve={(r) => resolve(c.id, r)}
              onDelete={() => remove(c.id)}
            />
          ))}
        </ul>
      )}

      {/* Composer */}
      <div className={comments.length > 0 ? "mt-4" : "mt-2"}>
        {allowRoleSwitch && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-full border border-black/10 bg-black/[0.03] p-0.5 text-[11px] font-medium">
              <RolePill
                active={author === "client"}
                onClick={() => setAuthor("client")}
                label={t(lang, "commentsRoleClient")}
                color="#6366f1"
              />
              <RolePill
                active={author === "consultant"}
                onClick={() => setAuthor("consultant")}
                label={t(lang, "commentsRoleConsultant")}
                color="#783DF5"
              />
            </div>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder={t(lang, "commentsNamePlaceholder")}
              className="flex-1 min-w-[140px] rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] text-black/75 outline-none focus:border-black/30"
            />
          </div>
        )}
        <div className="relative">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onComposerKey}
            placeholder={t(lang, "commentsPlaceholder")}
            rows={variant === "panel" ? 3 : 2}
            className="w-full resize-y rounded-lg border border-black/10 bg-white px-3 py-2 pr-24 text-sm text-black/85 outline-none transition focus:border-black/30"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!draft.trim() || posting}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
            }}
          >
            <Send className="h-3 w-3" />
            {posting ? t(lang, "commentsSending") : t(lang, "commentsSendButton")}
          </button>
        </div>
        {errorMsg && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-rose-600">
            <X className="h-3 w-3" /> {errorMsg}
          </p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] text-black/35">⌘/Ctrl + Enter</p>
          {variant === "inline" && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium text-black/55 transition hover:bg-black/[0.05] hover:text-black/85"
            >
              <ChevronUp className="h-3 w-3" />
              {t(lang, "commentsToggleClose")}
            </button>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

function RolePill({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 transition ${
        active ? "text-white" : "text-black/55 hover:text-black/85"
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      {label}
    </button>
  );
}

function CommentBubble({
  comment,
  currentAuthor,
  lang,
  onResolve,
  onDelete,
}: {
  comment: ReviewComment;
  currentAuthor: Author;
  lang: PublicLang;
  onResolve: (resolve: boolean) => void;
  onDelete: () => void;
}) {
  const isConsultant = comment.author === "consultant";
  const mine = comment.author === currentAuthor;
  const resolved = Boolean(comment.resolvedAt);
  return (
    <li
      className={`group rounded-lg border px-3 py-2 transition ${
        resolved
          ? "border-black/8 bg-black/[0.02] text-black/45"
          : isConsultant
            ? "border-violet-200/70 bg-violet-50/60"
            : "border-indigo-200/70 bg-indigo-50/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{
              backgroundColor: isConsultant ? "#783DF5" : "#6366f1",
            }}
            aria-hidden
          >
            {(comment.authorName ?? (isConsultant ? "WA" : "C"))
              .trim()
              .charAt(0)
              .toUpperCase() || "?"}
          </span>
          <span
            className={
              resolved
                ? "text-black/45"
                : isConsultant
                  ? "text-violet-800"
                  : "text-indigo-800"
            }
          >
            {comment.authorName?.trim() ||
              t(
                lang,
                isConsultant
                  ? "commentsRoleConsultant"
                  : "commentsRoleClient",
              )}
          </span>
          <span className="text-[10px] font-normal text-black/40">
            · {formatRelativeTime(comment.createdAt, lang)}
          </span>
          {resolved && (
            <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700">
              <Check className="h-2.5 w-2.5" />
              {t(lang, "commentsResolvedBadge")}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onResolve(!resolved)}
            title={
              resolved ? t(lang, "commentsReopen") : t(lang, "commentsResolve")
            }
            className="rounded-md p-1 text-black/35 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            {resolved ? (
              <CornerDownRight className="h-3 w-3" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </button>
          {mine && (
            <button
              type="button"
              onClick={onDelete}
              title={t(lang, "commentsDelete")}
              className="rounded-md p-1 text-black/35 transition hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <p
        className={`mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed ${
          resolved ? "text-black/45 line-through" : "text-black/85"
        }`}
      >
        {comment.body}
      </p>
    </li>
  );
}

function formatRelativeTime(ts: number, lang: PublicLang): string {
  const diffMs = Date.now() - ts;
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return t(lang, "commentsJustNow");
  const min = Math.floor(sec / 60);
  if (min < 60) return t(lang, "commentsMinutesAgo", { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t(lang, "commentsHoursAgo", { n: hr });
  const days = Math.floor(hr / 24);
  return t(lang, "commentsDaysAgo", { n: days });
}
