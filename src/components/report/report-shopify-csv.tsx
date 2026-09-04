"use client";

// Importar os números da Shopify por CSV — o caminho que funciona com a conta
// de colaborador da agência.
//
// Desde 1 de janeiro de 2026 a Shopify deixou de permitir criar «legacy custom
// apps» no admin da loja e mandou o desenvolvimento para o Dev Dashboard
// (dev.shopify.com), onde as contas de COLABORADOR não entram. Sem token, a
// Admin API está fechada para a maioria das lojas dos nossos clientes. O que a
// conta de colaborador CONTINUA a poder fazer é exportar CSV do admin — e é
// isso que este cartão lê (Orders → Export, ou Analytics → Sales over time /
// Sales by product), reconhecendo o formato sozinho.
//
// Os meses ficam gravados no cliente (report-config, KV), não no relatório:
// importa-se uma vez e a coluna homóloga do ano seguinte já vem preenchida,
// mesmo depois de um «Regenerar».

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Check,
  Upload,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  ClipboardPaste,
} from "lucide-react";
import {
  parseShopifyCsv,
  type ShopifyCsvMonthEntry,
  type ShopifyCsvParse,
  type ShopifyCsvProduct,
} from "@/lib/report/shopify-csv";
import { periodFromKey } from "@/lib/report/report-dates";
import { formatDate } from "@/lib/dates";

const KIND_LABEL: Record<string, string> = {
  orders: "Export de encomendas (Orders → Export)",
  "sales-over-time": "Relatório «Sales over time»",
  "sales-by-product": "Relatório «Sales by product»",
};

const monthLabel = (key: string) => {
  try {
    return periodFromKey(key).label;
  } catch {
    return key;
  }
};

