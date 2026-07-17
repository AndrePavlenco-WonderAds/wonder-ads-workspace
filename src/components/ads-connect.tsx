"use client";

// Per-client ADS platform connection panel on the ADS client page. The team
// pastes the Google Ads customer id and/or Meta ad account id; the shared
// app-level API credentials live in env. Once an id is saved (and the app
// creds exist) the platform is "connected" and the dashboard pulls real data.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plug, AlertTriangle, Link2 } from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import type { AdsConnectionConfig } from "@/lib/ads/ads-connections-store";
import type { AdsPlatform } from "@/lib/ads/ads-data";

type Row = {
  platform: AdsPlatform;
  label: string;
  iconId: string;
  field: "googleCustomerId" | "metaAdAccountId";
  placeholder: string;
  hint: string;
};

const ROWS: Record<AdsPlatform, Row> = {
  google: {
    platform: "google",
    label: "Google Ads",
    iconId: "google-ads",
    field: "googleCustomerId",
    placeholder: "Customer ID (ex: 123-456-7890)",
    hint: "O Customer ID da conta Google Ads do cliente.",
  },
  meta: {
    platform: "meta",
    label: "Meta Ads",
    iconId: "meta",
    field: "metaAdAccountId",
    placeholder: "Ad Account ID (ex: act_123456789)",
    hint: "O ID da conta publicitária Meta (Ad Account).",
  },
};

export function AdsConnect({
  slug,
  channels,
  initialConfig,
  appCreds,
}: {
  slug: string;
  channels: AdsPlatform[];
  initialConfig: AdsConnectionConfig;
  appCreds: { google: boolean; meta: boolean };
}) {
  const router = useRouter();
  const [config, setConfig] = useState<AdsConnectionConfig>(initialConfig);
  const [drafts, setDrafts] = useState<Record<string, string>>({
    googleCustomerId: initialConfig.googleCustomerId ?? "",
    metaAdAccountId: initialConfig.metaAdAccountId ?? "",
  });
  const [savingField, setSavingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(field: "googleCustomerId" | "metaAdAccountId") {
    setSavingField(field);
    setError(null);
    try {
      const res = await fetch(`/api/ads/${slug}/connections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: drafts[field] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setConfig(data.config);
      setDrafts({
        googleCustomerId: data.config.googleCustomerId ?? "",
        metaAdAccountId: data.config.metaAdAccountId ?? "",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar.");
    } finally {
      setSavingField(null);
    }
  }

  const rows = channels.map((c) => ROWS[c]).filter(Boolean);
  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <header className="mb-4 flex items-center gap-2.5">
        <span className="brand-gradient-bg flex h-8 w-8 items-center justify-center rounded-lg">
          <Plug className="h-4 w-4 text-white" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-white">Ligações de Plataforma</h2>
          <p className="text-[11px] text-white/45">
            Liga as contas para o dashboard puxar métricas reais (ROAS, CTR, CPA…).
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const saved = config[row.field];
          const hasAppCreds = appCreds[row.platform];
          const connected = Boolean(saved) && hasAppCreds;
          const draft = drafts[row.field] ?? "";
          const dirty = draft.trim() !== (saved ?? "");
          return (
            <div
              key={row.platform}
              className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
            >
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                  <PlatformIcon platform={row.iconId} className="h-6 w-6" />
                </span>
                <span className="text-sm font-semibold text-white">{row.label}</span>
                <span
                  className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    connected
                      ? "bg-emerald-500/12 text-emerald-300"
                      : "bg-amber-500/12 text-amber-200/80"
                  }`}
                >
                  {connected ? (
                    <>
                      <Check className="h-3 w-3" /> Ligado
                    </>
                  ) : (
                    "Por ligar"
                  )}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [row.field]: e.target.value }))
                  }
                  placeholder={row.placeholder}
                  className="flex-1 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 font-mono text-[13px] text-white outline-none transition focus:border-[#783DF5]/60 focus:bg-white/[0.06]"
                />
                <button
                  type="button"
                  onClick={() => save(row.field)}
                  disabled={!dirty || savingField === row.field}
                  className="brand-gradient-bg inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingField === row.field ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  Guardar
                </button>
              </div>

              <p className="mt-1.5 text-[11px] text-white/40">{row.hint}</p>

              {!hasAppCreds && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-200/80">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Credenciais de app em falta nas env vars — a ligação só puxa
                  dados depois de configuradas.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-[12px] text-rose-300">{error}</p>}
    </section>
  );
}
