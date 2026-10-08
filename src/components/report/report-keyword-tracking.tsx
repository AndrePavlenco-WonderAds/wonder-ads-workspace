"use client";

// Passo 1 do relatório mensal (v77.82) — o KEYWORD TRACKING.
//
// Duas fases no mesmo cartão:
//   1. Escolher — 15 keywords da client file (ou todas, se houver menos). A
//      seleção do mês anterior vem marcada; troca-se o que se quiser.
//   2. Verificar — para cada keyword, a posição vista à mão no Semrush e no
//      Search Console (obrigatórias) e, se se quiser, numa pesquisa Google
//      em janela anónima com VPN / pesquisa avançada na localização do
//      cliente. Depois escolhe-se, linha a linha, qual das três o cliente vê.
//
// Grava sozinho (1,2 s depois da última alteração) e atualiza a
// pré-visualização ao lado. O servidor volta a validar tudo (kw-tracking.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import {
  KW_RANK_SOURCES,
  kwTrackingIssues,
  type KeywordTrackingBlock,
  type KwRankSource,
  type KwRankValue,
} from "@/lib/report/report-types";

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
  /** País e língua da pesquisa Google («pt», «pt-PT»). */
  gl: string;
  hl: string;
};

/** O que o input guarda: "" = por preencher, "out" = não aparece, ou o
 *  número como foi escrito («6,8»). */
type Cell = string;
type Row = { semrush: Cell; gsc: Cell; google: Cell; show: KwRankSource };

const SOURCE_META: Record<
  KwRankSource,
  { short: string; label: string; required: boolean; decimals: boolean }
> = {
  semrush: { short: "Semrush", label: "Semrush", required: true, decimals: false },
  gsc: { short: "GSC", label: "Search Console", required: true, decimals: true },
  google: { short: "Google", label: "Pesquisa Google", required: false, decimals: false },
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function toCell(v: KwRankValue): Cell {
  if (v === null) return "";
  if (v === "out") return "out";
  return String(v).replace(".", ",");
}

/** Lê o input: "" → null, "out" → "out", número 1–100 → número; o resto é
 *  inválido (undefined), e fica a vermelho sem ir para o servidor. */
function fromCell(c: Cell, decimals: boolean): KwRankValue | undefined {
  const v = c.trim();
  if (!v) return null;
  if (v === "out") return "out";
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n) || n < 1 || n > 100) return undefined;
  if (!decimals && !Number.isInteger(n)) return undefined;
  return decimals ? Math.round(n * 10) / 10 : n;
}

function fmtPrev(v: KwRankValue | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v === "out") return "100+";
  return String(v).replace(".", ",");
}

