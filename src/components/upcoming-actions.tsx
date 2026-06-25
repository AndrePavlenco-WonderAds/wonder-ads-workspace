"use client";

// The two "Next Actions" blocks that sit between the rollup tiles and
// the Clients table: invoices to send + custom calendar events landing
// inside a window. Left = próximos 7 dias (red / urgent), right =
// próximos 30 dias (amber / "Brevemente"). Both pull custom events from
// the calendar store and merge them with the invoices derived from each
// client's invoiceDate.

import { useEffect, useState } from "react";
import { CalendarClock, ReceiptText, AlertTriangle } from "lucide-react";
import type { CalendarEvent, EventColor } from "@/lib/calendar-events-store";
import { daysUntilISO, formatDate } from "@/lib/dates";

export type UpcomingInvoice = {
  id: string;
  title: string;
  department: string;
  date: string; // yyyy-mm-dd
};

type ActionItem = {
  id: string;
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

export function UpcomingActions({ invoices }: { invoices: UpcomingInvoice[] }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/calendar", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { events: CalendarEvent[] };
        if (!cancelled) setEvents(json.events ?? []);
      } catch {
        /* keep empty — the blocks still show invoices */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items: ActionItem[] = [
    ...invoices.map((inv) => ({
      id: inv.id,
      date: inv.date,
      label: inv.title,
      sublabel: `Fatura a enviar · ${inv.department}`,
      kind: "invoice" as const,
      color: "invoice" as const,
      days: daysUntilISO(inv.date),
    })),
    ...events.map((ev) => ({
      id: ev.id,
      date: ev.date,
      label: ev.title,
      sublabel: ev.description || "Evento",
      kind: "event" as const,
      color: ev.color,
      days: daysUntilISO(ev.date),
    })),
  ].sort((a, b) => a.days - b.days);

  const within7 = items.filter((i) => i.days <= 7);
  const within30 = items.filter((i) => i.days <= 30);

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
        items={within7}
      />
      <ActionBlock
        tone="amber"
        Icon={CalendarClock}
        title="Próximos 30 dias"
        hint="Brevemente"
        items={within30}
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
}: {
  tone: "red" | "amber";
  Icon: typeof CalendarClock;
  title: string;
  hint: string;
  items: ActionItem[];
}) {
  const isRed = tone === "red";
  const border = isRed
    ? "border-rose-400/40 bg-rose-500/[0.06]"
    : "border-amber-400/35 bg-amber-500/[0.05]";
  const accent = isRed ? "text-rose-200" : "text-amber-200";
  const headLabel = isRed ? "text-rose-300/85" : "text-amber-300/85";

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
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="mt-3 text-[12px] text-white/40">Nada agendado.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.slice(0, 8).map((it) => {
            const overdue = it.days < 0;
            const dueLabel =
              it.days < 0
                ? `Atrasado ${Math.abs(it.days)}d`
                : it.days === 0
                  ? "Hoje"
                  : it.days === 1
                    ? "Amanhã"
                    : `Em ${it.days}d`;
            return (
              <li
                key={`${it.kind}-${it.id}`}
                className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[it.color]}`}
                />
                {it.kind === "invoice" && (
                  <ReceiptText className="h-3.5 w-3.5 shrink-0 text-white/40" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-white/90">
                    {it.label}
                  </div>
                  <div className="truncate text-[10.5px] text-white/40">
                    {it.sublabel}
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
                  <div className="text-[10px] text-white/35">
                    {formatDate(it.date)}
                  </div>
                </div>
              </li>
            );
          })}
          {items.length > 8 && (
            <li className="px-2.5 pt-1 text-[11px] text-white/40">
              + {items.length - 8} mais
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
