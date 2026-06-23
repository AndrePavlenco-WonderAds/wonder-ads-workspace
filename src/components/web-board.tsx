"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarPlus,
  Check,
  ClipboardList,
  Copy,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  User2,
  X,
} from "lucide-react";
import {
  WEB_PRIORITIES,
  WEB_PRIORITY_META,
  WEB_STATUSES,
  WEB_STATUS_META,
  type PublicWebProject,
  type WebPriority,
  type WebStatus,
} from "@/lib/web-shared";
import type { TicketStatus } from "@/lib/web-tickets-shared";
import { formatDate, formatDateTime } from "@/lib/dates";

type Assignee = { username: string; name: string };

/** Open ticket surfaced on the board as a first-class, draggable card —
 *  same chrome as a project, mapped onto the 5 board columns. */
export type BoardTicket = {
  id: string;
  seq: number;
  title: string;
  project: string;
  priorityLabel: string;
  priorityTag: string;
  assigneeName: string | null;
  /** Ticket status (own enum) — mapped to a board column for placement. */
  status: TicketStatus;
};

// Ticket-status ↔ board-column mapping. Tickets keep their own status
// enum but live on the same 5-column Kanban as projects.
const TICKET_TO_COLUMN: Record<TicketStatus, WebStatus> = {
  new: "negotiation",
  triage: "negotiation",
  in_dev: "in_progress",
  waiting: "client_feedback",
  done: "done",
  closed: "done",
};
const COLUMN_TO_TICKET: Record<WebStatus, TicketStatus> = {
  negotiation: "new",
  in_progress: "in_dev",
  client_feedback: "waiting",
  migration: "in_dev",
  done: "done",
};
/** Where a ticket should sit. */
function ticketColumn(s: TicketStatus): WebStatus {
  return TICKET_TO_COLUMN[s];
}
/** Resulting ticket status when dropped on a column — a no-op when the
 *  ticket already belongs to that column (preserves triage/closed). */
function ticketStatusForColumn(col: WebStatus, current: TicketStatus): TicketStatus {
  return TICKET_TO_COLUMN[current] === col ? current : COLUMN_TO_TICKET[col];
}

/** Today's date as yyyy-mm-dd in the user's local timezone — used as the
 *  default start date when creating a project. */
