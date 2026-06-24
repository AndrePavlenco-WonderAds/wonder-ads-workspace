"use client";

// Editable Pending Review table. Renders the same way on the public
// page (no app chrome) and the internal consultant view — drives all
// edits through PATCH /api/reviews/[slug]/items/[id] with optimistic
// UI + debounced save for text fields, immediate save for pickers.

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  Inbox,
  MessageSquare,
  MessageSquarePlus,
  RefreshCw,
} from "lucide-react";
import {
  CATEGORY_PILL,
  REVIEW_CATEGORIES,
  REVIEW_STATUSES,
  STATUS_PILL,
  isArchivable,
  unresolvedCount,
  type ReviewCategory,
  type ReviewItem,
  type ReviewStatus,
} from "@/lib/review-store";
import { CommentsThread } from "@/components/comments-thread";
import type { PublicLang } from "@/lib/public-i18n";

const TEXT_DEBOUNCE_MS = 600;
const AUTO_POLL_MS = 12000;

type Tab = "pending" | "archive";

export function ReviewTable({
  clientSlug,
  initialItems,
  /** When true (internal page), enables the delete button per row.
   *  The public page hides delete to prevent accidental client wipes. */
  allowDelete = false,
  /** When true (public/client side), hide the Publishing date column.
   *  Clients don't need to set publishing dates — that's internal. */
  hidePublishingDate = false,
  /** When true (public/client side), the Approval date column renders
   *  as static text rather than a date input. The date auto-fills
   *  server-side when the client flips status to Approved, so clients
   *  never need to set it manually. */
  readonlyApprovalDate = false,
  /** When true, renders the Pending / Archive tab switcher above the
   *  table. Both the internal consultant view AND the public client
   *  view set this to true so clients can scroll through past
   *  decisions, but the actions that MOVE rows between tabs stay
   *  consultant-only via `allowArchiveActions`. */
  allowArchive = false,
  /** When true, renders the per-row Archive / Restore buttons (the
   *  things that actually flip a row's `archived` field). Defaults
   *  to `false` so the public client view never sees the controls. */
  allowArchiveActions = false,
  /** Which side is using the table. Drives the default author on
   *  comment posts + whether the role switcher is shown. The internal
   *  consultant page passes "consultant"; the public/client surface
   *  passes "client". */
  commentAuthorRole = "client",
  /** Internal review page passes the resolved consultant's display
   *  name so their comments auto-attribute. */
  commentAuthorName = null,
  /** UI language for the comment thread strings (en/pt). The internal
   *  page leaves this default ("en"); the public page passes the
   *  result of pickLang(slug). */
  commentLang = "en",
  /** Color treatment for the Pending / Archive tab switcher. The
   *  internal review page sits on the dark workspace shell where
   *  `dark` (white-on-translucent) reads well; the public client
   *  page sits on a pure-white background where the dark styling is
   *  effectively invisible — pass `light` there for a brand-tinted
   *  pill that actually pops. */
  tabsTheme = "dark",
}: {
  clientSlug: string;
  initialItems: ReviewItem[];
  allowDelete?: boolean;
  hidePublishingDate?: boolean;
  readonlyApprovalDate?: boolean;
  allowArchive?: boolean;
  allowArchiveActions?: boolean;
  commentAuthorRole?: "client" | "consultant";
  commentAuthorName?: string | null;
  commentLang?: PublicLang;
  tabsTheme?: "dark" | "light";
}) {
  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(Date.now());
  const [tab, setTab] = useState<Tab>("pending");
  /** Which row's comments drawer is currently expanded. Only one at a
   *  time — clicking another row collapses the previous one. Drives a
   *  full-width sub-row under the active row that renders the
   *  <CommentsThread> against that item's id. */
  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null);
  /** Transient toast shown when the consultant tries to archive a
   *  row that isn't Approved/Rejected. Auto-clears after 4s. */
  const [archiveError, setArchiveError] = useState<string | null>(null);
  // Per-item per-field debounce timers for text edits. Picker / date /
  // pill changes save immediately (no debounce).
  const textTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Track items the user is actively editing so the auto-poll doesn't
  // clobber their in-flight typing. Cleared on debounced-save flush.
  const dirtyIds = useRef<Set<string>>(new Set());

  const markSaving = useCallback((id: string, on: boolean) => {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const persist = useCallback(
    async (id: string, patch: Partial<ReviewItem>) => {
      markSaving(id, true);
      try {
        const res = await fetch(
          `/api/reviews/${clientSlug}/items/${id}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        if (!res.ok) {
          console.warn("[review-table] save failed:", res.status);
        }
      } catch (err) {
        console.warn("[review-table] save threw:", err);
      } finally {
        markSaving(id, false);
      }
    },
    [clientSlug, markSaving],
  );

  /** Update local state immediately + persist. For text fields, use
   *  the debounced variant so we don't fire on every keystroke. */
  const updateLocal = useCallback(
    (id: string, patch: Partial<ReviewItem>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      );
    },
    [],
  );

  const updateAndSave = useCallback(
    (id: string, patch: Partial<ReviewItem>) => {
      updateLocal(id, patch);
      void persist(id, patch);
    },
    [updateLocal, persist],
  );

  const updateAndSaveDebounced = useCallback(
    (id: string, field: keyof ReviewItem, value: string) => {
      updateLocal(id, { [field]: value } as Partial<ReviewItem>);
      dirtyIds.current.add(id);
      const key = `${id}:${field}`;
      const existing = textTimers.current.get(key);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        void persist(id, { [field]: value } as Partial<ReviewItem>).then(() => {
          dirtyIds.current.delete(id);
        });
        textTimers.current.delete(key);
      }, TEXT_DEBOUNCE_MS);
      textTimers.current.set(key, t);
    },
    [updateLocal, persist],
  );

  // Flush any pending debounced saves when unmounting (e.g. tab close)
  useEffect(() => {
    const timers = textTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  /** Pull the latest list from the server and merge in any remote
   *  changes the user doesn't have a dirty (in-flight) edit on. Used
   *  by the manual Refresh button + the auto-poll. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ _: String(Date.now()) });
      if (allowArchive) params.set("includeArchived", "1");
      const res = await fetch(
        `/api/reviews/${clientSlug}?${params.toString()}`,
        {
          cache: "no-store",
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { items: ReviewItem[] };
      setItems((prev) => {
        const byIdServer = new Map(data.items.map((i) => [i.id, i]));
        const merged: ReviewItem[] = [];
        // Preserve order from the server (insertion order, newest at the
        // bottom) but if the local copy of a row is dirty, keep the local
        // one to avoid wiping the user's in-flight edits.
        for (const serverItem of data.items) {
          const localItem = prev.find((p) => p.id === serverItem.id);
          if (localItem && dirtyIds.current.has(serverItem.id)) {
            merged.push(localItem);
          } else {
            merged.push(serverItem);
          }
        }
        // Any local item not on the server is a freshly-added row the
        // server doesn't know about yet (race) — keep it at the bottom,
        // matching the append-at-end ordering.
        for (const p of prev) {
          if (!byIdServer.has(p.id)) merged.push(p);
        }
        return merged;
      });
      setLastSyncedAt(Date.now());
    } finally {
      setRefreshing(false);
    }
  }, [clientSlug, allowArchive]);

  // Auto-poll while the tab is visible. Pauses on hidden tabs so we
  // don't burn KV requests for backgrounded windows. Re-fires
  // immediately on visibility-regain to catch updates the OTHER side
  // (client vs consultant) made while we were away.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (timer) return;
      timer = setInterval(() => {
        void refresh();
      }, AUTO_POLL_MS);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        void refresh();
        start();
      }
    }
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const deleteItem = useCallback(
    async (id: string) => {
      if (!confirm("Delete this row? This can't be undone.")) return;
      setItems((prev) => prev.filter((it) => it.id !== id));
      try {
        await fetch(`/api/reviews/${clientSlug}/items/${id}`, {
          method: "DELETE",
        });
      } catch {
        /* worst case the row reappears on refresh */
      }
    },
    [clientSlug],
  );

  /** Move a row to (or back from) the Archive tab. Guarded: archiving
   *  is only permitted when the row's status is Approved or Rejected.
   *  The button only renders when the guard passes, but we keep the
   *  check here too for safety. */
  const archiveItem = useCallback(
    (it: ReviewItem) => {
      if (!isArchivable(it.status)) {
        setArchiveError(
          `Can't archive "${it.task.slice(0, 60) || "this row"}" — status must be Approved or Rejected first.`,
        );
        setTimeout(() => setArchiveError(null), 4500);
        return;
      }
      updateAndSave(it.id, { archived: true });
    },
    [updateAndSave],
  );
  const unarchiveItem = useCallback(
    (id: string) => {
      updateAndSave(id, { archived: false });
    },
    [updateAndSave],
  );

  // Split + count for the tab pills.
  const pendingCount = useMemo(
    () => items.filter((it) => !it.archived).length,
    [items],
  );
  const archivedCount = useMemo(
    () => items.filter((it) => it.archived).length,
    [items],
  );

  /** Items to render in the body — filtered by the active tab when
   *  archive support is enabled. The public view (allowArchive=false)
   *  receives a list already filtered server-side. */
  const visibleItems = useMemo(() => {
    if (!allowArchive) return items;
    return tab === "pending"
      ? items.filter((it) => !it.archived)
      : items
          .filter((it) => it.archived)
          // Newest-archived first inside the Archive tab.
          .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
  }, [items, allowArchive, tab]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-10 text-center text-sm text-black/55">
        <p className="font-medium text-black/85">Nothing pending yet</p>
        <p className="mt-1.5 text-xs text-black/45">
          The team will send work here when there&apos;s something for you
          to review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allowArchive && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Review tabs"
            className={
              tabsTheme === "light"
                ? // Brand-tinted pill against a white page background.
                  // The subtle violet→fuchsia wash + visible border give
                  // the toggle weight without competing with the table.
                  "inline-flex items-center gap-1 rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50/70 p-1 shadow-sm ring-1 ring-violet-100/60"
                : "inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] p-1"
            }
          >
            <TabButton
              active={tab === "pending"}
              onClick={() => setTab("pending")}
              Icon={Inbox}
              label="Pending"
              count={pendingCount}
              theme={tabsTheme}
            />
            <TabButton
              active={tab === "archive"}
              onClick={() => setTab("archive")}
              Icon={Archive}
              label="Archive"
              count={archivedCount}
              theme={tabsTheme}
            />
          </div>
          {archiveError && (
            <div
              role="alert"
              className="animate-fade-up inline-flex max-w-md items-start gap-2 rounded-md border border-rose-400/50 bg-rose-500/15 px-3 py-2 text-[12px] font-medium text-rose-100"
            >
              <Archive className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{archiveError}</span>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-sm">
        {allowArchive && visibleItems.length === 0 ? (
          <div className="bg-white px-6 py-10 text-center text-sm text-black/55">
            <p className="font-medium text-black/85">
              {tab === "pending"
                ? "Nothing pending"
                : "Nothing archived yet"}
            </p>
            <p className="mt-1.5 text-xs text-black/45">
              {tab === "pending"
                ? "Every row in flight has been moved to the Archive tab."
                : "Approved or Rejected rows you archive will land here."}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-[#4a5d3a] text-white">
                <tr>
                  <Th className={hidePublishingDate ? "w-[30%]" : "w-[28%]"}>
                    Task
                  </Th>
                  <Th className="w-[13%]">Status</Th>
                  <Th className="w-[11%]">Category</Th>
                  <Th className="w-[10%]">Approval date</Th>
                  {!hidePublishingDate && (
                    <Th className="w-[10%]">Publishing date</Th>
                  )}
                  <Th className={hidePublishingDate ? "w-[20%]" : "w-[14%]"}>
                    Doc link
                  </Th>
                  <Th className="w-[6%] text-center">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Comments
                    </span>
                  </Th>
                  {allowArchiveActions && (
                    <Th className="w-[6%] text-right">Archive</Th>
                  )}
                  {allowDelete && <Th className="w-[4%] text-right">·</Th>}
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((it) => {
                  const archivable = isArchivable(it.status);
                  const isCommentsOpen = openCommentsFor === it.id;
                  const totalComments = it.comments?.length ?? 0;
                  const openCount = unresolvedCount(it);
                  // Total column count for the full-width expanded
                  // comments row — has to track every <Th> + <Td>
                  // above so the subrow spans the whole table.
                  const cols =
                    6 /* task,status,category,approval,doc,comments */ +
                    (hidePublishingDate ? 0 : 1) +
                    (allowArchiveActions ? 1 : 0) +
                    (allowDelete ? 1 : 0);
                  return (
                  <Fragment key={it.id}>
                    <tr
                      className={`border-b border-black/8 align-top hover:bg-black/[0.015] ${
                        it.archived ? "bg-black/[0.025]" : ""
                      } ${isCommentsOpen ? "border-b-0" : ""}`}
                    >
                      <Td>
                        <input
                          type="text"
                          value={it.task}
                          onChange={(e) =>
                            updateAndSaveDebounced(
                              it.id,
                              "task",
                              e.target.value,
                            )
                          }
                          placeholder="Task name"
                          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-black/85 outline-none transition focus:border-black/15 focus:bg-white"
                        />
                      </Td>
                      <Td>
                        <StatusPicker
                          value={it.status}
                          onChange={(s) => updateAndSave(it.id, { status: s })}
                        />
                      </Td>
                      <Td>
                        <CategoryPicker
                          value={it.category}
                          onChange={(c) =>
                            updateAndSave(it.id, { category: c })
                          }
                        />
                      </Td>
                      <Td>
                        {readonlyApprovalDate ? (
                          <span className="text-xs text-black/65">
                            {it.approvalDate
                              ? formatApprovalDate(it.approvalDate)
                              : it.status === "Approved"
                                ? "— pending sync —"
                                : "—"}
                          </span>
                        ) : (
                          <input
                            type="date"
                            value={it.approvalDate ?? ""}
                            onChange={(e) =>
                              updateAndSave(it.id, {
                                approvalDate: e.target.value || null,
                              })
                            }
                            className="w-full rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-black/75 outline-none focus:border-black/30"
                          />
                        )}
                      </Td>
                      {!hidePublishingDate && (
                        <Td>
                          <input
                            type="date"
                            value={it.publishingDate ?? ""}
                            onChange={(e) =>
                              updateAndSave(it.id, {
                                publishingDate: e.target.value || null,
                              })
                            }
                            className="w-full rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-black/75 outline-none focus:border-black/30"
                          />
                        </Td>
                      )}
                      <Td>
                        <DocLinkCell
                          value={it.docLink}
                          onChange={(v) =>
                            updateAndSaveDebounced(it.id, "docLink", v)
                          }
                        />
                      </Td>
                      <Td className="text-center">
                        <CommentsToggle
                          open={isCommentsOpen}
                          openCount={openCount}
                          totalCount={totalComments}
                          onClick={() =>
                            setOpenCommentsFor((prev) =>
                              prev === it.id ? null : it.id,
                            )
                          }
                        />
                      </Td>
                      {allowArchiveActions && (
                        <Td className="text-right">
                          {it.archived ? (
                            <button
                              type="button"
                              onClick={() => unarchiveItem(it.id)}
                              title="Move back to Pending"
                              className="inline-flex items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-black/65 transition hover:border-black/25 hover:bg-black/[0.04] hover:text-black/85"
                            >
                              <ArchiveRestore className="h-3 w-3" />
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => archiveItem(it)}
                              disabled={!archivable}
                              title={
                                archivable
                                  ? "Move this row to the Archive tab"
                                  : "Available once status is Approved or Rejected"
                              }
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                                archivable
                                  ? "border-emerald-300/60 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100"
                                  : "cursor-not-allowed border-black/10 bg-black/[0.03] text-black/30"
                              }`}
                            >
                              <Archive className="h-3 w-3" />
                              Archive
                            </button>
                          )}
                        </Td>
                      )}
                      {allowDelete && (
                        <Td className="text-right">
                          <button
                            type="button"
                            onClick={() => deleteItem(it.id)}
                            title="Delete row"
                            className="rounded-md p-1.5 text-black/35 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            ×
                          </button>
                        </Td>
                      )}
                    </tr>
                    {isCommentsOpen && (
                      <tr
                        className={`border-b border-black/8 last:border-0 ${
                          it.archived ? "bg-black/[0.025]" : "bg-black/[0.015]"
                        }`}
                      >
                        <td colSpan={cols} className="px-3 pb-3 pt-1">
                          <CommentsThread
                            clientSlug={clientSlug}
                            itemId={it.id}
                            initialComments={it.comments ?? []}
                            defaultAuthor={commentAuthorRole}
                            defaultAuthorName={commentAuthorName}
                            // Always show the Client / Wonder Ads toggle so
                            // a consultant can mark a comment as the
                            // client's when relaying their feedback. Don't
                            // remember the choice in localStorage on the
                            // internal table — it should always start on
                            // Wonder Ads (the consultant), never inherit a
                            // public visitor's stored side.
                            allowRoleSwitch
                            rememberRole={false}
                            lang={commentLang}
                            variant="inline"
                            onClose={() => setOpenCommentsFor(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
            {/* Footer: saving indicator + last-synced + refresh.
                Auto-poll runs every 12s while the tab is visible so
                changes made by the OTHER side (client vs consultant)
                propagate without anyone having to click anything —
                but the manual Refresh is there for impatient moments. */}
            <div className="flex items-center justify-between gap-3 border-t border-black/8 bg-black/[0.02] px-3 py-2 text-[11px] text-black/45">
              <span>
                {savingIds.size > 0 ? (
                  <>
                    <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    Saving {savingIds.size} change
                    {savingIds.size === 1 ? "" : "s"}…
                  </>
                ) : allowArchive ? (
                  <>
                    All changes saved · {visibleItems.length}{" "}
                    {tab === "pending" ? "pending" : "archived"} item
                    {visibleItems.length === 1 ? "" : "s"} ·{" "}
                    {items.length} total
                  </>
                ) : (
                  <>
                    All changes saved · {items.length} item
                    {items.length === 1 ? "" : "s"}
                  </>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span
                  title={`Last synced at ${new Date(lastSyncedAt).toLocaleTimeString()}`}
                >
                  Last synced {formatRelativeTime(lastSyncedAt)}
                </span>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={refreshing}
                  title="Pull the latest from the server now"
                  className="inline-flex items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] font-medium text-black/65 transition hover:border-black/25 hover:text-black/85 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  Icon,
  label,
  count,
  theme,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Inbox;
  label: string;
  count: number;
  theme: "dark" | "light";
}) {
  // Active state is identical on both themes — brand-gradient pill with
  // white text reads cleanly against either background. Only the
  // INACTIVE state has to flip: white-on-translucent for the dark
  // internal shell vs. dark-violet-on-white for the public client page,
  // where the previous dark-theme styling rendered as invisible
  // white-on-white.
  const inactiveBtn =
    theme === "light"
      ? "text-violet-900/70 hover:bg-white hover:text-violet-900 hover:shadow-sm"
      : "text-white/65 hover:bg-white/[0.06] hover:text-white";
  const inactiveCount =
    theme === "light"
      ? "bg-violet-100 text-violet-800"
      : "bg-white/10 text-white/70";
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
        active
          ? "brand-gradient-bg text-white shadow-[0_6px_18px_-6px_rgba(120,61,245,0.55)]"
          : inactiveBtn
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span
        className={`ml-0.5 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums ${
          active ? "bg-white/25 text-white" : inactiveCount
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/** Format an ISO date (YYYY-MM-DD) as DD/MM/YYYY for the readonly
 *  approval-date cell on the public side. */
function formatApprovalDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Short relative time for the "last synced" indicator. */
function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 ${className ?? ""}`}>{children}</td>;
}

function StatusPicker({
  value,
  onChange,
}: {
  value: ReviewStatus;
  onChange: (s: ReviewStatus) => void;
}) {
  const meta = STATUS_PILL[value];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ReviewStatus)}
        className="appearance-none rounded-full border px-3 py-1 pr-7 text-xs font-medium outline-none focus:ring-2 focus:ring-black/15"
        style={{
          backgroundColor: meta.bg,
          color: meta.text,
          borderColor: meta.border,
        }}
      >
        {REVIEW_STATUSES.map((s) => (
          <option key={s} value={s} className="bg-white text-black">
            {STATUS_PILL[s].label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs"
        style={{ color: meta.text }}
      >
        ▾
      </span>
    </div>
  );
}

function CategoryPicker({
  value,
  onChange,
}: {
  value: ReviewCategory;
  onChange: (c: ReviewCategory) => void;
}) {
  const meta = CATEGORY_PILL[value];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ReviewCategory)}
        className="appearance-none rounded-full border px-3 py-1 pr-7 text-xs font-medium outline-none focus:ring-2 focus:ring-black/15"
        style={{
          backgroundColor: meta.bg,
          color: meta.text,
          borderColor: meta.border,
        }}
      >
        {REVIEW_CATEGORIES.map((c) => (
          <option key={c} value={c} className="bg-white text-black">
            {c}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs"
        style={{ color: meta.text }}
      >
        ▾
      </span>
    </div>
  );
}

function CommentsToggle({
  open,
  openCount,
  totalCount,
  onClick,
}: {
  open: boolean;
  /** Unresolved comments — drives the loud red dot. */
  openCount: number;
  /** Total comments (including resolved) — shown as the body number. */
  totalCount: number;
  onClick: () => void;
}) {
  const hasUnresolved = openCount > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        totalCount === 0
          ? "Add the first comment"
          : open
            ? "Hide comments"
            : `Show ${totalCount} comment${totalCount === 1 ? "" : "s"}`
      }
      aria-expanded={open}
      className={`relative inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition ${
        open
          ? "border-violet-400/60 bg-violet-50 text-violet-700"
          : hasUnresolved
            ? "border-rose-300/60 bg-rose-50 text-rose-700 hover:border-rose-400 hover:bg-rose-100"
            : totalCount > 0
              ? "border-black/15 bg-white text-black/65 hover:border-black/25 hover:bg-black/[0.04]"
              : "border-dashed border-black/15 bg-white text-black/45 hover:border-black/30 hover:text-black/75"
      }`}
    >
      {totalCount === 0 ? (
        <MessageSquarePlus className="h-3 w-3" />
      ) : (
        <MessageSquare className="h-3 w-3" />
      )}
      {totalCount > 0 ? totalCount : "Add"}
      {hasUnresolved && !open && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 inline-flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"
        />
      )}
    </button>
  );
}

function DocLinkCell({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="url"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        placeholder="https://…"
        className="w-full rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-black/75 outline-none focus:border-black/30"
      />
      {value && /^https?:\/\//i.test(value) && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          title="Open document in new tab"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:brightness-110"
          style={{
            background:
              "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open
        </a>
      )}
    </div>
  );
}
