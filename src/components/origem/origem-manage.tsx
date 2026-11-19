"use client";

// Origem de Pacientes — apagar registos e repor (v80.4).
//
// Só para a equipa WonderAds com sessão (a receção, com o PIN, nunca vê
// isto): apagar um registo da lista de hoje, ou dar reset a um período (hoje,
// este mês, desde o início) num local ou em todos. Apagar pede sempre a
// palavra «Confirmar» escrita. O que sai fica no histórico, e só um
// SuperAdmin o vê e repõe.

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Eraser, History, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import type { OrigemClient } from "@/lib/origem/config";
import { PERIOD_LABEL, type OrigemActionView, type OrigemPeriod } from "@/lib/origem/manage";
import { placeWords } from "@/lib/origem/words";
import { dayLabel, lisbonClock, lisbonParts, monthLabel, scopeOf, type MonthStats, type TodayVote } from "@/lib/origem/stats";

export type ManageSnapshot = { history?: MonthStats[]; today?: TodayVote[] };

const DANGER = "#B42318";

/** «19/11/2026 10:42», em hora de Lisboa. */
function stamp(ms: number): string {
  const { month, day } = lisbonParts(ms);
  return `${dayLabel(month, day)} ${lisbonClock(ms)}`;
}

const isWord = (v: string) => v.trim().toLowerCase() === "confirmar";
const registos = (n: number) => (n === 1 ? "1 registo" : `${n} registos`);
const apagados = (n: number) => (n === 1 ? "1 registo apagado" : `${n} registos apagados`);

function sourceLabel(cfg: OrigemClient, id: string) {
  return cfg.sources.find((s) => s.id === id)?.label ?? "Outra";
}
function sourceColor(cfg: OrigemClient, id: string) {
  return cfg.sources.find((s) => s.id === id)?.color ?? cfg.sources[cfg.sources.length - 1]?.color ?? "#888";
}
function siteShort(cfg: OrigemClient, id: string | null) {
  if (!id) return `${placeWords(cfg).allCap} ${placeWords(cfg).the === "a" ? "as" : "os"} ${cfg.place.many}`;
  return cfg.sites.find((s) => s.id === id)?.short ?? id;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Não foi possível concluir. Verifique a ligação e tente outra vez.");
  return j;
}

/* ───────────────────────────── A moldura ───────────────────────────── */

