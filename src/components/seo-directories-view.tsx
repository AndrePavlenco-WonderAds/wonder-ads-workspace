"use client";

// SEO Directories — gather backlinks for a client.
//
// Two ways to work, sharing one directory database:
//  1. Pick a client → the app ranks the best-fit directories (language +
//     niche gates, country + authority ranking — see seo-directory-match.ts).
//     The detected niche is editable live so a wrong guess self-corrects.
//     Add a directory to the client's pipeline (A tentar → Submetido → Live
//     → Rejeitado).
//  2. Browse / filter the whole database manually and multi-select.
//
// The database itself is fully editable in-app (add / edit / remove) and
// persisted to KV via /api/seo-directories. Targets persist via
// /api/seo-directories/targets.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Loader2,
  ExternalLink,
  Target,
  Sparkles,
  ChevronDown,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  directoryIdFromUrl,
  COUNTRY_LABELS,
  LANGUAGE_LABELS,
  SPAM_SCORES,
  SPAM_LABELS,
  type SeoDirectory,
  type SpamScore,
} from "@/lib/seo-directories";
import {
  matchDirectories,
  type ClientMatchProfile,
  type DirFit,
} from "@/lib/seo-directory-match";
import {
  TARGET_STATUSES,
  TARGET_STATUS_LABELS,
  type BacklinkTarget,
  type TargetStatus,
  type TargetsMap,
} from "@/lib/seo-backlink-targets";

const NICHE_VOCAB = [
  "health",
  "dental",
  "psychology",
  "fitness",
  "beauty",
  "travel",
  "food",
  "fashion",
  "lifestyle",
  "news",
  "webdesign",
  "tech",
  "software",
  "startup",
  "ecommerce",
  "consulting",
  "services",
  "business",
  "local",
  "reviews",
  "classifieds",
  "expat",
];

const COUNTRY_TOKENS = Object.keys(COUNTRY_LABELS);

function fmtTraffic(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-GB");
}

const FIT_STYLE: Record<DirFit, { label: string; cls: string }> = {
  strong: {
    label: "Melhor fit",
    cls: "border-emerald-400/45 bg-emerald-500/15 text-emerald-200",
  },
  good: {
    label: "Bom fit",
    cls: "border-sky-400/40 bg-sky-500/12 text-sky-200",
  },
  weak: {
    label: "Possível",
    cls: "border-white/15 bg-white/[0.05] text-white/55",
  },
};

function statusClasses(status: TargetStatus): string {
  switch (status) {
    case "awaiting-approval":
      return "border-[#783DF5]/55 bg-[#783DF5]/20 text-[#d4c4ff]";
    case "submitted":
      return "border-amber-400/45 bg-amber-500/15 text-amber-200";
    case "published":
      return "border-emerald-400/45 bg-emerald-500/15 text-emerald-200";
    case "rejected":
      return "border-rose-400/45 bg-rose-500/15 text-rose-200";
    default:
      return "border-white/20 bg-white/[0.06] text-white/75";
  }
}

// Sentinel value for the "remove from pipeline" entry in the status select.
const REMOVE_OPTION = "__remove__";

