"use client";

// Google IA — o relatório Generative AI do Search Console (AI Overviews +
// AI Mode) só existe na UI da GSC: sem API, sem BigQuery, só o botão de
// export (verificado 2026-09-02). Este cartão torna a tarefa mensal quase
// automática: cola-se o CSV exportado e o parse preenche o total do mês
// (linhas de datas), as páginas e os dispositivos de uma vez. O MoM e o
// histórico já vêm encadeados do relatório anterior — não se preenchem.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Ban, Sparkles, ClipboardPaste, Trash2 } from "lucide-react";
import type { GscAiBlock } from "@/lib/report/report-types";

type PageRow = { page: string; impressions: string };
type DeviceRow = { device: string; impressions: number };

/** "15 655" · "15.655" · "15,655" → 15655. Impressões são inteiros. */
function toInt(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

const DEVICE_MAP: Record<string, string> = {
  desktop: "Desktop",
  computador: "Desktop",
  mobile: "Mobile",
  "telemóvel": "Mobile",
  telemovel: "Mobile",
  smartphone: "Mobile",
  tablet: "Tablet",
};

type Parsed = {
  pages: { page: string; impressions: number }[];
  devices: DeviceRow[];
  dateTotal: number;
  dateRows: number;
};

/** Lê qualquer um dos CSVs do export (Gráfico=datas, Páginas, Dispositivos)
 *  — ou os três colados de seguida — e separa as linhas pelo formato da
 *  primeira coluna. Linhas de cabeçalho caem sozinhas (sem número). */
function parseCsv(text: string): Parsed {
  const out: Parsed = { pages: [], devices: [], dateTotal: 0, dateRows: 0 };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cells.length < 2) continue;
    const label = cells[0];
    const n = toInt(cells[1]);
    if (n === null) continue;
    if (/^https?:\/\//.test(label) || label.startsWith("/")) {
      out.pages.push({ page: label, impressions: n });
    } else if (DEVICE_MAP[label.toLowerCase()]) {
      const device = DEVICE_MAP[label.toLowerCase()];
      const existing = out.devices.find((d) => d.device === device);
      if (existing) existing.impressions += n;
      else out.devices.push({ device, impressions: n });
    } else if (
      /^\d{4}-\d{2}-\d{2}$/.test(label) ||
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(label)
    ) {
      out.dateTotal += n;
      out.dateRows += 1;
    }
  }
  out.pages.sort((a, b) => b.impressions - a.impressions);
  out.devices.sort((a, b) => b.impressions - a.impressions);
  return out;
}

