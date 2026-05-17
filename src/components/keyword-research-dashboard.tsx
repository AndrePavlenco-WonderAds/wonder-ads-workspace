"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Filter,
  Loader2,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import type { KwIdea, KwResearchPack } from "@/lib/seo-tools/keyword-research";
import type { KwCluster, KwClusterRow } from "@/lib/kw-cluster-parser";
import type { TargetKeyword } from "@/lib/target-keywords-store";

type SourceTab =
  | "all"
  | "suggestions"
  | "ideas"
  | "domain"
  | "competitors"
  | "clusters";
type IntentFilter =
  | "all"
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational";
type SortKey = "volume" | "keyword" | "kd" | "cpc";
type SortDir = "asc" | "desc";
type GroupBy = "none" | "intent" | "source" | "cluster";

type EnrichedIdea = KwIdea & {
  /** Origin label used when source === "all". */
  origin: "Suggestion" | "Idea" | "Already-ranking" | "AI cluster" | string;
  /** Competitor domain if origin is a competitor. */
  competitorDomain?: string;
  /** Cluster this row belongs to (when source === "clusters"). */
  clusterName?: string;
  /** Priority chip from Claude's cluster table. */
  clusterPriority?: KwClusterRow["priority"];
  clusterPriorityRaw?: string;
  /** Page Claude suggested for this keyword. */
  suggestedPage?: string;
  /** Claude's one-line rationale. */
  why?: string;
};

type SendStatus = "idle" | "sending" | "done" | "error";

