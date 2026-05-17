"use client";

import { useEffect, useState } from "react";
import { ALL_ACTIONS } from "./seo-pillars";

const KEY = "wa:quick-actions:v2";

const DEFAULT_SLUGS: readonly string[] = [
  "write-blog-article",
  "meta-title-description",
  "keyword-research",
  "seo-audit",
  "backlink-directories",
  "schema-markup",
];

const VALID_SLUGS = new Set(ALL_ACTIONS.map((a) => a.action.slug));

function sanitize(slugs: unknown): string[] {
  if (!Array.isArray(slugs)) return [...DEFAULT_SLUGS];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of slugs) {
    if (typeof item !== "string") continue;
    if (!VALID_SLUGS.has(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/** Read straight from localStorage. Returns DEFAULT_SLUGS when no record
 *  exists, an empty array when the saved record is intentionally empty. */
function readFromStorage(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_SLUGS];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return [...DEFAULT_SLUGS];
    return sanitize(JSON.parse(raw));
  } catch (err) {
    console.error("[quick-actions] read failed:", err);
    return [...DEFAULT_SLUGS];
  }
}

const listeners = new Set<(value: string[]) => void>();

export function setQuickActions(slugs: string[]) {
  const next = sanitize(slugs);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch (err) {
      // Surface storage failures (private mode / quota / disabled) so the
      // user sees a console hint instead of silent reverts.
      console.error("[quick-actions] localStorage save failed:", err);
    }
  }
  for (const cb of listeners) cb(next);
}

export function toggleQuickAction(slug: string) {
  const current = readFromStorage();
  if (current.includes(slug)) {
    setQuickActions(current.filter((s) => s !== slug));
  } else {
    setQuickActions([...current, slug]);
  }
}

export function moveQuickAction(slug: string, direction: -1 | 1) {
  const current = readFromStorage();
  const idx = current.indexOf(slug);
  if (idx === -1) return;
  const target = idx + direction;
  if (target < 0 || target >= current.length) return;
  const next = current.slice();
  [next[idx], next[target]] = [next[target], next[idx]];
  setQuickActions(next);
}

export function useQuickActions(): string[] {
  // useState initializer reads on mount. SSR returns DEFAULTs, client first
  // render re-reads from localStorage via the useEffect below to pick up the
  // saved order even if hydration started with DEFAULTs.
  const [value, setValue] = useState<string[]>(() => readFromStorage());

  useEffect(() => {
    // After hydration, force-sync from storage. Handles the case where SSR
    // rendered DEFAULTs but the client has a different saved order.
    const fresh = readFromStorage();
    setValue(fresh);

    const cb = (next: string[]) => setValue(next);
    listeners.add(cb);

    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setValue(readFromStorage());
    };
    window.addEventListener("storage", onStorage);

    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return value;
}
