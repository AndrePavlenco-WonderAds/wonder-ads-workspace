"use client";

// Editable Pending Review table. Renders the same way on the public
// page (no app chrome) and the internal consultant view — drives all
// edits through PATCH /api/reviews/[slug]/items/[id] with optimistic
// UI + debounced save for text fields, immediate save for pickers.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CATEGORY_PILL,
  REVIEW_CATEGORIES,
  REVIEW_STATUSES,
  STATUS_PILL,
  type ReviewCategory,
  type ReviewItem,
  type ReviewStatus,
} from "@/lib/review-store";

const TEXT_DEBOUNCE_MS = 600;

export function ReviewTable({
  clientSlug,
  initialItems,
  /** When true (internal page), enables the delete button per row.
   *  The public page hides delete to prevent accidental client wipes. */
  allowDelete = false,
}: {
  clientSlug: string;
  initialItems: ReviewItem[];
  allowDelete?: boolean;
}) {
  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  // Per-item per-field debounce timers for text edits. Picker / date /
  // pill changes save immediately (no debounce).
  const textTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
      const key = `${id}:${field}`;
      const existing = textTimers.current.get(key);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        void persist(id, { [field]: value } as Partial<ReviewItem>);
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
    <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[#4a5d3a] text-white">
          <tr>
            <Th className="w-[34%]">Task</Th>
            <Th className="w-[12%]">Status</Th>
            <Th className="w-[12%]">Category</Th>
            <Th className="w-[10%]">Approval date</Th>
            <Th className="w-[10%]">Publishing date</Th>
            <Th className="w-[18%]">Doc link</Th>
            {allowDelete && <Th className="w-[4%] text-right">·</Th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr
              key={it.id}
              className="border-b border-black/8 align-top last:border-0 hover:bg-black/[0.015]"
            >
              <Td>
                <input
                  type="text"
                  value={it.task}
                  onChange={(e) =>
                    updateAndSaveDebounced(it.id, "task", e.target.value)
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
                  onChange={(c) => updateAndSave(it.id, { category: c })}
                />
              </Td>
              <Td>
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
              </Td>
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
              <Td>
                <DocLinkCell
                  value={it.docLink}
                  onChange={(v) =>
                    updateAndSaveDebounced(it.id, "docLink", v)
                  }
                />
              </Td>
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
          ))}
        </tbody>
      </table>
      {/* Subtle saving indicator — visible only when any row is
          currently persisting. Reassurance for the client. */}
      <div className="flex items-center justify-end gap-2 border-t border-black/8 bg-black/[0.02] px-3 py-2 text-[11px] text-black/45">
        {savingIds.size > 0 ? (
          <span>
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            Saving {savingIds.size} change{savingIds.size === 1 ? "" : "s"}…
          </span>
        ) : (
          <span>All changes saved · {items.length} item{items.length === 1 ? "" : "s"}</span>
        )}
      </div>
    </div>
  );
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
    <div className="flex items-center gap-2">
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
          title="Open in new tab"
          className="rounded-md p-1 text-black/45 transition hover:bg-black/[0.05] hover:text-black/75"
        >
          ↗
        </a>
      )}
    </div>
  );
}
