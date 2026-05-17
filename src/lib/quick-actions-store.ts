"use client";

import { useEffect, useState } from "react";
import { ALL_ACTIONS } from "./seo-pillars";

// Backing store moved from localStorage to Vercel KV (v68.3). Reason:
// Vercel preview deployments each have a unique URL/origin, so localStorage
// was getting orphaned on every push and the user kept seeing the default
// order. KV makes the selection persistent across deployments, devices, and
// team members. localStorage stays as an optimistic cache so the panel
// renders instantly on first paint instead of flashing through the default
// while the API call settles.

const LOCAL_CACHE_KEY = "wa:quick-actions:v3";
const API_PATH = "/api/quick-actions";

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

// ---- Optimistic localStorage cache ----

function cacheRead(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

function cacheWrite(slugs: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(slugs));
  } catch {
    /* private mode etc. — not fatal, KV is the real source of truth */
  }
}

// ---- In-memory mirror + listener pool ----

let memoryCache: string[] | null = null;
const listeners = new Set<(value: string[]) => void>();

function notify(slugs: string[]): void {
  memoryCache = slugs;
  for (const cb of listeners) cb(slugs);
}

async function apiSave(slugs: string[]): Promise<void> {
  try {
    const res = await fetch(API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slugs }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ""}`);
    }
  } catch (err) {
    console.error("[quick-actions] save failed:", err);
  }
}

async function apiLoad(): Promise<string[]> {
  try {
    const res = await fetch(API_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { slugs?: unknown };
    return sanitize(data.slugs);
  } catch (err) {
    console.error("[quick-actions] load failed:", err);
    return [...DEFAULT_SLUGS];
  }
}

// ---- Public mutators ----

export function setQuickActions(slugs: string[]): void {
  const next = sanitize(slugs);
  cacheWrite(next);
  notify(next);
  // Fire-and-forget POST to KV
  void apiSave(next);
}

export function toggleQuickAction(slug: string): void {
  const current = memoryCache ?? cacheRead() ?? [...DEFAULT_SLUGS];
  if (current.includes(slug)) {
    setQuickActions(current.filter((s) => s !== slug));
  } else {
    setQuickActions([...current, slug]);
  }
}

export function moveQuickAction(slug: string, direction: -1 | 1): void {
  const current = memoryCache ?? cacheRead() ?? [...DEFAULT_SLUGS];
  const idx = current.indexOf(slug);
  if (idx === -1) return;
  const target = idx + direction;
  if (target < 0 || target >= current.length) return;
  const next = current.slice();
  [next[idx], next[target]] = [next[target], next[idx]];
  setQuickActions(next);
}

// ---- Hook ----

export function useQuickActions(): string[] {
  // First paint: read from localStorage cache (instant) so the panel doesn't
  // flash through DEFAULT_SLUGS while the API call resolves.
  const [value, setValue] = useState<string[]>(() => {
    if (memoryCache) return memoryCache;
    return cacheRead() ?? [...DEFAULT_SLUGS];
  });

  useEffect(() => {
    let cancelled = false;
    // After mount, fetch the authoritative version from KV.
    apiLoad().then((slugs) => {
      if (cancelled) return;
      memoryCache = slugs;
      cacheWrite(slugs);
      setValue(slugs);
    });

    const cb = (next: string[]) => setValue(next);
    listeners.add(cb);
    return () => {
      cancelled = true;
      listeners.delete(cb);
    };
  }, []);

  return value;
}
