"use client";

import { useState, useEffect } from "react";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from "lucide-react";
import type { KeywordData, KeywordRow } from "@/lib/keywords";

const RANGE_OPTIONS = [
  { days: 7, label: "Last 7 days" },
  { days: 28, label: "Last 28 days" },
  { days: 90, label: "Last 3 months" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last 12 months" },
] as const;

type SortKey = "traffic" | "position" | "growth";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "traffic", label: "Top traffic" },
  { value: "position", label: "Best position" },
  { value: "growth", label: "Recent growth" },
];

function sortRows<T extends KeywordRow>(rows: T[], sort: SortKey): T[] {
  if (sort === "traffic") return rows;
  const sorted = [...rows];
  if (sort === "position") {
    sorted.sort((a, b) => a.position - b.position);
  } else {
    // Recent growth — biggest position improvement first, nulls last.
    sorted.sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));
  }
  return sorted;
}

export function TrackedKeywords({
  slug,
  clientName,
}: {
  slug: string;
  clientName: string;
}) {
  const [data, setData] = useState<KeywordData | null>(null);
  const [days, setDays] = useState(28);
  const [sort, setSort] = useState<SortKey>("traffic");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(`/api/keywords/${slug}?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d as KeywordData);
      })
      .catch(() => {
        if (!cancelled)
          setData({ status: "error", message: "Failed to load keywords." });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, days]);

  const loading = data === null;
  const ok = data?.status === "ok";
  const rangeLabel =
    RANGE_OPTIONS.find((o) => o.days === days)?.label.toLowerCase() ??
    `last ${days} days`;

  return (
    <article className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-amber-500/40 opacity-20 blur-3xl"
      />

      <header className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="brand-gradient-bg flex h-7 w-7 items-center justify-center rounded-lg shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)]"
          >
            <Search className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Tracked Keywords
            </h3>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
              Live · Google Search Console
            </p>
          </div>
        </div>
        <StatusPill data={data} />
      </header>

      <p className="relative mt-3 text-xs text-white/55">
        {ok
          ? `Top Google queries for ${clientName} pulled live from GSC.`
          : `Live ranking positions for ${clientName} pulled from Google Search Console.`}
      </p>

      <div className="relative mt-2 flex items-center gap-2">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort keywords"
          className="flex-1 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-white/70 outline-none transition hover:border-white/25 focus:border-white/30 [&>option]:bg-[#10131a] [&>option]:text-white"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="Date range"
          className="flex-1 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-white/70 outline-none transition hover:border-white/25 focus:border-white/30 [&>option]:bg-[#10131a] [&>option]:text-white"
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.days} value={o.days}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <SkeletonRows />}

      {data?.status === "ok" &&
        (data.rows.length === 0 ? (
          <p className="relative mt-4 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-4 text-center text-[11px] text-white/40">
            No Search Console data for this property in the {rangeLabel}.
          </p>
        ) : (
          <div className="relative mt-4 max-h-[680px] overflow-y-auto pr-1">
            <ul className="space-y-1.5">
              {sortRows(data.rows, sort).map((row) => (
                <li
                  key={row.query}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2"
                >
                  <span
                    aria-hidden
                    className="brand-gradient-bg h-1.5 w-1.5 shrink-0 rounded-full"
                  />
                  <span
                    className="flex-1 truncate text-sm font-medium text-white/85"
                    title={row.query}
                  >
                    {row.query}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45"
                    title={`Average position · ${row.clicks} clicks · ${row.impressions} impressions`}
                  >
                    #{row.position}
                  </span>
                  <ChangeBadge change={row.change} />
                </li>
              ))}
            </ul>
          </div>
        ))}

      {data && data.status !== "ok" && (
        <div className="relative mt-4 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-3">
          <p className="text-[11px] leading-relaxed text-white/45">
            {messageFor(data)}
          </p>
        </div>
      )}

      {data?.status === "ok" && (
        <p className="relative mt-3 text-[11px] text-white/35">
          Source: Google Search Console · {data.start} → {data.end}
        </p>
      )}
    </article>
  );
}

function StatusPill({ data }: { data: KeywordData | null }) {
  if (data === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white/45">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Loading
      </span>
    );
  }
  if (data.status === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-300/85">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.7)]"
        />
        Connected
      </span>
    );
  }
  const isError = data.status === "error";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] ${
        isError
          ? "border-rose-400/30 bg-rose-400/[0.06] text-rose-300/85"
          : "border-amber-400/30 bg-amber-400/[0.06] text-amber-300/85"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          isError
            ? "bg-rose-300 shadow-[0_0_8px_rgba(253,164,175,0.7)]"
            : "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.7)]"
        }`}
      />
      {isError ? "Access needed" : "Not connected"}
    </span>
  );
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null || change === 0) {
    return (
      <span className="inline-flex items-center text-[10px] font-bold text-white/30">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400/80">
        <TrendingUp className="h-3 w-3" />
        {change}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-400/80">
      <TrendingDown className="h-3 w-3" />
      {Math.abs(change)}
    </span>
  );
}

function SkeletonRows() {
  return (
    <ul className="relative mt-4 space-y-1.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2"
        >
          <span
            aria-hidden
            className="brand-gradient-bg h-1.5 w-1.5 shrink-0 rounded-full opacity-40"
          />
          <span className="flex-1 truncate text-sm font-medium text-white/40">
            ————————
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/35">
            #—
          </span>
        </li>
      ))}
    </ul>
  );
}

function messageFor(
  data: Extract<KeywordData, { status: Exclude<KeywordData["status"], "ok"> }>,
): string {
  switch (data.status) {
    case "not-configured":
      return "Google Search Console isn't connected on this deployment yet — add the GOOGLE_SERVICE_ACCOUNT_JSON environment variable to enable live keyword data.";
    case "no-property":
      return "No Search Console property found for this client's domain that the connected account can access. Make sure the property exists and that account has access to it.";
    case "error":
      return `Couldn't reach Search Console for this client. Most likely the service account hasn't been granted access to the property yet. (${data.message})`;
  }
}
