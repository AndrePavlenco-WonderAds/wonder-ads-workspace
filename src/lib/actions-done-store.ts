// Tracks which "próximas ações" (invoices to send + calendar events)
// the team has ticked off. Stored as a single KV array of stable keys
// under `admin-actions-done` so a completed action disappears from the
// 7/30-day blocks across everyone's screens.
//
// Key shape encodes the date so a NEW invoice on a later date (same
// client) doesn't inherit the old "done" — see actionDoneKey() callers
// in upcoming-actions.tsx. Entries older than RETAIN_DAYS are pruned on
// save so the list can't grow without bound.

import { kv } from "@vercel/kv";

const KEY = "admin-actions-done";
const RETAIN_DAYS = 120;
const RETAIN_MS = RETAIN_DAYS * 86_400_000;
const MAX_ENTRIES = 2000;

export const actionsDoneStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type DoneAction = {
  /** Stable key identifying the action+date (see actionDoneKey). */
  key: string;
  doneAt: number;
};

export function sanitizeDone(arr: unknown, now: number = Date.now()): DoneAction[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: DoneAction[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const d = raw as Record<string, unknown>;
    if (typeof d.key !== "string" || d.key.length === 0) continue;
    if (seen.has(d.key)) continue;
    const doneAt = typeof d.doneAt === "number" ? d.doneAt : now;
    // Prune stale entries — the underlying action is long gone.
    if (now - doneAt > RETAIN_MS) continue;
    seen.add(d.key);
    out.push({ key: d.key.slice(0, 200), doneAt });
    if (out.length >= MAX_ENTRIES) break;
  }
  return out;
}

export async function getDoneActions(): Promise<DoneAction[]> {
  if (!actionsDoneStorageConfigured) return [];
  try {
    const stored = await kv.get<unknown>(KEY);
    return sanitizeDone(stored);
  } catch (err) {
    console.error("actions-done KV read failed:", err);
    return [];
  }
}

export async function saveDoneActions(list: unknown): Promise<DoneAction[]> {
  if (!actionsDoneStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const clean = sanitizeDone(list);
  await kv.set(KEY, clean);
  return clean;
}