export function ReportKeywordTracking({
  slug,
  period,
  block,
  targets,
  links,
}: {
  slug: string;
  period: string;
  block: KeywordTrackingBlock;
  targets: TrackingTarget[];
  links: TrackingLinks;
}) {
  const router = useRouter();
  const required = Math.min(15, targets.length);

  const [selected, setSelected] = useState<string[]>(() =>
    block.keywords.map((k) => k.keyword),
  );
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      block.keywords.map((k) => [
        norm(k.keyword),
        {
          semrush: toCell(k.semrush),
          gsc: toCell(k.gsc),
          google: toCell(k.google),
          show: k.show,
        },
      ]),
    ),
  );
  const [location, setLocation] = useState(block.googleLocation ?? "");
  const [phase, setPhase] = useState<"select" | "fill">(() =>
    block.keywords.length === required && required > 0 ? "fill" : "select",
  );
  const initiallyComplete = kwTrackingIssues(block).length === 0;
  const [collapsed, setCollapsed] = useState(
    initiallyComplete && block.keywords.length > 0,
  );
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // O «mês passado» vem do servidor (relatório anterior) — lê-se das props,
  // que se atualizam a cada gravação.
  const previousByKw = useMemo(
    () =>
      new Map(block.keywords.map((k) => [norm(k.keyword), k.previous ?? null])),
    [block.keywords],
  );
  const targetByKw = useMemo(
    () => new Map(targets.map((t) => [norm(t.keyword), t])),
    [targets],
  );

  const rowFor = useCallback(
    (kw: string): Row =>
      rows[norm(kw)] ?? { semrush: "", gsc: "", google: "", show: "semrush" },
    [rows],
  );

  const payload = useCallback(
    (sel: string[], rs: Record<string, Row>, loc: string) => ({
      keywords: sel.map((kw) => {
        const r = rs[norm(kw)] ?? { semrush: "", gsc: "", google: "", show: "semrush" };
        return {
          keyword: kw,
          semrush: fromCell(r.semrush, false) ?? null,
          gsc: fromCell(r.gsc, true) ?? null,
          google: fromCell(r.google, false) ?? null,
          show: r.show,
        };
      }),
      googleLocation: loc,
    }),
    [],
  );

  const save = useCallback(
    async (sel: string[], rs: Record<string, Row>, loc: string) => {
      setSaving(true);
      setErr(null);
      try {
        const res = await fetch(`/api/reports/${slug}/${period}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kwTracking: payload(sel, rs, loc) }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setSavedAt(Date.now());
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Falhou a gravar");
      } finally {
        setSaving(false);
      }
    },
    [slug, period, payload, router],
  );

  // Gravação automática na fase de verificar.
  const queueSave = useCallback(
    (sel: string[], rs: Record<string, Row>, loc: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(sel, rs, loc), 1200);
    },
    [save],
  );
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function setCell(kw: string, source: KwRankSource, value: Cell) {
    const key = norm(kw);
    const next = { ...rows, [key]: { ...rowFor(kw), [source]: value } };
    // Pesquisa Google apagada e era a que se mostrava → volta ao Semrush.
    if (source === "google" && !value && next[key].show === "google") {
      next[key] = { ...next[key], show: "semrush" };
    }
    setRows(next);
    queueSave(selected, next, location);
  }

  function setShow(kw: string, show: KwRankSource) {
    const next = { ...rows, [norm(kw)]: { ...rowFor(kw), show } };
    setRows(next);
    queueSave(selected, next, location);
  }

  function setShowAll(show: KwRankSource) {
    const next = { ...rows };
    for (const kw of selected) {
      const r = rowFor(kw);
      if (show === "google" && !r.google) continue;
      next[norm(kw)] = { ...r, show };
    }
    setRows(next);
    queueSave(selected, next, location);
  }

  // —— seleção ——
  const selectedSet = useMemo(() => new Set(selected.map(norm)), [selected]);
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
  const filteredTargets = useMemo(() => {
    const q = norm(query);
    return q ? sortedTargets.filter((t) => norm(t.keyword).includes(q)) : sortedTargets;
  }, [sortedTargets, query]);

  function toggleSelect(kw: string) {
    const k = norm(kw);
    if (selectedSet.has(k)) setSelected((p) => p.filter((x) => norm(x) !== k));
    else if (selected.length < required) setSelected((p) => [...p, kw]);
  }

  function autoComplete() {
    const next = [...selected];
    for (const t of sortedTargets) {
      if (next.length >= required) break;
      if (!next.some((x) => norm(x) === norm(t.keyword))) next.push(t.keyword);
    }
    setSelected(next);
  }

  async function confirmSelection() {
    await save(selected, rows, location);
    setPhase("fill");
  }

  // —— progresso ——
  const rowState = (kw: string) => {
    const r = rowFor(kw);
    const s = fromCell(r.semrush, false);
    const g = fromCell(r.gsc, true);
    const gg = fromCell(r.google, false);
    const invalid = s === undefined || g === undefined || gg === undefined;
    const shownVal = r.show === "semrush" ? s : r.show === "gsc" ? g : gg;
    const done = !invalid && s !== null && g !== null && shownVal !== null && shownVal !== undefined;
    return { invalid, done };
  };
  const doneCount = selected.filter((kw) => rowState(kw).done).length;
  const complete =
    selected.length === required && required > 0 && doneCount === required;

  // Sem keywords na client file não há nada para escolher.
  if (targets.length === 0) {
    return (
      <section id="passo-1" className="mb-6 scroll-mt-24 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] p-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-amber-100">
          <Target className="h-4 w-4 text-amber-300" />
          Passo 1 · Keyword tracking
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-amber-100/75">
          Este cliente ainda não tem target keywords na client file. Acrescenta-as
          na página do cliente (secção Keyword Research → Target keywords) e volta
          aqui para escolher as {15} a acompanhar.
        </p>
      </section>
    );
  }

  // —— resumo fechado (tudo feito) ——
  if (collapsed && phase === "fill") {
    return (
      <section
        id="passo-1"
        className="mb-6 flex scroll-mt-24 flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] px-5 py-3.5"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-emerald-50">
            Passo 1 · Keyword tracking completo — {selected.length} keywords verificadas
          </p>
          <p className="truncate text-[11.5px] text-emerald-100/60">
            {selected.slice(0, 6).join(" · ")}
            {selected.length > 6 ? ` · +${selected.length - 6}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/80 transition hover:border-white/30 hover:text-white"
        >
          Ver / editar
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </section>
    );
  }

  return (
    <section
      id="passo-1"
      className="brand-gradient-border mb-6 scroll-mt-24 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md"
    >
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#b79bff]" />
            <h3 className="text-[15px] font-semibold text-white/90">
              Passo 1 · Keyword tracking
            </h3>
            <span className="rounded-full border border-white/12 bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-semibold text-white/60">
              {phase === "select"
                ? `${selected.length}/${required} escolhidas`
                : `${doneCount}/${required} verificadas`}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-white/50">
            {phase === "select" ? (
              <>
                Escolhe as <b className="text-white/75">{required} keywords</b> da client file
                que este relatório acompanha. As do mês passado já vêm marcadas — mantê-las
                é o que dá sentido ao «Δ mês» que o cliente vê.
              </>
            ) : (
              <>
                Para cada keyword, a posição que vês no <b className="text-white/75">Semrush</b> e
                no <b className="text-white/75">Search Console</b> (obrigatórias) e, se quiseres,
                numa <b className="text-white/75">pesquisa Google</b> em janela anónima com VPN ou
                pela pesquisa avançada na localização do cliente. Depois escolhe qual o cliente vê.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11.5px]">
          {saving ? (
            <span className="inline-flex items-center gap-1 text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> a gravar…
            </span>
          ) : err ? (
            <span className="text-rose-300">{err}</span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1 text-emerald-300/90">
              <Check className="h-3.5 w-3.5" /> gravado
            </span>
          ) : null}
          {phase === "fill" && complete && (
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

      {/* Barra de progresso */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.round(
              ((phase === "select" ? selected.length : doneCount) / Math.max(1, required)) * 100,
            )}%`,
            background: "linear-gradient(90deg,#343ED7,#783DF5,#C535C9)",
          }}
        />
      </div>

      {phase === "select" ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
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
            {selected.length < required && (
              <button
                type="button"
                onClick={autoComplete}
                title="Completa com as prioritárias e as de maior volume que ainda não estão escolhidas"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-[12px] font-medium text-white/75 transition hover:border-[#783DF5]/50 hover:text-white"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Completar com as de maior volume
              </button>
            )}
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="rounded-lg px-2.5 py-2 text-[12px] text-white/45 transition hover:text-white"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="mt-3 grid max-h-[420px] grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTargets.map((t) => {
              const on = selectedSet.has(norm(t.keyword));
              const full = !on && selected.length >= required;
              return (
                <button
                  key={t.keyword}
                  type="button"
                  onClick={() => toggleSelect(t.keyword)}
                  disabled={full}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[12.5px] transition ${
                    on
                      ? "border-[#783DF5]/60 bg-[#783DF5]/15 text-white"
                      : full
                        ? "cursor-not-allowed border-transparent text-white/25"
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

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void confirmSelection()}
              disabled={selected.length !== required || saving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#783DF5]/25 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:translate-y-0 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#343ED7,#783DF5,#C535C9)" }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar as {required} e verificar posições
            </button>
            {selected.length !== required && (
              <span className="text-[12px] text-white/45">
                Faltam {required - selected.length}
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Ferramentas */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {links.semrush && (
              <a
                href={links.semrush}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Abrir Semrush <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <a
              href={links.gsc ?? "https://search.google.com/search-console"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-white/75 transition hover:border-white/30 hover:text-white"
            >
              Abrir Search Console <ExternalLink className="h-3 w-3" />
            </a>
            <label className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/12 bg-black/20 px-2.5 py-1.5 text-[12px] text-white/55">
              <MapPin className="h-3.5 w-3.5 text-white/40" />
              Pesquisa Google feita em
              <input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  queueSave(selected, rows, e.target.value);
                }}
                placeholder="ex.: Lisboa"
                maxLength={80}
                className="w-28 bg-transparent text-white outline-none placeholder:text-white/25"
              />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-white/45">
            Mostrar no relatório, em todas:
            {KW_RANK_SOURCES.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setShowAll(src)}
                className="rounded-md border border-white/12 px-2 py-0.5 text-white/70 transition hover:border-[#783DF5]/50 hover:text-white"
              >
                {SOURCE_META[src].label}
              </button>
            ))}
            <span className="text-white/30">(a pesquisa Google só onde estiver preenchida)</span>
          </div>

          {/* A grelha */}
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[860px] border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-white/[0.04] text-left text-[10.5px] uppercase tracking-[0.1em] text-white/45">
                  <th className="px-3 py-2 font-semibold">Keyword</th>
                  {KW_RANK_SOURCES.map((src) => (
                    <th key={src} className="px-2 py-2 font-semibold">
                      {SOURCE_META[src].label}
                      {SOURCE_META[src].required ? (
                        <span className="text-rose-300"> *</span>
                      ) : (
                        <span className="normal-case tracking-normal text-white/30"> (opcional)</span>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-semibold">O cliente vê</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((kw) => {
                  const r = rowFor(kw);
                  const t = targetByKw.get(norm(kw));
                  const prev = previousByKw.get(norm(kw)) ?? null;
                  const st = rowState(kw);
                  const gUrl = `https://www.google.com/search?q=${encodeURIComponent(kw)}&gl=${links.gl}&hl=${links.hl}&pws=0`;
                  return (
                    <tr key={kw} className="border-t border-white/[0.06] align-top">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {st.done ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          ) : (
                            <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20" />
                          )}
                          <span className="font-medium text-white/85">{kw}</span>
                          {t?.premium && (
                            <Star className="h-3 w-3 shrink-0 fill-amber-300 text-amber-300" />
                          )}
                          <a
                            href={gUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Pesquisar no Google (sem personalização). Confirma a localização com VPN ou na pesquisa avançada."
                            className="rounded p-0.5 text-white/30 transition hover:text-white"
                          >
                            <Search className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="mt-0.5 pl-5 text-[10.5px] text-white/35">
                          {t?.volume !== null && t?.volume !== undefined
                            ? `${t.volume.toLocaleString("pt-PT")} pesq./mês`
                            : "sem volume"}
                          {prev &&
                            ` · mês passado: S ${fmtPrev(prev.semrush)} · GSC ${fmtPrev(prev.gsc)} · G ${fmtPrev(prev.google)}`}
                        </div>
                      </td>
                      {KW_RANK_SOURCES.map((src) => (
                        <td key={src} className="px-2 py-2">
                          <RankInput
                            value={r[src]}
                            decimals={SOURCE_META[src].decimals}
                            active={r.show === src}
                            onChange={(v) => setCell(kw, src, v)}
                            label={`${SOURCE_META[src].label} — ${kw}`}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <div className="inline-flex overflow-hidden rounded-lg border border-white/12">
                          {KW_RANK_SOURCES.map((src) => {
                            const disabled = src === "google" && !r.google;
                            const on = r.show === src;
                            return (
                              <button
                                key={src}
                                type="button"
                                disabled={disabled}
                                onClick={() => setShow(kw, src)}
                                title={
                                  disabled
                                    ? "Preenche a pesquisa Google para a poderes mostrar"
                                    : `Mostrar ${SOURCE_META[src].label} ao cliente`
                                }
                                className={`px-2.5 py-1 text-[11px] font-semibold transition ${
                                  on
                                    ? "bg-[#783DF5] text-white"
                                    : disabled
                                      ? "cursor-not-allowed text-white/20"
                                      : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                                }`}
                              >
                                {SOURCE_META[src].short}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11.5px] text-white/40">
            <button
              type="button"
              onClick={() => setPhase("select")}
              className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-2.5 py-1 text-white/65 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Mudar as keywords
            </button>
            <span>
              Posição de 1 a 100 (o Search Console aceita décimas, ex.: 6,8). Se a keyword não
              aparece, usa o <b className="text-white/60">∅</b> — fica «100+» no relatório.
            </span>
          </div>
        </>
      )}
    </section>
  );
}

/** Um campo de posição: número, ou «não aparece». */
function RankInput({
  value,
  decimals,
  active,
  onChange,
  label,
}: {
  value: Cell;
  decimals: boolean;
  active: boolean;
  onChange: (v: Cell) => void;
  label: string;
}) {
  const invalid = fromCell(value, decimals) === undefined;
  if (value === "out") {
    return (
      <span
        className={`inline-flex h-8 w-[118px] items-center justify-between rounded-lg border px-2 text-[11.5px] ${
          active ? "border-[#783DF5]/60 bg-[#783DF5]/10 text-white/80" : "border-white/12 text-white/55"
        }`}
      >
        não aparece
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Limpar ${label}`}
          className="rounded p-0.5 text-white/40 hover:text-white"
        >
          <X className="h-3 w-3" />
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        inputMode="decimal"
        placeholder={decimals ? "ex.: 6,8" : "pos."}
        aria-label={label}
        className={`h-8 w-[84px] rounded-lg border bg-black/25 px-2 text-right font-mono text-[12.5px] text-white outline-none placeholder:font-sans placeholder:text-white/20 ${
          invalid
            ? "border-rose-400/70"
            : active
              ? "border-[#783DF5]/60 ring-1 ring-[#783DF5]/30"
              : "border-white/12 focus:border-white/30"
        }`}
      />
      <button
        type="button"
        onClick={() => onChange("out")}
        title="Não aparece (fora do top 100 / sem dados)"
        aria-label={`Não aparece — ${label}`}
        className="flex h-8 w-7 items-center justify-center rounded-lg border border-white/10 text-[12px] text-white/35 transition hover:border-white/25 hover:text-white"
      >
        ∅
      </button>
    </span>
  );
}
