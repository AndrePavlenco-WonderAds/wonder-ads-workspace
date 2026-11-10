"use client";

// Plugin WordPress «WonderAds — IA no site» de um cliente (v78.87): onde se
// cola a chave que o plugin mostra e se testa a ligação. A chave grava-se no
// report-config (KV) e NUNCA volta ao browser — aqui só se sabe se existe.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Loader2, PlugZap, Trash2 } from "lucide-react";

type TestResult = {
  ok: boolean;
  reachedWordPress: boolean;
  message: string;
  plugin: string | null;
  cache: string[];
  cacheHeaders: Record<string, string>;
  agents?: { key: string; reached: number; attempts: number; cacheStatus: (string | null)[] }[];
  thisMonth: Record<string, number> | null;
  crawlersThisMonth?: Record<string, number> | null;
  since?: string | null;
};

const LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  mistral: "Mistral",
};

export function ReportAiPluginConfig({
  slug,
  site,
  defaultSite,
  keySet,
}: {
  slug: string;
  site: string | null;
  /** O website do cliente, para pré-preencher. */
  defaultSite: string | null;
  keySet: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(site ?? defaultSite ?? "");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "clear" | null>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);

  async function put(body: Record<string, unknown>, kind: "save" | "clear"): Promise<boolean> {
    setBusy(kind);
    setErr(null);
    setSaved(false);
    setTest(null);
    try {
      const res = await fetch(`/api/reports/${slug}/config`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setKey("");
      setSaved(true);
      router.refresh();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const body: Record<string, unknown> = { aiVisibilitySite: url.trim() || null };
    // A chave só vai quando foi escrita — guardar sem mexer no campo não a apaga.
    if (key.trim()) body.aiVisibilityKey = key.trim();
    const willBeConnected = Boolean(url.trim()) && (keySet || Boolean(key.trim()));
    // Testa logo a seguir: uma chave colada no cliente errado (ou um site sem
    // o plugin) aparece aqui, e não só no relatório do mês seguinte.
    if ((await put(body, "save")) && willBeConnected) await runTest();
  }

  async function runTest() {
    setBusy("test");
    setErr(null);
    setTest(null);
    try {
      const res = await fetch(`/api/reports/${slug}/ai-visibility/test`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as TestResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setTest(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
    } finally {
      setBusy(null);
    }
  }

  const connected = Boolean(site) && keySet;

  return (
    <div className="p-5">
      <p className="mb-3 text-[12px] leading-relaxed text-white/45">
        Conta, no próprio site, as vezes que o ChatGPT, o Claude, o Perplexity e o
        Mistral abrem páginas para responder a alguém — também nas apps, que o GA4
        não vê. Só para sites WordPress. Os números entram na secção AI
        Visibility dos relatórios gerados depois de ligado.
      </p>

      <ol className="mb-4 list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-white/55">
        <li>
          <a
            href="/seo/plugin/wonderads-ia-no-site.zip"
            download
            className="inline-flex items-center gap-1 text-[#c9b2ff] underline-offset-2 hover:underline"
          >
            <Download className="h-3 w-3" />
            Descarregar o plugin (.zip)
          </a>
        </li>
        <li>No WordPress do cliente: Plugins → Adicionar novo → Carregar plugin → Ativar.</li>
        <li>Definições → WonderAds IA → copiar a chave e colá-la aqui → Guardar → Testar.</li>
      </ol>

      <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-white/50">Endereço do site</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.cliente.pt"
            className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/60"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-white/50">
            Chave do plugin {keySet && <span className="text-emerald-300/80">· gravada</span>}
          </span>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={keySet ? "•••••••• (escreve só para trocar)" : "cola aqui a chave"}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 font-mono text-[12px] text-white outline-none placeholder:font-sans placeholder:text-white/25 focus:border-[#783DF5]/60"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#783DF5] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Guardar
        </button>
        <button
          type="button"
          onClick={runTest}
          disabled={busy !== null || !connected}
          title={connected ? undefined : "Grava primeiro o endereço e a chave"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/80 transition hover:border-[#783DF5]/50 hover:text-white disabled:opacity-40"
        >
          {busy === "test" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
          Testar
        </button>
        {connected && (
          <button
            type="button"
            onClick={() => void put({ aiVisibilitySite: null, aiVisibilityKey: null }, "clear")}
            disabled={busy !== null}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-white/40 transition hover:text-red-300"
          >
            {busy === "clear" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Desligar
          </button>
        )}
        {saved && <span className="text-[11px] text-emerald-300/80">Gravado.</span>}
      </div>

      {err && <p className="mt-2.5 text-[12px] text-red-300/90">{err}</p>}

      {test && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed ${
            test.ok
              ? "border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-100/85"
              : "border-amber-400/25 bg-amber-500/[0.07] text-amber-100/85"
          }`}
        >
          <p>{test.message}</p>
          {test.plugin && (
            <p className="mt-1 text-white/45">
              Plugin {test.plugin}
              {test.cache.length > 0 && ` · cache: ${test.cache.join(", ")}`}
              {Object.keys(test.cacheHeaders).length > 0 &&
                ` · ${Object.entries(test.cacheHeaders)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}`}
            </p>
          )}
          {test.agents && test.agents.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {test.agents.map((a) => {
                const all = a.attempts > 0 && a.reached === a.attempts;
                return (
                  <li
                    key={a.key}
                    title={a.cacheStatus.map((c, i) => `pedido ${i + 1}: ${c ?? "sem cabeçalho de cache"}`).join(" · ")}
                    className={`rounded-md border px-2 py-0.5 text-[11px] ${
                      all
                        ? "border-emerald-400/30 text-emerald-200/90"
                        : a.reached > 0
                          ? "border-amber-400/30 text-amber-200/90"
                          : "border-red-400/30 text-red-200/85"
                    }`}
                  >
                    {LABEL[a.key] ?? a.key} {a.reached}/{a.attempts} chegaram
                  </li>
                );
              })}
            </ul>
          )}
          {test.thisMonth && (
            <p className="mt-2 text-white/55">
              Este mês:{" "}
              {Object.entries(test.thisMonth)
                .map(([k, n]) => `${LABEL[k] ?? k} ${n}`)
                .join(" · ")}
              {test.since && ` · a contar desde ${test.since.split("-").reverse().join("/")}`}
            </p>
          )}
          {test.crawlersThisMonth && Object.keys(test.crawlersThisMonth).length > 0 && (
            <p className="mt-1 text-white/40">
              Robôs de indexação/treino este mês (não entram no relatório):{" "}
              {Object.entries(test.crawlersThisMonth)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => `${k} ${n}`)
                .join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
