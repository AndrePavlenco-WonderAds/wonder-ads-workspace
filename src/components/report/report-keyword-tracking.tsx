"use client";

// Passo 1 do relatório mensal — as POSIÇÕES DAS KEYWORDS (v77.95).
//
// O fluxo, num cartão só:
//   1. Exportar — as keywords da client file num CSV (todas, ou só as
//      escolhidas — sem limite), no formato que o consultor preenche:
//      Palavra · Posição Semrush · Posição Search Console · Posição Serpstat.
//   2. Preencher — no Google Sheets, com o que se vê em cada ferramenta.
//   3. Carregar — o CSV volta; a app fica com a MELHOR das três por keyword,
//      compara-a com a melhor do mês anterior e mostra a tabela de revisão.
//
// A leitura faz-se aqui (pré-visualização imediata) e outra vez no servidor
// com as mesmas regras (kw-csv.ts) antes de gravar.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  Download,
  ExternalLink,
  FileSpreadsheet,
  History,
  Loader2,
  Search,
  Star,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  KW_CSV_SOURCES,
  hasKwCsv,
  kwCsvChange,
  kwTrackingIssues,
  type KeywordTrackingBlock,
  type KwCsvRow,
  type KwCsvSource,
} from "@/lib/report/report-types";
import {
  KW_SOURCE_LABEL,
  bestOf,
  kwCsvFileName,
  kwResultsCsv,
  kwTemplateCsv,
  foldKw,
  parseKwPositionsCsv,
  type KwCsvParse,
} from "@/lib/report/kw-csv";
import { formatDate } from "@/lib/dates";
import { downloadCsv } from "./csv-download";

export type TrackingTarget = {
  keyword: string;
  volume: number | null;
  premium: boolean;
};

export type TrackingLinks = {
  /** Posições orgânicas do domínio no Semrush, na base do país do cliente. */
  semrush: string | null;
  /** Desempenho no Search Console desta propriedade, quando a conhecemos. */
  gsc: string | null;
};

const GRAD = "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)";

/** Ordem das colunas na grelha — a do CSV. */
const COLS: KwCsvSource[] = ["semrush", "gsc", "serpstat"];

type Filter = "all" | "page1" | "up" | "down" | "none";
type SortKey = "pos" | "delta" | "volume" | "keyword";

function fmtPos(v: number | null): string {
  if (v === null) return "—";
  return Number.isInteger(v) ? String(v) : v.toLocaleString("pt-PT", { maximumFractionDigits: 1 });
}

function bandCls(v: number | null): string {
  if (v === null) return "bg-white/[0.05] text-white/35";
  if (v <= 3) return "bg-emerald-500/20 text-emerald-200";
  if (v <= 10) return "bg-sky-500/15 text-sky-200";
  if (v <= 20) return "bg-amber-500/15 text-amber-200";
  return "bg-white/[0.07] text-white/60";
}

/** Para ordenar pelo Δ: subidas primeiro, «entrou» acima de tudo. */
function deltaRank(c: ReturnType<typeof kwCsvChange>): number {
  if (c === "in") return 1000;
  if (c === "lost") return -1000;
  return c ?? -0.5;
}