const money = (n: number, currency: string) =>
  `${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export function ReportShopifyCsv({
  slug,
  period,
  needed,
  imported,
  importedProducts,
  currency,
}: {
  slug: string;
  /** Mês do relatório — destino dos produtos num export sem datas. */
  period: string;
  /** As colunas da tabela e-commerce, com o que já está resolvido. */
  needed: { key: string; label: string; hasMoney: boolean }[];
  imported: Record<string, ShopifyCsvMonthEntry>;
  importedProducts: Record<string, ShopifyCsvProduct[]>;
  currency: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ShopifyCsvParse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const importedKeys = Object.keys(imported).sort().reverse();

  function read(text: string, name?: string) {
    setErr(null);
    setSaved(null);
    setFileName(name ?? null);
    setParsed(parseShopifyCsv(text, { targetMonth: period }));
  }

  async function onFile(file: File | undefined | null) {
    if (!file) return;
    try {
      read(await file.text(), file.name);
    } catch {
      setErr("Não consegui ler o ficheiro.");
    }
  }

  async function save(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setErr(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/reports/${slug}/config`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setSaved(done);
      setParsed(null);
      setRaw("");
      setFileName(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
    } finally {
      setBusy(false);
    }
  }

  function importNow() {
    if (!parsed || parsed.status !== "ok") return;
    const months = Object.fromEntries(
      parsed.months.map((m) => [m.key, { revenue: m.revenue, orders: m.orders }]),
    );
    const body: Record<string, unknown> = {
      shopifyCsvImport: { months, products: parsed.productsByMonth },
    };
    if (parsed.currency && /^[A-Za-z]{3}$/.test(parsed.currency)) {
      body.currency = parsed.currency;
    }
    const n = parsed.months.length;
    void save(
      body,
      n > 0
        ? `${n} mês(es) importado(s) — regenera o relatório para entrarem na tabela.`
        : "Produtos importados — regenera o relatório para entrarem na tabela.",
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-400/25 bg-amber-500/[0.07] px-3 py-2.5 text-[12px] leading-relaxed text-amber-100/85">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          Sem token? É por aqui.
        </span>{" "}
        Desde 1 de janeiro de 2026 a Shopify já não deixa criar custom apps no
        admin da loja, e as contas de colaborador (as nossas) não entram no Dev
        Dashboard onde as apps passaram a viver. O export de CSV, esse, a conta
        de colaborador faz — e dá os mesmos números.
      </div>

      <details className="rounded-lg border border-white/10 bg-white/[0.02]">
        <summary className="cursor-pointer select-none list-none px-3 py-2 text-[12px] text-white/55 transition hover:text-white/80 [&::-webkit-details-marker]:hidden">
          Como exportar o CSV na Shopify (30 segundos)
        </summary>
        <div className="space-y-2.5 border-t border-white/8 px-3 py-2.5 text-[12px] leading-relaxed text-white/50">
          <p>
            <b className="text-white/70">Melhor opção — encomendas.</b> Admin da
            loja → <b>Orders</b> → filtro de datas do mês → <b>Export</b> →{" "}
            <i>Current search</i> + <i>Plain CSV file</i>. Traz receita,
            encomendas <i>e</i> produtos de uma vez. Acima de ~50 encomendas a
            Shopify manda o ficheiro por email.
          </p>
          <p>
            <b className="text-white/70">Alternativa — relatórios.</b> Admin →{" "}
            <b>Analytics → Reports</b> → <i>Sales over time</i> (receita e
            encomendas por dia/mês) e <i>Sales by product</i> (produtos), cada um
            com <b>Export</b>.
          </p>
          <p>
            Podes exportar os 3 meses e o homólogo de uma vez (intervalo de 13
            meses) e importar aqui uma única vez — cada mês fica gravado no
            cliente e volta sozinho nos relatórios seguintes.
          </p>
          <p className="text-white/40">
            Se o menu <i>Orders</i> ou <i>Analytics</i> não aparecer, a conta de
            colaborador não tem essas permissões: pede ao cliente para as ligar
            em <i>Settings → Users → Collaborators</i>. É bem mais simples do que
            pedir um token.
          </p>
        </div>
      </details>

      {/* O que este relatório precisa */}
      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
          Meses que este relatório precisa
        </p>
        <div className="flex flex-wrap gap-1.5">
          {needed.map((c) => {
            const has = c.hasMoney || Boolean(imported[c.key]);
            return (
              <span
                key={c.key}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] ${
                  has
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200/90"
                    : "border-amber-400/25 bg-amber-500/10 text-amber-100/85"
                }`}
              >
                {has ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {c.label}
                <span className="opacity-60">
                  {c.hasMoney ? "ok" : imported[c.key] ? "CSV" : "falta"}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Zona de largar / escolher ficheiro */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFile(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-xl border border-dashed px-4 py-5 text-center transition ${
          dragging
            ? "border-[#783DF5]/60 bg-[#783DF5]/[0.08]"
            : "border-white/15 bg-white/[0.02]"
        }`}
      >
        <FileSpreadsheet className="mx-auto mb-2 h-6 w-6 text-white/30" />
        <p className="mb-3 text-[12.5px] text-white/55">
          Larga aqui o CSV da Shopify — ou escolhe o ficheiro.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.09]"
          >
            <Upload className="h-3.5 w-3.5" />
            Escolher ficheiro
          </button>
          <button
            type="button"
            onClick={() => setPasting((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-white/55 transition hover:border-white/25 hover:text-white/85"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Colar texto
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {fileName && (
          <p className="mt-2 text-[11.5px] text-white/40">{fileName}</p>
        )}
      </div>

      {pasting && (
        <div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={() => raw.trim() && read(raw)}
            rows={5}
            placeholder="Cola aqui o conteúdo do CSV (com a linha de cabeçalho)…"
            className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 font-mono text-[11.5px] text-white/85 outline-none transition focus:border-[#783DF5]/50"
          />
          <button
            type="button"
            onClick={() => raw.trim() && read(raw)}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-white/60 transition hover:border-white/25 hover:text-white/85"
          >
            Ler o texto colado
          </button>
        </div>
      )}

      {/* Pré-visualização */}
      {parsed?.status === "error" && (
        <p className="rounded-lg border border-rose-400/25 bg-rose-500/[0.07] px-3 py-2 text-[12px] text-rose-200/90">
          {parsed.message}
        </p>
      )}

      {parsed?.status === "ok" && (
        <div className="rounded-xl border border-white/12 bg-white/[0.03] p-3.5">
          <p className="mb-2 text-[12px] text-white/60">
            <b className="text-white/85">{KIND_LABEL[parsed.kind] ?? parsed.kind}</b>{" "}
            · {parsed.rows.toLocaleString("pt-PT")} linhas lidas
            {parsed.currency ? ` · ${parsed.currency}` : ""}
          </p>
          {parsed.warnings.map((w) => (
            <p key={w} className="mb-1.5 text-[11.5px] text-amber-200/80">
              {w}
            </p>
          ))}
          {parsed.months.length > 0 && (
            <table className="mb-2 w-full text-left text-[12px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-white/35">
                  <th className="py-1 font-medium">Mês</th>
                  <th className="py-1 text-right font-medium">Encomendas</th>
                  <th className="py-1 text-right font-medium">Receita</th>
                  <th className="py-1 text-right font-medium">Produtos</th>
                </tr>
              </thead>
              <tbody>
                {parsed.months.map((m) => {
                  const used = needed.some((c) => c.key === m.key);
                  return (
                    <tr
                      key={m.key}
                      className={`border-t border-white/8 ${used ? "text-white/85" : "text-white/40"}`}
                    >
                      <td className="py-1">
                        {monthLabel(m.key)}
                        {used && (
                          <span className="ml-1.5 text-[10px] uppercase text-emerald-300/80">
                            neste relatório
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {m.orders.toLocaleString("pt-PT")}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {money(m.revenue, parsed.currency ?? currency)}
                      </td>
                      <td className="py-1 text-right tabular-nums text-white/45">
                        {parsed.productsByMonth[m.key]?.length ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {parsed.months.length === 0 &&
            Object.keys(parsed.productsByMonth).length > 0 && (
              <p className="mb-2 text-[12px] text-white/60">
                {Object.values(parsed.productsByMonth)[0]?.length ?? 0} produtos
                para {monthLabel(Object.keys(parsed.productsByMonth)[0])} — este
                formato não traz receita mensal.
              </p>
            )}
          <button
            type="button"
            onClick={importNow}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Importar
          </button>
        </div>
      )}

      {/* Já importado */}
      {importedKeys.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">
              Meses gravados ({importedKeys.length})
            </p>
            <button
              type="button"
              onClick={() => void save({ shopifyCsvClear: "all" }, "Importações apagadas.")}
              disabled={busy}
              className="text-[11.5px] text-white/40 transition hover:text-rose-300 disabled:opacity-50"
            >
              Apagar tudo
            </button>
          </div>
          <div className="divide-y divide-white/8 rounded-lg border border-white/10">
            {importedKeys.map((k) => (
              <div key={k} className="flex items-center gap-3 px-3 py-1.5 text-[12px]">
                <span className="min-w-[110px] text-white/80">{monthLabel(k)}</span>
                <span className="tabular-nums text-white/55">
                  {imported[k].orders.toLocaleString("pt-PT")} enc.
                </span>
                <span className="tabular-nums text-white/55">
                  {money(imported[k].revenue, currency)}
                </span>
                {(importedProducts[k]?.length ?? 0) > 0 && (
                  <span className="text-white/35">
                    {importedProducts[k].length} produtos
                  </span>
                )}
                <span className="ml-auto text-[11px] text-white/30">
                  {imported[k].importedAt ? formatDate(imported[k].importedAt) : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void save({ shopifyCsvClear: k }, `${monthLabel(k)} removido.`)}
                  disabled={busy}
                  className="rounded-md border border-white/10 p-1 text-white/35 transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
                  title="Remover este mês"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {saved && !busy && (
        <p className="text-[12px] text-emerald-300">{saved}</p>
      )}
      {err && <p className="text-[12px] text-rose-400">Não foi possível guardar: {err}</p>}
    </div>
  );
}
