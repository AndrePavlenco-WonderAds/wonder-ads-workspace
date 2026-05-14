"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from "lucide-react";
import type { Ga4Data, Ga4Metric } from "@/lib/analytics";

export function Ga4Metrics({
  slug,
  clientName,
}: {
  slug: string;
  clientName: string;
}) {
  const [data, setData] = useState<Ga4Data | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ga4/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d as Ga4Data);
      })
      .catch(() => {
        if (!cancelled)
          setData({ status: "error", message: "Failed to load analytics." });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loading = data === null;

  return (
    <article className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-emerald-500/40 opacity-20 blur-3xl"
      />

      <header className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="brand-gradient-bg flex h-7 w-7 items-center justify-center rounded-lg shadow-[0_4px_18px_-4px_rgba(120,61,245,0.55)]"
          >
            <BarChart3 className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
          </span>
          <h3 className="text-sm font-semibold tracking-tight text-white">
            GA4 Metrics
          </h3>
        </div>
        <StatusPill data={data} />
      </header>

      <p className="relative mt-3 text-xs text-white/55">
        Traffic and conversions for {clientName} — last 30 days.
      </p>

      <div className="relative mt-4 grid grid-cols-2 gap-2.5">
        {(data?.status === "ok"
          ? data.metrics
          : PLACEHOLDER_METRICS
        ).map((m) => (
          <MetricCell key={m.key} metric={m} loading={loading} />
        ))}
      </div>

      <div className="relative mt-4">
        <Sparkline values={data?.status === "ok" ? data.trend : []} />
      </div>

      {data && data.status !== "ok" && (
        <div className="relative mt-4 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-3">
          <p className="text-[11px] leading-relaxed text-white/45">
            {messageFor(data)}
          </p>
        </div>
      )}

      {data?.status === "ok" && (
        <p className="relative mt-3 text-[11px] text-white/35">
          Source: Google Analytics 4 · property {data.propertyId}
        </p>
      )}
    </article>
  );
}

const PLACEHOLDER_METRICS: Ga4Metric[] = [
  { key: "users", label: "Users (30d)", value: 0, previous: 0, format: "number" },
  { key: "sessions", label: "Sessions", value: 0, previous: 0, format: "number" },
  {
    key: "engagement",
    label: "Engagement",
    value: 0,
    previous: 0,
    format: "percent",
  },
  {
    key: "conversions",
    label: "Conversions",
    value: 0,
    previous: 0,
    format: "number",
  },
];

function MetricCell({
  metric,
  loading,
}: {
  metric: Ga4Metric;
  loading: boolean;
}) {
  const delta = metric.value - metric.previous;
  const pct =
    metric.previous > 0 ? Math.round((delta / metric.previous) * 100) : null;
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">
        {metric.label}
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span
          className={`text-lg font-bold tracking-tight ${
            loading ? "text-white/40" : "text-white"
          }`}
        >
          {loading ? "——" : formatValue(metric)}
        </span>
        {!loading && (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
              dir === "up"
                ? "text-emerald-400/80"
                : dir === "down"
                  ? "text-rose-400/80"
                  : "text-white/30"
            }`}
          >
            {dir === "up" && <TrendingUp className="h-3.5 w-3.5" />}
            {dir === "down" && <TrendingDown className="h-3.5 w-3.5" />}
            {dir === "flat" && <Minus className="h-3.5 w-3.5" />}
            {pct !== null && dir !== "flat" && `${Math.abs(pct)}%`}
          </span>
        )}
      </div>
    </div>
  );
}

function formatValue(metric: Ga4Metric): string {
  if (metric.format === "percent") {
    return `${(metric.value * 100).toFixed(1)}%`;
  }
  const n = metric.value;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

function Sparkline({ values }: { values: number[] }) {
  const W = 200;
  const H = 50;

  if (values.length < 2) {
    // Flat ghost line when there's no data yet.
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-12 w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={`M0 ${H / 2} L${W} ${H / 2}`}
          stroke="#34D399"
          strokeWidth="1.25"
          strokeOpacity="0.25"
          fill="none"
        />
      </svg>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = W / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-12 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="ga4-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34D399" stopOpacity="0.22" />
          <stop offset="1" stopColor="#34D399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ga4-spark-fill)" />
      <path
        d={line}
        stroke="#34D399"
        strokeWidth="1.5"
        strokeOpacity="0.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusPill({ data }: { data: Ga4Data | null }) {
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

function messageFor(
  data: Extract<Ga4Data, { status: Exclude<Ga4Data["status"], "ok"> }>,
): string {
  switch (data.status) {
    case "not-configured":
      return "Google isn't connected on this deployment yet — add the GOOGLE_SERVICE_ACCOUNT_JSON environment variable to enable live analytics.";
    case "no-property":
      return "No GA4 property found for this client's domain that the connected account can access. Check the property's web data stream URL, or grant the account access.";
    case "error":
      return `Couldn't reach Google Analytics for this client. Make sure the Analytics APIs are enabled and the account has access. (${data.message})`;
  }
}
