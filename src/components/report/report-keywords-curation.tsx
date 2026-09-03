"use client";

// A mão do consultor sobre a secção «Keywords & posições» (v77.9).
//
// O Serpstat devolve TUDO para que o domínio rankeia — «edith b», «helder
// dores», nomes de concorrentes — e as keywords do plano que ainda não
// entraram no top 100 fecham a tabela com uma coluna inteira de «fora do
// top 100». Nada disto é para o cliente ler. Aqui tira-se o que não
// interessa (fica escondido também nos meses seguintes), esconde-se de uma
// vez o que ainda não rankeia, e acrescenta-se à mão uma keyword cuja
// posição se verificou na Google.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  EyeOff,
  ListFilter,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { KeywordCuration } from "@/lib/report/report-types";
import { MAX_KEYWORD_CURATION } from "@/lib/report/report-types";

export type CurationRow = {
  keyword: string;
  position: number | null;
  inPlan: boolean;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function ReportKeywordsCuration({
  slug,
  period,
  rows,
  curation,
}: {
  slug: string;
  period: string;
  /** Tudo o que o Serpstat devolveu: a rankear primeiro, depois o plano
   *  fora do top 100. */
  rows: CurationRow[];
  curation: KeywordCuration | undefined;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set((curation?.hidden ?? []).map(norm)),
  );
  const [hideUnranked, setHideUnranked] = useState(
    curation?.hideUnranked ?? false,
  );
  const [added, setAdded] = useState<{ keyword: string; position: number | null }[]>(
    () => curation?.added ?? [],
  );
  const [query, setQuery] = useState("");
  const [newKw, setNewKw] = useState("");
  const [newPos, setNewPos] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const touch = () => {
    setDirty(true);
    setSaved(false);
  };

  const unrankedCount = rows.filter((r) => r.position === null).length;
  const existing = useMemo(() => new Set(rows.map((r) => norm(r.keyword))), [rows]);

  const isHidden = (r: CurationRow) =>
    hidden.has(norm(r.keyword)) || (hideUnranked && r.position === null);

  const visibleCount =
    rows.filter((r) => !isHidden(r)).length +
    added.filter((a) => !hidden.has(norm(a.keyword))).length;
  const hiddenCount = rows.length + added.length - visibleCount;

  const filtered = useMemo(() => {
    const q = norm(query);
    return q ? rows.filter((r) => norm(r.keyword).includes(q)) : rows;
  }, [rows, query]);

  const toggle = (keyword: string) => {
    const k = norm(keyword);
    setHidden((p) => {
      const next = new Set(p);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    touch();
  };

  function addKeyword() {
    const k = norm(newKw);
    if (!k) return;
    if (existing.has(k) || added.some((a) => norm(a.keyword) === k)) {
      setErr("Essa keyword já está na tabela — se está escondida, mostra-a.");
      return;
    }
    const posRaw = newPos.trim();
    let position: number | null = null;
    if (posRaw) {
      const n = Number(posRaw);
      if (!Number.isFinite(n) || n < 1 || n > 100) {
        setErr("A posição tem de ser um número de 1 a 100 (ou vazio = fora do top 100).");
        return;
      }
      position = Math.round(n);
    }
    setErr(null);
    setAdded((p) => [...p, { keyword: newKw.trim().slice(0, 120), position }]);
    setNewKw("");
    setNewPos("");
    touch();
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const payload: KeywordCuration = {
        hidden: Array.from(hidden).slice(0, MAX_KEYWORD_CURATION),
        hideUnranked,
        added,
      };
      const res = await fetch(`/api/reports/${slug}/${period}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kwCuration: payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setDirty(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falhou");
    } finally {
      setBusy(false);
    }
  }

  const pill = (position: number | null) =>
    position === null ? (
      <span className="shrink-0 text-[10.5px] italic text-white/35">fora do top 100</span>
    ) : (
      <span
        className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
          position <= 3
            ? "bg-emerald-500/15 text-emerald-300"
            : position <= 10
              ? "bg-emerald-500/10 text-emerald-200/80"
              : position <= 30
                ? "bg-amber-500/10 text-amber-200/85"
                : "bg-white/[0.06] text-white/55"
        }`}
      >
        {position}
      </span>
    );

  return (
    <div className="brand-gradient-border mb-4 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <ListFilter className="h-4 w-4 text-[#b79bff]" />
        <h3 className="text-sm font-semibold text-white/85">Keywords &amp; posições</h3>
        <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-semibold text-white/60">
          {visibleCount} na tabela
          {hiddenCount > 0 ? ` · ${hiddenCount} escondidas` : ""}
        </span>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-white/45">
        O que o cliente vê na secção de keywords. Esconde o que não faz sentido
        (fica escondido nos próximos meses) e acrescenta o que falta.
      </p>

      {/* O botão pedido: as do plano ainda sem posição, todas de uma vez. */}
      {unrankedCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setHideUnranked((v) => !v);
            touch();
          }}
          className={`mb-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition ${
            hideUnranked
              ? "border-[#783DF5]/50 bg-[#783DF5]/15 text-white"
              : "border-white/12 text-white/70 hover:border-[#783DF5]/50 hover:text-white"
          }`}
        >
          {hideUnranked ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {hideUnranked
            ? `Mostrar as ${unrankedCount} fora do top 100`
            : `Esconder todas fora do top 100 (${unrankedCount})`}
        </button>
      )}

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="procurar na tabela…"
          className="w-full rounded-lg border border-white/12 bg-black/25 py-1.5 pl-8 pr-3 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50"
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-1.5">
        {filtered.length === 0 && added.length === 0 ? (
          <p className="px-2 py-2 text-[12px] text-white/40">
            {rows.length === 0
              ? "Sem keywords neste relatório — o Serpstat não devolveu posições."
              : "Nada com esse nome."}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map((r) => {
              const off = isHidden(r);
              const byRule = hideUnranked && r.position === null && !hidden.has(norm(r.keyword));
              return (
                <li
                  key={r.keyword}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[12px] ${
                    off ? "text-white/30" : "text-white/80"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(r.keyword)}
                    title={off ? "Mostrar no relatório" : "Esconder do relatório"}
                    aria-label={`${off ? "Mostrar" : "Esconder"} ${r.keyword}`}
                    className={`shrink-0 rounded-md p-1 transition ${
                      off
                        ? "text-white/30 hover:bg-white/[0.06] hover:text-white"
                        : "text-[#b79bff] hover:bg-white/[0.06]"
                    }`}
                  >
                    {off ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <span className={`min-w-0 flex-1 truncate ${off ? "line-through" : ""}`}>
                    {r.keyword}
                  </span>
                  {r.inPlan && (
                    <span className="shrink-0 rounded bg-[#783DF5]/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#b79bff]">
                      plano
                    </span>
                  )}
                  {byRule && (
                    <span className="shrink-0 text-[9.5px] uppercase tracking-wider text-white/25">
                      regra
                    </span>
                  )}
                  {pill(r.position)}
                </li>
              );
            })}
            {added.map((a) => {
              const off = hidden.has(norm(a.keyword));
              return (
                <li
                  key={`added:${a.keyword}`}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[12px] ${
                    off ? "text-white/30" : "text-white/80"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAdded((p) => p.filter((x) => x.keyword !== a.keyword));
                      touch();
                    }}
                    title="Remover esta linha"
                    aria-label={`Remover ${a.keyword}`}
                    className="shrink-0 rounded-md p-1 text-white/40 transition hover:bg-white/[0.06] hover:text-red-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-0 flex-1 truncate">{a.keyword}</span>
                  <span className="shrink-0 rounded bg-sky-500/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-200">
                    manual
                  </span>
                  {pill(a.position)}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Acrescentar à mão — posição verificada pelo consultor. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addKeyword();
            }
          }}
          placeholder="adicionar keyword…"
          maxLength={120}
          className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/25 px-3 py-1.5 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50"
        />
        <input
          type="number"
          min={1}
          max={100}
          value={newPos}
          onChange={(e) => setNewPos(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addKeyword();
            }
          }}
          placeholder="pos."
          title="Posição na Google (vazio = fora do top 100)"
          className="w-16 rounded-lg border border-white/12 bg-black/25 px-2 py-1.5 text-right text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[#783DF5]/50"
        />
        <button
          type="button"
          onClick={addKeyword}
          disabled={!newKw.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12.5px] font-medium text-white/70 transition hover:border-[#783DF5]/50 hover:text-white disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Guardar keywords
        </button>
        {saved && !busy && <span className="text-[12px] text-emerald-300">Guardado ✓</span>}
        {err && <span className="text-[12px] text-rose-400">{err}</span>}
      </div>
    </div>
  );
}
