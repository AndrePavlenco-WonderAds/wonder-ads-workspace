"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  CalendarMinus,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import {
  MAX_ROADMAP_MONTHS,
  MIN_ROADMAP_MONTHS,
  ROADMAP_EXTEND_MONTHS,
  ROADMAP_GENERATE_MONTHS,
  ROADMAP_PILLARS,
  ROADMAP_STATUSES,
  currentWeekIndex,
  monthIndexOfWeek,
  monthsAfterExtend,
  monthsAfterRemove,
  newTaskId,
  roadmapLastDay,
  roadmapMonthCount,
  roadmapMonths,
  roadmapWeeks,
  taskEndWeek,
  taskSpanWeeks,
  weekStartDate,
  type Roadmap,
  type RoadmapPillar,
  type RoadmapStatus,
  type RoadmapTask,
} from "@/lib/roadmap-store";
import { formatDate } from "@/lib/dates";
import { RoadmapRenewalChip } from "./roadmap-renewal-chip";
import { useSeoReadOnly } from "./seo-readonly";

const MAX_PHOTOS = 8;
const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp,image/avif,image/gif";

type UploadedPhoto = {
  /** Stable id only used for keying + removal. */
  id: string;
  url: string;
  name: string;
  /** While the file is still uploading we keep a local preview blob URL. */
  previewUrl: string;
  uploading: boolean;
  error?: string;
};

// v74.23.2: status colours flipped so the board matches Andre's FigJam
// legend. In-progress used to be sky-blue and pending-review amber — that
// was the OPPOSITE of how the FigJam reads (YELLOW = ongoing, VIOLET/blue
// = pending client review). Now yellow = in-progress, blue = pending
// review. Emerald (done) + white (not started) are unchanged.
const STATUS_META: Record<
  RoadmapStatus,
  { label: string; bgClass: string; chipClass: string; dotClass: string }
