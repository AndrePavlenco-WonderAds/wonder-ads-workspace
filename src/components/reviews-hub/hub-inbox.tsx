"use client";

// Caixa de reviews — filtros, a lista e, ao lado, o painel de resposta.
// Atalhos: J/K (ou ↓/↑) muda de review, G gera a resposta da selecionada.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Bot, CircleCheck, Hourglass, PenLine, Search, X } from "lucide-react";
import type { HubReview } from "@/lib/reviews-hub/types";
import { useHub, type InboxTab } from "./hub-context";
import { Composer } from "./hub-composer";
import { EmptyState } from "./hub-dashboard";
import { Avatar, Kbd, LEVELS, Skeleton, StarRow, levelOf, relativeTime } from "./hub-ui";

type Sort = "new" | "old" | "worst";
const PAGE = 40;

function useIsDesktop() {
  const [v, setV] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setV(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return v;
}

export function InboxView() {
  const { scoped, data, loaded, inboxPreset, syncing, locationsById, loc } = useHub();
  const [tab, setTab] = useState<InboxTab>("pending");
  const [stars, setStars] = useState<number[]>([]);
  const [q, setQ] = useState("");
  const [onlyText, setOnlyText] = useState(false);
  const [sort, setSort] = useState<Sort>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [sheet, setSheet] = useState(false);
  const isDesktop = useIsDesktop();
  const listRef = useRef<HTMLDivElement>(null);

  // Um atalho de outra vista (dashboard, ranking…) chega aqui como preset.
  useEffect(() => {
    if (!inboxPreset) return;
    setTab(inboxPreset.tab ?? "pending");
    setStars(inboxPreset.stars ?? []);
    setQ("");
    setLimit(PAGE);
    if (inboxPreset.reviewId) {
      setSelectedId(inboxPreset.reviewId);
      setSheet(true);
    }
  }, [inboxPreset]);

  const drafts = data.drafts;
  const counts = useMemo(
    () => ({
      pending: scoped.filter((r) => !r.reply).length,
      approval: scoped.filter((r) => drafts[r.id]?.status === "awaiting_approval").length,
      answered: scoped.filter((r) => r.reply).length,
      all: scoped.length,
    }),
    [scoped, drafts],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = scoped.filter((r) => {
      if (tab === "pending" && r.reply) return false;
      if (tab === "answered" && !r.reply) return false;
      if (tab === "approval" && drafts[r.id]?.status !== "awaiting_approval") return false;
      if (stars.length && !stars.includes(r.stars)) return false;
      if (onlyText && !r.text) return false;
      if (needle && !`${r.author} ${r.text} ${r.reply?.text ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    if (sort === "old") list.sort((a, b) => a.created.localeCompare(b.created));
    else if (sort === "worst")
      list.sort((a, b) => (a.stars || 6) - (b.stars || 6) || b.created.localeCompare(a.created));
    return list;
  }, [scoped, tab, stars, onlyText, q, sort, drafts]);

  useEffect(() => setLimit(PAGE), [tab, stars, onlyText, q, sort, loc]);

  const selected: HubReview | null =
    filtered.find((r) => r.id === selectedId) ?? scoped.find((r) => r.id === selectedId) ?? null;

  // No desktop há sempre uma review aberta: a primeira da lista.
  useEffect(() => {
    if (!isDesktop || !loaded) return;
    if (!selectedId || !scoped.some((r) => r.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [isDesktop, loaded, filtered, scoped, selectedId]);

  // J/K e setas — só quando não se está a escrever.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = filtered.findIndex((r) => r.id === selectedId);
      if (e.key === "j" || e.key === "ArrowDown") {
        const next = filtered[Math.min(filtered.length - 1, idx + 1)];
        if (next) {
          e.preventDefault();
          setSelectedId(next.id);
          if (idx + 1 >= limit - 3) setLimit((l) => l + PAGE);
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        const prev = filtered[Math.max(0, idx - 1)];
        if (prev) {
          e.preventDefault();
          setSelectedId(prev.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId, limit]);

  // Mantém a selecionada à vista quando se navega com o teclado.
  useEffect(() => {
    if (!selectedId) return;
    listRef.current
      ?.querySelector(`[data-review="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  if (!loaded) {
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[110px] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="hidden h-[520px] rounded-2xl lg:block" />
      </div>
    );
  }
  if (data.reviews.length === 0) return <EmptyState syncing={syncing} />;

  const onPublished = (r: HubReview) => {
    // Na lista «Por responder», passa sozinho à próxima.
    if (tab !== "pending") return;
    const idx = filtered.findIndex((x) => x.id === r.id);
    const next = filtered[idx + 1] ?? filtered[idx - 1];
    setSelectedId(next && next.id !== r.id ? next.id : null);
    if (!isDesktop) setSheet(false);
  };

  const TABS: { key: InboxTab; label: string; n: number; hide?: boolean }[] = [
    { key: "pending", label: "Por responder", n: counts.pending },
    { key: "approval", label: "Para aprovar", n: counts.approval, hide: counts.approval === 0 && tab !== "approval" },
    { key: "answered", label: "Respondidas", n: counts.answered },
    { key: "all", label: "Todas", n: counts.all },
  ];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Coluna da lista */}
      <div className="min-w-0">
        <div className="space-y-3">
          <LayoutGroup id="rhub-tabs">
            <div className="rhub-scroll flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1">
              {TABS.filter((t) => !t.hide).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`relative flex shrink-0 grow items-center justify-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition ${
                    tab === t.key ? "text-white" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {tab === t.key && (
                    <motion.span
                      layoutId="rhub-tab"
                      className="absolute inset-0 rounded-xl bg-white/[0.08] ring-1 ring-white/10"
                      transition={{ type: "spring", stiffness: 450, damping: 36 }}
                    />
                  )}
                  <span className="relative">{t.label}</span>
                  <span
                    className={`relative rounded-full px-1.5 text-[11px] tabular-nums ${
                      t.key === "pending" && t.n > 0
                        ? "bg-rose-500/20 text-rose-200"
                        : t.key === "approval"
                          ? "bg-amber-400/20 text-amber-200"
                          : "bg-white/[0.07] text-white/50"
                    }`}
                  >
                    {t.n.toLocaleString("pt-PT")}
                  </span>
                </button>
              ))}
            </div>
          </LayoutGroup>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Procurar por nome ou texto…"
                className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-8 pr-8 text-[13px] text-white outline-none transition placeholder:text-white/30 focus:border-violet-400/50"
              />
              {q && (
                <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="modal-input h-9 !w-auto !py-0 text-[13px]"
              aria-label="Ordenar"
            >
              <option value="new">Mais recentes</option>
              <option value="old">Mais antigas</option>
              <option value="worst">Pior nota primeiro</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => {
              const on = stars.includes(s);
              const L = LEVELS[levelOf(s)];
              return (
                <motion.button
                  key={s}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setStars((v) => (on ? v.filter((x) => x !== s) : [...v, s]))}
                  className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition"
                  style={
                    on
                      ? { borderColor: L.ring, background: L.soft, color: L.color }
                      : { borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.5)" }
                  }
                >
                  {s} ★
                </motion.button>
              );
            })}
            <button
              onClick={() => setOnlyText((v) => !v)}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                onlyText ? "border-violet-400/40 bg-violet-500/15 text-violet-100" : "border-white/10 text-white/50 hover:text-white/80"
              }`}
            >
              Com comentário
            </button>
            {(stars.length > 0 || onlyText || q) && (
              <button
                onClick={() => {
                  setStars([]);
                  setOnlyText(false);
                  setQ("");
                }}
                className="ml-1 text-[12px] text-white/40 hover:text-white"
              >
                Limpar filtros
              </button>
            )}
            <span className="ml-auto hidden items-center gap-1 text-[11px] text-white/30 xl:flex">
              <Kbd>J</Kbd>
              <Kbd>K</Kbd> navegar · <Kbd>G</Kbd> gerar
            </span>
          </div>
        </div>

        <div ref={listRef} className="mt-4 space-y-2.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.slice(0, limit).map((r, i) => (
              <ReviewItem
                key={r.id}
                review={r}
                index={i}
                active={r.id === selectedId}
                salon={loc === "all" ? locationsById.get(r.loc)?.short : undefined}
                draftStatus={drafts[r.id]?.status}
                onClick={() => {
                  setSelectedId(r.id);
                  setSheet(true);
                }}
              />
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center"
            >
              <CircleCheck className="h-8 w-8 text-emerald-300/80" />
              <p className="mt-3 text-[15px] font-semibold text-white">
                {tab === "pending" && !stars.length && !q ? "Tudo respondido!" : "Nada com estes filtros"}
              </p>
              <p className="mt-1 text-[13px] text-white/45">
                {tab === "pending" && !stars.length && !q
                  ? "Não há reviews à espera de resposta neste momento."
                  : "Experimente outros filtros ou outro salão."}
              </p>
            </motion.div>
          )}
          {filtered.length > limit && (
            <button
              onClick={() => setLimit((l) => l + PAGE)}
              className="w-full rounded-2xl border border-white/10 py-3 text-[13px] font-medium text-white/60 transition hover:border-white/20 hover:text-white"
            >
              Mostrar mais ({(filtered.length - limit).toLocaleString("pt-PT")} por ver)
            </button>
          )}
        </div>
      </div>

      {/* Painel de resposta — ao lado no desktop, folha por baixo no telemóvel */}
      {isDesktop ? (
        <div className="sticky top-6">
          {selected ? (
            <motion.div
              key="composer"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
            >
              <Composer review={selected} onPublished={onPublished} />
            </motion.div>
          ) : (
            <motion.div
              key="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center"
            >
              <PenLine className="h-7 w-7 text-white/25" />
              <p className="mt-3 text-[14px] text-white/45">Escolha uma review para responder.</p>
            </motion.div>
          )}
        </div>
      ) : (
        <AnimatePresence>
          {selected && sheet && (
            <>
              <motion.div
                className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSheet(false)}
              />
              <motion.div
                className="rhub-scroll fixed inset-x-0 bottom-0 z-[61] max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0a0a11] p-3 pb-8"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => info.offset.y > 120 && setSheet(false)}
              >
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20" />
                <Composer review={selected} onPublished={onPublished} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function ReviewItem({
  review,
  index,
  active,
  salon,
  draftStatus,
  onClick,
}: {
  review: HubReview;
  index: number;
  active: boolean;
  salon?: string;
  draftStatus?: "draft" | "awaiting_approval" | "failed";
  onClick: () => void;
}) {
  const L = LEVELS[levelOf(review.stars)];
  return (
    <motion.button
      layout="position"
      data-review={review.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30, transition: { duration: 0.25 } }}
      transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.03, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-colors ${
        active
          ? "border-violet-400/45 bg-[linear-gradient(135deg,rgba(79,70,229,0.14),rgba(168,85,247,0.08))] shadow-[0_12px_40px_-20px_rgba(139,92,246,0.8)]"
          : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.035]"
      }`}
    >
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: L.color, opacity: active ? 1 : 0.55 }} />
      <div className="flex gap-3">
        <Avatar name={review.author} photo={review.photo} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-white/90">{review.author}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/40">
                <StarRow value={review.stars} size={12} />
                <span>{relativeTime(review.created)}</span>
                {salon && <span className="truncate">· {salon}</span>}
              </div>
            </div>
            <StatusChip review={review} draftStatus={draftStatus} />
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/60">
            {review.text || <em className="text-white/30">Sem comentário — só a nota.</em>}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

function StatusChip({
  review,
  draftStatus,
}: {
  review: HubReview;
  draftStatus?: "draft" | "awaiting_approval" | "failed";
}) {
  if (draftStatus === "awaiting_approval") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
        <Hourglass className="h-3 w-3" /> Para aprovar
      </span>
    );
  }
  if (draftStatus === "failed") {
    return <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200">Falhou</span>;
  }
  if (draftStatus === "draft") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
        <PenLine className="h-3 w-3" /> Rascunho
      </span>
    );
  }
  if (review.reply) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
        {review.reply.via === "auto" ? <Bot className="h-3 w-3" /> : <CircleCheck className="h-3 w-3" />}
        Respondida
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/50">
      Sem resposta
    </span>
  );
}
