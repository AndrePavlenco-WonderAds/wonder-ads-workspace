"use client";

import { useState, useEffect, type MouseEvent } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from "lucide-react";
import {
  GA4_CHANNELS,
  type Ga4Channel,
  type Ga4Data,
  type Ga4Metric,
  type Ga4TrendPoint,
} from "@/lib/analytics";

const RANGE_OPTIONS = [
  { days: 7, label: "Last 7 days" },
  { days: 28, label: "Last 28 days" },
  { days: 90, label: "Last 3 months" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last 12 months" },
] as const;

export function Ga4Metrics({
  slug,
  clientName,
}: {
  slug: string;
  clientName: string;
}) {
  const [data, setData] = useState<Ga4Data | null>(null);
  const [days, setDays] = useState(28);
  // SEO projects care about organic traffic first — default the filter to it.
  const [channel, setChannel] = useState<Ga4Channel>("Organic Search");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(`/api/ga4/${slug}?days=${days}&channel=${encodeURIComponent(channel)}`)
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
  }, [slug, days, channel]);

  const loading = data === null;
  const metrics = data?.status === "ok" ? data.metrics : PLACEHOLDER_METRICS;
  const channelLabel =
    channel === "all" ? "all traffic" : `${channel.toLowerCase()} traffic`;

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
        {data?.status === "ok"
          ? `${clientName} — ${channelLabel}, vs the previous period.`
          : `Traffic and conversions for ${clientName}.`}
      </p>

      <div className="relative mt-2 flex items-center gap-2">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as Ga4Channel)}
          aria-label="Traffic channel"
          className="flex-1 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-white/70 outline-none transition hover:border-white/25 focus:border-white/30 [&>option]:bg-[#10131a] [&>option]:text-white"
        >
          {GA4_CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
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

      <div className="relative mt-4 grid grid-cols-2 gap-2.5">
        {metrics.map((metric) => (
          <MetricCell key={metric.key} metric={metric} loading={loading} />
        ))}
      </div>

      <div className="relative mt-4">
        <TrendChart points={data?.status === "ok" ? data.trend : []} />
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
  "Users",
  "New Users",
  "Sessions",
  "Pageviews",
  "Pages / Session",
  "Engagement",
  "Bounce Rate",
  "Time / User",
  "Conversions",
  "Conv. Rate",
].map((label) => ({
  key: label,
  label,
  value: 0,
  previous: 0,
  format: "number" as const,
  higherIsBetter: true,
}));

function MetricCell({
  metric,
  loading,
}: {
  metric: Ga4Metric;
  loading: boolean;
}) {
  const delta = metric.value - metric.previous;
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const good =
    delta === 0 ? null : metric.higherIsBetter ? delta > 0 : delta < 0;
  const pct =
    metric.previous > 0 ? Math.round((delta / metric.previous) * 100) : null;

  const color =
    good === null
      ? "text-white/30"
      : good
        ? "text-emerald-400/80"
        : "text-rose-400/80";

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
      <p className="truncate text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">
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
            className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${color}`}
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
  switch (metric.format) {
    case "percent":
      return `${(metric.value * 100).toFixed(1)}%`;
    case "decimal":
      return metric.value.toFixed(1);
    case "duration": {
      const s = Math.round(metric.value);
      if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
      return `${s}s`;
    }
    default: {
      const n = metric.value;
      if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
      return Math.round(n).toLocaleString();
    }
  }
}

function formatGa4Date(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6)) - 1;
  const d = Number(yyyymmdd.slice(6, 8));
  return new Date(y, m, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const VB_W = 800;
const VB_H = 200;
const PAD = { l: 8, r: 8, t: 12, b: 10 };

function TrendChart({ points }: { points: Ga4TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white/40">
          Daily Sessions
        </p>
        <div className="flex h-24 items-center justify-center rounded-xl border border-white/8 bg-white/[0.02]">
          <span className="text-[11px] text-white/30">
            No trend data for this range.
          </span>
        </div>
      </div>
    );
  }

  const n = points.length;
  const values = points.map((p) => p.sessions);
  const max = Math.max(...values, 1);
  const peak = Math.max(...values);
  const total = values.reduce((a, b) => a + b, 0);

  const plotW = VB_W - PAD.l - PAD.r;
  const plotH = VB_H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (i / (n - 1)) * plotW;
  const y = (v: number) => PAD.t + (1 - v / max) * plotH;

  const linePts = points.map((p, i) => [x(i), y(p.sessions)] as const);
  const line = linePts
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`)
    .join(" ");
  const baseline = VB_H - PAD.b;
  const area = `${line} L${x(n - 1).toFixed(1)} ${baseline} L${x(0).toFixed(1)} ${baseline} Z`;
  const gridYs = [0, 0.5, 1].map((f) => PAD.t + (1 - f) * plotH);

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const plotFrac = Math.min(
      1,
      Math.max(0, (frac * VB_W - PAD.l) / plotW),
    );
    setHover(Math.round(plotFrac * (n - 1)));
  }

  const hi = hover !== null && hover >= 0 && hover < n ? hover : null;
  const tipLeft =
    hi !== null
      ? Math.min(90, Math.max(10, (hi / (n - 1)) * 100))
      : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/40">
          Daily Sessions
        </span>
        <span className="text-[11px] text-white/35">
          Peak {peak.toLocaleString()} · Total {total.toLocaleString()}
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full cursor-crosshair"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="ga4-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#34D399" stopOpacity="0.3" />
              <stop offset="1" stopColor="#34D399" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridYs.map((gy, i) => (
            <line
              key={i}
              x1={PAD.l}
              x2={VB_W - PAD.r}
              y1={gy}
              y2={gy}
              stroke="#ffffff"
              strokeOpacity="0.07"
              strokeWidth="1"
            />
          ))}

          <path d={area} fill="url(#ga4-trend-fill)" />
          <path
            d={line}
            stroke="#34D399"
            strokeWidth="2.5"
            strokeOpacity="0.9"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {hi !== null && (
            <line
              x1={x(hi)}
              x2={x(hi)}
              y1={PAD.t}
              y2={baseline}
              stroke="#6EE7B7"
              strokeOpacity="0.5"
              strokeWidth="1.5"
            />
          )}

          {linePts.map(([px, py], i) => (
            <circle
              key={i}
              cx={px}
              cy={py}
              r={hi === i ? 5 : 2.25}
              fill={hi === i ? "#6EE7B7" : "#34D399"}
              fillOpacity={hi === i ? 1 : 0.5}
            />
          ))}
        </svg>

        {hi !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-white/15 bg-[#10131a] px-2 py-1 text-center shadow-[0_8px_24px_-6px_rgba(0,0,0,0.7)]"
            style={{ left: `${tipLeft}%` }}
          >
            <p className="text-[10px] font-medium text-white/50">
              {formatGa4Date(points[hi].date)}
            </p>
            <p className="text-xs font-bold text-white">
              {points[hi].sessions.toLocaleString()}
              <span className="ml-1 font-normal text-white/45">sessions</span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-white/35">
        <span>{formatGa4Date(points[0].date)}</span>
        {n > 2 && (
          <span>{formatGa4Date(points[Math.floor(n / 2)].date)}</span>
        )}
        <span>{formatGa4Date(points[n - 1].date)}</span>
      </div>
    </div>
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