export function KeywordResearchDashboard({
  pack,
  clusters = [],
  generating,
  clientSlug,
  resultId,
  initialTargetedKeywords = [],
}: {
  pack: KwResearchPack | null;
  /** Clusters parsed out of Claude's keyword-research analysis. Surfaced
   *  as a first-class data source alongside the raw DataforSEO pack. */
  clusters?: KwCluster[];
  generating: boolean;
  clientSlug: string;
  resultId: string;
  /** Lowercased keywords already in the client's Target Keywords list.
   *  Rows whose `keyword.toLowerCase()` is in this set render with a 🎯
   *  chip + a disabled checkbox so consultants don't re-send keywords
   *  that are already on the tracking list. Grows locally when a send
   *  succeeds (no need to refetch). */
  initialTargetedKeywords?: string[];
}) {
  const [tab, setTab] = useState<SourceTab>("all");
  const [intent, setIntent] = useState<IntentFilter>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [targetedSet, setTargetedSet] = useState<Set<string>>(
    () => new Set(initialTargetedKeywords.map((k) => k.toLowerCase())),
  );

  const enriched = useMemo(() => enrichIdeas(pack, clusters), [pack, clusters]);
  const filtered = useMemo(
    () => filterAndSort(enriched, { tab, intent, query, sortKey, sortDir }),
    [enriched, tab, intent, query, sortKey, sortDir],
  );

  const totals = useMemo(() => {
    const totalVolume = filtered.reduce((s, k) => s + (k.searchVolume ?? 0), 0);
    return { count: filtered.length, totalVolume };
  }, [filtered]);

  if (!pack && clusters.length === 0) {
    return (
      <article className="brand-gradient-border rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
        <header className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-white/55" strokeWidth={2.25} />
          <h2 className="text-sm font-semibold tracking-tight text-white">
            Keyword Research
          </h2>
        </header>
        <p className="mt-4 text-xs text-white/45">
          {generating
            ? "Pulling keyword data from DataforSEO…"
            : "Run a keyword research generation to populate this dashboard."}
        </p>
      </article>
    );
  }

  return (
    <article className="brand-gradient-border overflow-hidden rounded-2xl bg-white/[0.035] backdrop-blur-md">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 border-b border-white/8 px-5 py-4">
        <Sparkles className="h-4 w-4 text-white/55" strokeWidth={2.25} />
        <h2 className="text-sm font-semibold tracking-tight text-white">
          Keyword Universe
        </h2>
        {pack && (
          <span className="text-[11px] text-white/45">
            {pack.geo.countryLabel} · {pack.geo.languageCode}
          </span>
        )}
        <span className="ml-2 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-white/65">
          {totals.count.toLocaleString()} keywords ·{" "}
          {fmtNum(totals.totalVolume)} vol/mo
        </span>
        {targetedSet.size > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200"
            title="Keywords already on this client's Target Keywords list — disabled in the table so you can't re-send them."
          >
            🎯 {targetedSet.size} already targeted
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={selected.size === 0 || sendStatus === "sending"}
            onClick={async () => {
              setSendStatus("sending");
              setSendMessage(null);
              const picked = filtered.filter((k) => selected.has(rowKey(k)));
              const payload: TargetKeyword[] = picked.map((k) => ({
                keyword: k.keyword,
                addedAt: Date.now(),
                source: "keyword-research",
                resultId,
                intent: k.intent ?? null,
                searchVolume: k.searchVolume ?? null,
                difficulty: k.difficulty ?? null,
              }));
              try {
                const res = await fetch(`/api/target-keywords/${clientSlug}`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ keywords: payload }),
                });
                if (!res.ok) {
                  const j = await res.json().catch(() => ({}));
                  throw new Error(j.error ?? `HTTP ${res.status}`);
                }
                const j = (await res.json()) as {
                  added: number;
                  skipped: number;
                };
                setSendStatus("done");
                setSendMessage(
                  j.skipped > 0
                    ? `Added ${j.added}; ${j.skipped} already on the list`
                    : `Added ${j.added} target keyword${j.added === 1 ? "" : "s"}`,
                );
                // Optimistically grow the targeted set so the rows we just
                // sent immediately render with the 🎯 chip + disabled
                // checkbox. No refetch needed.
                setTargetedSet((prev) => {
                  const next = new Set(prev);
                  picked.forEach((k) => next.add(k.keyword.toLowerCase()));
                  return next;
                });
                // Clear selection of the rows we just shipped.
                setSelected((prev) => {
                  const next = new Set(prev);
                  picked.forEach((k) => next.delete(rowKey(k)));
                  return next;
                });
                setTimeout(() => setSendStatus("idle"), 4000);
              } catch (err) {
                setSendStatus("error");
                setSendMessage(
                  err instanceof Error ? err.message : "Send failed",
                );
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-[#783DF5]/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-none disabled:bg-white/[0.04] disabled:text-white/45 disabled:shadow-none"
            title={
              selected.size === 0
                ? "Tick keywords to enable Send"
                : `Push ${selected.size} keyword(s) into the client's Target Keywords list`
            }
          >
            {sendStatus === "sending" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : sendStatus === "done" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Target className="h-3.5 w-3.5" />
            )}
            {sendStatus === "done"
              ? "Sent"
              : `Send to Tracked${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </button>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => exportCsv(filtered, selected)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:border-white/30 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title={
              selected.size === 0
                ? "Tick keywords to enable CSV export"
                : `Export ${selected.size} selected keyword(s) to CSV`
            }
          >
            <Download className="h-3.5 w-3.5" />
            CSV {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
          <button
            type="button"
            onClick={() => exportCsv(filtered, null)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:border-white/30 hover:bg-white/[0.07] hover:text-white"
            title="Export everything currently filtered"
          >
            <Download className="h-3.5 w-3.5" />
            All filtered
          </button>
        </div>
      </header>

      {sendMessage && (
        <div
          className={
            sendStatus === "error"
              ? "border-b border-rose-500/30 bg-rose-500/10 px-5 py-2 text-[11px] text-rose-200"
              : "border-b border-emerald-500/30 bg-emerald-500/10 px-5 py-2 text-[11px] text-emerald-200"
          }
        >
          {sendMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/8 px-5 py-3">
        {(
          [
            { k: "all", label: `All (${enriched.length})` },
            {
              k: "clusters",
              label: `AI Clusters (${clusters.reduce((s, c) => s + c.rows.length, 0)})`,
            },
            {
              k: "suggestions",
              label: `Suggestions (${pack?.suggestions.length ?? 0})`,
            },
            { k: "ideas", label: `Ideas (${pack?.ideas.length ?? 0})` },
            {
              k: "domain",
              label: `Already-ranking (${pack?.domainExisting.length ?? 0})`,
            },
            {
              k: "competitors",
              label: `Competitors (${pack?.competitors.reduce((s, c) => s + c.keywords.length, 0) ?? 0})`,
            },
          ] as { k: SourceTab; label: string }[]
        ).map(({ k, label }) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              tab === k
                ? "rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-[#783DF5]/30"
                : "rounded-md border border-white/8 bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-white/65 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-xs text-white/65">
        <span className="inline-flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-white/45" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords…"
            className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-white/45" />
          <label className="text-white/45">Intent</label>
          <select
            value={intent}
            onChange={(e) => setIntent(e.target.value as IntentFilter)}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white outline-none focus:border-white/30"
          >
            <option value="all">All</option>
            <option value="informational">Informational</option>
            <option value="commercial">Commercial</option>
            <option value="transactional">Transactional</option>
            <option value="navigational">Navigational</option>
          </select>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <label className="text-white/45">Group by</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white outline-none focus:border-white/30"
          >
            <option value="none">None</option>
            <option value="cluster">Cluster</option>
            <option value="intent">Intent</option>
            <option value="source">Source</option>
          </select>
        </span>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setIntent("all");
            setGroupBy("none");
          }}
          className="ml-auto text-[11px] text-white/45 transition hover:text-white"
        >
          Reset filters
        </button>
      </div>

      {/* Table */}
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#0a0a14]/95 backdrop-blur">
            <tr className="border-b border-white/10">
              <Th>
                <input
                  type="checkbox"
                  checked={
                    filtered.length > 0 &&
                    filtered
                      .filter(
                        (k) => !targetedSet.has(k.keyword.toLowerCase()),
                      )
                      .every((k) => selected.has(rowKey(k)))
                  }
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      const selectable = filtered.filter(
                        (k) => !targetedSet.has(k.keyword.toLowerCase()),
                      );
                      if (e.target.checked) {
                        selectable.forEach((k) => next.add(rowKey(k)));
                      } else {
                        selectable.forEach((k) => next.delete(rowKey(k)));
                      }
                      return next;
                    });
                  }}
                  className="accent-[#783DF5]"
                />
              </Th>
              <SortableTh
                label="Keyword"
                k="keyword"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(k, d) => {
                  setSortKey(k);
                  setSortDir(d);
                }}
              />
              <SortableTh
                label="Vol/mo"
                k="volume"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(k, d) => {
                  setSortKey(k);
                  setSortDir(d);
                }}
                align="right"
              />
              <SortableTh
                label="KD"
                k="kd"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(k, d) => {
                  setSortKey(k);
                  setSortDir(d);
                }}
                align="right"
              />
              <Th>Intent</Th>
              <SortableTh
                label="CPC"
                k="cpc"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(k, d) => {
                  setSortKey(k);
                  setSortDir(d);
                }}
                align="right"
              />
              <Th>Source</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center text-white/35"
                >
                  No keywords match these filters.
                </td>
              </tr>
            ) : (
              renderGroupedRows(
                filtered,
                groupBy,
                selected,
                setSelected,
                targetedSet,
              )
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center justify-between border-t border-white/8 px-5 py-3 text-[11px] text-white/45">
        <span>
          Showing {totals.count.toLocaleString()} of {enriched.length.toLocaleString()} keywords ·
          DataforSEO Labs + AI Clusters
          {pack
            ? ` · ${new Date(pack.fetchedAt).toLocaleDateString("en-GB")}`
            : ""}
        </span>
        <span>
          {selected.size > 0
            ? `${selected.size} selected for export`
            : "Tick a row to start selecting"}
        </span>
      </footer>
    </article>
  );
}

function enrichIdeas(
  pack: KwResearchPack | null,
  clusters: KwCluster[],
): EnrichedIdea[] {
  const out: EnrichedIdea[] = [];
  const seen = new Set<string>(); // key by lowercase keyword + origin to allow same kw across origins
  function add(
    k: KwIdea,
    origin: EnrichedIdea["origin"],
    extras: Partial<EnrichedIdea> = {},
  ) {
    const id = `${k.keyword.toLowerCase()}::${origin}::${extras.competitorDomain ?? extras.clusterName ?? ""}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ ...k, origin, ...extras });
  }
  if (pack) {
    pack.suggestions.forEach((k) => add(k, "Suggestion"));
    pack.ideas.forEach((k) => add(k, "Idea"));
    pack.domainExisting.forEach((k) => add(k, "Already-ranking"));
    pack.competitors.forEach((c) =>
      c.keywords.forEach((k) => add(k, c.domain, { competitorDomain: c.domain })),
    );
  }
  // AI-cluster rows — Claude's analysed keywords (often a superset of the
  // raw DataforSEO data because Claude infers from the onboarding form +
  // geo). These typically have null vol/KD when DataforSEO didn't surface
  // them, but carry rich intent/priority/page/why context.
  for (const cluster of clusters) {
    for (const row of cluster.rows) {
      const intentLower = (row.intent ?? "").toLowerCase();
      const validIntent =
        intentLower === "informational" ||
        intentLower === "commercial" ||
        intentLower === "transactional" ||
        intentLower === "navigational"
          ? (intentLower as KwIdea["intent"])
          : null;
      add(
        {
          keyword: row.keyword,
          searchVolume: row.volume,
          cpc: null,
          competition: null,
          competitionLevel: null,
          difficulty: row.difficulty,
          intent: validIntent,
          monthlyTrend: null,
          source: "ideas",
        },
        "AI cluster",
        {
          clusterName: cluster.name,
          clusterPriority: row.priority,
          clusterPriorityRaw: row.priorityRaw,
          suggestedPage: row.suggestedPage,
          why: row.why,
        },
      );
    }
  }
  return out;
}

