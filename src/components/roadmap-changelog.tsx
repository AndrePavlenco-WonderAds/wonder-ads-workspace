"use client";

// Activity log for a client's SEO roadmap. Renders the compact entries the
// API records on every meaningful change (add / remove / status / move /
// rename / generate). Collapsible; refreshes from /api/roadmaps/[slug]/log
// so it stays current after the board's debounced auto-save without a full
// page reload.

import { useState } from "react";
import {
  History,
  ChevronDown,
  RefreshCw,
  Plus,
  Trash2,
  ArrowRightLeft,
  MoveRight,
  Pencil,
  Sparkles,
  CircleDot,
  CalendarPlus,
} from "lucide-react";
import {
  ROADMAP_STATUS_LABELS,
  type RoadmapLogEntry,
  type RoadmapLogKind,
} from "@/lib/roadmap-changelog";
import { formatDateTime } from "@/lib/dates";

const KIND_META: Record<
  RoadmapLogKind,
  { Icon: typeof Plus; tint: string }
> = {
  add: { Icon: Plus, tint: "text-emerald-300" },
  remove: { Icon: Trash2, tint: "text-rose-300" },
  status: { Icon: ArrowRightLeft, tint: "text-sky-300" },
  move: { Icon: MoveRight, tint: "text-amber-300" },
  edit: { Icon: Pencil, tint: "text-white/60" },
  generated: { Icon: Sparkles, tint: "text-[#c08bff]" },
  weekly: { Icon: CircleDot, tint: "text-white/60" },
  reset: { Icon: RefreshCw, tint: "text-amber-300" },
  extend: { Icon: CalendarPlus, tint: "text-[#c08bff]" },
};

function describe(e: RoadmapLogEntry): string {
  switch (e.kind) {
    case "add":
      return `Added “${e.title ?? "task"}” to week ${e.week ?? "?"}`;
    case "remove":
      return `Removed “${e.title ?? "task"}”`;
    case "status":
      return `“${e.title ?? "task"}” · ${
        e.fromStatus ? ROADMAP_STATUS_LABELS[e.fromStatus] : "?"
      } → ${e.toStatus ? ROADMAP_STATUS_LABELS[e.toStatus] : "?"}`;
    case "move":
      return `Moved “${e.title ?? "task"}” to week ${e.week ?? "?"}${
        e.fromWeek ? ` (from week ${e.fromWeek})` : ""
      }`;
    case "edit":
      return `Renamed a task to “${e.title ?? "task"}”`;
    case "generated":
      return `Generated roadmap${e.count != null ? ` · ${e.count} tasks` : ""}`;
    case "reset":
      return "Reset roadmap";
    case "extend":
      return `Extended roadmap${
        e.count != null ? ` to ${e.count} weeks (${e.count / 4} months)` : " by 3 months"
      }`;
    case "weekly":
      return "Weekly update sent";
    default:
      return "Updated roadmap";
  }
}

export function RoadmapChangelog({
  clientSlug,
  initialEntries,
}: {
  clientSlug: string;
  initialEntries: RoadmapLogEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<RoadmapLogEntry[]>(initialEntries);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/roadmaps/${clientSlug}/log`, {
        cache: "no-store",
      });
      if (res.ok) {
        const j = (await res.json()) as { entries: RoadmapLogEntry[] };
        setEntries(j.entries ?? []);
      }
    } catch {
      /* keep current entries on failure */
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.02]">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-white/55 transition hover:text-white"
        >
          <History className="h-4 w-4" />
          Changelog
          <span className="rounded-full border border-white/12 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white/60">
            {entries.length}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/55 transition hover:border-white/30 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-white/8 px-4 py-3">
          {entries.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-white/40">
              No changes recorded yet. Edits to tasks (status, week, add/remove)
              and roadmap generations will show up here.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {entries.map((e, i) => {
                const { Icon, tint } = KIND_META[e.kind] ?? KIND_META.edit;
                return (
                  <li
                    key={`${e.at}-${i}`}
                    className="flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-white/[0.025]"
                  >
                    <Icon
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tint}`}
                      strokeWidth={2.25}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] leading-snug text-white/85">
                        {describe(e)}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-white/35">
                        {formatDateTime(e.at)}
                        {e.actor ? ` · ${e.actor}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
