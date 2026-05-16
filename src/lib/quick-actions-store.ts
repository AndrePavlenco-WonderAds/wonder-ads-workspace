"use client";

import { useSyncExternalStore } from "react";
import { ALL_ACTIONS } from "./seo-pillars";

const KEY = "wa:quick-actions:v1";

const DEFAULT_LABELS: string[] = [
  "Write Blog Article",
  "Meta Title & Description",
  "Keyword Research",
  "SEO Audit",
  "Find Backlink Directories",
  "Schema Markup (JSON-LD)",
];

const VALID_LABELS = new Set(ALL_ACTIONS.map((a) => a.label));

function sanitize(labels: unknown): string[] {
  if (!Array.isArray(labels)) return DEFAULT_LABELS;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of labels) {
    if (typeof item !== "string") continue;
    if (!VALID_LABELS.has(item)) continue;
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
    cache = DEFAULT_LABELS;
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? sanitize(JSON.parse(raw)) : DEFAULT_LABELS;
  } catch {
    cache = DEFAULT_LABELS;
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

export function setQuickActions(labels: string[]) {
  const next = sanitize(labels);
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage might be unavailable; ignore */
    }
  }
  emit();
}

export function toggleQuickAction(label: string) {
  const current = read();
  if (current.includes(label)) {
    setQuickActions(current.filter((l) => l !== label));
  } else {
    setQuickActions([...current, label]);
  }
}

export function moveQuickAction(label: string, direction: -1 | 1) {
  const current = read();
  const idx = current.indexOf(label);
  if (idx === -1) return;
  const target = idx + direction;
  if (target < 0 || target >= current.length) return;
  const next = current.slice();
  [next[idx], next[target]] = [next[target], next[idx]];
  setQuickActions(next);
}

export function useQuickActions(): string[] {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_LABELS);
}

export function isQuickAction(label: string, list: string[]): boolean {
  return list.includes(label);
}
