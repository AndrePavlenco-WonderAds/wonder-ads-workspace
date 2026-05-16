"use client";

import { useSyncExternalStore } from "react";
import { ALL_ACTIONS } from "./seo-pillars";

const KEY = "wa:quick-actions:v2";

const DEFAULT_SLUGS: string[] = [
  "write-blog-article",
  "meta-title-description",
  "keyword-research",
  "seo-audit",
  "backlink-directories",
  "schema-markup",
];

const VALID_SLUGS = new Set(ALL_ACTIONS.map((a) => a.action.slug));

function sanitize(slugs: unknown): string[] {
  if (!Array.isArray(slugs)) return DEFAULT_SLUGS;
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

let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = DEFAULT_SLUGS;
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? sanitize(JSON.parse(raw)) : DEFAULT_SLUGS;
  } catch {
    cache = DEFAULT_SLUGS;
  }
  return cache;
}

const listeners = new Set<() => void>();

function emit() {
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function setQuickActions(slugs: string[]) {
  const next = sanitize(slugs);
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage might be unavailable */
    }
  }
  emit();
}

export function toggleQuickAction(slug: string) {
  const current = read();
  if (current.includes(slug)) {
    setQuickActions(current.filter((s) => s !== slug));
  } else {
    setQuickActions([...current, slug]);
  }
}

export function moveQuickAction(slug: string, direction: -1 | 1) {
  const current = read();
  const idx = current.indexOf(slug);
  if (idx === -1) return;
  const target = idx + direction;
  if (target < 0 || target >= current.length) return;
  const next = current.slice();
  [next[idx], next[target]] = [next[target], next[idx]];
  setQuickActions(next);
}

export function useQuickActions(): string[] {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_SLUGS);
}