export function SeoDirectoriesView({
  directories: initialDirectories,
  clients,
  initialTargets,
}: {
  directories: SeoDirectory[];
  clients: ClientMatchProfile[];
  initialTargets: TargetsMap;
}) {
  const [directories, setDirectories] = useState(initialDirectories);
  const [targetsMap, setTargetsMap] = useState(initialTargets);
  const [error, setError] = useState<string | null>(null);

  // --- client matching state ----------------------------------------------
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const selectedClient = clients.find((c) => c.slug === selectedSlug) ?? null;
  // Language / country / niche are seeded from the client's detected geo
  // (client-geo + client-industry) but are adjustable live here WITHOUT
  // touching the real rank-tracking geo — e.g. flip Kings Gyms to English/UK,
  // or a PT clinic targeting UK expats to English.
  const [niches, setNiches] = useState<string[]>([]);
  const [lang, setLang] = useState<string>("pt");
  const [country, setCountry] = useState<string>("PT");
  useEffect(() => {
    setNiches(selectedClient?.niches ?? []);
    setLang(selectedClient?.language ?? "pt");
    setCountry(selectedClient?.country ?? "PT");
  }, [selectedClient]);
  const [showWeak, setShowWeak] = useState(false);

  const matches = useMemo(() => {
    if (!selectedClient) return [];
    return matchDirectories(
      { slug: selectedClient.slug, title: selectedClient.title, language: lang, country, niches },
      directories,
    );
  }, [selectedClient, lang, country, niches, directories]);

  const strong = matches.filter((m) => m.fit === "strong");
  const good = matches.filter((m) => m.fit === "good");
  const weak = matches.filter((m) => m.fit === "weak");

  const clientTargets = selectedSlug ? (targetsMap[selectedSlug] ?? []) : [];
  const targetIds = new Set(clientTargets.map((t) => t.directoryId));

  // --- browse / filter state -----------------------------------------------
  const [query, setQuery] = useState("");
  const [fLang, setFLang] = useState<string>("");
  const [fCountry, setFCountry] = useState<string>("");
  const [fNiche, setFNiche] = useState<string>("");
  const [fCost, setFCost] = useState<"all" | "free" | "paid">("all");
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return directories.filter((d) => {
      if (q && !(`${d.name} ${d.url} ${d.niche} ${d.tags.join(" ")}`.toLowerCase().includes(q)))
        return false;
      if (fLang && !d.languages.includes(fLang)) return false;
      if (fCountry && !d.countries.includes(fCountry)) return false;
      if (fNiche && !(d.tags.includes(fNiche) || (fNiche === "general" && d.general)))
        return false;
      if (fCost === "free" && d.paid) return false;
      if (fCost === "paid" && !d.paid) return false;
      return true;
    });
  }, [directories, query, fLang, fCountry, fNiche, fCost]);

  // --- directory CRUD -------------------------------------------------------
  const [editing, setEditing] = useState<SeoDirectory | "new" | null>(null);
  const [saving, setSaving] = useState(false);

  async function persistDirectories(next: SeoDirectory[]) {
    setDirectories(next);
    setError(null);
    try {
      const res = await fetch("/api/seo-directories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directories: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { directories: SeoDirectory[] };
      if (j.directories) setDirectories(j.directories);
    } catch (e) {
      setError(
        `Não foi possível guardar os diretórios: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  async function saveDirectory(dir: SeoDirectory) {
    setSaving(true);
    const exists = directories.some((d) => d.id === dir.id);
    const next = exists
      ? directories.map((d) => (d.id === dir.id ? dir : d))
      : [dir, ...directories];
    await persistDirectories(next);
    setSaving(false);
    setEditing(null);
  }

  async function deleteDirectory(id: string) {
    if (!window.confirm("Remover este diretório da base de dados?")) return;
    await persistDirectories(directories.filter((d) => d.id !== id));
    setSelection((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  }

  // --- targets pipeline -----------------------------------------------------
  async function persistTargets(slug: string, list: BacklinkTarget[]) {
    setTargetsMap((prev) => ({ ...prev, [slug]: list }));
    try {
      const res = await fetch("/api/seo-directories/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, targets: list }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      setError(
        `Não foi possível guardar os alvos: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  function addTargets(slug: string, dirIds: string[]) {
    const existing = targetsMap[slug] ?? [];
    const have = new Set(existing.map((t) => t.directoryId));
    const additions: BacklinkTarget[] = dirIds
      .filter((id) => !have.has(id))
      .map((id) => ({
        directoryId: id,
        status: "to-try" as TargetStatus,
        note: "",
        updatedAt: Date.now(),
      }));
    if (!additions.length) return;
    void persistTargets(slug, [...existing, ...additions]);
  }

  function updateTargetStatus(
    slug: string,
    dirId: string,
    status: TargetStatus,
  ) {
    const next = (targetsMap[slug] ?? []).map((t) =>
      t.directoryId === dirId ? { ...t, status, updatedAt: Date.now() } : t,
    );
    void persistTargets(slug, next);
  }

  function removeTarget(slug: string, dirId: string) {
    void persistTargets(
      slug,
      (targetsMap[slug] ?? []).filter((t) => t.directoryId !== dirId),
    );
  }

  const dirById = useMemo(() => {
    const m = new Map<string, SeoDirectory>();
    for (const d of directories) m.set(d.id, d);
    return m;
  }, [directories]);

  const freeCount = directories.filter((d) => !d.paid).length;

  return (
    <div className="animate-fade-up mt-2">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="brand-gradient-text">SEO Directories</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] text-white/45">
            Arranja novos backlinks para os teus clientes. Escolhe um cliente e
            a app sugere os diretórios com melhor fit (idioma + nicho + país),
            ou navega e filtra a base de dados manualmente.
          </p>
          <p className="mt-1 text-[11px] text-white/35">
            {directories.length} diretórios · {freeCount} grátis ·{" "}
            {directories.length - freeCount} pagos
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/12 px-3.5 py-2 text-[12.5px] font-semibold text-emerald-200 transition hover:border-emerald-400/70 hover:bg-emerald-500/20 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Adicionar diretório
        </button>
      </header>

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-[12px] text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {/* ───────── Match for a client ───────── */}
      <section
        aria-label="Sugestões por cliente"
        className="mt-8 rounded-2xl border border-white/8 bg-white/[0.02] p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="brand-gradient-bg flex h-10 w-10 items-center justify-center rounded-xl shadow-[0_8px_30px_-8px_rgba(120,61,245,0.7)]">
            <Sparkles className="h-5 w-5 text-white" strokeWidth={2.25} />
          </span>
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/45">
              Cliente
            </label>
            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-white/12 bg-[#0a0a0f] px-3 py-2 text-[13px] text-white outline-none transition focus:border-white/30"
            >
              <option value="">— Escolhe um cliente —</option>
              {clients.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedClient && (
          <div className="mt-5">
            {/* Detected profile — all adjustable live to refine matches */}
            <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-white/40">
                Mercado
              </span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="rounded-lg border border-white/12 bg-[#0a0a0f] px-2 py-1 text-[12px] text-white outline-none focus:border-white/30"
              >
                {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="rounded-lg border border-white/12 bg-[#0a0a0f] px-2 py-1 text-[12px] text-white outline-none focus:border-white/30"
              >
                {COUNTRY_TOKENS.map((k) => (
                  <option key={k} value={k}>
                    {COUNTRY_LABELS[k]}
                  </option>
                ))}
              </select>
              <span className="text-white/30">·</span>
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-white/40">
                Nicho (ajusta para refinar)
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {NICHE_VOCAB.map((tag) => {
                const on = niches.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setNiches((prev) =>
                        prev.includes(tag)
                          ? prev.filter((t) => t !== tag)
                          : [...prev, tag],
                      )
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      on
                        ? "border-[#783DF5]/55 bg-[#783DF5]/20 text-white"
                        : "border-white/10 bg-white/[0.02] text-white/45 hover:text-white/80"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Match results */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/55">
                  {matches.length} diretórios sugeridos
                </h3>
                {strong.length + good.length > 0 && selectedSlug && (
                  <button
                    type="button"
                    onClick={() =>
                      addTargets(
                        selectedSlug,
                        [...strong, ...good].map((m) => m.dir.id),
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-emerald-200 transition hover:border-emerald-400/70 hover:bg-emerald-500/20"
                  >
                    <Target className="h-3.5 w-3.5" />
                    Adicionar todos os bons fits
                  </button>
                )}
              </div>

              {matches.length === 0 ? (
                <p className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-6 text-center text-[12px] text-white/40">
                  Sem diretórios a condizer. Experimenta ajustar o nicho acima.
                </p>
              ) : (
                <>
                  {[...strong, ...good].map((m) => (
                    <MatchRow
                      key={m.dir.id}
                      dir={m.dir}
                      fit={m.fit}
                      reasons={m.reasons}
                      inPipeline={targetIds.has(m.dir.id)}
                      onAdd={() => addTargets(selectedSlug, [m.dir.id])}
                    />
                  ))}
                  {weak.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowWeak((v) => !v)}
                        className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-white/45 transition hover:text-white/80"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${
                            showWeak ? "rotate-180" : ""
                          }`}
                        />
                        {showWeak ? "Esconder" : "Mostrar"} {weak.length}{" "}
                        possíveis (fit mais fraco)
                      </button>
                      {showWeak &&
                        weak.map((m) => (
                          <MatchRow
                            key={m.dir.id}
                            dir={m.dir}
                            fit={m.fit}
                            reasons={m.reasons}
                            inPipeline={targetIds.has(m.dir.id)}
                            onAdd={() => addTargets(selectedSlug, [m.dir.id])}
                          />
                        ))}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Pipeline */}
            {clientTargets.length > 0 && (
              <div className="mt-7 border-t border-white/8 pt-5">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/55">
                  Pipeline · {clientTargets.length} alvos
                </h3>
                <div className="mt-3 space-y-1.5">
                  {clientTargets.map((t) => {
                    const dir = dirById.get(t.directoryId);
                    if (!dir) return null;
                    return (
                      <div
                        key={t.directoryId}
                        className="flex flex-wrap items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
                      >
                        <a
                          href={dir.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-white/90 hover:text-white"
                        >
                          <span className="truncate">{dir.name}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                        </a>
                        {dir.da != null && (
                          <span className="text-[10.5px] text-white/40">
                            DA {dir.da}
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-1.5">
                          <select
                            value={t.status}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === REMOVE_OPTION) {
                                removeTarget(selectedSlug, t.directoryId);
                              } else {
                                updateTargetStatus(
                                  selectedSlug,
                                  t.directoryId,
                                  v as TargetStatus,
                                );
                              }
                            }}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-semibold outline-none ${statusClasses(
                              t.status,
                            )}`}
                          >
                            {TARGET_STATUSES.map((s) => (
                              <option key={s} value={s} className="bg-[#0a0a0f] text-white">
                                {TARGET_STATUS_LABELS[s]}
                              </option>
                            ))}
                            <option disabled className="bg-[#0a0a0f] text-white/40">
                              ──────────
                            </option>
                            <option
                              value={REMOVE_OPTION}
                              className="bg-[#0a0a0f] text-rose-300"
                            >
                              Remover do pipeline
                            </option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              removeTarget(selectedSlug, t.directoryId)
                            }
                            aria-label="Remover do pipeline"
                            title="Remover do pipeline"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/40 transition hover:border-rose-400/50 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ───────── Browse the whole database ───────── */}
      <section aria-label="Base de dados" className="mt-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Procurar diretório, nicho, URL…"
              className="w-full rounded-lg border border-white/12 bg-white/[0.03] py-2 pl-9 pr-3 text-[13px] text-white outline-none transition focus:border-white/30 placeholder:text-white/30"
            />
          </div>
          <FilterSelect value={fLang} onChange={setFLang} placeholder="Idioma">
            {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect value={fCountry} onChange={setFCountry} placeholder="País">
            {COUNTRY_TOKENS.map((k) => (
              <option key={k} value={k}>
                {COUNTRY_LABELS[k]}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect value={fNiche} onChange={setFNiche} placeholder="Nicho">
            <option value="general">Geral (qualquer negócio)</option>
            {NICHE_VOCAB.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={fCost}
            onChange={(v) => setFCost(v as "all" | "free" | "paid")}
            placeholder="Custo"
            includeAll={false}
          >
            <option value="all">Grátis + Pagos</option>
            <option value="free">Só grátis</option>
            <option value="paid">Só pagos</option>
          </FilterSelect>
        </div>

        {selection.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#783DF5]/30 bg-[#783DF5]/10 px-3.5 py-2 text-[12px]">
            <span className="font-semibold text-white">
              {selection.size} selecionados
            </span>
            {selectedClient ? (
              <button
                type="button"
                onClick={() => {
                  addTargets(selectedSlug, [...selection]);
                  setSelection(new Set());
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/12 px-2.5 py-1 font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
              >
                <Target className="h-3.5 w-3.5" />
                Adicionar ao pipeline de {selectedClient.title}
              </button>
            ) : (
              <span className="text-white/45">
                Escolhe um cliente acima para os adicionar ao pipeline.
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelection(new Set())}
              className="text-white/50 underline-offset-2 hover:text-white hover:underline"
            >
              limpar
            </button>
          </div>
        )}

        <p className="mt-3 text-[11px] text-white/35">
          {filtered.length} de {directories.length} diretórios
        </p>

        <div className="mt-2 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.02]">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/8 bg-black/30 text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                <th className="w-9 px-3 py-2.5" />
                <th className="px-3 py-2.5">Diretório</th>
                <th className="px-3 py-2.5">Nicho</th>
                <th className="px-3 py-2.5">Idioma / País</th>
                <th className="px-3 py-2.5 text-right">DA</th>
                <th className="px-3 py-2.5 text-right">Tráfego</th>
                <th className="px-3 py-2.5">Spam</th>
                <th className="px-3 py-2.5">Submissão</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-[12px] text-white/40"
                  >
                    Nenhum diretório com estes filtros.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <BrowseRow
                    key={d.id}
                    dir={d}
                    selected={selection.has(d.id)}
                    inPipeline={targetIds.has(d.id)}
                    onToggle={() =>
                      setSelection((prev) => {
                        const n = new Set(prev);
                        if (n.has(d.id)) n.delete(d.id);
                        else n.add(d.id);
                        return n;
                      })
                    }
                    onEdit={() => setEditing(d)}
                    onDelete={() => deleteDirectory(d.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <DirectoryForm
          initial={editing === "new" ? null : editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={saveDirectory}
        />
      )}
    </div>
  );
}

function MatchRow({
  dir,
  fit,
  reasons,
  inPipeline,
  onAdd,
}: {
  dir: SeoDirectory;
  fit: DirFit;
  reasons: string[];
  inPipeline: boolean;
  onAdd: () => void;
}) {
  const style = FIT_STYLE[fit];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5 transition hover:border-white/15 hover:bg-white/[0.035]">
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${style.cls}`}
      >
        {style.label}
      </span>
      <a
        href={dir.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold text-white/90 hover:text-white"
      >
        <span className="truncate">{dir.name}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
      </a>
      <span className="hidden text-[11px] text-white/40 sm:inline">
        {dir.niche}
        {dir.paid && (
          <span className="ml-1.5 rounded bg-amber-500/15 px-1 text-amber-300">
            pago
          </span>
        )}
      </span>
      <div className="ml-auto flex items-center gap-2.5">
        <span className="hidden text-[10.5px] text-white/40 md:inline">
          {reasons.slice(0, 3).join(" · ")}
        </span>
        {inPipeline ? (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-300">
            <Check className="h-3.5 w-3.5" /> No pipeline
          </span>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] font-semibold text-white/80 transition hover:border-emerald-400/50 hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <Target className="h-3.5 w-3.5" /> Adicionar
          </button>
        )}
      </div>
    </div>
  );
}

function BrowseRow({
  dir,
  selected,
  inPipeline,
  onToggle,
  onEdit,
  onDelete,
}: {
  dir: SeoDirectory;
  selected: boolean;
  inPipeline: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-white/5 text-[12.5px] transition hover:bg-white/[0.025]">
      <td className="px-3 py-2.5 align-top">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 accent-[#783DF5]"
        />
      </td>
      <td className="px-3 py-2.5 align-top">
        <a
          href={dir.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-white/90 hover:text-white"
        >
          <span>{dir.name}</span>
          <ExternalLink className="h-3 w-3 opacity-50" />
        </a>
        <div className="mt-0.5 flex items-center gap-1.5">
          {dir.paid ? (
            <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-300">
              pago
            </span>
          ) : (
            <span className="rounded bg-emerald-500/12 px-1 text-[10px] text-emerald-300">
              grátis
            </span>
          )}
          {inPipeline && (
            <span className="text-[10px] text-emerald-300/80">· no pipeline</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 align-top text-white/60">
        {dir.niche || "—"}
        {dir.general && (
          <span className="ml-1 text-[10px] text-white/35">(geral)</span>
        )}
      </td>
      <td className="px-3 py-2.5 align-top text-white/55">
        {dir.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ")}
        <div className="text-[10.5px] text-white/35">
          {dir.countries.map((c) => COUNTRY_LABELS[c] ?? c).join(", ")}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right align-top tabular-nums text-white/70">
        {dir.da ?? "—"}
      </td>
      <td className="px-3 py-2.5 text-right align-top tabular-nums text-white/55">
        {fmtTraffic(dir.organicTraffic)}
      </td>
      <td className="px-3 py-2.5 align-top">
        {dir.spamScore ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] ${
              dir.spamScore === "very-low" || dir.spamScore === "low"
                ? "bg-emerald-500/12 text-emerald-300"
                : dir.spamScore === "medium"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-rose-500/15 text-rose-300"
            }`}
          >
            {SPAM_LABELS[dir.spamScore]}
          </span>
        ) : (
          <span className="text-white/30">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 align-top text-[11.5px] text-white/50">
        {dir.submission || "—"}
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Editar"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/45 transition hover:border-white/30 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Remover"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/45 transition hover:border-rose-400/50 hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  children,
  includeAll = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: ReactNode;
  includeAll?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border px-2.5 py-2 text-[12px] outline-none transition focus:border-white/30 ${
        value
          ? "border-[#783DF5]/45 bg-[#783DF5]/12 text-white"
          : "border-white/12 bg-white/[0.03] text-white/60"
      }`}
    >
      {includeAll && <option value="">{placeholder}: todos</option>}
      {children}
    </select>
  );
}

function DirectoryForm({
  initial,
  saving,
  onClose,
  onSave,
}: {
  initial: SeoDirectory | null;
  saving: boolean;
  onClose: () => void;
  onSave: (dir: SeoDirectory) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [niche, setNiche] = useState(initial?.niche ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [general, setGeneral] = useState(initial?.general ?? false);
  const [languages, setLanguages] = useState<string[]>(
    initial?.languages ?? ["en"],
  );
  const [countries, setCountries] = useState<string[]>(
    initial?.countries ?? ["GLOBAL"],
  );
  const [da, setDa] = useState(initial?.da?.toString() ?? "");
  const [dr, setDr] = useState(initial?.dr?.toString() ?? "");
  const [traffic, setTraffic] = useState(
    initial?.organicTraffic?.toString() ?? "",
  );
  const [spam, setSpam] = useState<SpamScore | "">(initial?.spamScore ?? "");
  const [submission, setSubmission] = useState(initial?.submission ?? "");
  const [paid, setPaid] = useState(initial?.paid ?? false);
  const [err, setErr] = useState<string | null>(null);

  function toggle<T>(list: T[], v: T, set: (l: T[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  function num(v: string): number | null {
    if (!v.trim()) return null;
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  function submit() {
    if (!url.trim()) {
      setErr("URL é obrigatório.");
      return;
    }
    if (!languages.length) {
      setErr("Escolhe pelo menos um idioma.");
      return;
    }
    const dir: SeoDirectory = {
      id: initial?.id ?? directoryIdFromUrl(url),
      name: name.trim() || url.trim(),
      url: url.trim(),
      niche: niche.trim(),
      tags,
      general,
      languages,
      countries: countries.length ? countries : ["GLOBAL"],
      da: num(da),
      dr: num(dr),
      organicTraffic: num(traffic),
      spamScore: spam || null,
      submission: submission.trim(),
      paid,
    };
    onSave(dir);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-2xl shadow-black/70">
        <header className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-white">
            {initial ? "Editar diretório" : "Adicionar diretório"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Hotfrog"
                className={inputCls}
              />
            </Field>
            <Field label="URL *">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Nicho / Indústria (texto)">
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Ex.: Business Directory"
              className={inputCls}
            />
          </Field>

          <Field label="Tags de nicho (para matching)">
            <div className="flex flex-wrap gap-1.5">
              {NICHE_VOCAB.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(tags, t, setTags)}
                  className={chipCls(tags.includes(t))}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <label className="flex items-center gap-2 text-[12.5px] text-white/70">
            <input
              type="checkbox"
              checked={general}
              onChange={(e) => setGeneral(e.target.checked)}
              className="h-4 w-4 accent-[#783DF5]"
            />
            Diretório geral (aceita qualquer negócio — aparece para todos os
            clientes)
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Idiomas *">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggle(languages, k, setLanguages)}
                    className={chipCls(languages.includes(k))}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Países">
              <div className="flex flex-wrap gap-1.5">
                {COUNTRY_TOKENS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggle(countries, k, setCountries)}
                    className={chipCls(countries.includes(k))}
                  >
                    {COUNTRY_LABELS[k]}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="DA">
              <input value={da} onChange={(e) => setDa(e.target.value)} className={inputCls} />
            </Field>
            <Field label="DR">
              <input value={dr} onChange={(e) => setDr(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Tráfego org.">
              <input
                value={traffic}
                onChange={(e) => setTraffic(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Spam">
              <select
                value={spam}
                onChange={(e) => setSpam(e.target.value as SpamScore | "")}
                className={inputCls}
              >
                <option value="">—</option>
                {SPAM_SCORES.map((s) => (
                  <option key={s} value={s}>
                    {SPAM_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Requisitos de submissão">
            <input
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              placeholder="Ex.: Free business listing"
              className={inputCls}
            />
          </Field>

          <label className="flex items-center gap-2 text-[12.5px] text-white/70">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            Diretório pago
          </label>

          {err && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11.5px] text-rose-300">
              {err}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/8 bg-black/30 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/12 px-3 py-2 text-[12px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold text-white shadow-[0_6px_22px_-4px_rgba(120,61,245,0.55)] transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Guardar
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none transition focus:border-white/30 placeholder:text-white/30";

function chipCls(on: boolean): string {
  return `rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
    on
      ? "border-[#783DF5]/55 bg-[#783DF5]/20 text-white"
      : "border-white/10 bg-white/[0.02] text-white/45 hover:text-white/80"
  }`;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}
