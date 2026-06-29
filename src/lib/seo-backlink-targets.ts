// Pure types + constants for the per-client backlink target pipeline.
// Kept free of any server-only imports (no @vercel/kv) so client components
// can import it; the KV store (seo-backlink-targets-store.ts) builds on top.

export const TARGET_STATUSES = [
  "to-try",
  "submitted",
  "live",
  "rejected",
] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];

export const TARGET_STATUS_LABELS: Record<TargetStatus, string> = {
  "to-try": "A tentar",
  submitted: "Submetido",
  live: "Live",
  rejected: "Rejeitado",
};

export type BacklinkTarget = {
  directoryId: string;
  status: TargetStatus;
  note: string;
  updatedAt: number;
};

export type TargetsMap = Record<string, BacklinkTarget[]>;

const MAX_PER_CLIENT = 500;

export function sanitizeTargetList(arr: unknown): BacklinkTarget[] {
  if (!Array.isArray(arr)) return [];
  const out: BacklinkTarget[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Record<string, unknown>;
    const directoryId =
      typeof t.directoryId === "string"
        ? t.directoryId.trim().slice(0, 80)
        : "";
    if (!directoryId || seen.has(directoryId)) continue;
    seen.add(directoryId);
    const status = (TARGET_STATUSES as readonly string[]).includes(
      t.status as string,
    )
      ? (t.status as TargetStatus)
      : "to-try";
    out.push({
      directoryId,
      status,
      note: typeof t.note === "string" ? t.note.slice(0, 1000) : "",
      updatedAt: typeof t.updatedAt === "number" ? t.updatedAt : Date.now(),
    });
    if (out.length >= MAX_PER_CLIENT) break;
  }
  return out;
}

export function sanitizeTargetsMap(raw: unknown): TargetsMap {
  if (!raw || typeof raw !== "object") return {};
  const out: TargetsMap = {};
  for (const [slug, list] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof slug !== "string" || !slug) continue;
    const clean = sanitizeTargetList(list);
    if (clean.length) out[slug.slice(0, 120)] = clean;
  }
  return out;
}