export function ReportKeywordTracking({
  slug,
  period,
  clientTitle,
  block,
  targets,
  prevKeywords,
  serpstatPrefill,
  serpstatCheckedOn,
  links,
}: {
  slug: string;
  period: string;
  clientTitle: string;
  block: KeywordTrackingBlock;
  targets: TrackingTarget[];
  /** As keywords acompanhadas no relatório do mês anterior. */
  prevKeywords: string[];
  /** Posição Serpstat deste relatório por keyword (normalizada). */
  serpstatPrefill: Record<string, number | null>;
  serpstatCheckedOn: string | null;
  links: TrackingLinks;
}) {
  const router = useRouter();
  const uploaded = hasKwCsv(block);
  const rows = useMemo(() => (block.format === "csv" ? (block.rows ?? []) : []), [block]);
  const legacyDone =
    block.format !== "csv" && block.keywords.length > 0 && kwTrackingIssues(block).length === 0;

  const [collapsed, setCollapsed] = useState(uploaded);
  const [exportOpen, setExportOpen] = useState(!uploaded);

  // —— 1 · exportar ——————————————————————————————————————————————————
  const sortedTargets = useMemo(
    () =>
      [...targets].sort(
        (a, b) =>
          Number(b.premium) - Number(a.premium) ||
          (b.volume ?? -1) - (a.volume ?? -1) ||
          a.keyword.localeCompare(b.keyword),
      ),
    [targets],
  );
  const targetSet = useMemo(() => new Set(targets.map((t) => foldKw(t.keyword))), [targets]);
  const prevInPlan = useMemo(
    () => prevKeywords.filter((k) => targetSet.has(foldKw(k))),
    [prevKeywords, targetSet],
  );
  const [selected, setSelected] = useState<Set<string>>(() => {
    const from = uploaded ? rows.map((r) => r.keyword) : prevKeywords;
    return new Set(from.map(foldKw).filter((k) => targetSet.has(k)));
  });
  const [query, setQuery] = useState("");
  const [prefill, setPrefill] = useState(false);
  const prefillCount = Object.values(serpstatPrefill).filter((v) => v !== null).length;
  const prevSet = useMemo(() => new Set(prevKeywords.map(foldKw)), [prevKeywords]);

  const filteredTargets = useMemo(() => {
    const q = foldKw(query);
    return q ? sortedTargets.filter((t) => foldKw(t.keyword).includes(q)) : sortedTargets;
  }, [sortedTargets, query]);

  function toggle(kw: string) {
    const k = foldKw(kw);
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  function exportTemplate(which: "all" | "selected") {
    const list = sortedTargets
      .filter((t) => which === "all" || selected.has(foldKw(t.keyword)))
      .map((t) => t.keyword);
    if (list.length === 0) return;
    const map = prefill
      ? new Map(Object.entries(serpstatPrefill).map(([k, v]) => [k, v] as const))
      : undefined;
    downloadCsv(
      kwTemplateCsv(list, map),
      kwCsvFileName(which === "all" ? "Posicoes" : "Posicoes-selecionadas", clientTitle, period),
    );
  }

  // —— 3 · carregar ——————————————————————————————————————————————————
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState<{ text: string; fileName: string; parse: KwCsvParse } | null>(
    null,
  );
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function stage(text: string, fileName: string) {
    setErr(null);
    setPending({ text, fileName, parse: parseKwPositionsCsv(text) });
    setCollapsed(false);
  }

  async function readFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) {
      setErr("Ficheiro grande demais para um CSV de keywords.");
      return;
    }
    stage(await f.text(), f.name);
  }

  async function put(body: unknown) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/reports/${slug}/${period}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou a gravar");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmUpload() {
    if (!pending?.parse.ok) return;
    const ok = await put({ kwCsv: { csv: pending.text, fileName: pending.fileName } });
    if (ok) {
      setPending(null);
      setPasteOpen(false);
      setPasteText("");
      setExportOpen(false);
      router.refresh();
    }
  }

  async function removeUpload() {
    const ok = await put({ kwCsv: null });
    if (ok) {
      setConfirmRemove(false);
      setExportOpen(true);
      router.refresh();
    }
  }

  // —— a tabela de revisão ————————————————————————————————————————————
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "pos", dir: 1 });
  const [tableQuery, setTableQuery] = useState("");

  const stats = useMemo(() => {
    const changes = rows.map(kwCsvChange);
    const ranked = rows.filter((r) => r.best !== null);
    const nums = ranked.map((r) => r.best as number);
    const wins: Record<KwCsvSource, number> = { semrush: 0, gsc: 0, serpstat: 0 };
    for (const r of rows) if (r.bestSource) wins[r.bestSource] += 1;
    return {
      total: rows.length,
      ranked: ranked.length,
      top3: nums.filter((v) => v <= 3).length,
      page1: nums.filter((v) => v <= 10).length,
      up: changes.filter((c) => c === "in" || (typeof c === "number" && c > 0)).length,
      down: changes.filter((c) => c === "lost" || (typeof c === "number" && c < 0)).length,
      entered: changes.filter((c) => c === "in").length,
      none: rows.length - ranked.length,
      compared: rows.filter((r) => r.previous !== null).length,
      wins,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const q = foldKw(tableQuery);
    const list = rows.filter((r) => {
      if (q && !foldKw(r.keyword).includes(q)) return false;
      const c = kwCsvChange(r);
      switch (filter) {
        case "page1":
          return r.best !== null && r.best <= 10;
        case "up":
          return c === "in" || (typeof c === "number" && c > 0);
        case "down":
          return c === "lost" || (typeof c === "number" && c < 0);
        case "none":
          return r.best === null;
        default:
          return true;
      }
    });
    const { key, dir } = sort;
    return list.sort((a, b) => {
      let d = 0;
      if (key === "pos") d = (a.best ?? 1000) - (b.best ?? 1000);
      else if (key === "delta") d = deltaRank(kwCsvChange(b)) - deltaRank(kwCsvChange(a));
      else if (key === "volume") d = (b.volume ?? -1) - (a.volume ?? -1);
      else d = a.keyword.localeCompare(b.keyword);
      return d * dir || (b.volume ?? -1) - (a.volume ?? -1) || a.keyword.localeCompare(b.keyword);
    });
  }, [rows, filter, sort, tableQuery]);

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  // —— resumo fechado ————————————————————————————————————————————————
  if (collapsed && uploaded && !pending) {
    return (
      <section
        id="passo-1"
        className="mb-6 flex scroll-mt-24 flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] px-5 py-3.5"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-emerald-50">
            Passo 1 · Posições carregadas — {stats.total} keywords · {stats.page1} na 1.ª página
            {stats.up > 0 ? ` · ${stats.up} a subir` : ""}
          </p>
          <p className="truncate text-[11.5px] text-emerald-100/60">
            {block.upload?.fileName} · {formatDate(block.upload?.uploadedAt)}
            {block.upload?.uploadedBy ? ` · ${block.upload.uploadedBy}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/80 transition hover:border-white/30 hover:text-white"
        >
          <Upload className="h-3.5 w-3.5" />
          Carregar outro CSV
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/80 transition hover:border-white/30 hover:text-white"
        >
          Ver tabela
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <FileInput fileRef={fileRef} onFile={readFile} />
      </section>
    );
  }

  const step1Done = uploaded;
  const steps = [
    { n: 1, label: "Exportar as keywords", done: step1Done },
    { n: 2, label: "Preencher Semrush · GSC · Serpstat", done: step1Done },
    { n: 3, label: "Carregar o CSV", done: step1Done },
  ];

  return (
    <section
      id="passo-1"
      className="brand-gradient-border mb-6 scroll-mt-24 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md"
    >
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Target className="h-4 w-4 text-[#b79bff]" />
            <h3 className="text-[15px] font-semibold text-white/90">
              Passo 1 · Posições das keywords
            </h3>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                uploaded
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-400/30 bg-amber-500/10 text-amber-200"
              }`}
            >
              {uploaded ? `${stats.total} keywords carregadas` : "CSV por carregar"}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-white/50">
            Exporta as keywords do cliente, preenche a posição de cada uma no{" "}
            <b className="text-white/75">Semrush</b>, no <b className="text-white/75">Search Console</b>{" "}
            e no <b className="text-white/75">Serpstat</b>, e carrega o CSV. O relatório fica com a{" "}
            <b className="text-white/75">melhor das três</b> e compara-a com a do mês anterior.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11.5px]">
          {busy && (
            <span className="inline-flex items-center gap-1 text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> a gravar…
            </span>
          )}
          {uploaded && !pending && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded-lg border border-white/12 px-2.5 py-1 text-white/60 transition hover:text-white"
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      {/* Os três passos */}
      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li
            key={s.n}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[12px] ${
              s.done
                ? "border-emerald-400/20 bg-emerald-500/[0.05] text-emerald-100/80"
                : "border-white/10 bg-black/15 text-white/65"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                s.done ? "bg-emerald-500/20 text-emerald-200" : "text-white"
              }`}
              style={s.done ? undefined : { background: GRAD }}
            >
              {s.done ? <Check className="h-3.5 w-3.5" /> : s.n}
            </span>
            {s.label}
          </li>
        ))}
      </ol>

      {legacyDone && !uploaded && (
        <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/55">
          Este relatório já tem as posições do formato anterior ({block.keywords.length} verificadas
          à mão) e pode ser finalizado assim. Carregar um CSV substitui-as.
        </p>
      )}

      {/* ① Exportar */}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/15">
        <button
          type="button"
          onClick={() => setExportOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left"
        >
          <Download className="h-4 w-4 text-[#b79bff]" />
          <span className="text-[13px] font-semibold text-white/85">1 · Exportar as keywords</span>
          <span className="text-[11.5px] text-white/40">
            {targets.length} na client file{selected.size > 0 ? ` · ${selected.size} selecionadas` : ""}
          </span>
          <ChevronDown
            className={`ml-auto h-4 w-4 text-white/40 transition ${exportOpen ? "rotate-180" : ""}`}
          />
        </button>
        {exportOpen && (
          <div className="border-t border-white/8 px-4 pb-4 pt-3">
            {targets.length === 0 ? (
              <p className="text-[12.5px] leading-relaxed text-amber-100/75">
                Este cliente ainda não tem target keywords na client file — acrescenta-as na página do
                cliente (Keyword Research → Target keywords). Entretanto podes carregar um CSV feito à
                mão no mesmo formato.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={`procurar nas ${targets.length} target keywords…`}
                      className="w-full rounded-lg border border-white/12 bg-black/25 py-2 pl-8 pr-3 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(targets.map((t) => foldKw(t.keyword))))}
                    className="rounded-lg border border-white/12 px-3 py-2 text-[12px] font-medium text-white/70 transition hover:border-[#783DF5]/50 hover:text-white"
                  >
                    Selecionar todas
                  </button>
                  {prevInPlan.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelected(new Set(prevInPlan.map(foldKw)))}
                      title="As keywords acompanhadas no relatório do mês anterior"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-[12px] font-medium text-white/70 transition hover:border-[#783DF5]/50 hover:text-white"
                    >
                      <History className="h-3.5 w-3.5" />
                      As do mês passado ({prevInPlan.length})
                    </button>
                  )}
                  {selected.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="rounded-lg px-2.5 py-2 text-[12px] text-white/45 transition hover:text-white"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div className="mt-3 grid max-h-[340px] grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredTargets.map((t) => {
                    const on = selected.has(foldKw(t.keyword));
                    return (
                      <button
                        key={t.keyword}
                        type="button"
                        onClick={() => toggle(t.keyword)}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[12.5px] transition ${
                          on
                            ? "border-[#783DF5]/60 bg-[#783DF5]/15 text-white"
                            : "border-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.04]"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            on ? "border-transparent bg-[#783DF5] text-white" : "border-white/25"
                          }`}
                        >
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{t.keyword}</span>
                        {prevSet.has(foldKw(t.keyword)) && (
                          <span
                            title="Acompanhada no mês passado"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#b79bff]"
                          />
                        )}
                        {t.premium && (
                          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-300 text-amber-300" />
                        )}
                        {t.volume !== null && (
                          <span className="shrink-0 font-mono text-[10.5px] text-white/35">
                            {t.volume.toLocaleString("pt-PT")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {filteredTargets.length === 0 && (
                    <p className="px-2 py-2 text-[12px] text-white/40">Nada com esse nome.</p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportTemplate("all")}
                    className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                    style={{ background: GRAD }}
                  >
                    <Download className="h-4 w-4" />
                    Exportar todas ({targets.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => exportTemplate("selected")}
                    disabled={selected.size === 0}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#783DF5]/50 bg-[#783DF5]/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-[#783DF5]/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                    Exportar selecionadas ({selected.size})
                  </button>
                  {prefillCount > 0 && (
                    <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-[12px] text-white/55">
                      <input
                        type="checkbox"
                        checked={prefill}
                        onChange={(e) => setPrefill(e.target.checked)}
                        className="h-3.5 w-3.5 accent-[#783DF5]"
                      />
                      Pré-preencher a coluna Serpstat com a recolha automática
                      {serpstatCheckedOn ? ` (${formatDate(serpstatCheckedOn)})` : ""}
                    </label>
                  )}
                </div>
              </>
            )}

            {/* ② Preencher — fora da app */}
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[12px] text-white/55">
              <span className="font-semibold text-white/75">2 · Preencher:</span>
              abre o CSV no Google Sheets e escreve a posição em cada ferramenta (o Search Console
              aceita décimas, ex.: 6,8). Onde a keyword não aparece, deixa em branco.
              <span className="ml-auto flex flex-wrap gap-1.5">
                {links.semrush && (
                  <a
                    href={links.semrush}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-white/12 px-2 py-1 text-[11.5px] text-white/70 transition hover:border-white/30 hover:text-white"
                  >
                    Semrush <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <a
                  href={links.gsc ?? "https://search.google.com/search-console"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-white/12 px-2 py-1 text-[11.5px] text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Search Console <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ③ Carregar */}
      {!pending && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void readFile(e.dataTransfer.files?.[0]);
          }}
          className={`mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-4 py-4 transition ${
            drag ? "border-[#783DF5] bg-[#783DF5]/10" : "border-white/15 bg-black/15"
          }`}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: GRAD }}
          >
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white/85">
              3 · {uploaded ? "Carregar um CSV novo (substitui o atual)" : "Carregar o CSV preenchido"}
            </p>
            <p className="text-[11.5px] text-white/40">
              Arrasta o ficheiro para aqui. Colunas: Palavra · Posição Semrush · Posição Search
              Console · Posição Serpstat (vírgula, ponto e vírgula ou tab).
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
            style={{ background: GRAD }}
          >
            <Upload className="h-4 w-4" />
            Escolher ficheiro
          </button>
          <button
            type="button"
            onClick={() => setPasteOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-[12px] text-white/65 transition hover:text-white"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Colar da folha
          </button>
          <FileInput fileRef={fileRef} onFile={readFile} />
          {pasteOpen && (
            <div className="w-full">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
                placeholder="Copia as linhas no Google Sheets (com o cabeçalho) e cola aqui…"
                className="w-full rounded-lg border border-white/12 bg-black/30 p-2.5 font-mono text-[11.5px] text-white outline-none placeholder:font-sans placeholder:text-white/25 focus:border-[#783DF5]/50"
              />
              <button
                type="button"
                onClick={() => stage(pasteText, "colado da folha")}
                disabled={!pasteText.trim()}
                className="mt-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/80 transition hover:text-white disabled:opacity-40"
              >
                Ler as linhas
              </button>
            </div>
          )}
        </div>
      )}

      {err && <p className="mt-2 text-[12px] text-rose-300">{err}</p>}

      {/* Pré-visualização antes de gravar */}
      {pending && (
        <UploadPreview
          pending={pending}
          busy={busy}
          replacing={uploaded}
          onConfirm={() => void confirmUpload()}
          onCancel={() => setPending(null)}
        />
      )}

      {/* A tabela de revisão */}
      {uploaded && !pending && (
        <div className="mt-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="na 1.ª página" value={`${stats.page1}`} sub={`de ${stats.total}`} hero />
            <Stat label="no top 3" value={`${stats.top3}`} />
            <Stat
              label="a subir"
              value={`${stats.up}`}
              sub={stats.entered > 0 ? `${stats.entered} entraram` : undefined}
              tone="up"
            />
            <Stat label="a descer" value={`${stats.down}`} tone={stats.down > 0 ? "down" : undefined} />
            <Stat label="sem posição" value={`${stats.none}`} sub="em nenhuma das 3" />
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                melhor fonte
              </p>
              <div className="mt-1 space-y-0.5 text-[11.5px]">
                {KW_CSV_SOURCES.map((s) => (
                  <div key={s} className="flex items-center justify-between gap-2 text-white/65">
                    <span>{KW_SOURCE_LABEL[s].short}</span>
                    <span className="font-mono text-white/85">{stats.wins[s]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {stats.compared === 0 && (
            <p className="mt-2 text-[11.5px] text-white/40">
              Sem mês anterior para comparar — o «Δ mês» começa no próximo relatório.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
              {(
                [
                  ["all", `Todas ${stats.total}`],
                  ["page1", `1.ª página ${stats.page1}`],
                  ["up", `A subir ${stats.up}`],
                  ["down", `A descer ${stats.down}`],
                  ["none", `Sem posição ${stats.none}`],
                ] as [Filter, string][]
              ).map(([f, label]) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition ${
                    filter === f ? "bg-[#783DF5] text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
              <input
                type="search"
                value={tableQuery}
                onChange={(e) => setTableQuery(e.target.value)}
                placeholder="procurar na tabela…"
                className="w-full rounded-lg border border-white/12 bg-black/25 py-1.5 pl-8 pr-3 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                downloadCsv(kwResultsCsv(visibleRows), kwCsvFileName("Posicoes-tabela", clientTitle, period))
              }
              title="A tabela como está filtrada — posições, melhor, fonte, mês anterior e Δ"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-white/75 transition hover:border-white/30 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              {filter === "all" && !tableQuery ? "Exportar tabela" : `Exportar estas (${visibleRows.length})`}
            </button>
          </div>

          <div className="mt-3 max-h-[560px] overflow-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[820px] border-collapse text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-[#17142b]">
                <tr className="text-left text-[10.5px] uppercase tracking-[0.1em] text-white/45">
                  <Th onClick={() => sortBy("keyword")} active={sort.key === "keyword"} dir={sort.dir}>
                    Keyword
                  </Th>
                  {COLS.map((c) => (
                    <th key={c} className="px-2 py-2 text-right font-semibold">
                      {KW_SOURCE_LABEL[c].long}
                    </th>
                  ))}
                  <Th onClick={() => sortBy("pos")} active={sort.key === "pos"} dir={sort.dir} right>
                    Posição
                  </Th>
                  <Th onClick={() => sortBy("delta")} active={sort.key === "delta"} dir={sort.dir} right>
                    Δ mês
                  </Th>
                  <Th onClick={() => sortBy("volume")} active={sort.key === "volume"} dir={sort.dir} right>
                    Volume
                  </Th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <ReviewRow key={r.keyword} r={r} />
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-[12px] text-white/40">
                      Nada neste filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11.5px] text-white/40">
            <span>
              {block.upload?.fileName} · carregado a {formatDate(block.upload?.uploadedAt)}
              {block.upload?.uploadedBy ? ` por ${block.upload.uploadedBy}` : ""}. A posição a cheio é a
              que vai para o relatório; o cliente vê as que aparecem na Google.
            </span>
            <span className="ml-auto">
              {confirmRemove ? (
                <span className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void removeUpload()}
                    disabled={busy}
                    className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2.5 py-1 text-rose-200 transition hover:bg-rose-500/20"
                  >
                    Remover o CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="rounded-lg px-2 py-1 text-white/45 hover:text-white"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-white/40 transition hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </button>
              )}
            </span>
          </div>
          {(block.upload?.warnings?.length ?? 0) > 0 && (
            <details className="mt-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.05] px-3 py-2 text-[11.5px] text-amber-100/75">
              <summary className="cursor-pointer select-none">
                {block.upload!.warnings!.length} avisos na leitura do ficheiro
              </summary>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {block.upload!.warnings!.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function FileInput({
  fileRef,
  onFile,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File | undefined) => void;
}) {
  return (
    <input
      ref={fileRef}
      type="file"
      accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
      className="hidden"
      onChange={(e) => {
        onFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );
}

function Stat({
  label,
  value,
  sub,
  hero,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  hero?: boolean;
  tone?: "up" | "down";
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${hero ? "border-transparent text-white" : "border-white/10 bg-black/20"}`}
      style={hero ? { background: GRAD } : undefined}
    >
      <p
        className={`text-[1.35rem] font-extrabold leading-tight tracking-tight tabular-nums ${
          tone === "up" ? "text-emerald-300" : tone === "down" ? "text-rose-300" : "text-white"
        }`}
      >
        {value}
        {sub && hero && <span className="ml-1 text-[12px] font-semibold text-white/75">{sub}</span>}
      </p>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${hero ? "text-white/85" : "text-white/40"}`}>
        {label}
      </p>
      {sub && !hero && <p className="text-[10.5px] text-white/35">{sub}</p>}
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  right,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: 1 | -1;
  right?: boolean;
}) {
  return (
    <th className={`px-2 py-2 font-semibold ${right ? "text-right" : "pl-3"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.1em] transition hover:text-white ${
          active ? "text-white/80" : ""
        }`}
      >
        {children}
        {active && (dir === 1 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </th>
  );
}

function DeltaCell({ r }: { r: KwCsvRow }) {
  const c = kwCsvChange(r);
  const prevTxt = r.previous
    ? `Mês passado: ${r.previous.best === null ? "fora do top 100" : fmtPos(r.previous.best)}`
    : "Não foi acompanhada no mês passado";
  let body: React.ReactNode;
  if (c === "in") body = <span className="text-emerald-300">▲ entrou</span>;
  else if (c === "lost") body = <span className="text-rose-300">▼ saiu</span>;
  else if (c === null) body = <span className="text-white/25">—</span>;
  else if (c === 0) body = <span className="text-white/40">=</span>;
  else
    body = (
      <span className={c > 0 ? "text-emerald-300" : "text-rose-300"}>
        {c > 0 ? "▲" : "▼"} {fmtPos(Math.abs(c))}
      </span>
    );
  return (
    <span title={prevTxt} className="font-mono text-[12px] font-semibold">
      {body}
      {r.previous && r.previous.best !== null && (
        <span className="ml-1.5 font-sans text-[10.5px] font-normal text-white/30">
          era {fmtPos(r.previous.best)}
        </span>
      )}
    </span>
  );
}

function ReviewRow({ r }: { r: KwCsvRow }) {
  return (
    <tr className="border-t border-white/[0.06] hover:bg-white/[0.02]">
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-white/85">{r.keyword}</span>
          {r.premium && <Star className="h-3 w-3 shrink-0 fill-amber-300 text-amber-300" />}
          {!r.inPlan && (
            <span className="rounded bg-white/[0.07] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/45">
              fora do plano
            </span>
          )}
          {r.aio && (
            <span
              className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                r.aio === "cited" ? "bg-emerald-500/15 text-emerald-200" : "bg-sky-500/10 text-sky-200/80"
              }`}
            >
              {r.aio === "cited" ? "citado na IA" : "AI Overview"}
            </span>
          )}
        </div>
      </td>
      {COLS.map((c) => {
        const v = r[c];
        const win = r.bestSource === c;
        return (
          <td key={c} className="px-2 py-2 text-right">
            <span
              className={`inline-block min-w-[2.6rem] rounded-md px-1.5 py-0.5 font-mono text-[12px] ${
                win
                  ? "bg-[#783DF5]/25 font-bold text-white ring-1 ring-[#783DF5]/60"
                  : v === null
                    ? "text-white/20"
                    : "text-white/55"
              }`}
              title={win ? "A melhor das três — é esta que vai para o relatório" : undefined}
            >
              {fmtPos(v)}
            </span>
          </td>
        );
      })}
      <td className="px-2 py-2 text-right">
        <span className={`inline-block min-w-[2.6rem] rounded-md px-1.5 py-0.5 text-center font-mono text-[12.5px] font-bold ${bandCls(r.best)}`}>
          {r.best === null ? "100+" : fmtPos(r.best)}
        </span>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right">
        <DeltaCell r={r} />
      </td>
      <td className="px-3 py-2 text-right font-mono text-[11.5px] text-white/45">
        {r.volume !== null ? r.volume.toLocaleString("pt-PT") : "—"}
      </td>
    </tr>
  );
}

/** O ficheiro lido, antes de gravar: quantas, o que falta, os avisos e um
 *  relance das primeiras linhas com a melhor das três. */
function UploadPreview({
  pending,
  busy,
  replacing,
  onConfirm,
  onCancel,
}: {
  pending: { text: string; fileName: string; parse: KwCsvParse };
  busy: boolean;
  replacing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const p = pending.parse;
  if (!p.ok) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-rose-400/30 bg-rose-500/[0.07] px-4 py-3">
        <X className="h-4 w-4 shrink-0 text-rose-300" />
        <p className="min-w-0 flex-1 text-[12.5px] text-rose-100/85">
          <b>{pending.fileName}</b> — {p.error}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/75 hover:text-white"
        >
          Tentar outro
        </button>
      </div>
    );
  }
  const withBest = p.rows.map((r) => ({ ...r, ...bestOf(r) }));
  const ranked = withBest.filter((r) => r.best !== null);
  const missingCols = COLS.filter((c) => !p.columns[c]);
  const sample = [...ranked].sort((a, b) => (a.best ?? 999) - (b.best ?? 999)).slice(0, 8);
  return (
    <div className="mt-3 rounded-xl border border-[#783DF5]/40 bg-[#783DF5]/[0.07] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-[#b79bff]" />
        <p className="text-[13px] font-semibold text-white/90">{pending.fileName}</p>
        <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-white/70">
          {p.rows.length} keywords
        </span>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">
          {ranked.length} com posição
        </span>
        {p.rows.length - ranked.length > 0 && (
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/50">
            {p.rows.length - ranked.length} sem posição em nenhuma
          </span>
        )}
      </div>
      {missingCols.length > 0 && (
        <p className="mt-2 text-[12px] text-amber-200/85">
          Sem coluna {missingCols.map((c) => KW_SOURCE_LABEL[c].long).join(" nem ")} — a melhor
          posição sai só das outras.
        </p>
      )}
      {p.warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[11.5px] text-amber-100/75">
          {p.warnings.slice(0, 6).map((w) => (
            <li key={w}>{w}</li>
          ))}
          {p.warnings.length > 6 && <li>e mais {p.warnings.length - 6}…</li>}
        </ul>
      )}
      {sample.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/20">
          <table className="w-full min-w-[520px] text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.1em] text-white/40">
                <th className="px-2.5 py-1.5">Keyword</th>
                {COLS.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-right">
                    {KW_SOURCE_LABEL[c].short}
                  </th>
                ))}
                <th className="px-2.5 py-1.5 text-right">Melhor</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((r) => (
                <tr key={r.keyword} className="border-t border-white/[0.06]">
                  <td className="px-2.5 py-1.5 text-white/80">{r.keyword}</td>
                  {COLS.map((c) => (
                    <td
                      key={c}
                      className={`px-2 py-1.5 text-right font-mono ${
                        r.bestSource === c ? "font-bold text-white" : "text-white/40"
                      }`}
                    >
                      {fmtPos(r[c])}
                    </td>
                  ))}
                  <td className="px-2.5 py-1.5 text-right">
                    <span className={`rounded px-1.5 py-0.5 font-mono font-bold ${bandCls(r.best)}`}>
                      {fmtPos(r.best)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ranked.length > sample.length && (
            <p className="border-t border-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/35">
              … e mais {ranked.length - sample.length} com posição.
            </p>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50"
          style={{ background: GRAD }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {replacing ? `Substituir pelas ${p.rows.length} keywords` : `Carregar ${p.rows.length} keywords`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg px-3 py-2 text-[12.5px] text-white/50 transition hover:text-white"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
