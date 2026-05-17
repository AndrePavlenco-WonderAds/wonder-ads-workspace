"use client";

import { useEffect, useState } from "react";
import { ExternalLink, TrendingUp, AlertTriangle } from "lucide-react";
import type { DomainMetrics } from "@/lib/seo-tools/dataforseo";

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
        {envConfigured ? (
          <p className="mt-3 text-xs text-white/55">
            DataforSEO is configured in this environment, but this audit
            result was generated before metrics started flowing. Click{" "}
            <strong className="text-white/80">Re-generate</strong> on the
            result toolbar above to refresh.
          </p>
        ) : (
          <p className="mt-3 text-xs text-white/55">
            Connect <strong className="text-white/80">DataforSEO</strong> to
            see domain authority, keywords, traffic estimate, and ranked
            keywords at the top of every audit.{" "}
            <a
              href="https://app.dataforseo.com/register"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[color:var(--brand-purple)] hover:underline"
            >
              Sign up <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </p>
        )}
      </section>
    );
  }

  const backlinksErr = metrics.errors.find((e) =>
    e.source.includes("backlinks"),
  );

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-white/55" strokeWidth={2.25} />
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
          Domain intelligence
        </h2>
        <span className="ml-2 text-[10px] text-white/35 font-mono">
          {metrics.target} · {locationName(metrics.locationCode)}
        </span>
        <span className="ml-auto text-[10px] text-white/30">
          DataforSEO · {new Date(metrics.fetchedAt).toLocaleDateString()}
        </span>
      </header>

      {/* Primary row — 4 big stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Authority"
          value={metrics.rankNormalised ?? "—"}
          suffix={metrics.rankNormalised != null ? "/100" : undefined}
          sublabel={
            metrics.rank != null
              ? `Rank ${metrics.rank} (raw 0-1000)`
              : backlinksErr
                ? "Activate Backlinks subscription"
                : "No backlink data"
          }
          accentMissing={metrics.rankNormalised == null}
        />
        <Stat
          label="Organic keywords"
          value={fmtNum(metrics.organicKeywords)}
          sublabel={
            metrics.organicCount
              ? `Top 3: ${metrics.organicCount.top3} · Top 10: ${metrics.organicCount.top10} · Top 100: ${metrics.organicCount.top100}`
              : undefined
          }
        />
        <Stat
          label="Est. monthly organic traffic"
          value={fmtNum(roundN(metrics.organicEtv, 0))}
          sublabel="ETV — clicks proxy"
        />
        <Stat
          label="Referring domains"
          value={fmtNum(metrics.referringDomains)}
          sublabel={
            metrics.referringDomains != null
              ? metrics.backlinks != null
                ? `${fmtNum(metrics.backlinks)} total backlinks`
                : undefined
              : backlinksErr
                ? "Activate Backlinks subscription"
                : "No data"
          }
          accentMissing={metrics.referringDomains == null}
        />
      </div>

      {/* Secondary row — 4 smaller stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Total backlinks"
          value={fmtNum(metrics.backlinks)}
          sublabel={
            metrics.dofollow != null && metrics.backlinks != null && metrics.backlinks > 0
              ? `${Math.round((metrics.dofollow / metrics.backlinks) * 100)}% dofollow`
              : undefined
          }
          accentMissing={metrics.backlinks == null}
        />
        <Stat
          label="Broken backlinks"
          value={fmtNum(metrics.brokenBacklinks)}
          sublabel={
            metrics.brokenBacklinks != null && metrics.backlinks
              ? `${Math.round((metrics.brokenBacklinks / metrics.backlinks) * 100)}% of total`
              : undefined
          }
          tone={
            metrics.brokenBacklinks != null && metrics.brokenBacklinks > 0
              ? "warn"
              : "default"
          }
          accentMissing={metrics.brokenBacklinks == null}
        />
        <Stat
          label="Paid keywords"
          value={fmtNum(metrics.paidKeywords)}
          sublabel={
            metrics.paidKeywords != null && metrics.paidKeywords > 0
              ? "Active paid campaigns"
              : "No paid presence"
          }
        />
        <Stat
          label="Top keywords (≤10)"
          value={metrics.organicCount?.top10 ?? "—"}
          sublabel={
            metrics.organicCount
              ? `Top 3: ${metrics.organicCount.top3} · 11-100: ${metrics.organicCount.top100 - metrics.organicCount.top10}`
              : undefined
          }
        />
      </div>

      {backlinksErr && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-200">
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
            </a>{" "}
            to populate Authority, Referring Domains, and Backlinks cards.
          </div>
        </div>
      )}

      {metrics.topKeywords && metrics.topKeywords.length > 0 && (
        <div className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.025] p-4">
          <header className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Top ranked keywords
            </h3>
            <span className="text-[10px] uppercase tracking-[0.13em] text-white/35">
              by estimated traffic · {metrics.topKeywords.length} shown
            </span>
          </header>
          <div className="max-h-[480px] overflow-y-auto rounded-md border border-white/5 print:max-h-none print:overflow-visible">
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
                {metrics.topKeywords.map((k, i) => (
                  <tr key={i} className="border-b border-white/5 text-white/85">
                    <td className="px-2 py-1.5 text-white/45">{i + 1}</td>
                    <td className="px-2 py-1.5 font-medium">{k.keyword}</td>
                    <td className="px-2 py-1.5 text-right">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${posBadge(k.position)}`}
                      >
                        {k.position}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {fmtNum(k.searchVolume)}
                    </td>
                    <td className="px-2 py-1.5 text-white/55">
                      {k.intent ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right text-white/60">
                      {k.cpc != null ? `$${k.cpc.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {fmtNum(roundN(k.estTraffic, 1))}
                    </td>
                    <td className="max-w-[200px] truncate px-2 py-1.5 text-[11px] text-white/45">
                      {k.url ? relativePath(k.url, metrics.target) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
  sublabel,
  tone = "default",
  accentMissing = false,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  sublabel?: string;
  tone?: "default" | "warn";
  accentMissing?: boolean;
}) {
  const border =
    tone === "warn"
      ? "border-amber-400/25"
      : accentMissing
        ? "border-white/8"
        : "border-white/10";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${border} bg-white/[0.025] p-4`}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tracking-tight ${accentMissing ? "text-white/40" : "text-white"}`}
      >
        {value}
        {suffix && (
          <span className="ml-0.5 text-sm text-white/45">{suffix}</span>
        )}
      </div>
      {sublabel && (
        <div className="mt-1 text-[11px] text-white/45">{sublabel}</div>
      )}
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
