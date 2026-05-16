import { kv } from "@vercel/kv";

const KEY_PREFIX = "action-history:";
const MAX_ENTRIES = 30;

export const historyConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type HistoryEntry = {
  id: string;
  createdAt: number;
  clientSlug: string;
  actionSlug: string;
  inputs: Record<string, string>;
  output: string;
  model: string;
};

function key(clientSlug: string, actionSlug: string): string {
  return `${KEY_PREFIX}${clientSlug}:${actionSlug}`;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listHistory(
  clientSlug: string,
  actionSlug: string,
): Promise<HistoryEntry[]> {
  if (!historyConfigured) return [];
  try {
    const stored = await kv.get<HistoryEntry[]>(key(clientSlug, actionSlug));
    if (!Array.isArray(stored)) return [];
    return stored;
  } catch (err) {
    console.error("history list failed:", err);
    return [];
  }
}

export async function appendHistory(
  entry: Omit<HistoryEntry, "id" | "createdAt">,
): Promise<HistoryEntry> {
  const full: HistoryEntry = {
    ...entry,
    id: newId(),
    createdAt: Date.now(),
  };
  if (!historyConfigured) return full;
  try {
    const current = await listHistory(entry.clientSlug, entry.actionSlug);
    const next = [full, ...current].slice(0, MAX_ENTRIES);
    await kv.set(key(entry.clientSlug, entry.actionSlug), next);
  } catch (err) {
    console.error("history append failed:", err);
  }
  return full;
}

export async function deleteHistoryEntry(
  clientSlug: string,
  actionSlug: string,
  id: string,
): Promise<void> {
  if (!historyConfigured) return;
  try {
    const current = await listHistory(clientSlug, actionSlug);
    const next = current.filter((e) => e.id !== id);
    await kv.set(key(clientSlug, actionSlug), next);
  } catch (err) {
    console.error("history delete failed:", err);
  }
}
