"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  Info,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  ROADMAP_PILLARS,
  ROADMAP_STATUSES,
  currentWeekIndex,
  newTaskId,
  weekStartDate,
  type Roadmap,
  type RoadmapPillar,
  type RoadmapStatus,
  type RoadmapTask,
  type RoadmapWarning,
} from "@/lib/roadmap-store";
import { formatDate } from "@/lib/dates";

const STATUS_META: Record<
  RoadmapStatus,
  { label: string; bgClass: string; chipClass: string }
> = {
  not_started: {
    label: "Not started",
    bgClass: "bg-white/[0.04] border border-white/12 text-white/85",
    chipClass: "border-white/20 bg-white/[0.06] text-white/65",
  },
  in_progress: {
    label: "In progress",
    bgClass: "bg-sky-500/15 border border-sky-400/40 text-white",
    chipClass: "border-sky-400/40 bg-sky-500/15 text-sky-100",
  },
  pending_review: {
    label: "Pending client review",
    bgClass: "bg-amber-500/15 border border-amber-400/45 text-white",
    chipClass: "border-amber-400/40 bg-amber-500/15 text-amber-100",
  },
  implemented: {
    label: "Implemented",
    bgClass: "bg-emerald-500/15 border border-emerald-400/45 text-white",
    chipClass: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  },
};

const PILLAR_LABEL: Record<RoadmapPillar, string> = {
  technical: "Technical",
  "on-page": "On-Page",
  "off-page": "Off-Page",
  local: "Local",
  content: "Content",
  research: "Research",
};

const MONTHS = [
  { name: "Month 1", weeks: [1, 2, 3, 4] },
  { name: "Month 2", weeks: [5, 6, 7, 8] },
  { name: "Month 3", weeks: [9, 10, 11, 12] },
];

type Props = {
  clientSlug: string;
  clientName: string;
  initialRoadmap: Roadmap | null;
  initialWarnings: RoadmapWarning[];
};

