// Roadmap changelog — compact activity log of meaningful roadmap changes,
// shown on each client's /seo/[slug]/roadmap page.
//
// Storage is deliberately tiny: entries are stored with 1-char keys, the
// timestamp in epoch SECONDS, status as a 0–3 index, titles snipped to 60
// chars, and the whole log capped per client (see roadmap-changelog-store).
// Only signal-heavy changes are recorded (add / remove / status / move /
// rename / generate) — pure drag-reordering writes nothing.
//
// This module is PURE (no @vercel/kv) so client components can import the
// types + labels; the KV read/write lives in roadmap-changelog-store.ts.

import type { Roadmap, RoadmapStatus, RoadmapTask } from "./roadmap-store";

// Local copy of the status order so this module stays free of the kv-backed
// roadmap-store at runtime (type-only import above is erased at build).
const STATUS_ORDER: RoadmapStatus[] = [
  "not_started",
  "in_progress",
  "pending_review",
  "implemented",
];

export const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  pending_review: "Pending review",
  implemented: "Implemented",
};

function sIdx(s: RoadmapStatus): number {
  const i = STATUS_ORDER.indexOf(s);
  return i < 0 ? 0 : i;
}
function sFromIdx(i: number | undefined): RoadmapStatus | undefined {
  return i == null ? undefined : (STATUS_ORDER[i] ?? undefined);
}

export type LogKindCode = "+" | "x" | "s" | "m" | "e" | "g" | "w" | "r" | "X";

/** Compact on-disk entry — short keys keep the KV blob small. */
export type RoadmapLogCompact = {
  t: number; // epoch SECONDS
  k: LogKindCode;
  a?: string; // actor username
  w?: number; // week
  ti?: string; // title snippet
  f?: number; // from-status index
  o?: number; // to-status index
  fw?: number; // from-week (move)
  c?: number; // count (generate)
};

export type RoadmapLogKind =
  | "add"
  | "remove"
  | "status"
  | "move"
  | "edit"
  | "generated"
  | "weekly"
  | "reset"
  | "extend";

/** Decoded, UI-friendly entry. */
export type RoadmapLogEntry = {
  at: number; // epoch ms
  actor?: string;
  kind: RoadmapLogKind;
  week?: number;
  title?: string;
  fromStatus?: RoadmapStatus;
  toStatus?: RoadmapStatus;
  fromWeek?: number;
  count?: number;
};

const KIND_DECODE: Record<LogKindCode, RoadmapLogKind> = {
  "+": "add",
  x: "remove",
  s: "status",
  m: "move",
  e: "edit",
  g: "generated",
  w: "weekly",
  r: "reset",
  X: "extend",
};

export function decodeLog(list: RoadmapLogCompact[]): RoadmapLogEntry[] {
  return list.map((e) => ({
    at: e.t * 1000,
    actor: e.a,
    kind: KIND_DECODE[e.k] ?? "edit",
    week: e.w,
    title: e.ti,
    fromStatus: sFromIdx(e.f),
    toStatus: sFromIdx(e.o),
    fromWeek: e.fw,
    count: e.c,
  }));
}

const TITLE_MAX = 60;
function snip(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t;
}

/** Event core — timestamp + actor are stamped at append time. */
export type RoadmapLogEvent = Omit<RoadmapLogCompact, "t" | "a">;

/** Diff two roadmap states into compact, meaningful events. Pure ordering,
 *  description-only, and statusChangedAt-only churn is ignored to keep the
 *  log small and signal-heavy. */
export function diffRoadmaps(
  prev: Roadmap | null,
  next: Roadmap,
): RoadmapLogEvent[] {
  const events: RoadmapLogEvent[] = [];
  const prevTasks = new Map<string, RoadmapTask>(
    (prev?.tasks ?? []).map((t) => [t.id, t]),
  );
  const nextIds = new Set(next.tasks.map((t) => t.id));

  for (const t of next.tasks) {
    const p = prevTasks.get(t.id);
    if (!p) {
      events.push({ k: "+", w: t.week, ti: snip(t.title) });
      continue;
    }
    if (p.status !== t.status) {
      events.push({
        k: "s",
        w: t.week,
        ti: snip(t.title),
        f: sIdx(p.status),
        o: sIdx(t.status),
      });
    }
    if (p.week !== t.week) {
      events.push({ k: "m", w: t.week, fw: p.week, ti: snip(t.title) });
    }
    if (p.title !== t.title) {
      events.push({ k: "e", w: t.week, ti: snip(t.title) });
    }
  }

  for (const p of prevTasks.values()) {
    if (!nextIds.has(p.id)) {
      events.push({ k: "x", w: p.week, ti: snip(p.title) });
    }
  }

  // Roadmap horizon grown ("Extend +3 months"). `c` carries the NEW total
  // week count so the log reads "Extended to 24 weeks". Default 12 keeps
  // pre-v74.65 roadmaps (no `weeks` field) from spuriously logging.
  const prevWeeks = prev?.weeks ?? 12;
  const nextWeeks = next.weeks ?? 12;
  if (nextWeeks > prevWeeks) {
    events.push({ k: "X", c: nextWeeks });
  }

  return events;
}