function filterAndSort(
  list: EnrichedIdea[],
  opts: {
    tab: SourceTab;
    intent: IntentFilter;
    query: string;
    sortKey: SortKey;
    sortDir: SortDir;
  },
): EnrichedIdea[] {
  let out = list;
  if (opts.tab === "suggestions") {
    out = out.filter((k) => k.origin === "Suggestion");
  } else if (opts.tab === "ideas") {
    out = out.filter((k) => k.origin === "Idea");
  } else if (opts.tab === "domain") {
    out = out.filter((k) => k.origin === "Already-ranking");
  } else if (opts.tab === "competitors") {
    out = out.filter((k) => !!k.competitorDomain);
  } else if (opts.tab === "clusters") {
    out = out.filter((k) => k.origin === "AI cluster");
  }
  if (opts.intent !== "all") {
    out = out.filter((k) => k.intent === opts.intent);
  }
  const q = opts.query.trim().toLowerCase();
  if (q) {
    out = out.filter((k) => k.keyword.toLowerCase().includes(q));
  }
  const dirMul = opts.sortDir === "asc" ? 1 : -1;
  out = [...out].sort((a, b) => {
    switch (opts.sortKey) {
      case "keyword":
        return a.keyword.localeCompare(b.keyword) * dirMul;
      case "kd":
        return ((a.difficulty ?? Number.MAX_SAFE_INTEGER) -
          (b.difficulty ?? Number.MAX_SAFE_INTEGER)) *
          dirMul;
      case "cpc":
        return ((a.cpc ?? 0) - (b.cpc ?? 0)) * dirMul;
      case "volume":
      default:
        return ((a.searchVolume ?? 0) - (b.searchVolume ?? 0)) * dirMul;
    }
  });
  return out;
}