> = {
  not_started: {
    label: "Not started",
    bgClass: "bg-white/[0.04] border border-white/12 text-white/85",
    chipClass: "border-white/20 bg-white/[0.06] text-white/65",
    dotClass: "bg-white/45",
  },
  in_progress: {
    label: "In progress",
    bgClass: "bg-amber-500/15 border border-amber-400/45 text-white",
    chipClass: "border-amber-400/40 bg-amber-500/15 text-amber-100",
    dotClass: "bg-amber-400",
  },
  pending_review: {
    // v74.23.3: shifted from sky-blue to violet so the chip leans
    // closer to the FigJam VIOLET swatch (purple-blue) instead of
    // reading as straight cyan. Same intensity, just shifted up the
    // hue wheel.
    label: "Pending client review",
    bgClass: "bg-violet-500/15 border border-violet-400/45 text-white",
    chipClass: "border-violet-400/40 bg-violet-500/20 text-violet-100",
    dotClass: "bg-violet-400",
  },
  implemented: {
    label: "Implemented",
    bgClass: "bg-emerald-500/15 border border-emerald-400/45 text-white",
    chipClass: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
    dotClass: "bg-emerald-400",
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

// Paced "what's happening" messages displayed while the generate call is
// pending. The endpoint is one-shot (no server-side progress events) so
// this is a UX-only cycle — the bar itself is indeterminate.
const GENERATE_PHASES = [
  "Loading client brief, onboarding form, and target keywords…",
  "Pulling the last 15 actions we ran on this account…",
  "Crawling the homepage + about page for a live mini-audit…",
  "Sending your reference photos to Claude (vision)…",
  "Diagnosing gaps like an SEO pro before sequencing tasks…",
  "Drafting the plan week by week with Claude Sonnet (30–90s)…",
  "Sequencing tasks across the calendar months…",
  "Saving to your workspace and archiving the previous roadmap…",
];

/** The typed word that unlocks "Remove months". Deleting weeks of planned
 *  work is the one destructive thing on this board, so it costs a word,
 *  not a click. */
const REMOVE_CONFIRM_WORD = "DELETE";

/** One rendered slot inside a week column. A multi-week task produces one
 *  cell per week it covers: `isStart` on its first week (the full,
 *  editable, draggable card) and a slim read-only continuation bar on each
 *  later week. */
type WeekCell = { task: RoadmapTask; isStart: boolean };

type Props = {
  clientSlug: string;
  clientName: string;
  /** Renovação do contrato — vive fora do roadmap (ver client-renewal-store). */
  initialRenewalDate: string | null;
  initialTermMonths: number;
  initialRoadmap: Roadmap;
};

export function RoadmapBoard({
  clientSlug,
  clientName,
  initialRenewalDate,
  initialTermMonths,
  initialRoadmap,
}: Props) {
  const readOnly = useSeoReadOnly();
  const [roadmap, setRoadmap] = useState<Roadmap>(initialRoadmap);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateMessage, setGenerateMessage] = useState<string>("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  // Id of the card currently being dragged between week columns — lets the
  // source card dim and every column light up as a drop target.
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [generatePanelOpen, setGeneratePanelOpen] = useState(false);
  const [generateStartDate, setGenerateStartDate] = useState(
    initialRoadmap.startDate,
  );
  // Plan length for a fresh generation. Defaults to the client's contract
  // term (6 months for almost everyone) so the roadmap covers the package
  // the client actually signed, not one quarter of it.
  const [generateMonths, setGenerateMonths] = useState<number>(
    (ROADMAP_GENERATE_MONTHS as readonly number[]).includes(initialTermMonths)
      ? initialTermMonths
      : 6,
  );
  const [generateFocus, setGenerateFocus] = useState("");
  const [generateConstraints, setGenerateConstraints] = useState("");
  const [generatePhotos, setGeneratePhotos] = useState<UploadedPhoto[]>([]);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  // Debounced auto-save: any roadmap mutation triggers a PUT after 600ms.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistRoadmap(roadmap, setSaving);
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [roadmap]);

  const week = useMemo(() => currentWeekIndex(roadmap), [roadmap]);
  const totalWeeks = useMemo(() => roadmapWeeks(roadmap), [roadmap]);
  const totalMonths = useMemo(() => roadmapMonthCount(roadmap), [roadmap]);
  const months = useMemo(() => roadmapMonths(roadmap), [roadmap]);
  const lastDay = useMemo(() => roadmapLastDay(roadmap), [roadmap]);
  const monthNow = useMemo(() => monthIndexOfWeek(roadmap, week), [roadmap, week]);
  const inHorizon = week >= 1 && week <= totalWeeks;
  // Place every task in each week column its span covers. The start week
  // gets the full editable card (isStart); later weeks get a slim
  // continuation bar so a Week 2–4 task visibly runs across all three
  // columns. Starts sort above continuations, then by their own order.
  const cellsByWeek = useMemo(() => {
    const map = new Map<number, WeekCell[]>();
    for (let w = 1; w <= totalWeeks; w++) map.set(w, []);
    for (const t of roadmap.tasks) {
      const start = Math.max(1, Math.min(totalWeeks, t.week));
      const end = Math.min(totalWeeks, taskEndWeek(t));
      for (let w = start; w <= end; w++) {
        map.get(w)?.push({ task: t, isStart: w === t.week });
      }
    }
    for (const [w, list] of map) {
      list.sort((a, b) => {
        if (a.isStart !== b.isStart) return a.isStart ? -1 : 1;
        return a.task.order - b.task.order;
      });
      map.set(w, list);
    }
    return map;
  }, [roadmap, totalWeeks]);

  // ----- Generate -----
  const generate = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    setGenerateMessage(GENERATE_PHASES[0]);
    // Cycle through realistic phase messages while we wait. The
    // generateText call is one-shot (no server-side progress events), so
    // this is a paced "what's happening" UX, not a true progress meter.
    let phaseIndex = 0;
    const phaseTimer = setInterval(() => {
      phaseIndex = Math.min(phaseIndex + 1, GENERATE_PHASES.length - 1);
      setGenerateMessage(GENERATE_PHASES[phaseIndex]);
    }, 4500);
    try {
      const readyPhotos = generatePhotos
        .filter((p) => !p.uploading && !p.error && p.url)
        .map((p) => p.url);
      const res = await fetch(`/api/roadmaps/${clientSlug}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startDate: generateStartDate,
          months: generateMonths,
          strategicFocus: generateFocus.trim() || undefined,
          constraints: generateConstraints.trim() || undefined,
          photos: readyPhotos.length > 0 ? readyPhotos : undefined,
        }),
      });
      // Read as text first so a non-JSON error page (e.g. a Vercel
      // function timeout) doesn't crash with "Unexpected token 'A'…".
      const rawText = await res.text();
      const data = tryParseJson<{
        roadmap?: Roadmap;
        error?: string;
      }>(rawText);
      if (!res.ok) {
        const message =
          data?.error ??
          (rawText.trim().length > 0
            ? rawText.trim().slice(0, 240)
            : `HTTP ${res.status}`);
        throw new Error(message);
      }
      if (!data?.roadmap) {
        throw new Error(
          data?.error ??
            "Server returned an unexpected response. Try regenerating.",
        );
      }
      skipNextSave.current = true;
      setRoadmap(data.roadmap);
      setGeneratePanelOpen(false);
      setGenerateFocus("");
      setGenerateConstraints("");
      // Clean up any local preview blob URLs we minted.
      for (const photo of generatePhotos) {
        if (photo.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(photo.previewUrl);
        }
      }
      setGeneratePhotos([]);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : String(err));
    } finally {
      clearInterval(phaseTimer);
      setGenerating(false);
      setGenerateMessage("");
    }
  }, [
    clientSlug,
    generateStartDate,
    generateMonths,
    generateFocus,
    generateConstraints,
    generatePhotos,
  ]);

  // ----- Photo upload (Vercel Blob client-upload pattern, same as
  // OnboardingForm). Uploads happen as soon as the user picks a file
  // so by the time they click Generate the URLs are already on Blob. -----
  const addPhotos = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const slots = Math.max(0, MAX_PHOTOS - generatePhotos.length);
      const picked = Array.from(files).slice(0, slots);
      if (picked.length === 0) return;
      const initial: UploadedPhoto[] = picked.map((file) => ({
        id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        url: "",
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        uploading: true,
      }));
      setGeneratePhotos((prev) => [...prev, ...initial]);
      // Upload in parallel; each settles its own slot.
      await Promise.all(
        picked.map(async (file, i) => {
          const id = initial[i].id;
          try {
            const blob = await upload(file.name, file, {
              access: "public",
              handleUploadUrl: "/api/files/upload",
            });
            setGeneratePhotos((prev) =>
              prev.map((p) =>
                p.id === id ? { ...p, url: blob.url, uploading: false } : p,
              ),
            );
          } catch (err) {
            setGeneratePhotos((prev) =>
              prev.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      uploading: false,
                      error: err instanceof Error ? err.message : "Upload failed",
                    }
                  : p,
              ),
            );
          }
        }),
      );
    },
    [generatePhotos.length],
  );
  const removePhoto = useCallback((id: string) => {
    setGeneratePhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target && target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  // ----- Mutators (all hit the auto-save effect by setting state) -----
  const updateTask = useCallback(
    (taskId: string, patch: Partial<RoadmapTask>) => {
      setRoadmap((prev) => {
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
    setRoadmap((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
  }, []);
  const addTask = useCallback((week: number) => {
    setRoadmap((prev) => {
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
  // Slide a task to a new START week, carrying its whole span with it.
  // Used by the ◀ ▶ nudge arrows (targetWeek = week ± 1) and by
  // drag-and-drop onto another column (targetWeek = the column dropped on).
  // The span length is preserved; if it would run off the end of the
  // roadmap the whole task is nudged back so it stays fully in-bounds.
  const shiftTask = useCallback((taskId: string, targetWeek: number) => {
    setRoadmap((prev) => {
      const total = roadmapWeeks(prev);
      const tasks = prev.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const span = taskEndWeek(t) - t.week; // 0 for a single-week task
        let start = Math.max(1, Math.min(total, Math.round(targetWeek)));
        let end = start + span;
        if (end > total) {
          end = total;
          start = Math.max(1, end - span);
        }
        if (start === t.week && (t.endWeek ?? t.week) <= t.week && span === 0) {
          return t; // no-op
        }
        return { ...t, week: start, endWeek: span > 0 ? end : undefined };
      });
      return { ...prev, tasks };
    });
  }, []);
  const updateStartDate = useCallback((next: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return; // ignore a half-typed date
    setRoadmap((prev) => ({
      ...prev,
      startDate: next,
      weeks: roadmapWeeks({ ...prev, startDate: next }),
    }));
  }, []);
  // "Extend" — grows the plan by 1, 3 or 6 CALENDAR months (up to the
  // 1-year cap). Existing tasks/weeks are untouched; the new weeks land as
  // empty columns ready to plan. The debounced auto-save persists the new
  // `months` and the changelog records an "extend" event.
  const extendRoadmap = useCallback((add: number) => {
    setRoadmap((prev) => {
      const current = roadmapMonthCount(prev);
      const next = monthsAfterExtend(current, add);
      if (next <= current) return prev;
      return {
        ...prev,
        months: next,
        weeks: roadmapWeeks({ ...prev, months: next }),
      };
    });
  }, []);
  // "Remove months" — cuts N calendar months off the END of the plan
  // (never below one quarter). Tasks that START in the removed weeks are
  // deleted; a multi-week task that merely runs into them is cut short at
  // the new last week. The dialog spells out exactly what goes before the
  // consultant types the confirmation word.
  const removeMonths = useCallback((remove: number) => {
    setRoadmap((prev) => {
      const current = roadmapMonthCount(prev);
      const next = monthsAfterRemove(current, remove);
      if (next >= current) return prev;
      const keepWeeks = roadmapWeeks({ ...prev, months: next });
      const tasks = prev.tasks
        .filter((t) => t.week <= keepWeeks)
        .map((t) =>
          taskEndWeek(t) > keepWeeks
            ? { ...t, endWeek: keepWeeks > t.week ? keepWeeks : undefined }
            : t,
        );
      return { ...prev, months: next, weeks: keepWeeks, tasks };
    });
  }, []);

  const isEmpty = roadmap.tasks.length === 0;
  const canRemoveMonths = totalMonths > MIN_ROADMAP_MONTHS;

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="brand-gradient-border flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-white/75 backdrop-blur-md">
        <label
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] text-white/75"
          title="Starting date — week 1 begins here. Editable inline."
        >
          <Calendar className="h-3.5 w-3.5 text-white/55" />
          <span className="text-[10px] uppercase tracking-[0.13em] text-white/55">
            Starts
          </span>
          <input
            type="date"
            value={roadmap.startDate}
            onChange={(e) => updateStartDate(e.target.value)}
            className="border-0 bg-transparent p-0 text-[11px] text-white outline-none [color-scheme:dark]"
          />
        </label>
        {roadmap.onboardingDate && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[10px] text-white/55"
            title="When the client originally onboarded with the agency — pinned even after the roadmap is reset"
          >
            <span className="text-[9px] uppercase tracking-[0.13em] text-white/40">
              Onboarded
            </span>
            <span className="font-medium text-white/75">
              {formatDate(roadmap.onboardingDate)}
            </span>
          </span>
        )}
        <RoadmapRenewalChip
          clientSlug={clientSlug}
          initialRenewalDate={initialRenewalDate}
          initialTermMonths={initialTermMonths}
          readOnly={readOnly}
        />
        {/* Horizon pill — where we are in weeks AND calendar months, and
            the real end date. The team sells packages in months, so
            "Month 5 of 6" is the number they actually reason about. */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[10px] text-white/55"
          title={`${totalMonths} calendar months from ${formatDate(roadmap.startDate)} · ${totalWeeks} weeks · ends ${formatDate(lastDay)}`}
        >
          <span className="font-medium text-white/75">
            {inHorizon
              ? `Week ${week} of ${totalWeeks} · Month ${monthNow} of ${totalMonths}`
              : week < 1
                ? `${totalMonths} months · ${totalWeeks} weeks · starts ${formatDate(roadmap.startDate)}`
                : `${totalMonths} months · ${totalWeeks} weeks · past the last week`}
          </span>
          <span className="text-white/35">·</span>
          <span className="text-[9px] uppercase tracking-[0.13em] text-white/40">
            ends
          </span>
          <span className="font-medium text-white/75">{formatDate(lastDay)}</span>
        </span>
        <span className="text-[11px] text-white/45">
          {roadmap.tasks.length} task{roadmap.tasks.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto inline-flex items-center gap-3">
          {saving && !readOnly && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          {!readOnly && !isEmpty && (
            <ExtendControl totalMonths={totalMonths} onExtend={extendRoadmap} />
          )}
          {!readOnly && !isEmpty && (
            <button
              type="button"
              disabled={!canRemoveMonths}
              onClick={() => setRemoveDialogOpen(true)}
              title={
                canRemoveMonths
                  ? "Cut months off the end of this roadmap (asks for a typed confirmation)"
                  : `A roadmap can't be shorter than ${MIN_ROADMAP_MONTHS} months.`
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/25 bg-rose-500/[0.07] px-2.5 py-1.5 text-[11px] font-medium text-rose-100/85 transition hover:border-rose-400/55 hover:bg-rose-500/15 hover:text-rose-50 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <CalendarMinus className="h-3.5 w-3.5" />
              Remove months
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => setGeneratePanelOpen((p) => !p)}
              className={
                isEmpty
                  ? "inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-3 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-[#783DF5]/25 transition hover:brightness-110"
                  : "inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
              }
            >
              {isEmpty ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isEmpty ? "Fill with AI" : "Regenerate"}
              <ChevronDown
                className={`h-3 w-3 transition ${generatePanelOpen ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </span>
      </div>

      {removeDialogOpen && (
        <RemoveMonthsDialog
          roadmap={roadmap}
          clientName={clientName}
          onConfirm={(n) => {
            removeMonths(n);
            setRemoveDialogOpen(false);
          }}
          onClose={() => setRemoveDialogOpen(false)}
        />
      )}

      {generatePanelOpen && (
        <GeneratePanel
          startDate={generateStartDate}
          setStartDate={setGenerateStartDate}
          months={generateMonths}
          setMonths={setGenerateMonths}
          focus={generateFocus}
          setFocus={setGenerateFocus}
          constraints={generateConstraints}
          setConstraints={setGenerateConstraints}
          photos={generatePhotos}
          onAddPhotos={addPhotos}
          onRemovePhoto={removePhoto}
          generating={generating}
          generate={generate}
          error={generateError}
          progressMessage={generateMessage}
          mode={isEmpty ? "create" : "regenerate"}
        />
      )}

      {roadmap.auditSummary && (
        <CollapsibleAuditSummary
          auditSummary={roadmap.auditSummary}
          sourcePhotos={roadmap.sourcePhotos ?? []}
        />
      )}

      {/* v77.42: the warning banners (stalled reviews, falling behind,
          empty week) and the "final month — extend?" nudge that used to
          stack here are gone. Andre asked for them out: the board is the
          plan, not an inbox. Extend / Remove live in the top bar. */}

      {/* Months + weeks — month label centred with horizontal connector
          like the mind-map, weeks underneath. Each month is a CALENDAR
          month of the plan (startDate + k months), so it holds 4 or 5
          week columns and carries its real date range in the label. The
          month that contains the current week + the current week column
          itself get a stronger brand-gradient treatment so a consultant
          can tell at a glance "we're in Week 6, Month 2" without doing
          the maths from the date pills. */}
      <div className="space-y-8">
        {months.map((m) => {
          const monthIsCurrent = m.weeks.includes(week);
          return (
          <div key={m.name}>
            <div className="relative flex items-center">
              <span
                className={`h-px flex-1 ${
                  monthIsCurrent ? "bg-white/25" : "bg-white/10"
                }`}
              />
              <span
                className={`mx-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                  monthIsCurrent
                    ? "brand-gradient-bg text-white shadow-[0_8px_28px_-6px_rgba(120,61,245,0.55)] ring-2 ring-[color:var(--brand-purple)]/40"
                    : "brand-gradient-border bg-[color:var(--brand-purple)]/15 text-white/65"
                }`}
                title={`${m.weeks.length} weeks · ${formatDate(m.start)} – ${formatDate(m.end)}`}
              >
                {monthIsCurrent && (
                  <span
                    aria-hidden
                    className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"
                  />
                )}
                {m.name}
                <span
                  className={`ml-1 text-[9.5px] font-medium normal-case tracking-[0.04em] tabular-nums ${
                    monthIsCurrent ? "text-white/85" : "text-white/45"
                  }`}
                >
                  {formatDate(m.start)} – {formatDate(m.end)}
                </span>
                {monthIsCurrent && (
                  <span className="ml-1 rounded-full bg-white/20 px-1.5 py-px text-[9px] font-bold tracking-wider">
                    NOW
                  </span>
                )}
              </span>
              <span
                className={`h-px flex-1 ${
                  monthIsCurrent ? "bg-white/25" : "bg-white/10"
                }`}
              />
            </div>
            <div
              className={`mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 ${
                m.weeks.length >= 5 ? "xl:grid-cols-5" : "xl:grid-cols-4"
              }`}
            >
              {m.weeks.map((w) => {
                const cells = cellsByWeek.get(w) ?? [];
                const isCurrent = w === week;
                return (
                  <WeekColumn
                    key={w}
                    week={w}
                    totalWeeks={totalWeeks}
                    weekDate={weekStartDate(roadmap, w)}
                    cells={cells}
                    isCurrent={isCurrent}
                    editingTaskId={editingTaskId}
                    onStartEdit={(id) => setEditingTaskId(id)}
                    onStopEdit={() => setEditingTaskId(null)}
                    onUpdate={updateTask}
                    onDelete={deleteTask}
                    onAdd={addTask}
                    onSlideTask={shiftTask}
                    draggingTaskId={draggingTaskId}
                    onDragStartTask={setDraggingTaskId}
                    onDragEndTask={() => setDraggingTaskId(null)}
                    onDropTaskToWeek={(id, targetWeek) => {
                      shiftTask(id, targetWeek);
                      setDraggingTaskId(null);
                    }}
                  />
                );
              })}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------

/** EXTEND +1 / +3 / +6 MONTHS.
 *
 *  A quarter is the common renewal but it was never the only one: an
 *  account that just signed for six months needed two clicks (and left
 *  two "extended" lines in the log for one decision), and a plan that
 *  only had to reach the end of an engagement had to overshoot by a
 *  whole quarter. Three steps side by side make the choice one click and
 *  keep the horizon honest.
 *
 *  A step that would run past the 12-month ceiling is DISABLED, not
 *  silently clamped — clicking "+6" and getting one month is the kind of
 *  small lie that teaches people to stop trusting the button. The
 *  tooltip says how much room is actually left. */
function ExtendControl({
  totalMonths,
  onExtend,
}: {
  totalMonths: number;
  onExtend: (months: number) => void;
}) {
  if (totalMonths >= MAX_ROADMAP_MONTHS) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/45"
        title={`This roadmap is at the ${MAX_ROADMAP_MONTHS}-month maximum.`}
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        Max {MAX_ROADMAP_MONTHS} months
      </span>
    );
  }

  const roomMonths = MAX_ROADMAP_MONTHS - totalMonths;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/12 bg-white/[0.03] px-1.5 py-1">
      <span className="inline-flex items-center gap-1.5 pl-1 pr-0.5 text-[11px] font-medium text-white/65">
        <CalendarPlus className="h-3.5 w-3.5" />
        Extend
      </span>
      {ROADMAP_EXTEND_MONTHS.map((m) => {
        const fits = m <= roomMonths;
        const featured = m === 3;
        return (
          <button
            key={m}
            type="button"
            disabled={!fits}
            onClick={() => onExtend(m)}
            title={
              fits
                ? `Add ${m} calendar month${m === 1 ? "" : "s"} — ${
                    totalMonths + m
                  } months in total. The new weeks land as empty columns.`
                : `Only ${roomMonths} more month${
                    roomMonths === 1 ? "" : "s"
                  } fit before the ${MAX_ROADMAP_MONTHS}-month ceiling.`
            }
            className={`rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-35 ${
              featured
                ? "bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] text-white shadow-md shadow-[#783DF5]/25 hover:brightness-110"
                : "border border-white/12 bg-white/[0.04] text-white/80 hover:border-white/30 hover:bg-white/[0.09] hover:text-white"
            }`}
          >
            +{m}m
          </button>
        );
      })}
    </span>
  );
}

/** REMOVE MONTHS — the mirror of Extend, behind a typed confirmation.
 *
 *  Cutting months deletes every task that starts in the removed weeks,
 *  which is the only destructive thing this board can do to planned work.
 *  So the dialog shows the exact consequence first — the new end date, the
 *  week numbers that disappear, the tasks that go with them by name — and
 *  only then asks the consultant to type DELETE. A click-through "Are you
 *  sure?" would be read as noise within a week; a word is a decision.
 *
 *  Portalled to <body>: the board sits under PageShell, and a `fixed`
 *  overlay must not inherit a blurred ancestor as its containing block. */
function RemoveMonthsDialog({
  roadmap,
  clientName,
  onConfirm,
  onClose,
}: {
  roadmap: Roadmap;
  clientName: string;
  onConfirm: (months: number) => void;
  onClose: () => void;
}) {
  const totalMonths = roadmapMonthCount(roadmap);
  const totalWeeks = roadmapWeeks(roadmap);
  const maxRemovable = Math.max(0, totalMonths - MIN_ROADMAP_MONTHS);
  const [remove, setRemove] = useState(1);
  const [typed, setTyped] = useState("");

  const nextMonths = monthsAfterRemove(totalMonths, remove);
  const keepWeeks = roadmapWeeks({ ...roadmap, months: nextMonths });
  const nextLastDay = roadmapLastDay({ ...roadmap, months: nextMonths });
  const doomed = roadmap.tasks
    .filter((t) => t.week > keepWeeks)
    .sort((a, b) => a.week - b.week || a.order - b.order);
  const trimmed = roadmap.tasks.filter(
    (t) => t.week <= keepWeeks && taskEndWeek(t) > keepWeeks,
  );
  const confirmed = typed.trim().toUpperCase() === REMOVE_CONFIRM_WORD;

  // Escape closes; the overlay click closes; the card itself swallows it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-months-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-rose-400/30 bg-[#12101c] p-5 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-400/40 bg-rose-500/15 text-rose-200">
            <CalendarMinus className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="remove-months-title"
              className="text-[15px] font-semibold leading-tight"
            >
              Remove months from the end of this roadmap
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-white/60">
              {clientName} · {totalMonths} months today ({totalWeeks} weeks,
              ends {formatDate(roadmapLastDay(roadmap))}). A roadmap can&apos;t
              go below {MIN_ROADMAP_MONTHS} months.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-white/50 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* How many months to cut */}
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.13em] text-white/50">
            Months to remove
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Array.from({ length: maxRemovable }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRemove(n)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold tabular-nums transition ${
                  remove === n
                    ? "border border-rose-400/60 bg-rose-500/25 text-rose-50"
                    : "border border-white/12 bg-white/[0.04] text-white/75 hover:border-white/30 hover:text-white"
                }`}
              >
                −{n}
              </button>
            ))}
          </div>
        </div>

        {/* The consequence, spelled out */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-[12px] leading-relaxed">
          <p className="text-white/85">
            <span className="font-semibold">{totalMonths} → {nextMonths} months.</span>{" "}
            The plan will end on{" "}
            <span className="font-semibold">{formatDate(nextLastDay)}</span>{" "}
            instead of {formatDate(roadmapLastDay(roadmap))}.{" "}
            {totalWeeks > keepWeeks && (
              <>
                Week{totalWeeks - keepWeeks === 1 ? "" : "s"}{" "}
                <span className="font-semibold tabular-nums">
                  {keepWeeks + 1}
                  {totalWeeks - keepWeeks === 1 ? "" : `–${totalWeeks}`}
                </span>{" "}
                disappear.
              </>
            )}
          </p>
          {doomed.length > 0 ? (
            <div className="mt-2.5">
              <p className="font-semibold text-rose-200">
                {doomed.length} task{doomed.length === 1 ? "" : "s"} will be
                deleted:
              </p>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto pr-1 text-white/70">
                {doomed.map((t) => (
                  <li key={t.id} className="flex items-baseline gap-2">
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-white/40">
                      Wk {t.week}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-white/40">
                      {STATUS_META[t.status].label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-emerald-200/85">
              No tasks are planned in the removed weeks — nothing gets deleted.
            </p>
          )}
          {trimmed.length > 0 && (
            <p className="mt-2 text-amber-200/85">
              {trimmed.length} multi-week task{trimmed.length === 1 ? "" : "s"}{" "}
              will be cut short at week {keepWeeks}.
            </p>
          )}
        </div>

        {/* Typed confirmation */}
        <label className="mt-4 block text-[10px] uppercase tracking-[0.13em] text-white/50">
          Type {REMOVE_CONFIRM_WORD} to confirm
          <input
            type="text"
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && confirmed) onConfirm(remove);
            }}
            placeholder={REMOVE_CONFIRM_WORD}
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-white outline-none placeholder:text-white/25 focus:border-rose-400/60"
          />
        </label>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-white/80 transition hover:border-white/30 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!confirmed}
            onClick={() => onConfirm(remove)}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/50 bg-rose-500/25 px-3 py-1.5 text-[11.5px] font-semibold text-rose-50 transition hover:bg-rose-500/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove {remove} month{remove === 1 ? "" : "s"}
            {doomed.length > 0
              ? ` · delete ${doomed.length} task${doomed.length === 1 ? "" : "s"}`
              : ""}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GeneratePanel({
  startDate,
  setStartDate,
  months,
  setMonths,
  focus,
  setFocus,
  constraints,
  setConstraints,
  photos,
  onAddPhotos,
  onRemovePhoto,
  generating,
  generate,
  error,
  progressMessage,
  mode,
}: {
  startDate: string;
  setStartDate: (v: string) => void;
  months: number;
  setMonths: (v: number) => void;
  focus: string;
  setFocus: (v: string) => void;
  constraints: string;
  setConstraints: (v: string) => void;
  photos: UploadedPhoto[];
  onAddPhotos: (files: FileList | null) => void;
  onRemovePhoto: (id: string) => void;
  generating: boolean;
  generate: () => void;
  error: string | null;
  progressMessage: string;
  mode: "create" | "regenerate";
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const remainingSlots = MAX_PHOTOS - photos.length;
  const anyUploading = photos.some((p) => p.uploading);
  return (
    <div
      className={
        mode === "regenerate"
          ? "rounded-xl border border-white/10 bg-white/[0.025] p-4"
          : "mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4"
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="block text-xs">
          <span className="text-[11px] uppercase tracking-[0.13em] text-white/55">
            Start date (any day — week 1 begins here)
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
          />
        </label>
        {/* Plan length in CALENDAR months — the package the client signed.
            The week count follows from the start date (a 6-month plan is
            26 or 27 weeks), so it's shown, not chosen. */}
        <label className="block text-xs">
          <span className="text-[11px] uppercase tracking-[0.13em] text-white/55">
            Plan length
          </span>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30 [color-scheme:dark]"
          >
            {ROADMAP_GENERATE_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m} months ·{" "}
                {/^\d{4}-\d{2}-\d{2}$/.test(startDate)
                  ? roadmapWeeks({ startDate, months: m })
                  : Math.ceil((m * 30.4375) / 7)}{" "}
                weeks
              </option>
            ))}
          </select>
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

      {/* Reference photos — uploaded straight to Vercel Blob and passed
          to Claude as vision input. Optional, but the agent does sharper
          diagnosis when it can SEE the clinic / GMB / SERP screenshots. */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-[0.13em] text-white/55">
            Reference photos (optional · up to {MAX_PHOTOS})
          </span>
          <span className="text-[10px] text-white/40">
            Clinic interior · GMB screenshot · competitor SERP · GSC graph — Claude sees these natively
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-stretch gap-2">
          {photos.map((p) => (
            <div
              key={p.id}
              className="group relative h-20 w-20 overflow-hidden rounded-md border border-white/10 bg-white/[0.03]"
              title={p.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt={p.name}
                className="h-full w-full object-cover"
              />
              {p.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                </div>
              )}
              {p.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-rose-900/70 px-1 text-center text-[9px] font-medium text-rose-100">
                  {p.error.slice(0, 50)}
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemovePhoto(p.id)}
                aria-label={`Remove ${p.name}`}
                className="absolute right-1 top-1 hidden rounded-full border border-white/20 bg-black/60 p-0.5 text-white/80 transition hover:border-white/50 hover:text-white group-hover:block"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {remainingSlots > 0 && (
            <button
              type="button"
              disabled={generating}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-white/15 bg-white/[0.02] text-[10px] text-white/55 transition hover:border-white/35 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              Add photo
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              onAddPhotos(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={generating || anyUploading}
          onClick={generate}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-[#343ED7] via-[#783DF5] to-[#C535C9] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#783DF5]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {generating
            ? "Generating roadmap…"
            : anyUploading
              ? "Waiting for photo upload…"
              : mode === "create"
                ? "Generate roadmap"
                : "Generate new roadmap"}
        </button>
        {!generating && mode === "regenerate" && (
          <span className="text-[11px] text-white/45">
            Old roadmap will be archived. New one starts blank — you can keep
            editing right after.
          </span>
        )}
      </div>
      {generating && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="brand-gradient-bg absolute inset-y-0 left-0 w-1/3 animate-[indeterminate_1.6s_ease-in-out_infinite] rounded-full" />
          </div>
          {progressMessage && (
            <p className="text-[11px] text-white/65">{progressMessage}</p>
          )}
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-rose-300">{error}</p>
      )}
    </div>
  );
}

function WeekColumn({
  week,
  totalWeeks,
  weekDate,
  cells,
  isCurrent,
  editingTaskId,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onDelete,
  onAdd,
  onSlideTask,
  draggingTaskId,
  onDragStartTask,
  onDragEndTask,
  onDropTaskToWeek,
}: {
  week: number;
  totalWeeks: number;
  weekDate: string;
  cells: WeekCell[];
  isCurrent: boolean;
  editingTaskId: string | null;
  onStartEdit: (id: string) => void;
  onStopEdit: () => void;
  onUpdate: (id: string, patch: Partial<RoadmapTask>) => void;
  onDelete: (id: string) => void;
  onAdd: (week: number) => void;
  onSlideTask: (id: string, targetWeek: number) => void;
  draggingTaskId: string | null;
  onDragStartTask: (id: string) => void;
  onDragEndTask: () => void;
  onDropTaskToWeek: (id: string, targetWeek: number) => void;
}) {
  const readOnly = useSeoReadOnly();
  // True while a card is mid-drag AND hovering this column — drives the
  // "drop here" glow. Local so only the hovered column lights up strongly.
  const [dropActive, setDropActive] = useState(false);
  const isDragActive = !readOnly && draggingTaskId !== null;

  const base = isCurrent
    ? // Current-week column: brand-purple ring + soft outer glow + a top
      // brand-gradient strip (1px) so the column reads as "you are here"
      // the instant the page loads.
      "relative rounded-xl border border-[color:var(--brand-purple)]/70 bg-[color:var(--brand-purple)]/[0.10] p-3 shadow-[0_0_0_1px_rgba(120,61,245,0.45),_0_18px_48px_-18px_rgba(120,61,245,0.6)] ring-1 ring-[color:var(--brand-purple)]/35"
    : "relative rounded-xl border border-white/8 bg-white/[0.02] p-3";
  const dragCls = dropActive
    ? " outline-dashed outline-2 outline-offset-2 outline-[color:var(--brand-purple)] bg-[color:var(--brand-purple)]/[0.14]"
    : isDragActive
      ? " outline-dashed outline-1 outline-offset-2 outline-white/20"
      : "";

  // Only wire drop handlers when interactive and something is being
  // dragged — keeps read-only viewers and idle columns inert.
  const dropHandlers = readOnly
    ? {}
    : {
        onDragOver: (e: DragEvent) => {
          if (draggingTaskId) e.preventDefault();
        },
        onDragEnter: (e: DragEvent) => {
          if (draggingTaskId) {
            e.preventDefault();
            setDropActive(true);
          }
        },
        onDragLeave: (e: DragEvent) => {
          // Ignore leaves that just move into a child node — only clear
          // when the pointer genuinely exits the column.
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setDropActive(false);
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setDropActive(false);
          const id = e.dataTransfer.getData("text/plain") || draggingTaskId;
          if (id) onDropTaskToWeek(id, week);
        },
      };

  return (
    <div className={base + dragCls} {...dropHandlers}>
      {isCurrent && (
        <span
          aria-hidden
          className="brand-gradient-bg pointer-events-none absolute inset-x-3 top-0 h-[2px] rounded-full opacity-90"
        />
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-white">
            {isCurrent && (
              <span
                aria-hidden
                className="brand-gradient-text mr-1.5 inline"
              >
                ▶
              </span>
            )}
            Week {week}
          </h3>
          <span className="text-[10px] uppercase tracking-[0.13em] text-white/40">
            {formatDate(weekDate)}
          </span>
        </div>
        {isCurrent && (
          <span className="brand-gradient-bg inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_4px_14px_-4px_rgba(120,61,245,0.7)]">
            <span
              aria-hidden
              className="h-1 w-1 animate-pulse rounded-full bg-white"
            />
            This Week
          </span>
        )}
      </div>
      <ul className="mt-2 space-y-2">
        {cells.map((cell) =>
          cell.isStart ? (
            <TaskCard
              key={cell.task.id}
              task={cell.task}
              totalWeeks={totalWeeks}
              editing={editingTaskId === cell.task.id}
              dragging={draggingTaskId === cell.task.id}
              onStartEdit={() => onStartEdit(cell.task.id)}
              onStopEdit={onStopEdit}
              onUpdate={(patch) => onUpdate(cell.task.id, patch)}
              onDelete={() => onDelete(cell.task.id)}
              onSlide={(delta) =>
                onSlideTask(cell.task.id, cell.task.week + delta)
              }
              onDragStart={() => onDragStartTask(cell.task.id)}
              onDragEnd={onDragEndTask}
            />
          ) : (
            <ContinuationChip
              key={`${cell.task.id}-w${week}`}
              task={cell.task}
              week={week}
            />
          ),
        )}
        {cells.length === 0 && (
          <li
            className={
              isDragActive
                ? "rounded-lg border border-dashed border-[color:var(--brand-purple)]/50 bg-[color:var(--brand-purple)]/[0.06] px-2.5 py-2 text-center text-[10.5px] font-medium text-white/70"
                : "rounded-lg border border-dashed border-white/10 bg-white/[0.01] px-2.5 py-2 text-center text-[10.5px] text-white/35"
            }
          >
            {isDragActive ? "Drop to move here" : "No tasks"}
          </li>
        )}
      </ul>
      {!readOnly && (
        <button
          type="button"
          onClick={() => onAdd(week)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-white/15 bg-white/[0.02] px-2 py-1.5 text-[11px] text-white/55 transition hover:border-white/30 hover:bg-white/[0.05] hover:text-white"
        >
          <Plus className="h-3 w-3" />
          Add task
        </button>
      )}
    </div>
  );
}

/** Slim, read-only marker rendered in each week a multi-week task runs
 *  through AFTER its start week. Shows the task title + a status dot so the
 *  consultant can see at a glance that an effort is still ongoing this
 *  week; the editable card + slide controls live in the task's start week.
 */
function ContinuationChip({
  task,
  week,
}: {
  task: RoadmapTask;
  week: number;
}) {
  const meta = STATUS_META[task.status];
  const end = taskEndWeek(task);
  const isLast = week === end;
  return (
    <li
      className="relative flex items-center gap-1.5 overflow-hidden rounded-lg border border-dashed border-white/12 bg-white/[0.015] py-1.5 pl-2 pr-2 text-white/55"
      title={`Multi-week task — runs Week ${task.week}–${end}. Edit or move it from Week ${task.week}.`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] ${meta.dotClass} opacity-70`}
      />
      <CornerDownRight className="h-3 w-3 shrink-0 text-white/35" />
      <span className="min-w-0 flex-1 truncate text-[11px] leading-snug">
        {task.title}
      </span>
      <span className="shrink-0 text-[8.5px] font-bold uppercase tracking-[0.12em] text-white/40">
        {isLast ? "ends" : "cont."}
      </span>
    </li>
  );
}

function TaskCard({
  task,
  totalWeeks,
  editing,
  dragging,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onDelete,
  onSlide,
  onDragStart,
  onDragEnd,
}: {
  task: RoadmapTask;
  totalWeeks: number;
  editing: boolean;
  dragging: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (patch: Partial<RoadmapTask>) => void;
  onDelete: () => void;
  /** Nudge the task by ±1 week (arrows). Preserves its span. */
  onSlide: (delta: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const readOnly = useSeoReadOnly();
  const meta = STATUS_META[task.status];
  const span = taskSpanWeeks(task);
  const end = taskEndWeek(task);
  const canSlideLeft = task.week > 1;
  const canSlideRight = end < totalWeeks;

  // "Wk 2–4" pill shown on multi-week tasks so the span is legible even in
  // the task's start column (the continuation bars carry it forward).
  const spanBadge =
    span > 1 ? (
      <span className="inline-flex items-center rounded-full border border-[color:var(--brand-purple)]/45 bg-[color:var(--brand-purple)]/15 px-1.5 py-0.5 font-semibold text-white/85">
        Wk {task.week}–{end}
      </span>
    ) : null;

  if (readOnly) {
    // Read-only viewers see the task as a static card — no click-to-edit,
    // no pencil, no inline form.
    return (
      <li className={`relative rounded-lg ${meta.bgClass}`}>
        <div className="block w-full px-2.5 py-2 text-left text-[11.5px] leading-snug">
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
            {spanBadge}
          </span>
        </div>
      </li>
    );
  }
  if (!editing) {
    return (
      <li
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", task.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        className={`group relative cursor-grab rounded-lg active:cursor-grabbing ${meta.bgClass} ${dragging ? "opacity-40 ring-2 ring-[color:var(--brand-purple)]/70" : ""}`}
      >
        <button
          type="button"
          onClick={onStartEdit}
          className="block w-full px-2.5 py-2 pr-[4.75rem] text-left text-[11.5px] leading-snug"
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
            {spanBadge}
          </span>
        </button>
        {/* Hover toolbar — slide one week ◀ ▶ (span preserved) or edit.
            Drag the card body onto any column to move it further. */}
        <div className="absolute right-1 top-1 hidden items-center gap-0.5 group-hover:flex">
          <button
            type="button"
            onClick={() => onSlide(-1)}
            disabled={!canSlideLeft}
            aria-label="Move one week earlier"
            title="Move one week earlier"
            className="rounded-md border border-white/10 bg-black/40 p-1 text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onSlide(1)}
            disabled={!canSlideRight}
            aria-label="Move one week later"
            title="Move one week later"
            className="rounded-md border border-white/10 bg-black/40 p-1 text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onStartEdit}
            aria-label="Edit"
            className="rounded-md border border-white/10 bg-black/40 p-1 text-white/70 transition hover:border-white/30 hover:text-white"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
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
        <div className="grid grid-cols-2 gap-1.5">
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
        </div>
        {/* Start week + how far it runs. "Through" = the last week the task
            spans; leaving it on "Just this week" keeps it single-week. */}
        <div className="grid grid-cols-2 gap-1.5">
          <label className="block text-[9.5px] uppercase tracking-[0.1em] text-white/45">
            Week (start)
            <select
              value={task.week}
              onChange={(e) => {
                const w = Number(e.target.value);
                const patch: Partial<RoadmapTask> = { week: w };
                // Keep the span valid — if the new start is at/after the
                // old end, collapse back to a single-week task.
                if (task.endWeek != null && task.endWeek <= w) {
                  patch.endWeek = undefined;
                }
                onUpdate(patch);
              }}
              className="mt-0.5 w-full rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-1 text-[11px] text-white focus:border-white/30"
            >
              {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[9.5px] uppercase tracking-[0.1em] text-white/45">
            Through
            <select
              value={end}
              onChange={(e) => {
                const v = Number(e.target.value);
                onUpdate({ endWeek: v > task.week ? v : undefined });
              }}
              className="mt-0.5 w-full rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-1 text-[11px] text-white focus:border-white/30"
            >
              <option value={task.week}>Just this week</option>
              {Array.from(
                { length: Math.max(0, totalWeeks - task.week) },
                (_, i) => task.week + 1 + i,
              ).map((w) => (
                <option key={w} value={w}>
                  Through Week {w}
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

/** Wraps the auditSummary card behind a small "View SEO diagnosis"
 *  button. Default closed — the consultant only sees the long
 *  prose paragraph when they explicitly open it. Previously this
 *  block was always rendered on top of the board which made the
 *  page feel busy on every visit. */
function CollapsibleAuditSummary({
  auditSummary,
  sourcePhotos,
}: {
  auditSummary: string;
  sourcePhotos: { url: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const photoCount = sourcePhotos.length;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/[0.08] px-3 py-1.5 text-[11px] font-semibold text-white/75 transition hover:border-[color:var(--brand-purple)]/55 hover:bg-[color:var(--brand-purple)]/[0.14] hover:text-white"
      >
        <Sparkles className="h-3 w-3 text-[color:var(--brand-purple)]" />
        <span className="uppercase tracking-[0.16em]">
          SEO diagnosis (Claude)
        </span>
        {photoCount > 0 && (
          <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white/65">
            {photoCount} photo{photoCount === 1 ? "" : "s"}
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="animate-fade-up mt-3">
          <AuditSummaryCard
            auditSummary={auditSummary}
            sourcePhotos={sourcePhotos}
          />
        </div>
      )}
    </div>
  );
}

function AuditSummaryCard({
  auditSummary,
  sourcePhotos,
}: {
  auditSummary: string;
  sourcePhotos: { url: string; name: string }[];
}) {
  return (
    <div className="brand-gradient-border rounded-xl bg-white/[0.025] p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
          SEO diagnosis (Claude)
        </h3>
      </div>
      <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-white/80">
        {auditSummary}
      </p>
      {sourcePhotos.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-[0.13em] text-white/40">
            Grounded in {sourcePhotos.length} reference photo
            {sourcePhotos.length === 1 ? "" : "s"}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sourcePhotos.map((p) => (
              <a
                key={p.url}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                title={p.name}
                className="block h-12 w-12 overflow-hidden rounded border border-white/10 bg-white/[0.03] transition hover:border-white/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function tryParseJson<T>(raw: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}


async function persistRoadmap(
  roadmap: Roadmap,
  setSaving: (v: boolean) => void,
) {
  setSaving(true);
  try {
    const res = await fetch(`/api/roadmaps/${roadmap.clientSlug}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(roadmap),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      console.error("roadmap save failed:", data?.error ?? `HTTP ${res.status}`);
    }
  } catch (err) {
    console.error("roadmap save failed:", err);
  } finally {
    setSaving(false);
  }
}
