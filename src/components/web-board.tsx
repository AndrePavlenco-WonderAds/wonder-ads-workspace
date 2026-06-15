"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarPlus,
  Loader2,
  Plus,
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
import { formatDate, formatDateTime } from "@/lib/dates";

type Assignee = { username: string; name: string };

export function WebBoard({
  initialProjects,
  assignees,
  storageConfigured,
}: {
  initialProjects: PublicWebProject[];
  assignees: Assignee[];
  storageConfigured: boolean;
}) {
  const [projects, setProjects] = useState<PublicWebProject[]>(initialProjects);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<WebStatus | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => {
    const byStatus: Record<WebStatus, PublicWebProject[]> = {
      negotiation: [],
      in_progress: [],
      client_feedback: [],
      migration: [],
      done: [],
    };
    for (const p of projects) byStatus[p.status]?.push(p);
    for (const s of WEB_STATUSES) {
      byStatus[s].sort((a, b) => a.order - b.order);
    }
    return byStatus;
  }, [projects]);

  const moveTo = useCallback(
    async (id: string, status: WebStatus) => {
      const project = projects.find((p) => p.id === id);
      if (!project || project.status === status) return;
      // Optimistic: drop at the bottom of the target column.
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
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? data.project : p)),
        );
      } catch {
        // Roll back on failure.
        setProjects((prev) => prev.map((p) => (p.id === id ? project : p)));
        setError("Couldn't move the project — try again.");
      }
    },
    [projects],
  );

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
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/55">
          {projects.length} project{projects.length === 1 ? "" : "s"} · drag a
          card between columns to change its status
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_-6px_rgba(120,61,245,0.6)] transition hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New project
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                // Only clear when leaving the column wrapper itself.
                if (e.currentTarget === e.target) setOverCol(null);
              }}
              onDrop={() => {
                if (dragId) moveTo(dragId, status);
                setDragId(null);
                setOverCol(null);
              }}
              className={`flex min-h-[140px] flex-col rounded-2xl border bg-white/[0.02] p-3 transition ${
                isOver
                  ? "border-[color:var(--brand-purple)]/60 bg-white/[0.05]"
                  : meta.column
              }`}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  <h2 className="text-[13px] font-semibold tracking-tight text-white/90">
                    {meta.short}
                  </h2>
                </div>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/55">
                  {cards.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2.5">
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
                {cards.length === 0 && (
                  <p className="px-1 py-6 text-center text-[11px] text-white/30">
                    Drop a card here
                  </p>
                )}
              </div>
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
    </div>
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
        // Some browsers require data to be set for the drag to start.
        e.dataTransfer.setData("text/plain", project.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="group block cursor-grab rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-white/25 hover:bg-white/[0.07] active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13.5px] font-semibold leading-snug tracking-tight text-white">
          {project.name}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${prio.tag}`}
        >
          {prio.label}
        </span>
      </div>

      {project.clientName && (
        <p className="mt-1 text-[11.5px] text-white/55">{project.clientName}</p>
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
  const [startDate, setStartDate] = useState("");
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
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