function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function WebBoard({
  initialProjects,
  assignees,
  storageConfigured,
  openTickets = [],
}: {
  initialProjects: PublicWebProject[];
  assignees: Assignee[];
  storageConfigured: boolean;
  /** Open tickets to pin at the top of the "Not Started" column. */
  openTickets?: BoardTicket[];
}) {
  const [projects, setProjects] = useState<PublicWebProject[]>(initialProjects);
  const [tickets, setTickets] = useState<BoardTicket[]>(openTickets);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragTicketId, setDragTicketId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<WebStatus | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBacklog, setShowBacklog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (assigneeFilter && p.assigneeUsername !== assigneeFilter) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.clientName.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [projects, query, assigneeFilter]);

  const columns = useMemo(() => {
    const byStatus: Record<WebStatus, PublicWebProject[]> = {
      negotiation: [],
      in_progress: [],
      client_feedback: [],
      migration: [],
      done: [],
    };
    for (const p of filtered) byStatus[p.status]?.push(p);
    for (const s of WEB_STATUSES) byStatus[s].sort((a, b) => a.order - b.order);
    return byStatus;
  }, [filtered]);

  // Tickets placed in their mapped column, honouring the same filters.
  const ticketsByColumn = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byCol: Record<WebStatus, BoardTicket[]> = {
      negotiation: [],
      in_progress: [],
      client_feedback: [],
      migration: [],
      done: [],
    };
    for (const t of tickets) {
      if (
        assigneeFilter &&
        !assignees.some(
          (a) => a.username === assigneeFilter && a.name === t.assigneeName,
        )
      )
        continue;
      if (
        q &&
        !`#${t.seq} ${t.title} ${t.project}`.toLowerCase().includes(q)
      )
        continue;
      byCol[ticketColumn(t.status)].push(t);
    }
    return byCol;
  }, [tickets, query, assigneeFilter, assignees]);

  const moveTicket = useCallback(
    async (id: string, col: WebStatus) => {
      const ticket = tickets.find((t) => t.id === id);
      if (!ticket) return;
      const nextStatus = ticketStatusForColumn(col, ticket.status);
      if (nextStatus === ticket.status) return;
      const prev = ticket;
      setTickets((list) =>
        list.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)),
      );
      try {
        const res = await fetch(`/api/web/tickets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!res.ok) throw new Error("Save failed");
      } catch {
        setTickets((list) => list.map((t) => (t.id === id ? prev : t)));
        setError("Não foi possível mover o ticket — tenta de novo.");
      }
    },
    [tickets],
  );

  const moveTo = useCallback(
    async (id: string, status: WebStatus) => {
      const project = projects.find((p) => p.id === id);
      if (!project || project.status === status) return;
      const maxOrder = Math.max(
        0,
        ...projects.filter((p) => p.status === status).map((p) => p.order),
      );
      const updated = { ...project, status, order: maxOrder + 1 };
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      try {
        const res = await fetch(`/api/web/projects/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (!res.ok) throw new Error("Save failed");
        const data = await res.json();
        setProjects((prev) => prev.map((p) => (p.id === id ? data.project : p)));
      } catch {
        setProjects((prev) => prev.map((p) => (p.id === id ? project : p)));
        setError("Couldn't move the project — try again.");
      }
    },
    [projects],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/web/projects", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch {
      setError("Couldn't refresh — try again.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onCreated = useCallback((project: PublicWebProject) => {
    setProjects((prev) => [...prev, project]);
    setShowCreate(false);
  }, []);

  if (!storageConfigured) {
    return (
      <div className="mt-10 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 text-sm text-amber-100">
        The project board needs Vercel KV. Set{" "}
        <code className="font-mono">KV_REST_API_URL</code> +{" "}
        <code className="font-mono">KV_REST_API_TOKEN</code> on the project,
        then redeploy.
      </div>
    );
  }

  return (
    <div className="mt-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: search + employee filters */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="w-56 rounded-xl border border-white/12 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-[color:var(--brand-purple)]/60 focus:bg-white/[0.06]"
            />
          </div>
          <FilterChip
            label="All"
            active={assigneeFilter === null}
            onClick={() => setAssigneeFilter(null)}
          />
          {assignees.map((a) => (
            <FilterChip
              key={a.username}
              label={a.name}
              active={assigneeFilter === a.username}
              onClick={() =>
                setAssigneeFilter(
                  assigneeFilter === a.username ? null : a.username,
                )
              }
            />
          ))}
        </div>

        {/* Right: actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-white/75 transition hover:border-white/30 hover:bg-white/[0.07] hover:text-white disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <Link
            href="/web/activity"
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-white/75 transition hover:border-white/30 hover:bg-white/[0.07] hover:text-white"
          >
            <History className="h-4 w-4" />
            Activity log
          </Link>
          <Link
            href="/web/tickets"
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-white/75 transition hover:border-white/30 hover:bg-white/[0.07] hover:text-white"
          >
            <Ticket className="h-4 w-4" />
            Tickets
          </Link>
          <button
            onClick={() => setShowBacklog(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--brand-purple)]/45 bg-[#783DF5]/10 px-3.5 py-2.5 text-sm font-medium text-white/90 transition hover:bg-[#783DF5]/18 hover:text-white"
          >
            <ClipboardList className="h-4 w-4 text-[color:var(--brand-magenta)]" />
            Generate backlog
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_-6px_rgba(120,61,245,0.6)] transition hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New project
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-white/45">
        {filtered.length} of {projects.length} project
        {projects.length === 1 ? "" : "s"} · drag a card between columns to
        change its status
      </p>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {WEB_STATUSES.map((status) => {
          const meta = WEB_STATUS_META[status];
          const cards = columns[status];
          const isOver = overCol === status;
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                if (overCol !== status) setOverCol(status);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setOverCol(null);
              }}
              onDrop={() => {
                if (dragTicketId) moveTicket(dragTicketId, status);
                else if (dragId) moveTo(dragId, status);
                setDragId(null);
                setDragTicketId(null);
                setOverCol(null);
              }}
              className={`flex min-h-[140px] flex-col rounded-2xl border bg-white/[0.02] p-3 transition ${
                isOver
                  ? "border-[color:var(--brand-purple)]/60 bg-white/[0.05]"
                  : meta.column
              }`}
            >
              {(() => {
                const colTickets = ticketsByColumn[status];
                const total = cards.length + colTickets.length;
                return (
                  <>
                    <div className="mb-3 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                        <h2 className="text-[13px] font-semibold tracking-tight text-white/90">
                          {meta.short}
                        </h2>
                      </div>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/55">
                        {total}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col gap-2.5">
                      {colTickets.map((t) => (
                        <TicketCard
                          key={t.id}
                          ticket={t}
                          onDragStart={() => setDragTicketId(t.id)}
                          onDragEnd={() => {
                            setDragTicketId(null);
                            setOverCol(null);
                          }}
                        />
                      ))}
                      {cards.map((p) => (
                        <BoardCard
                          key={p.id}
                          project={p}
                          onDragStart={() => setDragId(p.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverCol(null);
                          }}
                        />
                      ))}
                      {total === 0 && (
                        <p className="px-1 py-6 text-center text-[11px] text-white/30">
                          {query || assigneeFilter
                            ? "No matches"
                            : "Drop a card here"}
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          );
        })}
      </div>

      {showCreate && (
        <CreateProjectModal
          assignees={assignees}
          onClose={() => setShowCreate(false)}
          onCreated={onCreated}
        />
      )}
      {showBacklog && <BacklogModal onClose={() => setShowBacklog(false)} />}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${
        active
          ? "border-[color:var(--brand-purple)]/60 bg-[#783DF5]/20 text-white"
          : "border-white/12 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

/** Draggable ticket card — same chrome as a project card so tickets are
 *  first-class on the board. A small "TICKET #n" marker distinguishes it
 *  (clicking opens the ticket detail; dragging changes its status). */
function TicketCard({
  ticket,
  onDragStart,
  onDragEnd,
}: {
  ticket: BoardTicket;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <Link
      href={`/web/tickets/${ticket.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", ticket.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="group block cursor-grab rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-white/25 hover:bg-white/[0.07] active:cursor-grabbing"
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Ticket className="h-3 w-3 text-[color:var(--brand-magenta)]" />
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/45">
          Ticket #{ticket.seq}
        </span>
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold leading-snug tracking-tight text-white">
          {ticket.title}
        </h3>
        <span
          className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${ticket.priorityTag}`}
        >
          {ticket.priorityLabel}
        </span>
      </div>
      {ticket.project && (
        <p className="mt-1 text-[11.5px] font-medium text-white/50">
          {ticket.project}
        </p>
      )}
      <div className="mt-2 flex items-center gap-1 border-t border-white/8 pt-2 text-[10.5px] text-white/45">
        <User2 className="h-3 w-3" />
        {ticket.assigneeName ?? "Por atribuir"}
      </div>
    </Link>
  );
}

function BoardCard({
  project,
  onDragStart,
  onDragEnd,
}: {
  project: PublicWebProject;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const meta = WEB_STATUS_META[project.status];
  const prio = WEB_PRIORITY_META[project.priority];
  return (
    <Link
      href={`/web/${project.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", project.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="group block cursor-grab rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-white/25 hover:bg-white/[0.07] active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold leading-snug tracking-tight text-white group-hover:text-white">
          {project.name}
        </h3>
        <span
          className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${prio.tag}`}
        >
          {prio.label}
        </span>
      </div>

      {project.clientName && (
        <p className="mt-1 text-[11.5px] font-medium text-white/50">
          {project.clientName}
        </p>
      )}

      <span
        className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.tag}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        {meta.short}
      </span>

      <div className="mt-2.5 flex flex-col gap-1 text-[10.5px] text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <User2 className="h-3 w-3" />
          {project.assigneeName}
        </span>
        {project.startDate && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarPlus className="h-3 w-3" />
            Start {formatDate(project.startDate)}
          </span>
        )}
        {project.deadline && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3 w-3" />
            Launch {formatDate(project.deadline)}
          </span>
        )}
      </div>

      <p className="mt-2 border-t border-white/[0.06] pt-1.5 text-[9.5px] text-white/30">
        Updated {formatDateTime(project.updatedAt)}
      </p>
    </Link>
  );
}

