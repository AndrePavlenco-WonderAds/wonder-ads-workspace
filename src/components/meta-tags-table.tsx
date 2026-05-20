"use client";

// Editable Meta Tags table. Used on the internal result page (full
// edit) and re-used by the public preview in read-only mode.
//
// Per-cell side-by-side layout: URL anchor row up top, then 2-column
// grid with "Current" on the left and "Optimised" on the right for
// both title and meta. Char-count indicator beneath each editable
// field (Google's 50–60 / 140–160 sweet-spot in green, outside in
// amber/red).

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import {
  META_IDEAL_MAX,
  META_IDEAL_MIN,
  TITLE_IDEAL_MAX,
  TITLE_IDEAL_MIN,
  type MetaTagsRow,
} from "@/lib/meta-tags-store";

type Props = {
  clientSlug: string;
  resultId: string;
  initialRows: MetaTagsRow[];
  /** True when rendered from the public preview — disables editing,
   *  hides per-row Send-for-Approval, hides reasoning + issues. */
  readonly?: boolean;
};

export function MetaTagsTable({
  clientSlug,
  resultId,
  initialRows,
  readonly = false,
}: Props) {
  const [rows, setRows] = useState<MetaTagsRow[]>(initialRows);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  const markSaving = useCallback((id: string, on: boolean) => {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const persist = useCallback(
    async (rowId: string, patch: Partial<MetaTagsRow>) => {
      if (readonly) return;
      markSaving(rowId, true);
      try {
        await fetch(
          `/api/seo-actions/${clientSlug}/meta-title-description/meta-update`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ resultId, rowId, patch }),
          },
        );
      } catch (err) {
        console.warn("[meta-tags-table] save failed:", err);
      } finally {
        markSaving(rowId, false);
      }
    },
    [clientSlug, resultId, readonly, markSaving],
  );

  const editLocal = useCallback(
    (rowId: string, patch: Partial<MetaTagsRow>) => {
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const editDebounced = useCallback(
    (rowId: string, field: "optimizedTitle" | "optimizedMeta", value: string) => {
      const lengthField =
        field === "optimizedTitle" ? "optimizedTitleLength" : "optimizedMetaLength";
      editLocal(rowId, {
        [field]: value,
        [lengthField]: value.length,
      } as Partial<MetaTagsRow>);
      const key = `${rowId}:${field}`;
      const existing = saveTimers.current.get(key);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        void persist(rowId, {
          [field]: value,
          [lengthField]: value.length,
        } as Partial<MetaTagsRow>);
        saveTimers.current.delete(key);
      }, 700);
      saveTimers.current.set(key, t);
    },
    [editLocal, persist],
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-10 text-center text-sm text-white/45">
        No URLs in this result.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <article
          key={row.id}
          className={
            readonly
              ? "overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
              : "brand-gradient-border overflow-hidden rounded-2xl bg-white/[0.03] backdrop-blur-md"
          }
        >
          {/* Row header: URL + saving + per-row Send-for-Approval */}
          <header
            className={
              readonly
                ? "flex flex-wrap items-center justify-between gap-2 border-b border-black/8 bg-black/[0.02] px-4 py-2.5"
                : "flex flex-wrap items-center justify-between gap-2 border-b border-white/8 bg-white/[0.02] px-4 py-2.5"
            }
          >
            <div className="flex min-w-0 items-center gap-2">
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  readonly
                    ? "inline-flex max-w-[600px] items-center gap-1.5 truncate text-xs font-medium text-black/85 hover:underline"
                    : "inline-flex max-w-[600px] items-center gap-1.5 truncate text-xs font-medium text-white/85 hover:text-white"
                }
              >
                <span className="truncate">{row.url}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
              </a>
              {row.primaryKeyword && (
                <span
                  className={
                    readonly
                      ? "inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-900"
                      : "inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-purple)]/35 bg-[color:var(--brand-purple)]/15 px-2 py-0.5 text-[10px] font-medium text-white/85"
                  }
                  title="Primary target keyword Claude assigned to this URL"
                >
                  🎯 {row.primaryKeyword}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {savingIds.has(row.id) && (
                <span
                  className={
                    readonly ? "text-[10px] text-black/45" : "text-[10px] text-white/45"
                  }
                >
                  <Loader2 className="mr-1 inline h-2.5 w-2.5 animate-spin" />
                  saving…
                </span>
              )}
              {/* Per-row Approval button removed in v73.1 — clients
                  review the entire batch together via the prominent
                  "Send for Approval" button at the top of the page. */}
            </div>
          </header>

          {/* Body */}
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            {/* Title pair */}
            <CellPair
              readonly={readonly}
              label="Title"
              current={row.currentTitle}
              currentLength={row.currentTitleLength}
              optimized={row.optimizedTitle}
              onOptimizedChange={(v) =>
                editDebounced(row.id, "optimizedTitle", v)
              }
              idealMin={TITLE_IDEAL_MIN}
              idealMax={TITLE_IDEAL_MAX}
              charsHardMax={75}
            />
            {/* Meta pair */}
            <CellPair
              readonly={readonly}
              label="Meta description"
              current={row.currentMeta}
              currentLength={row.currentMetaLength}
              optimized={row.optimizedMeta}
              onOptimizedChange={(v) =>
                editDebounced(row.id, "optimizedMeta", v)
              }
              idealMin={META_IDEAL_MIN}
              idealMax={META_IDEAL_MAX}
              charsHardMax={180}
              multiline
            />
          </div>

          {/* Reasoning + issues — staff side only */}
          {!readonly && (row.reasoning || row.issues.length > 0) && (
            <div className="border-t border-white/8 bg-white/[0.02] px-4 py-3 space-y-2">
              {row.reasoning && (
                <p className="flex items-start gap-2 text-[11px] italic text-white/55">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--brand-purple)]" />
                  <span>{row.reasoning}</span>
                </p>
              )}
              {row.issues.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {row.issues.map((issue) => (
                    <span
                      key={issue}
                      className="inline-flex items-center rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200"
                    >
                      ⚠️ {issue}
                    </span>
                  ))}
                  {row.secondaryKeywords.length > 0 &&
                    row.secondaryKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/55"
                      >
                        + {kw}
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function CellPair({
  readonly,
  label,
  current,
  currentLength,
  optimized,
  onOptimizedChange,
  idealMin,
  idealMax,
  charsHardMax,
  multiline = false,
}: {
  readonly: boolean;
  label: string;
  current: string | null;
  currentLength: number;
  optimized: string;
  onOptimizedChange: (v: string) => void;
  idealMin: number;
  idealMax: number;
  charsHardMax: number;
  multiline?: boolean;
}) {
  return (
    <>
      <div>
        <label
          className={
            readonly
              ? "text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45"
              : "text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45"
          }
        >
          Current {label}
        </label>
        <div
          className={
            readonly
              ? "mt-1 rounded-lg border border-black/8 bg-black/[0.03] px-3 py-2 text-xs leading-relaxed text-black/65"
              : "mt-1 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-white/55"
          }
        >
          {current ? (
            current
          ) : (
            <span
              className={
                readonly ? "italic text-black/35" : "italic text-white/30"
              }
            >
              (missing)
            </span>
          )}
        </div>
        <div className="mt-1 flex justify-end">
          <CharCount
            readonly={readonly}
            len={currentLength}
            min={idealMin}
            max={idealMax}
          />
        </div>
      </div>
      <div>
        <label
          className={
            readonly
              ? "text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700"
              : "text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300"
          }
        >
          Optimised {label}
        </label>
        {readonly ? (
          <div className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
            {optimized}
          </div>
        ) : multiline ? (
          <textarea
            value={optimized}
            onChange={(e) => onOptimizedChange(e.currentTarget.value)}
            maxLength={charsHardMax}
            rows={3}
            className="mt-1 w-full resize-y rounded-lg border border-emerald-400/30 bg-emerald-500/[0.06] px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/55"
          />
        ) : (
          <input
            type="text"
            value={optimized}
            onChange={(e) => onOptimizedChange(e.currentTarget.value)}
            maxLength={charsHardMax}
            className="mt-1 w-full rounded-lg border border-emerald-400/30 bg-emerald-500/[0.06] px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/55"
          />
        )}
        <div className="mt-1 flex justify-end">
          <CharCount
            readonly={readonly}
            len={optimized.length}
            min={idealMin}
            max={idealMax}
          />
        </div>
      </div>
    </>
  );
}

function CharCount({
  readonly,
  len,
  min,
  max,
}: {
  readonly: boolean;
  len: number;
  min: number;
  max: number;
}) {
  const status =
    len === 0
      ? "empty"
      : len > max + 5
        ? "over"
        : len < min
          ? "short"
          : "ok";
  const baseDark =
    status === "ok"
      ? "text-emerald-300"
      : status === "short"
        ? "text-amber-300"
        : status === "over"
          ? "text-rose-300"
          : "text-white/35";
  const baseLight =
    status === "ok"
      ? "text-emerald-700"
      : status === "short"
        ? "text-amber-700"
        : status === "over"
          ? "text-rose-700"
          : "text-black/35";
  return (
    <span
      className={`text-[10px] font-mono ${readonly ? baseLight : baseDark}`}
      title={`Sweet spot ${min}–${max} chars`}
    >
      {len} / {max} chars
      {status === "over" && " · too long"}
      {status === "short" && len > 0 && " · short"}
    </span>
  );
}