function Modal({
  title,
  icon,
  onClose,
  busy,
  wide = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  busy: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const labelId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => !busy && onClose()}
        className="absolute inset-0 cursor-default bg-[rgba(var(--o-ink-rgb),0.45)]"
        tabIndex={-1}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-[calc(32px*var(--o-rs))] bg-white shadow-[0_40px_80px_-30px_rgba(var(--o-ink-rgb),0.6)] sm:rounded-[calc(32px*var(--o-rs))] ${
          wide ? "max-w-[680px]" : "max-w-[560px]"
        }`}
        initial={reduce ? { opacity: 0 } : { y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      >
        <div className="flex items-center gap-3 px-5 pb-2 pt-6 sm:px-8 sm:pt-8">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--o-paper)] text-[var(--o-ink)] ring-1 ring-[var(--o-line)]">
            {icon}
          </span>
          <h2 id={labelId} className="min-w-0 flex-1 text-[22px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[24px]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--o-muted)] transition hover:bg-[var(--o-paper)] hover:text-[var(--o-ink)] disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(24px,env(safe-area-inset-bottom))] sm:px-8 sm:pb-8">{children}</div>
      </motion.div>
    </motion.div>
  );
}

/** O campo onde se escreve «Confirmar» e o botão vermelho. */
function ConfirmBlock({
  label,
  disabled,
  busy,
  error,
  onConfirm,
}: {
  label: string;
  disabled: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  const [word, setWord] = useState("");
  const ok = isWord(word) && !disabled && !busy;
  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onConfirm();
      }}
    >
      <label className="block">
        <span className="block text-[15px] font-bold">
          Para apagar, escreva <span style={{ color: DANGER }}>Confirmar</span>
        </span>
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          disabled={busy}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder="Confirmar"
          className="mt-2 h-14 w-full rounded-[calc(18px*var(--o-rs))] border border-[var(--o-line-strong)] bg-white px-4 text-[18px] font-semibold outline-none transition placeholder:font-normal placeholder:text-[var(--o-muted)]/60 focus:border-[var(--o-deep)]"
        />
      </label>
      {error && (
        <p className="mt-3 rounded-[calc(14px*var(--o-rs))] bg-[#FEF3F2] px-4 py-3 text-[14.5px] text-[#7A271A]" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!ok}
        className="mt-4 flex h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-[calc(20px*var(--o-rs))] text-[16.5px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: DANGER }}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
        {label}
      </button>
    </form>
  );
}

const KEEP_NOTE = "Deixa de contar nos números. Fica no histórico, e um SuperAdmin pode repor.";

/* ─────────────────────────── Apagar um registo ─────────────────────────── */

export function DeleteVoteSheet({
  cfg,
  slug,
  vote,
  onClose,
  onDone,
}: {
  cfg: OrigemClient;
  slug: string;
  vote: TodayVote;
  onClose: () => void;
  onDone: (snap: ManageSnapshot, removed: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channel = vote.channel ? cfg.channels.find((c) => c.id === vote.channel)?.label ?? null : null;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const j = await post<ManageSnapshot & { removed: number }>(`/api/origem/${slug}/manage`, { op: "delete", id: vote.id, confirm: "Confirmar" });
      onDone(j, j.removed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível apagar.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Apagar este registo?" icon={<Trash2 className="h-5 w-5" />} onClose={onClose} busy={busy}>
      <div className="mt-3 flex items-center gap-3 rounded-[calc(20px*var(--o-rs))] bg-[var(--o-paper)] px-4 py-4 ring-1 ring-[var(--o-line)]">
        <span className="w-12 shrink-0 text-[15px] font-bold tabular-nums text-[var(--o-muted)]">{lisbonClock(vote.at)}</span>
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: sourceColor(cfg, vote.source) }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-bold">{sourceLabel(cfg, vote.source)}</span>
          <span className="block truncate text-[14px] text-[var(--o-muted)]">
            {[channel, cfg.sites.length > 1 ? siteShort(cfg, vote.site) : null].filter(Boolean).join(" · ") || "Sem canal indicado"}
          </span>
        </span>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--o-muted)]">{KEEP_NOTE}</p>
      <ConfirmBlock label="Apagar registo" disabled={false} busy={busy} error={error} onConfirm={run} />
    </Modal>
  );
}

/* ─────────────────────────── Apagar por período ─────────────────────────── */

export function ResetSheet({
  cfg,
  slug,
  site,
  history,
  today,
  now,
  onClose,
  onDone,
}: {
  cfg: OrigemClient;
  slug: string;
  /** O local deste tablet (ou null). */
  site: string | null;
  history: Record<string, MonthStats>;
  today: TodayVote[];
  now: number;
  onClose: () => void;
  onDone: (snap: ManageSnapshot, removed: number) => void;
}) {
  const single = cfg.sites.length === 1;
  const [period, setPeriod] = useState<OrigemPeriod>("today");
  const [scope, setScope] = useState<string | null>(single ? null : site);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const words = placeWords(cfg);
  const current = lisbonParts(now).month;

  const count =
    period === "today"
      ? today.filter((v) => !scope || v.site === scope).length
      : period === "month"
        ? scopeOf(history[current], current, scope).total
        : Object.entries(history).reduce((a, [m, s]) => a + scopeOf(s, m, scope).total, 0);

  const periodHint: Record<OrigemPeriod, string> = {
    today: dayLabel(current, lisbonParts(now).day),
    month: monthLabel(current),
    all: "Todos os meses",
  };

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const j = await post<ManageSnapshot & { removed: number }>(`/api/origem/${slug}/manage`, {
        op: "reset",
        period,
        site: scope,
        confirm: "Confirmar",
      });
      onDone(j, j.removed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível apagar.");
      setBusy(false);
    }
  }

  const chip = (on: boolean) =>
    `flex min-h-[56px] touch-manipulation flex-col items-start justify-center rounded-[calc(18px*var(--o-rs))] px-4 py-2.5 text-left ring-1 transition ${
      on ? "bg-[var(--o-ink)] text-white ring-[var(--o-ink)]" : "bg-white text-[var(--o-ink)] ring-[var(--o-line)] hover:ring-[var(--o-deep)]"
    }`;

  return (
    <Modal title="Apagar registos" icon={<Eraser className="h-5 w-5" />} onClose={onClose} busy={busy}>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--o-muted)]">
        Para limpar testes ou recomeçar a contagem. {KEEP_NOTE}
      </p>

      <fieldset className="mt-6" disabled={busy}>
        <legend className="text-[15px] font-bold">Que registos?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(Object.keys(PERIOD_LABEL) as OrigemPeriod[]).map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)} className={chip(period === p)} aria-pressed={period === p}>
              <span className="text-[15.5px] font-bold leading-tight">{PERIOD_LABEL[p]}</span>
              <span className={`text-[12.5px] leading-tight ${period === p ? "text-white/70" : "text-[var(--o-muted)]"}`}>{periodHint[p]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {!single && (
        <fieldset className="mt-5" disabled={busy}>
          <legend className="text-[15px] font-bold">Onde?</legend>
          {cfg.sites.length <= 4 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {[null, ...cfg.sites.map((s) => s.id)].map((id) => (
                <button
                  key={id ?? "all"}
                  type="button"
                  onClick={() => setScope(id)}
                  aria-pressed={scope === id}
                  className={`h-12 touch-manipulation rounded-[var(--o-pill)] px-4 text-[15px] font-bold ring-1 transition ${
                    scope === id ? "bg-[var(--o-ink)] text-white ring-[var(--o-ink)]" : "bg-white ring-[var(--o-line)] hover:ring-[var(--o-deep)]"
                  }`}
                >
                  {id ? siteShort(cfg, id) : `${words.allCap} ${words.the === "a" ? "as" : "os"} ${cfg.place.many}`}
                </button>
              ))}
            </div>
          ) : (
            <select
              value={scope ?? ""}
              onChange={(e) => setScope(e.target.value || null)}
              className="mt-2 h-12 w-full rounded-[calc(16px*var(--o-rs))] border border-[var(--o-line-strong)] bg-white px-3 text-[16px] font-semibold"
            >
              <option value="">
                {words.allCap} {words.the === "a" ? "as" : "os"} {cfg.place.many}
              </option>
              {cfg.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </fieldset>
      )}

      <p className="mt-6 flex items-baseline gap-2 border-t border-[var(--o-line)] pt-5">
        <span className="o-display text-[40px] leading-none tracking-[-0.03em]">{count}</span>
        <span className="text-[15px] font-semibold text-[var(--o-muted)]">{count === 1 ? "registo a apagar" : "registos a apagar"}</span>
      </p>

      <ConfirmBlock
        key={`${period}-${scope ?? "all"}`}
        label={count ? `Apagar ${registos(count)}` : "Sem registos a apagar"}
        disabled={count === 0}
        busy={busy}
        error={error}
        onConfirm={run}
      />
    </Modal>
  );
}

/* ───────────────────────────── O histórico ───────────────────────────── */

export function HistorySheet({
  cfg,
  slug,
  onClose,
  onDone,
}: {
  cfg: OrigemClient;
  slug: string;
  onClose: () => void;
  onDone: (snap: ManageSnapshot, restored: number) => void;
}) {
  const [actions, setActions] = useState<OrigemActionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    fetch(`/api/origem/${slug}/history`, { cache: "no-store" })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as { actions?: OrigemActionView[]; error?: string };
        if (!res.ok) throw new Error(j.error ?? "Não foi possível abrir o histórico.");
        if (!stop) setActions(j.actions ?? []);
      })
      .catch((err) => !stop && setError(err instanceof Error ? err.message : "Não foi possível abrir o histórico."));
    return () => {
      stop = true;
    };
  }, [slug]);

  async function restore(a: OrigemActionView) {
    setBusy(a.id);
    setError(null);
    try {
      const j = await post<ManageSnapshot & { actions: OrigemActionView[] }>(`/api/origem/${slug}/history`, { id: a.id });
      setActions(j.actions);
      setAsking(null);
      onDone(j, a.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível repor.");
    } finally {
      setBusy(null);
    }
  }

  const sourcesLine = (a: OrigemActionView) =>
    Object.entries(a.sources)
      .sort((x, y) => y[1] - x[1])
      .map(([id, n]) => `${sourceLabel(cfg, id)} ${n}`)
      .join(" · ");

  return (
    <Modal title="Histórico do que se apagou" icon={<History className="h-5 w-5" />} onClose={onClose} busy={Boolean(busy)} wide>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--o-muted)]">
        Cada registo apagado fica aqui. «Repor» devolve-o aos números, tal como estava.
      </p>
      {error && (
        <p className="mt-4 rounded-[calc(14px*var(--o-rs))] bg-[#FEF3F2] px-4 py-3 text-[14.5px] text-[#7A271A]" role="alert">
          {error}
        </p>
      )}
      {!actions && !error ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--o-muted)]" />
        </div>
      ) : actions && actions.length === 0 ? (
        <p className="mt-6 rounded-[calc(18px*var(--o-rs))] bg-[var(--o-paper)] px-5 py-6 text-[15px] text-[var(--o-muted)]">
          Ainda não se apagou nenhum registo.
        </p>
      ) : (
        <ol className="mt-5 grid gap-3">
          {actions?.map((a) => {
            const reverted = Boolean(a.revertedAt);
            const channel = a.vote?.channel ? cfg.channels.find((c) => c.id === a.vote?.channel)?.label ?? null : null;
            const title =
              a.kind === "delete" && a.vote
                ? `Registo apagado: ${sourceLabel(cfg, a.vote.source)}`
                : `${a.period ? PERIOD_LABEL[a.period] : "Reset"}: ${apagados(a.count)}`;
            const detail =
              a.kind === "delete" && a.vote
                ? [channel, cfg.sites.length > 1 ? siteShort(cfg, a.vote.site) : null, `registo de ${stamp(a.vote.at)}`].filter(Boolean).join(" · ")
                : [cfg.sites.length > 1 ? siteShort(cfg, a.site) : null, sourcesLine(a)].filter(Boolean).join(" · ");
            return (
              <li
                key={a.id}
                className={`rounded-[calc(20px*var(--o-rs))] p-4 ring-1 sm:p-5 ${reverted ? "bg-[var(--o-paper)] ring-[var(--o-line)]" : "bg-white ring-[var(--o-line-strong)]"}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={reverted ? { background: "white", color: "var(--o-muted)" } : { background: "#FEF3F2", color: DANGER }}
                  >
                    {a.kind === "delete" ? <Trash2 className="h-4 w-4" /> : <Eraser className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[16px] font-bold leading-snug ${reverted ? "text-[var(--o-muted)] line-through decoration-1" : ""}`}>{title}</p>
                    {detail && <p className="mt-0.5 text-[14px] leading-snug text-[var(--o-muted)]">{detail}</p>}
                    <p className="mt-1.5 text-[13px] font-semibold text-[var(--o-muted)]">
                      {a.byName} · {stamp(a.at)}
                    </p>
                    {reverted && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--o-pill)] bg-white px-2.5 py-1 text-[12.5px] font-bold text-[var(--o-deep)] ring-1 ring-[var(--o-line)]">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} /> Reposto{a.revertedByName ? ` por ${a.revertedByName}` : ""}
                        {a.revertedAt ? ` · ${stamp(a.revertedAt)}` : ""}
                      </p>
                    )}
                  </div>
                  {!reverted && asking !== a.id && (
                    <button
                      type="button"
                      onClick={() => setAsking(a.id)}
                      disabled={Boolean(busy)}
                      className="inline-flex h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-[var(--o-pill)] bg-[var(--o-paper)] px-4 text-[14.5px] font-bold text-[var(--o-deep)] ring-1 ring-[var(--o-line)] transition hover:ring-[var(--o-deep)] disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" /> Repor
                    </button>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {!reverted && asking === a.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--o-line)] pt-4">
                        <p className="mr-auto text-[15px] font-semibold">Repor {registos(a.count)} nos números?</p>
                        <button
                          type="button"
                          onClick={() => setAsking(null)}
                          disabled={busy === a.id}
                          className="h-11 rounded-[var(--o-pill)] px-4 text-[14.5px] font-bold text-[var(--o-muted)] hover:bg-[var(--o-paper)]"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => restore(a)}
                          disabled={busy === a.id}
                          className="inline-flex h-11 items-center gap-1.5 rounded-[var(--o-pill)] bg-[var(--o-ink)] px-5 text-[14.5px] font-bold text-white disabled:opacity-60"
                        >
                          {busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Repor
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