export function ReportGscAiInputs({
  slug,
  period,
  gscAi,
}: {
  slug: string;
  period: string;
  gscAi: GscAiBlock;
}) {
  const router = useRouter();
  const m = gscAi.impressions;
  // Puxado da API (o dia em que a Google a abrir) → nada para fazer aqui.
  const auto = m.source === "gsc" && m.value !== null;
  const [mode, setMode] = useState<"value" | "na" | "pending">(
    m.manualNa ? "na" : m.value !== null ? "value" : "pending",
  );
  const [value, setValue] = useState(m.value !== null ? String(m.value) : "");
  const [pageRows, setPageRows] = useState<PageRow[]>(() =>
    gscAi.topPages.map((p) => ({ page: p.page, impressions: String(p.impressions) })),
  );
  const [deviceRows, setDeviceRows] = useState<DeviceRow[]>(gscAi.byDevice);
  const [csv, setCsv] = useState("");
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function readCsv() {
    const parsed = parseCsv(csv);
    const notes: string[] = [];
    if (parsed.pages.length) {
      setPageRows(
        parsed.pages.slice(0, 10).map((p) => ({
          page: p.page,
          impressions: String(p.impressions),
        })),
      );
      notes.push(`${parsed.pages.length} páginas`);
    }
    if (parsed.devices.length) {
      setDeviceRows(parsed.devices);
      notes.push(`${parsed.devices.length} dispositivos`);
    }
    if (parsed.dateTotal > 0) {
      setValue(String(parsed.dateTotal));
      setMode("value");
      notes.push(
        `total do mês ${parsed.dateTotal.toLocaleString("pt-PT")} (${parsed.dateRows} dias)`,
      );
    }
    setParseNote(
      notes.length
        ? `Lido: ${notes.join(" · ")}.`
        : "Não reconheci nenhuma linha — cola o CSV tal como sai do botão Exportar.",
    );
    if (notes.length) setCsv("");
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    const impressions =
      mode === "na" ? ("na" as const) : mode === "value" ? toInt(value) : null;
    try {
      const res = await fetch(`/api/reports/${slug}/${period}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gscAi: {
            impressions,
            topPages: pageRows
              .map((r) => ({ page: r.page.trim(), impressions: toInt(r.impressions) ?? -1 }))
              .filter((r) => r.page && r.impressions >= 0),
            byDevice: deviceRows,
          },
        }),
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

  return (
    <div className="brand-gradient-border mb-4 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#b79bff]" />
        <h3 className="text-sm font-semibold text-white/85">
          Google IA — AI Overviews &amp; AI Mode
        </h3>
        {auto ? (
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-200/90">
            puxado da API ✓
          </span>
        ) : mode === "value" && value ? (
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-200/90">
            preenchido
          </span>
        ) : mode === "na" ? (
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-semibold text-white/40">
            N/A
          </span>
        ) : (
          <span className="rounded-full border border-amber-400/25 bg-amber-500/[0.1] px-2 py-0.5 text-[10.5px] font-semibold text-amber-200/90">
            por preencher
          </span>
        )}
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-white/45">
        {auto ? (
          <>
            A Google abriu a API deste relatório e os dados já vêm sozinhos —
            nada para preencher. Podes na mesma corrigir os valores abaixo.
          </>
        ) : (
          <>
            Cola o export do relatório <b>Generative AI</b> do Search Console — o
            total do mês, as páginas e os dispositivos preenchem-se sozinhos. MoM
            e histórico vêm do relatório anterior, automáticos.
          </>
        )}
      </p>

      <details className="mb-3 rounded-lg border border-white/10 bg-white/[0.02]">
        <summary className="cursor-pointer select-none list-none px-3 py-2 text-[12px] text-white/55 transition hover:text-white/80 [&::-webkit-details-marker]:hidden">
          Onde está o export? (a Google não dá API — ainda)
        </summary>
        <p className="border-t border-white/8 px-3 py-2.5 text-[12px] leading-relaxed text-white/50">
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#b79bff] underline decoration-[#783DF5]/50 underline-offset-2 hover:text-white"
          >
            Search Console ↗
          </a>{" "}
          → <b>Desempenho → Generative AI</b> → define o mês do relatório →
          botão <b>Exportar</b>. Cola aqui qualquer uma das tabelas (Gráfico,
          Páginas, Dispositivos) — ou as três de seguida. A Search Analytics
          API e o BigQuery ainda não expõem estes dados; assim que a Google
          abrir a API, isto passa a puxar sozinho.
        </p>
      </details>

      <div className="mb-3 flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[12.5px] text-white/70">
          Impressões do mês em respostas de IA
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={mode === "na" ? "" : value}
          disabled={mode === "na"}
          onChange={(e) => {
            setValue(e.target.value);
            setMode("value");
          }}
          placeholder={mode === "na" ? "N/A" : "—"}
          className="w-28 rounded-md border border-white/12 bg-white/[0.04] px-2 py-1 text-right text-[12.5px] text-white/90 outline-none transition focus:border-[#783DF5]/50 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() =>
            setMode((p) => (p === "na" ? "pending" : "na"))
          }
          title="Marcar N/A (propriedade sem visibilidade em IA)"
          className={`rounded-md border p-1 transition ${
            mode === "na"
              ? "border-white/25 bg-white/10 text-white/85"
              : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/70"
          }`}
        >
          <Ban className="h-3 w-3" />
        </button>
      </div>

      <div className="mb-1 flex items-center gap-2">
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={3}
          placeholder={"Cola aqui o CSV exportado…\n2026-08-01,512\n/pagina-mais-vista,15655\nMobile,9200"}
          className="min-w-0 flex-1 resize-y rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 font-mono text-[11.5px] text-white/85 outline-none transition placeholder:text-white/25 focus:border-[#783DF5]/50"
        />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={readCsv}
          disabled={!csv.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-white/70 transition hover:border-[#783DF5]/50 hover:text-white disabled:opacity-40"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Ler CSV
        </button>
        {parseNote && (
          <span className="text-[11.5px] text-white/45">{parseNote}</span>
        )}
      </div>

      {deviceRows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {deviceRows.map((d) => (
            <span
              key={d.device}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-white/70"
            >
              <b>{d.device}</b> {d.impressions.toLocaleString("pt-PT")}
              <button
                type="button"
                onClick={() =>
                  setDeviceRows((rows) => rows.filter((r) => r.device !== d.device))
                }
                className="text-white/30 transition hover:text-rose-300"
                title="Remover"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {pageRows.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {pageRows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-right text-[11px] text-white/35">{i + 1}</span>
              <input
                value={row.page}
                onChange={(e) =>
                  setPageRows(pageRows.map((r, j) => (j === i ? { ...r, page: e.target.value } : r)))
                }
                className="min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1 font-mono text-[11.5px] text-white/85 outline-none transition focus:border-[#783DF5]/50"
              />
              <input
                value={row.impressions}
                onChange={(e) =>
                  setPageRows(
                    pageRows.map((r, j) => (j === i ? { ...r, impressions: e.target.value } : r)),
                  )
                }
                inputMode="numeric"
                className="w-20 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-right text-[11.5px] text-white/85 outline-none transition focus:border-[#783DF5]/50"
              />
              <button
                type="button"
                onClick={() => setPageRows(pageRows.filter((_, j) => j !== i))}
                className="rounded-md border border-white/10 p-1 text-white/35 transition hover:border-rose-400/40 hover:text-rose-300"
                title="Remover linha"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Guardar Google IA
        </button>
        {saved && !busy && <span className="text-[12px] text-emerald-300">Guardado ✓</span>}
        {err && <span className="text-[12px] text-rose-400">Não foi possível guardar: {err}</span>}
      </div>
    </div>
  );
}