function CreateProjectModal({
  assignees,
  onClose,
  onCreated,
}: {
  assignees: Assignee[];
  onClose: () => void;
  onCreated: (p: PublicWebProject) => void;
}) {
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [assignee, setAssignee] = useState(assignees[0]?.username ?? "");
  const [priority, setPriority] = useState<WebPriority>("medium");
  const [status, setStatus] = useState<WebStatus>("negotiation");
  const [startDate, setStartDate] = useState(todayISO());
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setErr("A project name is required.");
      return;
    }
    setSaving(true);
    setErr(null);
    const assigneeName =
      assignees.find((a) => a.username === assignee)?.name ?? "Unassigned";
    try {
      const res = await fetch("/api/web/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          clientName,
          assigneeUsername: assignee,
          assigneeName,
          priority,
          status,
          startDate: startDate || null,
          deadline: deadline || null,
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      const data = await res.json();
      onCreated(data.project);
    } catch {
      setErr("Couldn't create the project — try again.");
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div
        className="brand-gradient-border w-full max-w-lg rounded-2xl bg-[color:var(--background)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            New web project
          </h2>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-white/50 hover:text-white" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <Field label="Project name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Clinic — new WordPress site"
              className="modal-input"
            />
          </Field>
          <Field label="Client name">
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Acme Clinic"
              className="modal-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Assigned to">
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="modal-input"
              >
                {assignees.length === 0 && <option value="">Unassigned</option>}
                {assignees.map((a) => (
                  <option key={a.username} value={a.username}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as WebPriority)}
                className="modal-input"
              >
                {WEB_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {WEB_PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Column / status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as WebStatus)}
              className="modal-input"
            >
              {WEB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {WEB_STATUS_META[s].label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="modal-input"
              />
            </Field>
            <Field label="Target launch">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="modal-input"
              />
            </Field>
          </div>

          {err && <p className="text-sm text-rose-300">{err}</p>}

          <button
            onClick={submit}
            disabled={saving}
            className="brand-gradient-bg mt-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            )}
            Create project
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function BacklogModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setCopied(false);
    try {
      const res = await fetch("/api/web/backlog", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setText(data.backlog ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't generate the backlog.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Kick off the first generation when the modal mounts.
  useEffect(() => {
    void generate();
  }, [generate]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Couldn't copy — select the text and copy manually.");
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div
        className="brand-gradient-border flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-[color:var(--background)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
              <ClipboardList className="h-5 w-5 text-[color:var(--brand-magenta)]" />
              Generate backlog
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Slack-ready, in Portuguese — built from each project&apos;s most
              recent comments. Edit anything before copying.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-white/50 hover:text-white" />
          </button>
        </div>

        {loading ? (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 py-16 text-white/55">
            <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand-purple)]" />
            <p className="text-sm">Reading recent updates and drafting…</p>
          </div>
        ) : err ? (
          <div className="mt-6 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
            {err}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="modal-input mt-5 min-h-[340px] flex-1 resize-y whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed"
            spellCheck={false}
          />
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3.5 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Regenerate
          </button>
          <button
            onClick={copy}
            disabled={loading || !text}
            className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:opacity-60"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}
