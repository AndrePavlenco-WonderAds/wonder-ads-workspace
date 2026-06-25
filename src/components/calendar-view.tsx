"use client";

// Full-page month calendar for Admin → Overview Calendário. Shows two
// kinds of blocks on each day:
//   • Invoices — derived (read-only) from each client's invoiceDate.
//   • Custom events — fiscal obligations / reminders the team pins to a
//     day, each with a colour, title and description. Click any empty
//     day to add one; click an existing event to edit or delete it.
//
// Events persist to KV via PUT /api/admin/calendar (the whole list is
// replaced on every change — low volume, single admin team).

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  Loader2,
  Check,
  ReceiptText,
  CalendarDays,
} from "lucide-react";
import {
  EVENT_COLORS,
  type CalendarEvent,
  type EventColor,
} from "@/lib/calendar-events-store";
import { toISODate, formatDateLong } from "@/lib/dates";

export type CalendarInvoice = {
  id: string;
  date: string; // yyyy-mm-dd
  title: string;
  department: string;
};

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const COLOR: Record<EventColor, { chip: string; dot: string; swatch: string }> =
  {
    red: {
      chip: "border-rose-400/40 bg-rose-500/20 text-rose-100",
      dot: "bg-rose-400",
      swatch: "bg-rose-500",
    },
    amber: {
      chip: "border-amber-400/40 bg-amber-500/20 text-amber-100",
      dot: "bg-amber-400",
      swatch: "bg-amber-500",
    },
    green: {
      chip: "border-emerald-400/40 bg-emerald-500/20 text-emerald-100",
      dot: "bg-emerald-400",
      swatch: "bg-emerald-500",
    },
    blue: {
      chip: "border-sky-400/40 bg-sky-500/20 text-sky-100",
      dot: "bg-sky-400",
      swatch: "bg-sky-500",
    },
    violet: {
      chip: "border-violet-400/40 bg-violet-500/20 text-violet-100",
      dot: "bg-violet-400",
      swatch: "bg-violet-500",
    },
    cyan: {
      chip: "border-cyan-400/40 bg-cyan-500/20 text-cyan-100",
      dot: "bg-cyan-400",
      swatch: "bg-cyan-500",
    },
    slate: {
      chip: "border-slate-400/40 bg-slate-500/20 text-slate-100",
      dot: "bg-slate-400",
      swatch: "bg-slate-500",
    },
  };

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type Draft = {
  id: string | null;
  date: string;
  title: string;
  description: string;
  color: EventColor;
};

