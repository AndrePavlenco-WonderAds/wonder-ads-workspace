"use client";

// Web Dept ticket management + dashboard. Renders an overview strip of
// KPIs (new / pending / urgent / done / avg resolution / by-priority /
// by-dept / by-assignee) followed by a filterable, searchable, sortable
// table of every ticket. Status / priority / assignee are editable
// inline; changes persist via PATCH and (for status) notify Slack.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Inbox,
  Search,
  Timer,
} from "lucide-react";
import {
  OPEN_STATUSES,
  REQUESTING_DEPT_LABEL,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_META,
  TICKET_STATUSES,
  TICKET_STATUS_META,
  type TicketPriority,
  type TicketStatus,
  type WebTicket,
} from "@/lib/web-tickets-shared";
import type { TicketStats } from "@/lib/web-tickets-store";
import { formatDate } from "@/lib/dates";

type Assignee = { username: string; name: string };
type SortKey = "created" | "updated" | "priority" | "status";

export function TicketsBoard({
  initialTickets,
  initialStats,
  assignees,
}: {
  initialTickets: WebTicket[];
  initialStats: TicketStats;
  assignees: Assignee[];
}) {
  const [tickets, setTickets] = useState<WebTicket[]>(initialTickets);
  const [stats, setStats] = useState<TicketStats>(initialStats);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all" | "open">(
    "open",
  );
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">(
    "all",
  );
  const [sort, setSort] = useState<SortKey>("created");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/web/tickets/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ticket?: WebTicket };
      if (res.ok && data.ticket) {
        setTickets((prev) => {
          const next = prev.map((t) => (t.id === id ? data.ticket! : t));
          return next;
        });
      }
    } finally {
      setSavingId(null);
    }
  }

  // Recompute lightweight stats client-side after an inline edit so the
  // KPI strip stays in sync without a full reload.
  useEffect(() => {
    const byStatus = Object.fromEntries(
      TICKET_STATUSES.map((s) => [s, 0]),
    ) as Record<TicketStatus, number>;
    let urgent = 0;
    let rSum = 0;
    let rCount = 0;
    const aMap = new Map<string, { name: string; open: number }>();
    for (const t of tickets) {
      byStatus[t.status]++;
      const isOpen = (OPEN_STATUSES as TicketStatus[]).includes(t.status);
      if (t.priority === "urgent" && isOpen) urgent++;
      if (isOpen && t.assigneeUsername) {
        const c = aMap.get(t.assigneeUsername) ?? {
          name: t.assigneeName ?? t.assigneeUsername,
          open: 0,
        };
        c.open++;
        aMap.set(t.assigneeUsername, c);
      }
      if (t.resolvedAt) {
        rSum += t.resolvedAt - t.createdAt;
        rCount++;
      }
    }
    setStats({
      total: tickets.length,
      open: OPEN_STATUSES.reduce((n, s) => n + byStatus[s], 0),
      byStatus,
      newCount: byStatus.new,
      pending: byStatus.triage + byStatus.in_dev + byStatus.waiting,
      urgent,
      done: byStatus.done + byStatus.closed,
      byPriority: Object.fromEntries(
        TICKET_PRIORITIES.map((p) => [
          p,
          tickets.filter((t) => t.priority === p).length,
        ]),
      ),
      byDept: stats.byDept,
      byAssignee: [...aMap.entries()]
        .map(([username, v]) => ({ username, name: v.name, open: v.open }))
        .sort((a, b) => b.open - a.open),
      avgResolutionMs: rCount > 0 ? rSum / rCount : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tickets.filter((t) => {
      if (statusFilter === "open" && !(OPEN_STATUSES as TicketStatus[]).includes(t.status))
        return false;
      if (statusFilter !== "all" && statusFilter !== "open" && t.status !== statusFilter)
        return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (q) {
        const hay =
          `#${t.seq} ${t.title} ${t.description} ${t.authorName} ${t.assigneeName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "priority")
        return (
          TICKET_PRIORITY_META[b.priority].rank -
          TICKET_PRIORITY_META[a.priority].rank
        );
      if (sort === "status")
        return TICKET_STATUSES.indexOf(a.status) - TICKET_STATUSES.indexOf(b.status);
      if (sort === "updated") return b.updatedAt - a.updatedAt;
      return b.createdAt - a.createdAt;
    });
    return list;
  }, [tickets, query, statusFilter, priorityFilter, sort]);

  return (
    <div className="space-y-6">
      {/* Dashboard KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi icon={Inbox} label="Novos" value={stats.newCount} accent="sky" />
        <Kpi icon={Clock} label="Pendentes" value={stats.pending} accent="amber" />
        <Kpi
          icon={AlertOctagon}
          label="Urgentes"
          value={stats.urgent}
          accent="rose"
        />
        <Kpi
          icon={CheckCircle2}
          label="Concluídos"
          value={stats.done}
          accent="emerald"
        />
        <Kpi
          icon={Timer}
          label="Tempo médio"
          value={formatDuration(stats.avgResolutionMs)}
          accent="violet"
          isText
        />
      </div>

      {/* Breakdown row: priority · dept · assignees */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Breakdown
          title="Por prioridade"
          rows={TICKET_PRIORITIES.map((p) => ({
            label: `${TICKET_PRIORITY_META[p].emoji} ${TICKET_PRIORITY_META[p].label}`,
            value: stats.byPriority[p] ?? 0,
          }))}
        />
        <Breakdown
          title="Por departamento"
          rows={Object.entries(stats.byDept).map(([d, n]) => ({
            label: REQUESTING_DEPT_LABEL[d as keyof typeof REQUESTING_DEPT_LABEL] ?? d,
            value: n,
          }))}
        />
        <Breakdown
          title="Carga por pessoa (abertos)"
          rows={
            stats.byAssignee.length > 0
              ? stats.byAssignee.map((a) => ({ label: a.name, value: a.open }))
              : [{ label: "Sem atribuições", value: 0 }]
          }
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar tickets…"
            className="w-full rounded-lg border border-white/12 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as TicketStatus | "all" | "open")}
          options={[
            { value: "open", label: "Abertos" },
            { value: "all", label: "Todos os estados" },
            ...TICKET_STATUSES.map((s) => ({
              value: s,
              label: TICKET_STATUS_META[s].label,
            })),
          ]}
        />
        <FilterSelect
          value={priorityFilter}
          onChange={(v) => setPriorityFilter(v as TicketPriority | "all")}
          options={[
            { value: "all", label: "Todas as prioridades" },
            ...TICKET_PRIORITIES.map((p) => ({
              value: p,
              label: TICKET_PRIORITY_META[p].label,
            })),
          ]}
        />
        <FilterSelect
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          icon
          options={[
            { value: "created", label: "Mais recentes" },
            { value: "updated", label: "Última atualização" },
            { value: "priority", label: "Prioridade" },
            { value: "status", label: "Estado" },
          ]}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.08em] text-white/50">
            <tr>
              <th className="px-3 py-2.5 font-semibold">#</th>
              <th className="px-3 py-2.5 font-semibold">Ticket</th>
              <th className="px-3 py-2.5 font-semibold">Estado</th>
              <th className="px-3 py-2.5 font-semibold">Prioridade</th>
              <th className="px-3 py-2.5 font-semibold">Responsável</th>
              <th className="px-3 py-2.5 font-semibold">Dpt</th>
              <th className="px-3 py-2.5 font-semibold">Criado</th>
              <th className="px-3 py-2.5 font-semibold">Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className={`border-b border-white/6 align-middle transition hover:bg-white/[0.03] ${
                  savingId === t.id ? "opacity-60" : ""
                }`}
              >
                <td className="px-3 py-2.5 text-white/45 tabular-nums">#{t.seq}</td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/web/tickets/${t.id}`}
                    className="font-medium text-white/90 transition hover:text-white"
                  >
                    {t.title}
                  </Link>
                  <div className="text-[10.5px] text-white/40">
                    {TICKET_CATEGORY_LABEL[t.category]} · {t.authorName}
                    {t.comments.length > 0 && ` · 💬 ${t.comments.length}`}
                    {t.attachments.length > 0 && ` · 📎 ${t.attachments.length}`}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <InlineSelect
                    value={t.status}
                    onChange={(v) => patch(t.id, { status: v })}
                    options={TICKET_STATUSES.map((s) => ({
                      value: s,
                      label: TICKET_STATUS_META[s].label,
                    }))}
                    tagClass={TICKET_STATUS_META[t.status].tag}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <InlineSelect
                    value={t.priority}
                    onChange={(v) => patch(t.id, { priority: v })}
                    options={TICKET_PRIORITIES.map((p) => ({
                      value: p,
                      label: TICKET_PRIORITY_META[p].label,
                    }))}
                    tagClass={TICKET_PRIORITY_META[t.priority].tag}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <InlineSelect
                    value={t.assigneeUsername ?? ""}
                    onChange={(v) => patch(t.id, { assigneeUsername: v || null })}
                    options={[
                      { value: "", label: "— por atribuir —" },
                      ...assignees.map((a) => ({
                        value: a.username,
                        label: a.name,
                      })),
                    ]}
                    tagClass="border-white/15 bg-white/[0.05] text-white/75"
                  />
                </td>
                <td className="px-3 py-2.5 text-[11px] text-white/60">
                  {REQUESTING_DEPT_LABEL[t.requestingDept]}
                </td>
                <td className="px-3 py-2.5 text-[11px] text-white/55">
                  {formatDate(t.createdAt)}
                </td>
                <td className="px-3 py-2.5 text-[11px] text-white/55">
                  {formatDate(t.updatedAt)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-white/45">
                  Nenhum ticket corresponde aos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-white/40">
        {filtered.length} de {tickets.length} tickets
      </p>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
  isText = false,
}: {
  icon: typeof Inbox;
  label: string;
  value: number | string;
  accent: "sky" | "amber" | "rose" | "emerald" | "violet";
  isText?: boolean;
}) {
  const ring: Record<string, string> = {
    sky: "text-sky-300 border-sky-400/25 bg-sky-500/10",
    amber: "text-amber-300 border-amber-400/25 bg-amber-500/10",
    rose: "text-rose-300 border-rose-400/25 bg-rose-500/10",
    emerald: "text-emerald-300 border-emerald-400/25 bg-emerald-500/10",
    violet: "text-violet-300 border-violet-400/25 bg-violet-500/10",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
      <div
        className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border ${ring[accent]}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className={`font-semibold text-white ${isText ? "text-base" : "text-2xl"}`}>
        {value}
      </div>
      <div className="text-[11px] text-white/50">{label}</div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/55">
        {title}
      </h3>
      <ul className="mt-2.5 space-y-1.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2 text-[12px]">
            <span className="w-28 shrink-0 truncate text-white/70">{r.label}</span>
            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <span
                className="brand-gradient-bg absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </span>
            <span className="w-6 shrink-0 text-right tabular-nums text-white/60">
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  icon = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: boolean;
}) {
  return (
    <div className="relative">
      {icon && (
        <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-lg border border-white/12 bg-white/[0.04] py-2 ${
          icon ? "pl-8" : "pl-3"
        } pr-8 text-[12px] text-white outline-none focus:border-white/30`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#14141b]">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-white/45">
        ▾
      </span>
    </div>
  );
}

function InlineSelect({
  value,
  onChange,
  options,
  tagClass,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  tagClass: string;
}) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`max-w-[150px] cursor-pointer appearance-none truncate rounded-full border px-2.5 py-1 pr-6 text-[11px] font-medium outline-none ${tagClass}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#14141b] text-white">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] opacity-70">
        ▾
      </span>
    </div>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const h = ms / (1000 * 60 * 60);
  if (h < 1) return `${Math.round(ms / (1000 * 60))} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}
