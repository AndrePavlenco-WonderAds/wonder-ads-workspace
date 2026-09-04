"use client";

// Ligação Shopify do cliente e-commerce — o fallback de receita/encomendas/
// produtos quando o GA4 não tem purchase tracking. O token grava-se no
// report-config (KV) e NUNCA volta ao browser: aqui só se sabe se existe.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Store, Trash2, Copy } from "lucide-react";

export function ReportShopifyConfig({
  slug,
  shopDomain,
  currency,
  tokenSet,
  bare = false,
}: {
  slug: string;
  shopDomain: string | null;
  currency: string;
  tokenSet: boolean;
  /** Sem cartão nem cabeçalho próprios — para viver dentro de um disclosure
   *  que já traz ambos (v77.1). */
  bare?: boolean;
}) {
  const router = useRouter();
  const [domain, setDomain] = useState(shopDomain ?? "");
  const [token, setToken] = useState("");
  const [cur, setCur] = useState(currency);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"pt" | "en" | null>(null);

  /** O pedido pronto a enviar ao cliente — o consultor não tem de o escrever
   *  nem de ir procurar o caminho novo do Dev Dashboard. */
  function instructions(lang: "pt" | "en"): string {
    const shop = domain.trim() || "a-vossa-loja.myshopify.com";
    if (lang === "en") {
      return [
        "Hi! To pull your store's sales into the monthly SEO report, we need a read-only access token. It takes 2 minutes and only the store owner can do it:",
        "",
        "1. Go to https://dev.shopify.com and log in with the store owner account.",
        "2. Create a new app (name it e.g. \"Wonder Ads Reporting\").",
        "3. In the app's configuration, under Admin API access scopes, tick: read_orders and read_all_orders.",
        `4. Install the app on the store (${shop}). If it asks you to approve access to protected customer data, approve it.`,
        "5. Copy the Admin API access token (it starts with shpat_) and send it to us privately.",
        "",
        "The token is read-only — it can only read orders, never change anything — and you can revoke it at any time from the same page.",
      ].join("\n");
    }
    return [
      "Olá! Para levarmos as vendas da loja para o relatório mensal de SEO, precisamos de um token de leitura. São 2 minutos e só o dono da loja o pode criar:",
      "",
      "1. Entrar em https://dev.shopify.com com a conta de dono da loja.",
      "2. Criar uma app nova (por exemplo \"Wonder Ads Reporting\").",
      "3. Na configuração da app, em Admin API access scopes, ativar: read_orders e read_all_orders.",
      `4. Instalar a app na loja (${shop}). Se pedir para aprovar o acesso a dados protegidos de clientes, aprovar.`,
      "5. Copiar o Admin API access token (começa por shpat_) e enviar-nos em privado.",
      "",
      "O token é só de leitura — lê encomendas e mais nada — e pode ser revogado a qualquer momento na mesma página.",
    ].join("\n");
  }

  async function copy(lang: "pt" | "en") {
    try {
      await navigator.clipboard.writeText(instructions(lang));
      setCopied(lang);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setErr("O browser não deixou copiar — seleciona o texto à mão.");
    }
  }

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
    <div
      className={
        bare
          ? "p-5"
          : "brand-gradient-border mb-4 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md"
      }
    >
      {!bare && (
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
      )}
      <p className="mb-3 text-[12px] leading-relaxed text-white/45">
        Fallback de receita, transações e produtos quando o GA4 não tem purchase
        tracking — totais da <b>loja inteira</b> (todos os canais), etiquetados
        como tal no relatório. Com token, a puxada é automática todos os meses;
        sem token, o CSV faz o mesmo trabalho à mão.
      </p>
      <details className="mb-4 rounded-lg border border-white/10 bg-white/[0.02]">
        <summary className="cursor-pointer select-none list-none px-3 py-2 text-[12px] text-white/55 transition hover:text-white/80 [&::-webkit-details-marker]:hidden">
          Já não consigo criar a app — e agora?
        </summary>
        <div className="space-y-2.5 border-t border-white/8 px-3 py-2.5 text-[12px] leading-relaxed text-white/50">
          <p>
            <b className="text-white/75">O que mudou.</b> Desde{" "}
            <b>1 de janeiro de 2026</b> a Shopify já não deixa criar «legacy
            custom apps» no admin da loja, e o botão «Develop apps» passou a
            apontar para o Dev Dashboard (dev.shopify.com) — onde as contas de{" "}
            <b>colaborador</b>, que são as nossas, não entram. Com a nossa conta
            não há forma de gerar um <code className="rounded bg-white/10 px-1">shpat_…</code>.
          </p>
          <p>
            <b className="text-white/75">Saída 1 — CSV (imediata).</b> É o cartão
            aqui em cima. Exportamos nós, sem depender de ninguém.
          </p>
          <p>
            <b className="text-white/75">Saída 2 — o cliente cria a app.</b> O
            dono da loja (conta de staff, não colaborador) entra em{" "}
            <a
              href="https://dev.shopify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#b79bff] underline decoration-[#783DF5]/50 underline-offset-2 transition hover:text-white"
            >
              dev.shopify.com ↗
            </a>
            , cria a app, liga-a à loja com os scopes{" "}
            <code className="rounded bg-white/10 px-1">read_orders</code> e{" "}
            <code className="rounded bg-white/10 px-1">read_all_orders</code>{" "}
            (sem o segundo só saem 60 dias — a coluna homóloga precisa de 1 ano)
            e envia-nos o Admin API access token, que se cola aqui em baixo.
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => copy("pt")}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/12 px-2.5 py-1 text-[11.5px] font-medium text-white/60 transition hover:border-white/25 hover:text-white/85"
            >
              {copied === "pt" ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copiar instruções (PT)
            </button>
            <button
              type="button"
              onClick={() => copy("en")}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/12 px-2.5 py-1 text-[11.5px] font-medium text-white/60 transition hover:border-white/25 hover:text-white/85"
            >
              {copied === "en" ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copiar instruções (EN)
            </button>
          </div>
          <p className="text-white/35">
            O token é só de leitura de encomendas e o cliente revoga-o quando
            quiser, no mesmo sítio.
          </p>
        </div>
      </details>

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
