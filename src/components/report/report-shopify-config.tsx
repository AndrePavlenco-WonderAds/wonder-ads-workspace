"use client";

// Ligação Shopify do cliente e-commerce — o fallback de receita/encomendas/
// produtos quando o GA4 não tem purchase tracking. O token grava-se no
// report-config (KV) e NUNCA volta ao browser: aqui só se sabe se existe.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Store, Trash2 } from "lucide-react";

export function ReportShopifyConfig({
  slug,
  shopDomain,
  currency,
  tokenSet,
}: {
  slug: string;
  shopDomain: string | null;
  currency: string;
  tokenSet: boolean;
}) {
  const router = useRouter();
  const [domain, setDomain] = useState(shopDomain ?? "");
  const [token, setToken] = useState("");
  const [cur, setCur] = useState(currency);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/reports/${slug}/config`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setToken("");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const body: Record<string, unknown> = {
      shopifyShopDomain: domain.trim(),
      currency: cur.trim(),
    };
    // O token só vai quando foi mesmo escrito — um save sem mexer no campo
    // não pode apagar o que está gravado.
    if (token.trim()) body.shopifyAccessToken = token.trim();
    void submit(body);
  }

  return (
    <div className="brand-gradient-border mb-4 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <Store className="h-4 w-4 text-[#b79bff]" />
        <h3 className="text-sm font-semibold text-white/85">Ligação Shopify</h3>
        {tokenSet ? (
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
            token gravado
          </span>
        ) : (
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            por ligar
          </span>
        )}
      </div>
      <p className="mb-4 text-[12px] leading-relaxed text-white/45">
        Fallback de receita, transações e produtos quando o GA4 do cliente não
        tem purchase tracking — os totais vêm da <b>loja inteira</b> (todos os
        canais) e o relatório etiqueta-os como tal. No admin da loja:{" "}
        <b>Settings → Apps and sales channels → Develop apps</b> → criar app com
        os scopes <code className="rounded bg-white/10 px-1">read_orders</code> e{" "}
        <code className="rounded bg-white/10 px-1">read_all_orders</code> (sem o
        segundo só saem os últimos 60 dias — a coluna homóloga precisa de 1 ano)
        e colar aqui o Admin API access token (<code className="rounded bg-white/10 px-1">shpat_…</code>).
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_92px]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-white/55">
            Domínio da loja
          </span>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="loja.myshopify.com"
            className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/90 outline-none transition focus:border-[#783DF5]/50"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-white/55">
            Admin API access token {tokenSet && "(deixar vazio mantém o atual)"}
          </span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={tokenSet ? "••••••••" : "shpat_…"}
            type="password"
            autoComplete="off"
            className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/90 outline-none transition focus:border-[#783DF5]/50"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-white/55">
            Moeda
          </span>
          <input
            value={cur}
            onChange={(e) => setCur(e.target.value.toUpperCase())}
            placeholder="EUR"
            maxLength={3}
            className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-center text-[12.5px] uppercase text-white/90 outline-none transition focus:border-[#783DF5]/50"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Guardar ligação
        </button>
        {tokenSet && (
          <button
            type="button"
            onClick={() => void submit({ shopifyAccessToken: null })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-[12px] font-medium text-white/55 transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover token
          </button>
        )}
        {saved && !busy && <span className="text-[12px] text-emerald-300">Guardado ✓ — regenera o relatório para puxar.</span>}
        {err && <span className="text-[12px] text-rose-400">Não foi possível guardar: {err}</span>}
      </div>
    </div>
  );
}
