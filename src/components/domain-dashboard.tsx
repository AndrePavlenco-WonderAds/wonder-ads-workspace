"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  TrendingUp,
  AlertTriangle,
  Trophy,
  Search,
  Activity,
  Link2,
  Link2Off,
  DollarSign,
  Sparkles,
  Bot,
  Globe2,
  Target,
  Award,
} from "lucide-react";
import type {
  DomainMetrics,
  LlmMentions,
} from "@/lib/seo-tools/dataforseo";

type EnvDiag = {
  dataforseo: {
    DATAFORSEO_LOGIN: { present: boolean; length: number };
    DATAFORSEO_PASSWORD: { present: boolean; length: number };
  };
};

export function DomainDashboard({ metrics }: { metrics: DomainMetrics | null }) {
  const [envOk, setEnvOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (metrics) return;
    let cancelled = false;
    fetch("/api/diagnostics/env", { cache: "no-store" })
      .then((r) => r.json() as Promise<EnvDiag>)
      .then((d) => {
        if (cancelled) return;
        setEnvOk(
          d.dataforseo.DATAFORSEO_LOGIN.present &&
            d.dataforseo.DATAFORSEO_PASSWORD.present,
        );
      })
      .catch(() => {
        if (!cancelled) setEnvOk(null);
      });
    return () => {
      cancelled = true;
    };
  }, [metrics]);

  if (!metrics) {
    const envConfigured = envOk === true;
    return (
      <section className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.025] p-5">
        <header className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-white/55" strokeWidth={2.25} />
          <h2 className="text-sm font-semibold tracking-tight text-white">
            Domain intelligence
          </h2>
          <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
            {envOk === null
              ? "Checking…"
              : envConfigured
                ? "Not in this result"
                : "Not connected"}
          </span>
        </header>
        <p className="mt-3 text-xs text-white/55">
          {envConfigured
            ? "Re-generate the result to populate live DataforSEO metrics."
            : "Connect DataforSEO to unlock the dashboard."}
        </p>
      </section>
    );
  }

  const backlinksErr = metrics.errors.find((e) =>
    e.source.includes("backlinks"),
  );

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline gap-2">
        <TrendingUp
          className="h-4 w-4 text-[color:var(--brand-purple)]"
          strokeWidth={2.25}
        />
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/65">
          Domain intelligence
        </h2>
        <span className="font-mono text-[10px] text-white/40">
          {metrics.target} · {locationName(metrics.locationCode)}
        </span>
        <span className="ml-auto text-[10px] text-white/30">
          DataforSEO · {new Date(metrics.fetchedAt).toLocaleDateString()}
        </span>
      </header>

      {/* PRIMARY ROW — hero stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AuthorityCard
          score={metrics.rankNormalised ?? null}
          rawRank={metrics.rank ?? null}
          missing={metrics.rankNormalised == null}
          missingReason={backlinksErr ? "Activate Backlinks API" : "No data"}
        />
        <Stat
          icon={<Search className="h-3.5 w-3.5" />}
          accent="sky"
          label="Organic keywords"
          value={fmtNum(metrics.organicKeywords)}
          sublabel={
            metrics.organicCount
              ? `Top 3: ${metrics.organicCount.top3} · Top 10: ${metrics.organicCount.top10} · Top 100: ${metrics.organicCount.top100}`
              : undefined
          }
        />
        <Stat
          icon={<Activity className="h-3.5 w-3.5" />}
          accent="emerald"
          label="Est. monthly organic traffic"
          value={fmtNum(roundN(metrics.organicEtv, 0))}
          sublabel="ETV — clicks proxy"
        />
        <Stat
          icon={<Link2 className="h-3.5 w-3.5" />}
          accent="violet"
          label="Referring domains"
          value={fmtNum(metrics.referringDomains)}
          sublabel={
            metrics.referringDomains != null && metrics.backlinks != null
              ? `${fmtNum(metrics.backlinks)} total backlinks`
              : backlinksErr
                ? "Activate Backlinks API"
                : "No data"
          }
          missing={metrics.referringDomains == null}
        />
      </div>

      {/* SECONDARY ROW — supporting stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<Link2 className="h-3.5 w-3.5" />}
          accent="cyan"
          label="Total backlinks"
          value={fmtNum(metrics.backlinks)}
          sublabel={
            metrics.dofollow != null && metrics.backlinks
              ? `${Math.round((metrics.dofollow / metrics.backlinks) * 100)}% dofollow`
              : undefined
          }
          missing={metrics.backlinks == null}
        />
        <Stat
          icon={<Link2Off className="h-3.5 w-3.5" />}
          accent={
            metrics.brokenBacklinks != null && metrics.brokenBacklinks > 50
              ? "amber"
              : "slate"
          }
          label="Broken backlinks"
          value={fmtNum(metrics.brokenBacklinks)}
          sublabel={
            metrics.brokenBacklinks != null && metrics.backlinks
              ? `${Math.round((metrics.brokenBacklinks / metrics.backlinks) * 100)}% of total`
              : undefined
          }
          missing={metrics.brokenBacklinks == null}
        />
        <Stat
          icon={<DollarSign className="h-3.5 w-3.5" />}
          accent="amber"
          label="Paid keywords"
          value={fmtNum(metrics.paidKeywords)}
          sublabel={
            metrics.paidKeywords && metrics.paidKeywords > 0
              ? "Active paid campaigns"
              : "No paid presence"
          }
        />
        <Stat
          icon={<Target className="h-3.5 w-3.5" />}
          accent="rose"
          label="Top-10 keywords"
          value={metrics.organicCount?.top10 ?? "—"}
          sublabel={
            metrics.organicCount
              ? `Top 3: ${metrics.organicCount.top3} · 11-100: ${metrics.organicCount.top100 - metrics.organicCount.top10}`
              : undefined
          }
        />
      </div>

      {backlinksErr && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <strong>Backlinks data missing.</strong> {backlinksErr.message}.{" "}
            <a
              href="https://app.dataforseo.com/backlinks-subscription"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              Activate the DataforSEO Backlinks subscription
            </a>
            .
          </div>
        </div>
      )}

      {metrics.llmMentions && (
        <AiVisibilityPanel mentions={metrics.llmMentions} />
      )}

      {metrics.topKeywords && metrics.topKeywords.length > 0 && (
        <TopKeywordsTable
          keywords={metrics.topKeywords}
          targetDomain={metrics.target}
        />
      )}
    </section>
  );
}

// ---- Authority gradient card ----

function AuthorityCard({
  score,
  rawRank,
  missing,
  missingReason,
}: {
  score: number | null;
  rawRank: number | null;
  missing: boolean;
  missingReason: string;
}) {
  const tier = scoreTier(score);
  const gradient =
    tier === "missing"
      ? "from-white/[0.04] to-white/[0.02]"
      : tier === "weak"
        ? "from-rose-500/25 via-rose-500/8 to-transparent"
        : tier === "developing"
          ? "from-amber-500/25 via-amber-500/8 to-transparent"
          : tier === "good"
            ? "from-sky-500/25 via-sky-500/8 to-transparent"
            : "from-emerald-500/30 via-emerald-500/10 to-transparent";
  const border =
    tier === "missing"
      ? "border-white/8"
      : tier === "weak"
        ? "border-rose-400/30"
        : tier === "developing"
          ? "border-amber-400/30"
          : tier === "good"
            ? "border-sky-400/30"
            : "border-emerald-400/40";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${border} bg-gradient-to-br ${gradient} p-4`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
        <Trophy className="h-3.5 w-3.5" />
        Authority
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={`text-3xl font-bold tracking-tight ${missing ? "text-white/35" : "text-white"}`}
        >
          {score ?? "—"}
        </span>
        {score != null && (
          <span className="text-sm text-white/45">/100</span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-white/55">
        {missing
          ? missingReason
          : `Rank ${rawRank} · ${tierLabel(tier)}`}
      </div>
    </div>
  );
}

function scoreTier(
  score: number | null,
): "missing" | "weak" | "developing" | "good" | "strong" {
  if (score == null) return "missing";
  if (score < 20) return "weak";
  if (score < 40) return "developing";
  if (score < 60) return "good";
  return "strong";
}

function tierLabel(t: ReturnType<typeof scoreTier>): string {
  return {
    missing: "—",
    weak: "Weak",
    developing: "Developing",
    good: "Established",
    strong: "Strong",
  }[t];
}

// ---- Generic stat card with coloured accent ----

type Accent =
  | "violet"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "cyan"
  | "slate";

const ACCENTS: Record<Accent, { bg: string; ring: string; icon: string }> = {
  violet: {
    bg: "bg-violet-500/15",
    ring: "ring-violet-400/25",
    icon: "text-violet-200",
  },
  sky: { bg: "bg-sky-500/15", ring: "ring-sky-400/25", icon: "text-sky-200" },
  emerald: {
    bg: "bg-emerald-500/15",
    ring: "ring-emerald-400/25",
    icon: "text-emerald-200",
  },
  amber: {
    bg: "bg-amber-500/15",
    ring: "ring-amber-400/25",
    icon: "text-amber-200",
  },
  rose: {
    bg: "bg-rose-500/15",
    ring: "ring-rose-400/25",
    icon: "text-rose-200",
  },
  cyan: { bg: "bg-cyan-500/15", ring: "ring-cyan-400/25", icon: "text-cyan-200" },
  slate: {
    bg: "bg-white/[0.05]",
    ring: "ring-white/10",
    icon: "text-white/65",
  },
};

function Stat({
  icon,
  accent,
  label,
  value,
  sublabel,
  missing = false,
}: {
  icon: React.ReactNode;
  accent: Accent;
  label: string;
  value: string | number;
  sublabel?: string;
  missing?: boolean;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md ${a.bg} ring-1 ${a.ring} ${a.icon}`}
        >
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          {label}
        </span>
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight ${missing ? "text-white/35" : "text-white"}`}
      >
        {value}
      </div>
      {sublabel && (
        <div className="mt-0.5 text-[11px] text-white/45">{sublabel}</div>
      )}
    </div>
  );
}

// ---- AI Visibility panel ----

function AiVisibilityPanel({ mentions }: { mentions: LlmMentions }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/[0.06] via-white/[0.02] to-transparent p-5">
      <header className="mb-4 flex flex-wrap items-baseline gap-2">
        <Sparkles
          className="h-4 w-4 text-[color:var(--brand-purple)]"
          strokeWidth={2.25}
        />
        <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-white/75">
          AI visibility
        </h3>
        <span className="font-mono text-[10px] text-white/40">
          LLM Mentions · US/EN window
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.13em] text-violet-200">
          NEW
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<Bot className="h-3.5 w-3.5" />}
          accent="violet"
          label="Total mentions"
          value={mentions.totalMentions}
          sublabel="Across queried LLMs"
        />
        <Stat
          icon={<Activity className="h-3.5 w-3.5" />}
          accent="violet"
          label="AI search volume"
          value={fmtNum(mentions.aiSearchVolume)}
          sublabel="Queries that could trigger us"
        />
        {mentions.perPlatform.map((p) => (
          <Stat
            key={p.platform}
            icon={
              p.platform === "google" ? (
                <Globe2 className="h-3.5 w-3.5" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )
            }
            accent={p.platform === "google" ? "sky" : "rose"}
            label={`${p.platform} mentions`}
            value={p.mentions}
            sublabel={`${fmtNum(p.aiSearchVolume)} AI search vol`}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {mentions.topCitedPages.length > 0 && (
          <div className="rounded-xl border border-white/8 bg-black/15 p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/65">
              <Award className="h-3 w-3 text-violet-300" />
              Top cited pages from this domain
            </h4>
            <ul className="space-y-1.5">
              {mentions.topCitedPages.slice(0, 8).map((p, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-2 text-[11.5px]"
                >
                  <span className="font-mono text-[10px] text-white/35">
                    {i + 1}
                  </span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate text-white/80 hover:text-white hover:underline"
                    title={p.url}
                  >
                    {p.url}
                  </a>
                  <span className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-200">
                    {p.mentions}×
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {mentions.coCitedDomains.length > 0 && (
          <div className="rounded-xl border border-white/8 bg-black/15 p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/65">
              <Globe2 className="h-3 w-3 text-sky-300" />
              Co-cited domains (competitors + sources)
            </h4>
            <ul className="space-y-1.5">
              {mentions.coCitedDomains.slice(0, 10).map((d, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-2 text-[11.5px]"
                >
                  <span className="font-mono text-[10px] text-white/35">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-white/80">{d.domain}</span>
                  <span className="shrink-0 text-[10px] text-white/40">
                    {fmtNum(d.aiSearchVolume)} ASV
                  </span>
                  <span className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-200">
                    {d.mentions}×
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Top keywords table ----

function TopKeywordsTable({
  keywords,
  targetDomain,
}: {
  keywords: DomainMetrics["topKeywords"];
  targetDomain: string;
}) {
  if (!keywords || keywords.length === 0) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <header className="mb-3 flex items-center gap-2">
        <Search
          className="h-3.5 w-3.5 text-sky-300"
          strokeWidth={2.25}
        />
        <h3 className="text-sm font-semibold tracking-tight text-white">
          Top ranked keywords
        </h3>
        <span className="text-[10px] uppercase tracking-[0.13em] text-white/35">
          by estimated traffic · {keywords.length} shown
        </span>
      </header>
      <div className="max-h-[520px] overflow-y-auto rounded-md border border-white/5 print:max-h-none print:overflow-visible">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 z-[1] border-b border-white/10 bg-[#0a0a0f]/95 text-[10px] uppercase tracking-[0.08em] text-white/55 backdrop-blur">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Keyword</th>
              <th className="px-2 py-1.5 text-right">Pos</th>
              <th className="px-2 py-1.5 text-right">Volume</th>
              <th className="px-2 py-1.5">Intent</th>
              <th className="px-2 py-1.5 text-right">CPC</th>
              <th className="px-2 py-1.5 text-right">ETV</th>
              <th className="px-2 py-1.5">URL</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((k, i) => (
              <tr
                key={i}
                className="border-b border-white/5 text-white/85 transition hover:bg-white/[0.025]"
              >
                <td className="px-2 py-1.5 text-white/45">{i + 1}</td>
                <td className="px-2 py-1.5 font-medium">{k.keyword}</td>
                <td className="px-2 py-1.5 text-right">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${posBadge(k.position)}`}
                  >
                    {k.position}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right">{fmtNum(k.searchVolume)}</td>
                <td className="px-2 py-1.5 text-white/55">{k.intent ?? "—"}</td>
                <td className="px-2 py-1.5 text-right text-white/60">
                  {k.cpc != null ? `$${k.cpc.toFixed(2)}` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {fmtNum(roundN(k.estTraffic, 1))}
                </td>
                <td className="max-w-[200px] truncate px-2 py-1.5 text-[11px] text-white/45">
                  {k.url ? relativePath(k.url, targetDomain) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v < 1000) return v.toString();
  if (v < 1_000_000) return `${(v / 1000).toFixed(1)}k`;
  return `${(v / 1_000_000).toFixed(2)}M`;
}

function roundN(v: number | null | undefined, decimals: number): number | null {
  if (v === null || v === undefined) return null;
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

function relativePath(url: string, target: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === target) return u.pathname + u.search || "/";
    return url;
  } catch {
    return url;
  }
}

function posBadge(pos: number): string {
  if (pos <= 3) return "bg-emerald-400/15 text-emerald-200";
  if (pos <= 10) return "bg-sky-400/15 text-sky-200";
  if (pos <= 20) return "bg-amber-400/15 text-amber-200";
  return "bg-white/[0.06] text-white/55";
}

function locationName(code: number): string {
  const map: Record<number, string> = {
    2620: "Portugal",
    2840: "United States",
    2826: "United Kingdom",
    2724: "Spain",
    2250: "France",
    2276: "Germany",
    2124: "Canada",
    2380: "Italy",
    2056: "Belgium",
  };
  return map[code] ?? `geo ${code}`;
}
