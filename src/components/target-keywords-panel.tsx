"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Target,
  Loader2,
  Trash2,
  Download,
  RefreshCw,
  Plus,
} from "lucide-react";
import Link from "next/link";
import type { TargetKeyword } from "@/lib/target-keywords-store";
import { formatDateLong } from "@/lib/dates";
import { SendToReviewButton } from "./send-to-review-button";
import { useSeoReadOnly } from "./seo-readonly";

type SortKey = "addedAt" | "keyword" | "volume" | "kd";
type SortDir = "asc" | "desc";

const INTENT_STYLE: Record<string, string> = {
  informational: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  commercial: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  transactional: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  navigational: "border-violet-400/30 bg-violet-500/10 text-violet-200",
};

export function TargetKeywordsPanel({
  slug,
  clientName,
}: {
  slug: string;
  clientName: string;
}) {
  const readOnly = useSeoReadOnly();
  const [items, setItems] = useState<TargetKeyword[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("addedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/target-keywords/${slug}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as TargetKeyword[];
        setItems(data);
      }
    } catch {
      /* network blip — fine */
    } finally {
      setLoaded(true);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(keyword: string) {
    if (
      !window.confirm(
        `Remove "${keyword}" from the target keyword list?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/target-keywords/${slug}?keyword=${encodeURIComponent(keyword)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setItems((cur) => cur.filter((k) => k.keyword !== keyword.toLowerCase()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    const raw = draft.trim();
    if (!raw) return;
    const parts = raw
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/target-keywords/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keywords: parts.map((keyword) => ({
            keyword,
            addedAt: Date.now(),
            source: "manual",
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setDraft("");
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (items.length === 0) return;
    const header = [
      "keyword",
      "search_volume",
      "keyword_difficulty",
      "intent",
      "source",
      "added_at",
    ].join(",");
    const lines = [header];
    for (const k of items) {
      lines.push(
        [
          csvEscape(k.keyword),
          k.searchVolume ?? "",
          k.difficulty ?? "",
          k.intent ?? "",
          k.source,
          new Date(k.addedAt).toISOString(),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Target Keywords - ${clientName} - Wonder Ads.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const sorted = [...items].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "keyword":
        return a.keyword.localeCompare(b.keyword) * mul;
      case "volume":
        return ((a.searchVolume ?? 0) - (b.searchVolume ?? 0)) * mul;
      case "kd":
        return (
          ((a.difficulty ?? Number.MAX_SAFE_INTEGER) -
            (b.difficulty ?? Number.MAX_SAFE_INTEGER)) *
          mul
        );
      case "addedAt":
      default:
        return (a.addedAt - b.addedAt) * mul;
    }
  });

  return (
    <section
      aria-label={`Target keywords for ${clientName}`}
      id="section-target-keywords"
      className="brand-gradient-border rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md"
    >
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Target className="h-4 w-4 text-white/55" strokeWidth={2.25} />
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
          Target Keywords
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/55">
          {items.length} queued
        </span>
        {busy && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45">
            <Loader2 className="h-3 w-3 animate-spin" />
            Working…
          </span>
        )}
        {error && (
          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
            {error}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-medium text-white/65 transition hover:border-white/35 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            title="Refresh from KV"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-medium text-white/65 transition hover:border-white/35 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
          {!readOnly && items.length > 0 && (
            <SendToReviewButton
              variant="compact"
              clientSlug={slug}
              task={`Target Keywords (${items.length}) · ${clientName}`}
              category="Keyword Research"
              docLink={`/${slug}/preview/target-keywords`}
              sourceType="target-keywords"
            />
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)] transition hover:opacity-90"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          )}
        </div>
      </header>

      {adding && (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <label className="block text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/60">
            New target keywords
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="One per line, or comma-separated. e.g. 'dentista lisboa, all-on-4 lisboa, clínica dentária'"
            className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft("");
                setAdding(false);
              }}
              className="rounded-md border border-white/12 px-3 py-1.5 text-[11px] text-white/60 transition hover:border-white/30 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addManual}
              disabled={busy || !draft.trim()}
              className="brand-gradient-bg rounded-md px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {!loaded ? (
        <p className="py-8 text-center text-sm text-white/35">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState slug={slug} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/8">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-white/[0.025]">
              <tr className="border-b border-white/10">
                <SortHeader
                  label="Keyword"
                  k="keyword"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={(k, d) => {
                    setSortKey(k);
                    setSortDir(d);
                  }}
                />
                <SortHeader
                  label="Vol/mo"
                  k="volume"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={(k, d) => {
                    setSortKey(k);
                    setSortDir(d);
                  }}
                />
                <SortHeader
                  label="KD"
                  k="kd"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={(k, d) => {
                    setSortKey(k);
                    setSortDir(d);
                  }}
                />
                <th className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/55">
                  Intent
                </th>
                <SortHeader
                  label="Added"
                  k="addedAt"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={(k, d) => {
                    setSortKey(k);
                    setSortDir(d);
                  }}
                />
                <th className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/55">
                  Source
                </th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((k) => (
                <tr
                  key={k.keyword}
                  className="border-b border-white/5 transition hover:bg-white/[0.025]"
                >
                  <td className="px-3 py-2 text-white">{k.keyword}</td>
                  <td className="px-3 py-2 text-right text-white/80">
                    {fmtNum(k.searchVolume)}
                  </td>
                  <td className="px-3 py-2 text-right text-white/80">
                    {k.difficulty ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {k.intent ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${INTENT_STYLE[k.intent] ?? "border-white/15 bg-white/[0.04] text-white/65"}`}
                      >
                        {k.intent}
                      </span>
                    ) : (
                      <span className="text-[11px] text-white/35">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-white/60">
                    {formatDateLong(new Date(k.addedAt))}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-white/55">
                    {k.source === "keyword-research" && k.resultId ? (
                      <Link
                        href={`/seo/${slug}/actions/keyword-research/results/${k.resultId}`}
                        className="text-[#c9a8ff] underline-offset-2 hover:underline"
                      >
                        kw-research
                      </Link>
                    ) : (
                      k.source
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => remove(k.keyword)}
                        aria-label={`Remove ${k.keyword}`}
                        className="rounded-md p-1 text-white/40 transition hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EmptyState({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-8 text-center">
      <Target className="h-7 w-7 text-white/35" strokeWidth={1.5} />
      <p className="max-w-md text-sm text-white/55">
        No target keywords yet. Run a{" "}
        <Link
          href={`/seo/${slug}/actions/keyword-research`}
          className="text-[#c9a8ff] underline-offset-2 hover:underline"
        >
          Keyword Research
        </Link>{" "}
        and use <strong>Send to Tracked</strong> on the dashboard, or add
        keywords manually with the <strong>Add</strong> button above.
      </p>
    </div>
  );
}

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  align,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey, dir: SortDir) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th
      className={`px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => {
          if (active) onSort(k, sortDir === "asc" ? "desc" : "asc");
          else onSort(k, k === "keyword" ? "asc" : "desc");
        }}
        className={`inline-flex items-center gap-1 transition ${active ? "text-white" : "text-white/55 hover:text-white/85"}`}
      >
        {label}
        {active && (sortDir === "asc" ? "↑" : "↓")}
      </button>
    </th>
  );
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v < 1000) return v.toString();
  if (v < 1_000_000) return `${(v / 1000).toFixed(1)}k`;
  return `${(v / 1_000_000).toFixed(2)}M`;
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
