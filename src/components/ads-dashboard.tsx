"use client";

// Full-width ADS performance dashboard for a single client. Shows ONLY
// real platform data — when Google/Meta isn't connected it surfaces the
// "Conectar API" prompt and empty metrics instead of fabricated numbers.
//
// Layout (top → bottom): controls (window + Export PDF) · platform tabs ·
// connect alert · KPI snapshot · top campaigns + conversions chart ·
// Reports automáticos. The client brief / files live BELOW this, rendered
// by the page.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Target,
  TrendingUp,
  MousePointerClick,
  Coins,
  Wallet,
  Trophy,
  BarChart3,
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Plus,
  Trash2,
  ArrowUpRight,
  LayoutGrid,
} from "lucide-react";
import type {
  AdsPerformance,
  AdsPlatform,
  PlatformFilter,
  AdsWindow,
  AdsKpis,
} from "@/lib/ads/ads-data";
import type { AdsReport } from "@/lib/ads/ads-reports-store";
import { formatDate } from "@/lib/dates";

const PLATFORM_META: Record<AdsPlatform, { label: string; color: string }> = {
  google: { label: "Google Ads", color: "#4285F4" },
  meta: { label: "Meta Ads", color: "#E1306C" },
};

function eur(n: number): string {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${Math.round(n)}`;
}

type WindowMode = AdsWindow["mode"];

export function AdsDashboard({
  slug,
  channels,
  initialPerformance,
  initialReports,
}: {
  slug: string;
  channels: AdsPlatform[];
  initialPerformance: AdsPerformance;
  initialReports: AdsReport[];
}) {
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [windowMode, setWindowMode] = useState<WindowMode>("week");
  const [days, setDays] = useState(30);
  const [perf, setPerf] = useState<AdsPerformance>(initialPerformance);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<AdsReport[]>(initialReports);
  const [generating, setGenerating] = useState(false);

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    p.set("platform", platform);
    p.set("window", windowMode);
    if (windowMode === "days") p.set("days", String(days));
    return p.toString();
  }, [platform, windowMode, days]);

  // Refetch real data on any control change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/ads/${slug}/performance?${buildQuery()}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { performance: AdsPerformance };
        if (!cancelled) setPerf(json.performance);
      } catch {
        /* keep prior state */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, buildQuery]);

  // Which of the relevant platforms are missing a connection?
  const missing = useMemo<AdsPlatform[]>(() => {
    const relevant: AdsPlatform[] =
      platform === "all" ? channels : channels.includes(platform) ? [platform] : [];
    return relevant.filter((c) => !perf.connected[c]);
  }, [platform, channels, perf.connected]);

  const kpis = perf.kpis;

  async function generateReport() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/ads/${slug}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          windowMode,
          days: windowMode === "days" ? days : undefined,
          kind:
            windowMode === "week"
              ? "Report semanal"
              : windowMode === "month"
                ? "Report mensal"
                : windowMode === "quarter"
                  ? "Report trimestral"
                  : "Report",
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { report: AdsReport };
        setReports((prev) => [json.report, ...prev]);
        window.open(`/ads/${slug}/report/${json.report.id}`, "_blank");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function deleteReport(id: string) {
    const res = await fetch(`/api/ads/${slug}/reports?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const json = (await res.json()) as { reports: AdsReport[] };
      setReports(json.reports);
    }
  }

  const platformTabs: Array<{ key: PlatformFilter; label: string; Icon: typeof LayoutGrid }> = [
    { key: "all", label: "Todas as plataformas", Icon: LayoutGrid },
    ...channels.map((c) => ({
      key: c as PlatformFilter,
      label: PLATFORM_META[c].label,
      Icon: BarChart3,
    })),
  ];

  return (
    <div className="animate-fade-up mt-8">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WindowSelector
          mode={windowMode}
          days={days}
          onMode={setWindowMode}
          onDays={setDays}
        />
        <button
          type="button"
          onClick={generateReport}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/[0.08] disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export PDF
          <ArrowUpRight className="h-3.5 w-3.5 text-white/40" />
        </button>
      </div>

      {/* Platform tabs */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {platformTabs.map(({ key, label, Icon }) => {
          const active = platform === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPlatform(key)}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition ${
                active
                  ? "border-[#783DF5]/50 bg-[#783DF5]/15 text-white"
                  : "border-white/10 bg-white/[0.02] text-white/55 hover:border-white/25 hover:text-white/80"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Connect alert */}
      {missing.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/45 bg-amber-500/[0.08] px-4 py-3.5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-amber-100">
              Atenção! Conectar a API —{" "}
              {missing.map((m) => PLATFORM_META[m].label).join(" e ")}
            </div>
            <div className="text-[11.5px] text-amber-200/70">
              Sem ligação à plataforma os dados não podem ser mostrados. Liga a
              conta para puxar métricas reais (nada é estimado nem inventado).
            </div>
          </div>
          <span className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[11.5px] font-semibold text-amber-100">
            Por conectar
          </span>
        </div>
      )}

      {/* KPI snapshot */}
      <div className="mt-6">
        <SectionLabel>KPI Snapshot · {windowLabelOf(windowMode, days)}</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi Icon={Target} label="Conversões" value={kpis ? String(kpis.conversions) : "—"} sub={kpiSub(kpis, "Google + Meta")} loading={loading} />
          <Kpi Icon={TrendingUp} label="ROAS" value={kpis ? `${kpis.roas.toFixed(1)}x` : "—"} sub={kpiSub(kpis, "Combinado")} loading={loading} />
          <Kpi Icon={MousePointerClick} label="CTR" value={kpis ? `${kpis.ctr.toFixed(1)}%` : "—"} sub={kpiSub(kpis, "Google + Meta")} loading={loading} />
          <Kpi Icon={Coins} label="CPA" value={kpis ? eur(kpis.cpa) : "—"} sub={kpiSub(kpis, "Custo por conversão")} loading={loading} />
          <Kpi
            Icon={Wallet}
            label="Spend"
            value={kpis ? eur(kpis.spend) : "—"}
            sub={
              kpis
                ? kpis.budget != null
                  ? `de ${eur(kpis.budget)} orçamento`
                  : "no período"
                : "Conectar API"
            }
            loading={loading}
          />
        </div>
      </div>

      {/* Campaigns + chart */}
      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel
          title="Top campanhas por conversão"
          icon={<Trophy className="h-4 w-4 text-amber-300" />}
        >
          {perf.topCampaigns.length === 0 ? (
            <EmptyState connected={perf.anyConnected} />
          ) : (
            <ol className="space-y-2.5">
              {perf.topCampaigns.slice(0, 5).map((c, i) => (
                <li key={`${c.name}-${i}`} className="flex items-center gap-3">
                  <span className="w-4 text-right text-[12px] font-semibold text-white/35">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-white">
                      {c.name}
                    </div>
                    <span
                      className="mt-0.5 inline-block rounded border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.12em]"
                      style={{
                        borderColor: `${PLATFORM_META[c.platform].color}66`,
                        color: PLATFORM_META[c.platform].color,
                      }}
                    >
                      {PLATFORM_META[c.platform].label}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[13px] font-semibold text-white">
                      {c.conversions} conv
                    </div>
                    <div className="text-[11px] text-emerald-300">
                      ROAS {c.roas.toFixed(1)}x
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel
          title="Conversões por período"
          icon={<BarChart3 className="h-4 w-4 text-sky-300" />}
          legend
        >
          {perf.conversions.length === 0 ? (
            <EmptyState connected={perf.anyConnected} />
          ) : (
            <ConversionsChart points={perf.conversions} />
          )}
        </Panel>
      </div>

      {/* Reports automáticos */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-white/60" />
            <h2 className="text-[14px] font-semibold text-white">
              Reports automáticos
            </h2>
          </div>
          <button
            type="button"
            onClick={generateReport}
            disabled={generating}
            className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-[0_6px_22px_-4px_rgba(120,61,245,0.55)] transition hover:opacity-90 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Gerar report
          </button>
        </div>

        {reports.length === 0 ? (
          <p className="mt-4 text-[12.5px] text-white/40">
            Sem reports ainda. Gera um report para guardar um snapshot dos KPIs
            — fica aqui com a data do pedido e descarregável em PDF.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/8">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-white">
                    {r.kind} — {formatDate(r.requestedAt)}
                  </div>
                  <div className="truncate text-[11.5px] text-white/45">
                    {reportSummary(r.kpis)}
                  </div>
                </div>
                <a
                  href={`/ads/${slug}/report/${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/80 transition hover:border-white/35 hover:bg-white/[0.06]"
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </a>
                <button
                  type="button"
                  onClick={() => deleteReport(r.id)}
                  aria-label="Apagar report"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:border-rose-400/50 hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function windowLabelOf(mode: WindowMode, days: number): string {
  return mode === "week"
    ? "Esta semana"
    : mode === "month"
      ? "Este mês"
      : mode === "quarter"
        ? "Este trimestre"
        : `Últimos ${days} dias`;
}

function kpiSub(kpis: AdsKpis | null, connectedSub: string): string {
  return kpis ? connectedSub : "Conectar API";
}

function reportSummary(kpis: AdsKpis | null): string {
  if (!kpis) return "Sem dados — plataforma por conectar no momento do pedido";
  return `Conversões: ${kpis.conversions} · ROAS: ${kpis.roas.toFixed(1)}x · Spend: ${eur(kpis.spend)}`;
}

function WindowSelector({
  mode,
  days,
  onMode,
  onDays,
}: {
  mode: WindowMode;
  days: number;
  onMode: (m: WindowMode) => void;
  onDays: (d: number) => void;
}) {
  const opts: Array<{ key: WindowMode; label: string }> = [
    { key: "week", label: "Semana" },
    { key: "month", label: "Mês" },
    { key: "quarter", label: "Trimestre" },
    { key: "days", label: "Dias" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.02] p-1">
        {opts.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onMode(o.key)}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
              mode === o.key
                ? "bg-white/[0.10] text-white"
                : "text-white/55 hover:text-white/80"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {mode === "days" && (
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-1">
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => {
              const n = Number(e.target.value);
              onDays(Number.isFinite(n) ? Math.min(365, Math.max(1, n)) : 1);
            }}
            className="w-14 rounded-md bg-white/[0.04] px-2 py-1 text-right text-[12.5px] font-semibold text-white outline-none"
          />
          <span className="pr-1 text-[11.5px] text-white/45">dias</span>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDays(d)}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium transition ${
                days === d
                  ? "bg-[#783DF5]/30 text-white"
                  : "text-white/45 hover:text-white/75"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/45">
      {children}
    </div>
  );
}

function Kpi({
  Icon,
  label,
  value,
  sub,
  loading,
}: {
  Icon: typeof Target;
  label: string;
  value: string;
  sub: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-white/55">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11.5px] font-medium">{label}</span>
      </div>
      <div className="mt-1.5 text-[26px] font-bold leading-none tracking-tight text-white">
        {loading ? <span className="text-white/30">···</span> : value}
      </div>
      <div className="mt-1.5 text-[11px] text-white/40">{sub}</div>
    </div>
  );
}

function Panel({
  title,
  icon,
  legend,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  legend?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-[14px] font-semibold text-white">{title}</h2>
        </div>
        {legend && (
          <div className="flex items-center gap-3 text-[11px] text-white/50">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#4285F4]" /> Google
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#E1306C]" /> Meta
            </span>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ connected }: { connected: boolean }) {
  return (
    <div className="flex h-44 flex-col items-center justify-center gap-1.5 text-center">
      <p className="text-[12.5px] font-medium text-white/45">
        {connected ? "Sem dados para este período." : "Sem dados — conecta a API."}
      </p>
      <p className="max-w-xs text-[11px] text-white/30">
        Os dados são sempre puxados das plataformas, em tempo real. Nada é
        estimado nem inventado.
      </p>
    </div>
  );
}

function ConversionsChart({
  points,
}: {
  points: AdsPerformance["conversions"];
}) {
  const max = Math.max(
    1,
    ...points.flatMap((p) => [p.google ?? 0, p.meta ?? 0]),
  );
  return (
    <div className="flex h-44 items-end justify-between gap-2">
      {points.map((p, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex h-36 w-full items-end justify-center gap-1">
            <span
              className="w-1/3 rounded-t bg-[#4285F4]"
              style={{ height: `${((p.google ?? 0) / max) * 100}%` }}
            />
            <span
              className="w-1/3 rounded-t bg-[#E1306C]"
              style={{ height: `${((p.meta ?? 0) / max) * 100}%` }}
            />
          </div>
          <span className="text-[10.5px] text-white/40">{p.label}</span>
        </div>
      ))}
    </div>
  );
}
