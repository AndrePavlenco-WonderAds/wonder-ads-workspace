"use client";

// Preenchimento manual do bloco e-commerce: a tabela de conversão (célula a
// célula, com N/A), e as listas de páginas/produtos quando nenhuma fonte as
// puxou. Segue a gramática da grelha de canais: o que foi puxado (GA4/GSC/
// Shopify) mostra-se read-only com a proveniência; o que não foi, edita-se.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Ban, ShoppingCart, Plus, Trash2 } from "lucide-react";
import {
  ECOM_METRIC_KEYS,
  type EcomCell,
  type EcommerceBlock,
  type EcomMetricKey,
} from "@/lib/report/report-types";

const ROW_LABELS: Record<EcomMetricKey, string> = {
  revenue: "Receita",
  transactions: "Transações",
  conversionRate: "Conversão (%)",
  users: "Utilizadores",
  impressions: "Impressões",
  avgTicket: "Ticket médio",
};

const SOURCE_TAG: Record<string, string> = {
  ga4: "GA4",
  gsc: "GSC",
  shopify: "Shopify · loja inteira",
};

/** Editável = ainda não puxado por fonte nenhuma (pendente, manual ou N/A). */
function isEditable(cell: EcomCell): boolean {
  return cell.source === "manual" || cell.source === "na";
}

type Mode = "value" | "na" | "pending";
type CellState = { mode: Mode; value: string };

function initialCell(cell: EcomCell): CellState {
  if (cell.manualNa) return { mode: "na", value: "" };
  if (cell.value !== null && cell.source === "manual") {
    return { mode: "value", value: String(cell.value) };
  }
  return { mode: "pending", value: "" };
}

