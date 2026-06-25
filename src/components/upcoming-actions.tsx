"use client";

// The two "Next Actions" blocks between the rollup tiles and the
// Clients table. Left = próximos 7 dias (red / urgent), right = 8–30
// dias (amber / "Brevemente"). The windows are DISJOINT — an action in
// the 7-day range shows ONLY on the left; 8–30 days shows ONLY on the
// right; nothing is duplicated.
//
// Each row has a tick box. Ticking it plays a quick "done" animation,
// the row collapses out, and the action is persisted as completed (KV)
// so it stays gone across screens. A footer lets you reopen completed
// ones.

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ReceiptText, AlertTriangle, Check, RotateCcw } from "lucide-react";
import type { CalendarEvent, EventColor } from "@/lib/calendar-events-store";
import type { DoneAction } from "@/lib/actions-done-store";
import { daysUntilISO, formatDate } from "@/lib/dates";

export type UpcomingInvoice = {
  id: string;
  title: string;
  department: string;
  date: string; // yyyy-mm-dd
};

type ActionItem = {
  key: string;
  date: string;
  label: string;
  sublabel: string;
  kind: "invoice" | "event";
  color: EventColor | "invoice";
  days: number;
};

const DOT_CLASS: Record<EventColor | "invoice", string> = {
  invoice: "bg-violet-400",
  red: "bg-rose-400",
  amber: "bg-amber-400",
  green: "bg-emerald-400",
  blue: "bg-sky-400",
  violet: "bg-violet-400",
  cyan: "bg-cyan-400",
  slate: "bg-slate-400",
};

const EXIT_MS = 420;

