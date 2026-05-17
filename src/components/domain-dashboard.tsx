"use client";

import { useEffect, useState } from "react";
import { ExternalLink, TrendingUp } from "lucide-react";
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
    if (metrics) return; // only need diagnostic when metrics is missing
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
            result was generated before metrics started flowing (or Phase 1
            failed before saving them). Run a new audit on the action page —
            the dashboard will populate.{" "}
            <a
              href="/api/diagnostics/dataforseo-test"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[color:var(--brand-purple)] hover:underline"
            >
              Test the API directly
              <ExternalLink className="h-2.5 w-2.5" />
            </a>{" "}
            to verify credentials work.
          </p>
        ) : (
          <p className="mt-3 text-xs text-white/55">
            Connect <strong className="text-white/80">DataforSEO</strong> to
            see Authority Score, organic keyword count + traffic estimate,
            referring domains, and the top ranked keywords for this site at
            the top of every audit.{" "}
            <a
              href="https://app.dataforseo.com/register"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[color:var(--brand-purple)] hover:underline"
            >
              Sign up → set DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD in Vercel
              env.
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </p>
        )}
      </section>
    );
  }

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Authority"
          value={metrics.rankNormalised ?? "—"}
          suffix={metrics.rankNormalised != null ? "/100" : undefined}
          sublabel={`Rank ${metrics.rank ?? "—"} (raw)`}
        />
        <Stat
          label="Organic keywords"
          value={fmtNum(metrics.organicKeywords)}
          sublabel={
            metrics.organicCount
              ? `Top 3: ${metrics.organicCount.top3} · Top 10: ${metrics.organicCount.top10}`
              : undefined
          }
        />
        <Stat
          label="Est. monthly organic traffic"
          value={fmtNum(metrics.organicEtv)}
          sublabel="ETV — clicks proxy"
        />
        <Stat
          label="Referring domains"
          value={fmtNum(metrics.referringDomains)}
          sublabel={
            metrics.backlinks != null
              ? `${fmtNum(metrics.backlinks)} backlinks · ${fmtNum(metrics.dofollow)} dofollow`
              : undefined
          }
        />
      </div>

      {metrics.topKeywords && metrics.topKeywords.length > 0 && (
        <div className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.025] p-4">
          <header className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Top ranked keywords
            </h3>
            <span className="text-[10px] uppercase tracking-[0.13em] text-white/35">
              by estimated traffic
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.08em] text-white/55">
                <tr>
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Keyword</th>
                  <th className="px-2 py-1.5 text-right">Pos</th>
                  <th className="px-2 py-1.5 text-right">Volume</th>
                  <th className="px-2 py-1.5">Intent</th>
                  <th className="px-2 py-1.5 text-right">ETV</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topKeywords.slice(0, 15).map((k, i) => (
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
                    <td className="px-2 py-1.5 text-right">
                      {fmtNum(k.estTraffic)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {metrics.errors.length > 0 && (
        <p className="text-[11px] text-yellow-300/80">
          Partial data — {metrics.errors.length} sub-pull
          {metrics.errors.length === 1 ? "" : "s"} failed:{" "}
          {metrics.errors.map((e) => e.source).join(", ")}
        </p>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
  sublabel,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  sublabel?: string;
}) {
  return (
    <div className="brand-gradient-border relative overflow-hidden rounded-2xl bg-white/[0.025] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
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

function posBadge(pos: number): string {
  if (pos <= 3) return "bg-emerald-400/15 text-emerald-200";
  if (pos <= 10) return "bg-sky-400/15 text-sky-200";
  if (pos <= 20) return "bg-amber-400/15 text-amber-200";
  return "bg-white/[0.06] text-white/55";
}

function locationName(code: number): string {
  // DataforSEO uses Google geo codes. Adding the ones our clients sit in.
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