export function RoadmapBoard({
  clientSlug,
  clientName,
  initialRoadmap,
  initialWarnings,
}: Props) {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(initialRoadmap);
  const [warnings, setWarnings] = useState<RoadmapWarning[]>(initialWarnings);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [generatePanelOpen, setGeneratePanelOpen] = useState(false);
  const [generateStartDate, setGenerateStartDate] = useState(() =>
    initialRoadmap?.startDate ?? defaultStartDateISO(),
  );
  const [generateFocus, setGenerateFocus] = useState("");
  const [generateConstraints, setGenerateConstraints] = useState("");

  // Debounced auto-save: any roadmap mutation triggers a PUT after 600ms.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);
  useEffect(() => {
    if (!roadmap) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistRoadmap(roadmap, setSaving, setWarnings);
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [roadmap]);

  const week = useMemo(
    () => (roadmap ? currentWeekIndex(roadmap) : 0),
    [roadmap],
  );
  const tasksByWeek = useMemo(() => {
    const map = new Map<number, RoadmapTask[]>();
    for (let w = 1; w <= 12; w++) map.set(w, []);
    if (roadmap) {
      for (const t of roadmap.tasks) {
        const bucket = map.get(t.week) ?? [];
        bucket.push(t);
        map.set(t.week, bucket);
      }
      for (const [w, list] of map) {
        list.sort((a, b) => a.order - b.order);
        map.set(w, list);
      }
    }
    return map;
  }, [roadmap]);
  const flaggedTaskIds = useMemo(() => {
    const s = new Set<string>();
    for (const w of warnings) for (const id of w.taskIds) s.add(id);
    return s;
  }, [warnings]);

  // ----- Generate -----
  const generate = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/roadmaps/${clientSlug}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startDate: generateStartDate,
          strategicFocus: generateFocus.trim() || undefined,
          constraints: generateConstraints.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        roadmap?: Roadmap;
        error?: string;
      };
      if (!res.ok || !data.roadmap) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      skipNextSave.current = true;
      setRoadmap(data.roadmap);
      setWarnings([]);
      setGeneratePanelOpen(false);
      setGenerateFocus("");
      setGenerateConstraints("");
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [clientSlug, generateStartDate, generateFocus, generateConstraints]);

  // ----- Mutators (all hit the auto-save effect by setting state) -----
  const updateTask = useCallback(
    (taskId: string, patch: Partial<RoadmapTask>) => {
      setRoadmap((prev) => {
        if (!prev) return prev;
        const now = Date.now();
        const tasks = prev.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const next = { ...t, ...patch };
          if (patch.status && patch.status !== t.status) {
            next.statusChangedAt = now;
          }
          return next;
        });
        return { ...prev, tasks };
      });
    },
    [],
  );
  const deleteTask = useCallback((taskId: string) => {
    setRoadmap((prev) => {
      if (!prev) return prev;
      return { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) };
    });
  }, []);
  const addTask = useCallback((week: number) => {
    setRoadmap((prev) => {
      if (!prev) return prev;
      const maxOrder = prev.tasks
        .filter((t) => t.week === week)
        .reduce((m, t) => Math.max(m, t.order), 0);
      const now = Date.now();
      const newTask: RoadmapTask = {
        id: newTaskId(),
        week,
        title: "New task",
        status: "not_started",
        pillar: "technical",
        order: maxOrder + 1,
        createdAt: now,
        statusChangedAt: now,
      };
      setEditingTaskId(newTask.id);
      return { ...prev, tasks: [...prev.tasks, newTask] };
    });
  }, []);
  const dismissWarning = useCallback((id: string) => {
    setRoadmap((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dismissedWarnings: [
          ...prev.dismissedWarnings,
          { id, dismissedAt: Date.now() },
        ],
      };
    });
    setWarnings((prev) => prev.filter((w) => w.id !== id));
  }, []);
  const updateStartDate = useCallback((next: string) => {
    setRoadmap((prev) => (prev ? { ...prev, startDate: next } : prev));
  }, []);

  // ----- Empty state (no roadmap yet) -----
  if (!roadmap) {
    return (
      <div className="brand-gradient-border rounded-2xl bg-white/[0.035] p-8 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-[color:var(--brand-purple)]" />
          <h2 className="text-lg font-semibold text-white">
            No roadmap yet for {clientName}
          </h2>
        </div>
        <p className="mt-2 max-w-xl text-sm text-white/65">
          Generate a fresh 12-week SEO roadmap from {clientName}&apos;s brief,
          onboarding form, target keywords, and recent action history.
          You&apos;ll be able to edit every task — change status, move weeks,
          rename, delete — after it&apos;s generated.
        </p>
        <GeneratePanel
          startDate={generateStartDate}
          setStartDate={setGenerateStartDate}
          focus={generateFocus}
          setFocus={setGenerateFocus}
          constraints={generateConstraints}
          setConstraints={setGenerateConstraints}
          generating={generating}
          generate={generate}
          error={generateError}
          mode="create"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="brand-gradient-border flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-white/75 backdrop-blur-md">
        <span className="inline-flex items-center gap-2">
          <Calendar className="h-4 w-4 text-white/55" />
          <span className="text-[11px] uppercase tracking-[0.13em] text-white/55">
            Start
          </span>
          <input
            type="date"
            value={roadmap.startDate}
            onChange={(e) => updateStartDate(e.target.value)}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white outline-none focus:border-white/30"
          />
        </span>
        <span
          className={
            week >= 1 && week <= 12
              ? "inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-purple)]/45 bg-[color:var(--brand-purple)]/15 px-2.5 py-0.5 text-[11px] font-medium text-white"
              : "inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-white/65"
          }
        >
          {week >= 1 && week <= 12
            ? `▶ Week ${week} of 12`
            : week === 0
              ? "Starts soon"
              : "Past the 12-week horizon"}
        </span>
        <span className="text-[11px] text-white/45">
          Generated {formatDate(roadmap.generatedAt)} · {roadmap.tasks.length} tasks
        </span>
        <span className="ml-auto inline-flex items-center gap-3">
          {saving && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          <button
            type="button"
            onClick={() => setGeneratePanelOpen((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
            <ChevronDown
              className={`h-3 w-3 transition ${generatePanelOpen ? "rotate-180" : ""}`}
            />
          </button>
        </span>
      </div>

      {generatePanelOpen && (
        <GeneratePanel
          startDate={generateStartDate}
          setStartDate={setGenerateStartDate}
          focus={generateFocus}
          setFocus={setGenerateFocus}
          constraints={generateConstraints}
          setConstraints={setGenerateConstraints}
          generating={generating}
          generate={generate}
          error={generateError}
          mode="regenerate"
        />
      )}

      {warnings.length > 0 && (
        <ul className="space-y-2">
          {warnings.map((w) => (
            <li
              key={w.id}
              className={
                w.severity === "critical"
                  ? "flex items-start gap-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-100"
                  : w.severity === "warning"
                    ? "flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-100"
                    : "flex items-start gap-3 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3.5 py-2.5 text-xs text-sky-100"
              }
            >
              {w.severity === "info" ? (
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span className="flex-1">{w.message}</span>
              <button
                type="button"
                onClick={() => dismissWarning(w.id)}
                className="rounded-md p-1 text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Months + weeks */}
      <div className="space-y-6">
        {MONTHS.map((m) => (
          <div key={m.name}>
            <div className="mb-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
              <span className="rounded-md bg-[color:var(--brand-purple)]/20 px-2 py-0.5 text-white">
                {m.name}
              </span>
              <span className="h-px flex-1 bg-white/8" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {m.weeks.map((w) => {
                const tasks = tasksByWeek.get(w) ?? [];
                const isCurrent = w === week;
                return (
                  <WeekColumn
                    key={w}
                    week={w}
                    weekDate={weekStartDate(roadmap, w)}
                    tasks={tasks}
                    isCurrent={isCurrent}
                    editingTaskId={editingTaskId}
                    onStartEdit={(id) => setEditingTaskId(id)}
                    onStopEdit={() => setEditingTaskId(null)}
                    onUpdate={updateTask}
                    onDelete={deleteTask}
                    onAdd={addTask}
                    flaggedTaskIds={flaggedTaskIds}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------

function GeneratePanel({
  startDate,
  setStartDate,
  focus,
  setFocus,
  constraints,
  setConstraints,
  generating,
  generate,
  error,
  mode,
}: {
  startDate: string;
  setStartDate: (v: string) => void;
  focus: string;
  setFocus: (v: string) => void;
  constraints: string;
  setConstraints: (v: string) => void;
  generating: boolean;
  generate: () => void;
  error: string | null;
  mode: "create" | "regenerate";
}) {
  return (
    <div
      className={
        mode === "regenerate"
          ? "rounded-xl border border-white/10 bg-white/[0.025] p-4"
          : "mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4"
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block text-xs">
          <span className="text-[11px] uppercase tracking-[0.13em] text-white/55">
            Start date (Monday of week 1)
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
          />
        </label>
        <label className="block text-xs md:col-span-2">
          <span className="text-[11px] uppercase tracking-[0.13em] text-white/55">
            Strategic focus (optional)
          </span>
          <input
            type="text"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder='e.g. "push local SEO hard for the new Lisbon clinic"'
            className="mt-1 w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </label>
      </div>
      <label className="mt-3 block text-xs">
        <span className="text-[11px] uppercase tracking-[0.13em] text-white/55">
          Constraints (optional)
        </span>
        <textarea
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          rows={2}
          placeholder="e.g. no link-building Q3, content team capped at 2 articles/week"
          className="mt-1 w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/30"
        />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={generating}
          onClick={generate}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {mode === "create" ? "Generate roadmap" : "Generate new roadmap"}
        </button>
        {mode === "regenerate" && (
          <span className="text-[11px] text-white/45">
            Old roadmap will be archived. New one starts blank — you can keep
            editing right after.
          </span>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-rose-300">{error}</p>
      )}
    </div>
  );
}

function WeekColumn({
  week,
  weekDate,
  tasks,
  isCurrent,
  editingTaskId,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onDelete,
  onAdd,
  flaggedTaskIds,
}: {
  week: number;
  weekDate: string;
  tasks: RoadmapTask[];
  isCurrent: boolean;
  editingTaskId: string | null;
  onStartEdit: (id: string) => void;
  onStopEdit: () => void;
  onUpdate: (id: string, patch: Partial<RoadmapTask>) => void;
  onDelete: (id: string) => void;
  onAdd: (week: number) => void;
  flaggedTaskIds: Set<string>;
}) {
  return (
    <div
      className={
        isCurrent
          ? "relative rounded-xl border border-[color:var(--brand-purple)]/50 bg-[color:var(--brand-purple)]/[0.06] p-3 shadow-[0_0_0_1px_rgba(120,61,245,0.25)]"
          : "rounded-xl border border-white/8 bg-white/[0.02] p-3"
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-white">Week {week}</h3>
          <span className="text-[10px] uppercase tracking-[0.13em] text-white/40">
            {formatDate(weekDate)}
          </span>
        </div>
        {isCurrent && (
          <span className="rounded-full border border-[color:var(--brand-purple)]/50 bg-[color:var(--brand-purple)]/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-white">
            Now
          </span>
        )}
      </div>
      <ul className="mt-2 space-y-2">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            editing={editingTaskId === t.id}
            flagged={flaggedTaskIds.has(t.id)}
            onStartEdit={() => onStartEdit(t.id)}
            onStopEdit={onStopEdit}
            onUpdate={(patch) => onUpdate(t.id, patch)}
            onDelete={() => onDelete(t.id)}
          />
        ))}
        {tasks.length === 0 && (
          <li className="rounded-lg border border-dashed border-white/10 bg-white/[0.01] px-2.5 py-2 text-center text-[10.5px] text-white/35">
            No tasks
          </li>
        )}
      </ul>
      <button
        type="button"
        onClick={() => onAdd(week)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-white/15 bg-white/[0.02] px-2 py-1.5 text-[11px] text-white/55 transition hover:border-white/30 hover:bg-white/[0.05] hover:text-white"
      >
        <Plus className="h-3 w-3" />
        Add task
      </button>
    </div>
  );
}

function TaskCard({
  task,
  editing,
  flagged,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onDelete,
}: {
  task: RoadmapTask;
  editing: boolean;
  flagged: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (patch: Partial<RoadmapTask>) => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[task.status];
  if (!editing) {
    return (
      <li
        className={`group relative rounded-lg ${meta.bgClass} ${flagged ? "ring-1 ring-amber-300/60" : ""}`}
      >
        <button
          type="button"
          onClick={onStartEdit}
          className="block w-full px-2.5 py-2 text-left text-[11.5px] leading-snug"
        >
          <span className="font-medium">{task.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[9.5px] uppercase tracking-[0.1em]">
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-semibold ${meta.chipClass}`}
            >
              {meta.label}
            </span>
            <span className="rounded-full border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-white/65">
              {PILLAR_LABEL[task.pillar]}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onStartEdit}
          aria-label="Edit"
          className="absolute right-1 top-1 hidden rounded-md border border-white/10 bg-black/30 p-1 text-white/70 transition hover:border-white/30 hover:text-white group-hover:block"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </li>
    );
  }
  return (
    <li className={`rounded-lg ${meta.bgClass}`}>
      <div className="space-y-2 px-2.5 py-2">
        <input
          type="text"
          value={task.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-[12px] text-white outline-none focus:border-white/30"
          placeholder="Task title"
        />
        <textarea
          value={task.description ?? ""}
          onChange={(e) =>
            onUpdate({ description: e.target.value || undefined })
          }
          rows={2}
          placeholder="Notes / what this means in practice (optional)"
          className="w-full rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] text-white outline-none placeholder:text-white/35 focus:border-white/30"
        />
        <div className="grid grid-cols-3 gap-1.5">
          <label className="block text-[9.5px] uppercase tracking-[0.1em] text-white/45">
            Status
            <select
              value={task.status}
              onChange={(e) =>
                onUpdate({ status: e.target.value as RoadmapStatus })
              }
              className="mt-0.5 w-full rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-1 text-[11px] text-white focus:border-white/30"
            >
              {ROADMAP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[9.5px] uppercase tracking-[0.1em] text-white/45">
            Pillar
            <select
              value={task.pillar}
              onChange={(e) =>
                onUpdate({ pillar: e.target.value as RoadmapPillar })
              }
              className="mt-0.5 w-full rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-1 text-[11px] text-white focus:border-white/30"
            >
              {ROADMAP_PILLARS.map((p) => (
                <option key={p} value={p}>
                  {PILLAR_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[9.5px] uppercase tracking-[0.1em] text-white/45">
            Week
            <select
              value={task.week}
              onChange={(e) =>
                onUpdate({ week: Number(e.target.value) })
              }
              className="mt-0.5 w-full rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-1 text-[11px] text-white focus:border-white/30"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[10.5px] font-medium text-rose-200 transition hover:border-rose-400/60 hover:bg-rose-500/20"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
          <button
            type="button"
            onClick={onStopEdit}
            className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/[0.06] px-2 py-1 text-[10.5px] font-semibold text-white transition hover:bg-white/[0.12]"
          >
            <Check className="h-3 w-3" />
            Done
          </button>
        </div>
      </div>
    </li>
  );
}

function defaultStartDateISO(): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dow = d.getUTCDay();
  const offset = dow === 1 ? 0 : (8 - dow) % 7;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function persistRoadmap(
  roadmap: Roadmap,
  setSaving: (v: boolean) => void,
  setWarnings: (v: RoadmapWarning[]) => void,
) {
  setSaving(true);
  try {
    const res = await fetch(`/api/roadmaps/${roadmap.clientSlug}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(roadmap),
    });
    const data = (await res.json()) as {
      roadmap?: Roadmap;
      warnings?: RoadmapWarning[];
      error?: string;
    };
    if (res.ok && data.warnings) {
      setWarnings(data.warnings);
    }
  } catch (err) {
    console.error("roadmap save failed:", err);
  } finally {
    setSaving(false);
  }
}