export function UpcomingActions({ invoices }: { invoices: UpcomingInvoice[] }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [done, setDone] = useState<DoneAction[]>([]);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [evRes, dnRes] = await Promise.all([
          fetch("/api/admin/calendar", { cache: "no-store" }),
          fetch("/api/admin/actions-done", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (evRes.ok) {
          const j = (await evRes.json()) as { events: CalendarEvent[] };
          if (!cancelled) setEvents(j.events ?? []);
        }
        if (dnRes.ok) {
          const j = (await dnRes.json()) as { done: DoneAction[] };
          if (!cancelled) setDone(j.done ?? []);
        }
      } catch {
        /* keep empty — the blocks still show invoices */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistDone(next: DoneAction[]) {
    setDone(next);
    try {
      const res = await fetch("/api/admin/actions-done", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        const j = (await res.json()) as { done: DoneAction[] };
        setDone(j.done ?? next);
      }
    } catch {
      /* best-effort — UI already updated optimistically */
    }
  }

  function complete(item: ActionItem) {
    // Trigger the collapse/fade, then commit to done after the animation.
    setLeaving((prev) => new Set(prev).add(item.key));
    window.setTimeout(() => {
      setLeaving((prev) => {
        const n = new Set(prev);
        n.delete(item.key);
        return n;
      });
      setDone((prev) => {
        if (prev.some((d) => d.key === item.key)) return prev;
        const next = [...prev, { key: item.key, doneAt: Date.now() }];
        void persistDone(next);
        return next;
      });
    }, EXIT_MS);
  }

  function reopen(key: string) {
    void persistDone(done.filter((d) => d.key !== key));
  }

  const doneKeys = useMemo(() => new Set(done.map((d) => d.key)), [done]);

  const allItems: ActionItem[] = useMemo(
    () =>
      [
        ...invoices.map((inv) => ({
          key: `inv:${inv.id}:${inv.date}`,
          date: inv.date,
          label: inv.title,
          sublabel: `Fatura a enviar · ${inv.department}`,
          kind: "invoice" as const,
          color: "invoice" as const,
          days: daysUntilISO(inv.date),
        })),
        ...events.map((ev) => ({
          key: `ev:${ev.id}`,
          date: ev.date,
          label: ev.title,
          sublabel: ev.description || "Evento",
          kind: "event" as const,
          color: ev.color,
          days: daysUntilISO(ev.date),
        })),
      ].sort((a, b) => a.days - b.days),
    [invoices, events],
  );

  // Disjoint windows. Overdue (days < 0) collapses into the urgent left
  // block. Items still mid-exit-animation stay visible until they land
  // in `done`.
  const visible = allItems.filter(
    (i) => !doneKeys.has(i.key) || leaving.has(i.key),
  );
  const left = visible.filter((i) => i.days <= 7);
  const right = visible.filter((i) => i.days > 7 && i.days <= 30);

  const doneItems = allItems.filter((i) => doneKeys.has(i.key) && !leaving.has(i.key));
  const doneLeft = doneItems.filter((i) => i.days <= 7);
  const doneRight = doneItems.filter((i) => i.days > 7 && i.days <= 30);

  return (
    <section
      aria-label="Próximas ações"
      className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2"
    >
      <ActionBlock
        tone="red"
        Icon={AlertTriangle}
        title="Próx. 7 dias"
        hint="Faturas e obrigações a tratar já"
        items={left}
        doneItems={doneLeft}
        leaving={leaving}
        onComplete={complete}
        onReopen={reopen}
      />
      <ActionBlock
        tone="amber"
        Icon={CalendarClock}
        title="Próximos 30 dias"
        hint="Brevemente"
        items={right}
        doneItems={doneRight}
        leaving={leaving}
        onComplete={complete}
        onReopen={reopen}
      />
    </section>
  );
}

function ActionBlock({
  tone,
  Icon,
  title,
  hint,
  items,
  doneItems,
  leaving,
  onComplete,
  onReopen,
}: {
  tone: "red" | "amber";
  Icon: typeof CalendarClock;
  title: string;
  hint: string;
  items: ActionItem[];
  doneItems: ActionItem[];
  leaving: Set<string>;
  onComplete: (i: ActionItem) => void;
  onReopen: (key: string) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const isRed = tone === "red";
  const border = isRed
    ? "border-rose-400/40 bg-rose-500/[0.06]"
    : "border-amber-400/35 bg-amber-500/[0.05]";
  const accent = isRed ? "text-rose-200" : "text-amber-200";
  const headLabel = isRed ? "text-rose-300/85" : "text-amber-300/85";
  // Count = open items only (excludes the ones mid-exit so the badge
  // ticks down the instant you check something).
  const openCount = items.filter((i) => !leaving.has(i.key)).length;

  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${border}`}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${accent}`} strokeWidth={2.25} />
          <span
            className={`text-[11px] font-bold uppercase tracking-[0.16em] ${headLabel}`}
          >
            {title}
          </span>
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-white/35">
            · {hint}
          </span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${
            isRed
              ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
              : "border-amber-400/40 bg-amber-500/15 text-amber-100"
          }`}
        >
          {openCount}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="mt-3 text-[12px] text-white/40">Tudo tratado. ✨</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((it) => (
            <ActionRow
              key={it.key}
              item={it}
              leaving={leaving.has(it.key)}
              onComplete={() => onComplete(it)}
            />
          ))}
        </ul>
      )}

      {doneItems.length > 0 && (
        <div className="mt-3 border-t border-white/8 pt-2.5">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/80 transition hover:text-emerald-200"
          >
            <Check className="h-3.5 w-3.5" />
            {doneItems.length} concluída{doneItems.length === 1 ? "" : "s"}
            <span className="text-white/35">· {showDone ? "ocultar" : "ver"}</span>
          </button>
          {showDone && (
            <ul className="mt-2 space-y-1">
              {doneItems.map((it) => (
                <li
                  key={it.key}
                  className="flex items-center gap-2 rounded-lg border border-white/6 bg-white/[0.015] px-2.5 py-1.5"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-white/45 line-through">
                    {it.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onReopen(it.key)}
                    title="Reabrir"
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-1 text-[10.5px] text-white/50 transition hover:border-white/30 hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" /> Reabrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ActionRow({
  item,
  leaving,
  onComplete,
}: {
  item: ActionItem;
  leaving: boolean;
  onComplete: () => void;
}) {
  const overdue = item.days < 0;
  const dueLabel =
    item.days < 0
      ? `Atrasado ${Math.abs(item.days)}d`
      : item.days === 0
        ? "Hoje"
        : item.days === 1
          ? "Amanhã"
          : `Em ${item.days}d`;

  return (
    <li
      className={`overflow-hidden transition-all duration-[420ms] ease-out ${
        leaving
          ? "max-h-0 -translate-x-2 opacity-0"
          : "max-h-24 translate-x-0 opacity-100"
      }`}
    >
      <div className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
        <button
          type="button"
          onClick={onComplete}
          disabled={leaving}
          aria-label={`Marcar "${item.label}" como feito`}
          title="Marcar como feito"
          className="group/check shrink-0"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-200 ${
              leaving
                ? "scale-110 border-transparent bg-emerald-500 shadow-[0_0_14px_-2px_rgba(16,185,129,0.9)]"
                : "border-white/25 group-hover/check:border-emerald-400/70 group-hover/check:bg-emerald-500/10"
            }`}
          >
            <Check
              className={`h-3 w-3 text-white transition-all duration-200 ${
                leaving
                  ? "scale-100 opacity-100"
                  : "scale-0 opacity-0 group-hover/check:scale-75 group-hover/check:opacity-40"
              }`}
              strokeWidth={3}
            />
          </span>
        </button>
        <span
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[item.color]}`}
        />
        {item.kind === "invoice" && (
          <ReceiptText className="h-3.5 w-3.5 shrink-0 text-white/40" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium text-white/90">
            {item.label}
          </div>
          <div className="truncate text-[10.5px] text-white/40">
            {item.sublabel}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`text-[11px] font-semibold tabular-nums ${
              overdue ? "text-rose-300" : "text-white/70"
            }`}
          >
            {dueLabel}
          </div>
          <div className="text-[10px] text-white/35">{formatDate(item.date)}</div>
        </div>
      </div>
    </li>
  );
}