/** "1 234,56" → 1234.56 (aceita vírgula decimal à portuguesa). */
function parseNum(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function fmt(cell: EcomCell, key: EcomMetricKey, currency: string): string {
  if (cell.value === null) return "—";
  if (key === "revenue" || key === "avgTicket") {
    return `${cell.value.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
  if (key === "conversionRate") {
    return `${cell.value.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;
  }
  return Math.round(cell.value).toLocaleString("pt-PT");
}

type ListRow = { a: string; b: string; c: string };

export function ReportEcomInputs({
  slug,
  period,
  ecom,
}: {
  slug: string;
  period: string;
  ecom: EcommerceBlock;
}) {
  const router = useRouter();
  const cellKey = (colKey: string, metric: EcomMetricKey) => `${colKey}:${metric}`;

  const [cells, setCells] = useState<Record<string, CellState>>(() => {
    const out: Record<string, CellState> = {};
    for (const col of ecom.columns) {
      for (const k of ECOM_METRIC_KEYS) {
        if (isEditable(col.cells[k])) {
          out[cellKey(col.key, k)] = initialCell(col.cells[k]);
        }
      }
    }
    return out;
  });

  // Editores das listas — só quando nenhuma fonte as puxou (ou já são manuais):
  // com GA4/Shopify a alimentar, editar aqui só criaria números divergentes.
  const pagesEditable = ecom.topPagesSource === "manual";
  const productsEditable = ecom.topProductsSource === "manual";
  const [pageRows, setPageRows] = useState<ListRow[]>(() =>
    ecom.topPages.length
      ? ecom.topPages.map((p) => ({ a: p.page, b: String(p.views), c: "" }))
      : [{ a: "", b: "", c: "" }],
  );
  const [productRows, setProductRows] = useState<ListRow[]>(() =>
    ecom.topProducts.length
      ? ecom.topProducts.map((p) => ({
          a: p.name,
          b: String(p.revenue),
          c: p.quantity !== null ? String(p.quantity) : "",
        }))
      : [{ a: "", b: "", c: "" }],
  );

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const editableCount = useMemo(
    () => Object.keys(cells).length,
    [cells],
  );

  const setCell = (key: string, patch: Partial<CellState>) =>
    setCells((p) => ({ ...p, [key]: { ...p[key], ...patch } }));

  /** «N/A no resto» — valida de uma vez as células ainda vazias da coluna. */
  const naColumn = (colKey: string) =>
    setCells((p) => {
      const next = { ...p };
      for (const k of ECOM_METRIC_KEYS) {
        const key = cellKey(colKey, k);
        if (next[key] && next[key].mode === "pending") {
          next[key] = { mode: "na", value: "" };
        }
      }
      return next;
    });

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    const ecomCells: Record<string, Partial<Record<EcomMetricKey, number | "na" | null>>> = {};
    for (const col of ecom.columns) {
      for (const k of ECOM_METRIC_KEYS) {
        const st = cells[cellKey(col.key, k)];
        if (!st) continue;
        (ecomCells[col.key] ??= {});
        if (st.mode === "na") ecomCells[col.key][k] = "na";
        else if (st.mode === "value") ecomCells[col.key][k] = parseNum(st.value);
        else ecomCells[col.key][k] = null;
      }
    }
    const body: Record<string, unknown> = { ecomCells };
    if (pagesEditable) {
      body.ecomTopPages = pageRows
        .map((r) => ({ page: r.a.trim(), views: parseNum(r.b) ?? -1 }))
        .filter((r) => r.page && r.views >= 0);
    }
    if (productsEditable) {
      body.ecomTopProducts = productRows
        .map((r) => ({
          name: r.a.trim(),
          revenue: parseNum(r.b) ?? -1,
          quantity: parseNum(r.c),
        }))
        .filter((r) => r.name && r.revenue >= 0);
    }
    try {
      const res = await fetch(`/api/reports/${slug}/${period}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
    } finally {
      setBusy(false);
    }
  }

  const listEditor = (
    rows: ListRow[],
    setRows: (r: ListRow[]) => void,
    labels: { a: string; b: string; c?: string },
  ) => (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <span className="w-5 text-right text-[11px] text-white/35">{i + 1}</span>
          <input
            value={row.a}
            onChange={(e) =>
              setRows(rows.map((r, j) => (j === i ? { ...r, a: e.target.value } : r)))
            }
            placeholder={labels.a}
            className="min-w-[180px] flex-1 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/90 outline-none transition focus:border-[#783DF5]/50"
          />
          <input
            value={row.b}
            onChange={(e) =>
              setRows(rows.map((r, j) => (j === i ? { ...r, b: e.target.value } : r)))
            }
            placeholder={labels.b}
            inputMode="decimal"
            className="w-28 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/90 outline-none transition focus:border-[#783DF5]/50"
          />
          {labels.c && (
            <input
              value={row.c}
              onChange={(e) =>
                setRows(rows.map((r, j) => (j === i ? { ...r, c: e.target.value } : r)))
              }
              placeholder={labels.c}
              inputMode="numeric"
              className="w-20 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/90 outline-none transition focus:border-[#783DF5]/50"
            />
          )}
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
            className="rounded-md border border-white/10 p-1.5 text-white/40 transition hover:border-rose-400/40 hover:text-rose-300"
            title="Remover linha"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {rows.length < 10 && (
        <button
          type="button"
          onClick={() => setRows([...rows, { a: "", b: "", c: "" }])}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/12 px-2.5 py-1 text-[11.5px] font-medium text-white/60 transition hover:border-white/25 hover:text-white/85"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar linha
        </button>
      )}
    </div>
  );

  return (
    <div className="brand-gradient-border mb-4 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-[#b79bff]" />
        <h3 className="text-sm font-semibold text-white/85">
          E-commerce — Conversão orgânica
        </h3>
      </div>
      <p className="mb-4 text-[12px] leading-relaxed text-white/45">
        As células puxadas do GA4/GSC/Shopify aparecem bloqueadas com a fonte;
        as restantes preenchem-se aqui ou marcam-se <b>N/A</b>. O ticket médio e a
        conversão derivam-se sozinhos quando a receita e as transações existem.
        Só a coluna de <b>{ecom.columns.find((c) => !c.yoy && c.key === period)?.label ?? "mês do relatório"}</b>{" "}
        é obrigatória para finalizar.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr>
              <th className="border-b border-white/10 px-2 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-white/45">
                Métrica
              </th>
              {ecom.columns.map((col) => (
                <th
                  key={col.key}
                  className={`border-b border-white/10 px-2 py-2 text-right text-[10.5px] font-semibold uppercase tracking-wider ${col.yoy ? "text-white/35" : "text-white/55"}`}
                >
                  {col.label}
                  {col.yoy && (
                    <span className="ml-1 rounded bg-white/[0.06] px-1 py-px text-[8.5px] font-bold">
                      homólogo
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ECOM_METRIC_KEYS.map((k) => (
              <tr key={k}>
                <td className="border-b border-white/6 px-2 py-1.5 text-white/70">
                  {ROW_LABELS[k]}
                </td>
                {ecom.columns.map((col) => {
                  const cell = col.cells[k];
                  const key = cellKey(col.key, k);
                  const st = cells[key];
                  if (!st) {
                    // Puxada automaticamente — read-only com a fonte.
                    return (
                      <td
                        key={col.key}
                        className="border-b border-white/6 px-2 py-1.5 text-right font-medium tabular-nums text-white/85"
                        title={SOURCE_TAG[cell.source] ?? cell.source}
                      >
                        {fmt(cell, k, ecom.currency)}
                        <span className="ml-1.5 align-middle text-[8.5px] font-bold uppercase tracking-wide text-white/30">
                          {SOURCE_TAG[cell.source] ?? cell.source}
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={col.key} className="border-b border-white/6 px-1.5 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          value={st.mode === "na" ? "" : st.value}
                          disabled={st.mode === "na"}
                          onChange={(e) =>
                            setCell(key, { value: e.target.value, mode: "value" })
                          }
                          placeholder={st.mode === "na" ? "N/A" : "—"}
                          inputMode="decimal"
                          className="w-24 rounded-md border border-white/12 bg-white/[0.04] px-2 py-1 text-right text-[12px] text-white/90 outline-none transition focus:border-[#783DF5]/50 disabled:opacity-40"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCell(
                              key,
                              st.mode === "na"
                                ? { mode: "pending", value: "" }
                                : { mode: "na", value: "" },
                            )
                          }
                          className={`rounded-md border p-1 transition ${
                            st.mode === "na"
                              ? "border-white/25 bg-white/10 text-white/85"
                              : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/70"
                          }`}
                          title="Marcar N/A"
                        >
                          <Ban className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {editableCount > 0 && (
              <tr>
                <td className="px-2 pt-2" />
                {ecom.columns.map((col) => {
                  const hasPending = ECOM_METRIC_KEYS.some((k) => {
                    const st = cells[cellKey(col.key, k)];
                    return st && st.mode === "pending";
                  });
                  return (
                    <td key={col.key} className="px-1.5 pt-2 text-right">
                      {hasPending && (
                        <button
                          type="button"
                          onClick={() => naColumn(col.key)}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10.5px] font-medium text-white/45 transition hover:border-white/25 hover:text-white/75"
                        >
                          N/A no resto
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editableCount === 0 && (
        <p className="mt-2 text-[11.5px] text-emerald-300/80">
          Tabela toda puxada automaticamente — nada para preencher.
        </p>
      )}

      {pagesEditable && (
        <div className="mt-5">
          <h4 className="mb-2 text-[12px] font-semibold text-white/70">
            Páginas mais acedidas (manual)
          </h4>
          {listEditor(pageRows, setPageRows, {
            a: "/caminho-da-pagina",
            b: "visualizações",
          })}
        </div>
      )}

      {productsEditable && (
        <div className="mt-5">
          <h4 className="mb-2 text-[12px] font-semibold text-white/70">
            Produtos mais vendidos (manual)
          </h4>
          {listEditor(productRows, setProductRows, {
            a: "Nome do produto",
            b: `receita (${ecom.currency})`,
            c: "un.",
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Guardar e-commerce
        </button>
        {saved && !busy && <span className="text-[12px] text-emerald-300">Guardado ✓</span>}
        {err && <span className="text-[12px] text-rose-400">Não foi possível guardar: {err}</span>}
      </div>
    </div>
  );
}