export function CalendarView({
  invoices,
  initialEvents,
}: {
  invoices: CalendarInvoice[];
  initialEvents: CalendarEvent[];
}) {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toISODate(today), [today]);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Index invoices + events by date for O(1) day lookup.
  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, [events]);
  const invoicesByDate = useMemo(() => {
    const m = new Map<string, CalendarInvoice[]>();
    for (const inv of invoices) {
      const arr = m.get(inv.date) ?? [];
      arr.push(inv);
      m.set(inv.date, arr);
    }
    return m;
  }, [invoices]);

  // Build the 6-week (Sun-start) grid for the current month.
  const weeks = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = first.getDay(); // 0 = Sunday
    const gridStart = new Date(year, month, 1 - startOffset);
    const cells: Array<{ date: Date; iso: string; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i,
      );
      cells.push({
        date: d,
        iso: ymd(d.getFullYear(), d.getMonth(), d.getDate()),
        inMonth: d.getMonth() === month,
      });
    }
    const out: (typeof cells)[] = [];
    for (let w = 0; w < 6; w++) out.push(cells.slice(w * 7, w * 7 + 7));
    return out;
  }, [year, month]);

  const persist = useCallback(async (next: CalendarEvent[]) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { events: CalendarEvent[] };
      setEvents(json.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      // Re-fetch authoritative state so the UI doesn't drift on error.
      try {
        const r = await fetch("/api/admin/calendar", { cache: "no-store" });
        if (r.ok) setEvents(((await r.json()) as { events: CalendarEvent[] }).events);
      } catch {
        /* ignore */
      }
    } finally {
      setSaving(false);
    }
  }, []);

  function openNew(dateIso: string) {
    setDraft({
      id: null,
      date: dateIso,
      title: "",
      description: "",
      color: "red",
    });
  }
  function openEdit(ev: CalendarEvent) {
    setDraft({
      id: ev.id,
      date: ev.date,
      title: ev.title,
      description: ev.description,
      color: ev.color,
    });
  }

  async function saveDraft() {
    if (!draft) return;
    const title = draft.title.trim() || "Sem título";
    let next: CalendarEvent[];
    if (draft.id) {
      next = events.map((e) =>
        e.id === draft.id
          ? { ...e, date: draft.date, title, description: draft.description, color: draft.color }
          : e,
      );
    } else {
      next = [
        ...events,
        {
          id: crypto.randomUUID(),
          date: draft.date,
          title,
          description: draft.description,
          color: draft.color,
          createdAt: Date.now(),
        },
      ];
    }
    setDraft(null);
    await persist(next);
  }

  async function deleteDraft() {
    if (!draft?.id) {
      setDraft(null);
      return;
    }
    const next = events.filter((e) => e.id !== draft.id);
    setDraft(null);
    await persist(next);
  }

  function go(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  return (
    <div className="animate-fade-up mt-2">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="brand-gradient-bg flex h-11 w-11 items-center justify-center rounded-2xl shadow-[0_10px_40px_-10px_rgba(120,61,245,0.65)]">
            <CalendarDays className="h-5 w-5 text-white" strokeWidth={2.25} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              <span className="brand-gradient-text">Overview Calendário</span>
            </h1>
            <p className="text-[12px] text-white/45">
              Faturas a enviar + obrigações fiscais e lembretes.
              {saving && (
                <span className="ml-2 inline-flex items-center gap-1 text-white/55">
                  <Loader2 className="h-3 w-3 animate-spin" /> a guardar…
                </span>
              )}
              {error && (
                <span className="ml-2 text-rose-300">{error}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openNew(todayIso)}
            className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-[0_6px_22px_-4px_rgba(120,61,245,0.55)] transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Adicionar evento
          </button>
        </div>
      </header>

      {/* Month nav */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Mês anterior"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Mês seguinte"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <div className="grid grid-cols-7 border-b border-white/8 bg-black/40">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-white/40"
            >
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7 border-b border-white/6 last:border-b-0"
          >
            {week.map((cell) => {
              const dayEvents = eventsByDate.get(cell.iso) ?? [];
              const dayInvoices = invoicesByDate.get(cell.iso) ?? [];
              const isToday = cell.iso === todayIso;
              return (
                <button
                  type="button"
                  key={cell.iso}
                  onClick={() => openNew(cell.iso)}
                  className={`group min-h-[120px] border-r border-white/6 px-1.5 py-1.5 text-left align-top transition last:border-r-0 hover:bg-white/[0.025] ${
                    cell.inMonth ? "" : "opacity-40"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between px-0.5">
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums ${
                        isToday
                          ? "bg-[#783DF5] text-white"
                          : "text-white/55"
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                    <Plus className="h-3 w-3 text-white/0 transition group-hover:text-white/35" />
                  </div>
                  <div className="space-y-1">
                    {dayInvoices.map((inv) => (
                      <span
                        key={inv.id}
                        title={`Fatura a enviar · ${inv.title} (${inv.department})`}
                        className="flex items-center gap-1 truncate rounded border border-violet-400/30 bg-violet-500/15 px-1.5 py-0.5 text-[10.5px] text-violet-100"
                      >
                        <ReceiptText className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{inv.title}</span>
                      </span>
                    ))}
                    {dayEvents.map((ev) => (
                      <span
                        key={ev.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(ev);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            openEdit(ev);
                          }
                        }}
                        title={ev.description || ev.title}
                        className={`flex cursor-pointer items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[10.5px] ${COLOR[ev.color].chip}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${COLOR[ev.color].dot}`}
                        />
                        <span className="truncate">{ev.title}</span>
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-white/35">
        Clica num dia para adicionar um evento · clica num evento para editar.
        As faturas (a roxo) vêm das datas de fatura dos clientes.
      </p>

      {draft && (
        <EventModal
          draft={draft}
          saving={saving}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={saveDraft}
          onDelete={deleteDraft}
        />
      )}
    </div>
  );
}

function EventModal({
  draft,
  saving,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  draft: Draft;
  saving: boolean;
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const body = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="animate-fade-up w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-2xl shadow-black/70"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-white/8 bg-black/40 px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-white">
            {draft.id ? "Editar evento" : "Novo evento"}
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
          <p className="text-[12px] text-white/45">
            {formatDateLong(draft.date)}
          </p>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
              Data
            </span>
            <input
              type="date"
              value={draft.date}
              onChange={(e) =>
                onChange({ ...draft, date: e.target.value || draft.date })
              }
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none transition focus:border-white/30"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
              Título
            </span>
            <input
              value={draft.title}
              autoFocus
              onChange={(e) => onChange({ ...draft, title: e.target.value })}
              placeholder="Entregar IVA"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none transition focus:border-white/30 placeholder:text-white/30"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
              Descrição
            </span>
            <textarea
              value={draft.description}
              onChange={(e) =>
                onChange({ ...draft, description: e.target.value })
              }
              rows={3}
              placeholder="Detalhes, valores, link…"
              className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] leading-relaxed text-white outline-none transition focus:border-white/30 placeholder:text-white/30"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
              Cor
            </span>
            <div className="flex flex-wrap gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ ...draft, color: c })}
                  aria-label={c}
                  className={`h-7 w-7 rounded-full ${COLOR[c].swatch} transition ${
                    draft.color === c
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0f]"
                      : "opacity-70 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-white/8 bg-black/30 px-5 py-3.5">
          {draft.id ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/35 px-3 py-2 text-[12px] font-medium text-rose-200 transition hover:bg-rose-500/15 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/12 px-3 py-2 text-[12px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
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
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