function rowKey(k: EnrichedIdea): string {
  return `${k.keyword.toLowerCase()}::${k.origin}::${k.competitorDomain ?? ""}`;
}

function exportCsv(
  list: EnrichedIdea[],
  selectedKeys: Set<string> | null,
) {
  const rows = selectedKeys
    ? list.filter((k) => selectedKeys.has(rowKey(k)))
    : list;
  if (rows.length === 0) return;
  const header = [
    "keyword",
    "search_volume",
    "keyword_difficulty",
    "intent",
    "cpc",
    "source",
    "competitor_domain",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.keyword),
        r.searchVolume ?? "",
        r.difficulty ?? "",
        r.intent ?? "",
        r.cpc ?? "",
        csvEscape(r.origin),
        csvEscape(r.competitorDomain ?? ""),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[:T]/g, "-");
  a.href = url;
  a.download = `keyword-research-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v < 1000) return v.toString();
  if (v < 1_000_000) return `${(v / 1000).toFixed(1)}k`;
  return `${(v / 1_000_000).toFixed(2)}M`;
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/55 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function SortableTh({
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
        {active &&
          (sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          ))}
      </button>
    </th>
  );
}

function renderGroupedRows(
  filtered: EnrichedIdea[],
  groupBy: GroupBy,
  selected: Set<string>,
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
  targetedSet: Set<string>,
): React.ReactNode {
  if (groupBy === "none") {
    return filtered.map((k) => (
      <KwRow
        key={rowKey(k)}
        kw={k}
        checked={selected.has(rowKey(k))}
        targeted={targetedSet.has(k.keyword.toLowerCase())}
        onToggle={() => toggleSelected(setSelected, rowKey(k))}
      />
    ));
  }
  // Bucket by the chosen dimension, preserving filtered order within each
  // bucket. "Other" catches null intents.
  const order: string[] = [];
  const buckets = new Map<string, EnrichedIdea[]>();
  for (const k of filtered) {
    let bucketKey: string;
    if (groupBy === "intent") {
      bucketKey = k.intent ?? "other";
    } else if (groupBy === "cluster") {
      bucketKey = k.clusterName ?? "(not in a cluster)";
    } else {
      bucketKey = k.competitorDomain ?? k.origin;
    }
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
      order.push(bucketKey);
    }
    buckets.get(bucketKey)!.push(k);
  }
  return order.flatMap((label) => {
    const rows = buckets.get(label)!;
    const selectableInGroup = rows.filter(
      (r) => !targetedSet.has(r.keyword.toLowerCase()),
    );
    const groupKeys = selectableInGroup.map((r) => rowKey(r));
    const allChecked =
      groupKeys.length > 0 && groupKeys.every((id) => selected.has(id));
    const targetedInGroup = rows.length - selectableInGroup.length;
    return [
      <tr
        key={`__group-${label}`}
        className="bg-white/[0.025] text-white/65"
      >
        <td className="px-3 py-2">
          <input
            type="checkbox"
            checked={allChecked}
            disabled={groupKeys.length === 0}
            onChange={(e) => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (e.target.checked) groupKeys.forEach((id) => next.add(id));
                else groupKeys.forEach((id) => next.delete(id));
                return next;
              });
            }}
            className="accent-[#783DF5] disabled:opacity-30"
          />
        </td>
        <td
          colSpan={6}
          className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.12em]"
        >
          {label} <span className="text-white/40">({rows.length})</span>
          {targetedInGroup > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium normal-case tracking-normal text-emerald-200">
              {targetedInGroup} 🎯 already targeted
            </span>
          )}
        </td>
      </tr>,
      ...rows.map((k) => (
        <KwRow
          key={rowKey(k)}
          kw={k}
          checked={selected.has(rowKey(k))}
          targeted={targetedSet.has(k.keyword.toLowerCase())}
          onToggle={() => toggleSelected(setSelected, rowKey(k))}
        />
      )),
    ];
  });
}

function toggleSelected(
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
  id: string,
) {
  setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function KwRow({
  kw,
  checked,
  targeted,
  onToggle,
}: {
  kw: EnrichedIdea;
  checked: boolean;
  targeted: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      className={
        targeted
          ? "border-b border-white/5 bg-emerald-500/[0.04] transition"
          : "border-b border-white/5 transition hover:bg-white/[0.025]"
      }
    >
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={checked && !targeted}
          disabled={targeted}
          onChange={onToggle}
          className="accent-[#783DF5] disabled:cursor-not-allowed disabled:opacity-30"
          title={
            targeted
              ? "Already in this client's Target Keywords list"
              : undefined
          }
        />
      </td>
      <td className="px-3 py-2 text-white">
        <span className="inline-flex items-center gap-1.5">
          {kw.keyword}
          {targeted && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-emerald-200"
              title="Already in this client's Target Keywords list"
            >
              🎯 targeted
            </span>
          )}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-white/80">
        {fmtNum(kw.searchVolume)}
      </td>
      <td className="px-3 py-2 text-right text-white/80">
        {kw.difficulty ?? "—"}
      </td>
      <td className="px-3 py-2">
        <IntentChip intent={kw.intent} />
      </td>
      <td className="px-3 py-2 text-right text-white/70">
        {kw.cpc != null ? `$${kw.cpc.toFixed(2)}` : "—"}
      </td>
      <td className="px-3 py-2 text-white/55">
        {kw.competitorDomain ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
            {kw.competitorDomain}
          </span>
        ) : (
          <span className="text-[11px]">{kw.origin}</span>
        )}
      </td>
    </tr>
  );
}

function IntentChip({ intent }: { intent: KwIdea["intent"] }) {
  if (!intent)
    return <span className="text-[11px] text-white/35">—</span>;
  const styles: Record<string, string> = {
    informational: "border-sky-400/30 bg-sky-500/10 text-sky-200",
    commercial: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    transactional: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    navigational: "border-violet-400/30 bg-violet-500/10 text-violet-200",
  };
  const cls = styles[intent] ?? "border-white/15 bg-white/[0.04] text-white/65";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${cls}`}
    >
      {intent}
    </span>
  );
}
