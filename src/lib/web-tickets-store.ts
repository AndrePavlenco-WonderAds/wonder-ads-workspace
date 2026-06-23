// Global Web Ticketing system — KV-backed store.
//
// Storage layout (all under the `web:ticket` / `web:tickets` namespace):
//   web:ticket:<id>        → WebTicket JSON
//   web:tickets:index      → Redis SET of ticket ids
//   web:tickets:seq        → Redis counter for the human #number
//
// Mirrors the get/set + normalise discipline of web-projects-store: every
// write runs through `normaliseTicket` so a bad client payload can't
// corrupt the blob.

import { kv } from "@vercel/kv";
import {
  OPEN_STATUSES,
  RESOLVED_STATUSES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  REQUESTING_DEPTS,
  type TicketAttachment,
  type TicketComment,
  type TicketEvent,
  type TicketStatus,
  type WebTicket,
} from "./web-tickets-shared";

const TICKET_PREFIX = "web:ticket:";
const INDEX_KEY = "web:tickets:index";
const SEQ_KEY = "web:tickets:seq";

export const ticketsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// ---- small coercion helpers (same discipline as web-projects-store) ----
function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}
function num(v: unknown, fb = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fb;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function newTicketId(): string {
  return `tk_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normaliseAttachment(v: unknown): TicketAttachment | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const url = str(o.url).trim();
  if (!url) return null;
  return {
    id: str(o.id) || `att_${Math.random().toString(36).slice(2, 8)}`,
    name: str(o.name) || url,
    url,
    kind: oneOf(
      o.kind,
      ["image", "video", "document", "link"] as const,
      "document",
    ),
    addedAt: num(o.addedAt, Date.now()),
  };
}

function normaliseComment(v: unknown): TicketComment | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const body = str(o.body).trim();
  if (!body) return null;
  return {
    id: str(o.id) || `cm_${Math.random().toString(36).slice(2, 8)}`,
    authorUsername: str(o.authorUsername),
    authorName: str(o.authorName) || "Alguém",
    body,
    createdAt: num(o.createdAt, Date.now()),
  };
}

function normaliseEvent(v: unknown): TicketEvent | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const message = str(o.message).trim();
  if (!message) return null;
  return {
    id: str(o.id) || `ev_${Math.random().toString(36).slice(2, 8)}`,
    kind: oneOf(
      o.kind,
      ["created", "status", "assigned", "priority", "comment", "edited"] as const,
      "edited",
    ),
    actorUsername: str(o.actorUsername),
    actorName: str(o.actorName) || "Alguém",
    message,
    at: num(o.at, Date.now()),
  };
}

/** Sanitise a full ticket payload. `prev` preserves immutable fields
 *  (seq, author, createdAt) + the resolvedAt stamp across edits. */
export function normaliseTicket(
  v: unknown,
  id: string,
  seq: number,
  prev?: WebTicket | null,
): WebTicket {
  const o = (v ?? {}) as Record<string, unknown>;
  const now = Date.now();
  const status = oneOf(o.status, TICKET_STATUSES, "new");
  const assigneeUsername = str(o.assigneeUsername).trim() || null;

  // resolvedAt: stamp the first time the ticket enters a resolved status;
  // clear it if it's reopened to an open status.
  let resolvedAt: number | null = prev?.resolvedAt ?? null;
  const isResolved = (RESOLVED_STATUSES as TicketStatus[]).includes(status);
  if (isResolved && resolvedAt === null) resolvedAt = now;
  if (!isResolved && (OPEN_STATUSES as TicketStatus[]).includes(status)) {
    resolvedAt = null;
  }

  return {
    id,
    seq,
    title: str(o.title).trim() || "Sem título",
    description: str(o.description).trim(),
    category: oneOf(o.category, TICKET_CATEGORIES, "other"),
    priority: oneOf(o.priority, TICKET_PRIORITIES, "medium"),
    requestingDept: oneOf(o.requestingDept, REQUESTING_DEPTS, "other"),
    authorUsername: prev?.authorUsername ?? str(o.authorUsername),
    authorName: prev?.authorName ?? (str(o.authorName) || "Alguém"),
    status,
    assigneeUsername,
    assigneeName: assigneeUsername ? str(o.assigneeName).trim() || null : null,
    attachments: arr(o.attachments)
      .map(normaliseAttachment)
      .filter((a): a is TicketAttachment => a !== null),
    comments: arr(o.comments)
      .map(normaliseComment)
      .filter((c): c is TicketComment => c !== null),
    history: arr(o.history)
      .map(normaliseEvent)
      .filter((e): e is TicketEvent => e !== null),
    createdAt: prev?.createdAt ?? num(o.createdAt, now),
    updatedAt: now,
    resolvedAt,
  };
}

// ---- CRUD ----
export async function nextTicketSeq(): Promise<number> {
  if (!ticketsStorageConfigured) return 0;
  return await kv.incr(SEQ_KEY);
}

export async function getTicket(id: string): Promise<WebTicket | null> {
  if (!ticketsStorageConfigured) return null;
  return (await kv.get<WebTicket>(TICKET_PREFIX + id)) ?? null;
}

export async function getAllTickets(): Promise<WebTicket[]> {
  if (!ticketsStorageConfigured) return [];
  const ids = await kv.smembers(INDEX_KEY);
  if (!ids || ids.length === 0) return [];
  const keys = ids.map((id) => TICKET_PREFIX + id);
  const rows = await kv.mget<WebTicket[]>(...keys);
  return rows
    .filter((r): r is WebTicket => Boolean(r))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveTicket(t: WebTicket): Promise<void> {
  if (!ticketsStorageConfigured) return;
  await kv.set(TICKET_PREFIX + t.id, t);
  await kv.sadd(INDEX_KEY, t.id);
}

export async function deleteTicket(id: string): Promise<void> {
  if (!ticketsStorageConfigured) return;
  await kv.del(TICKET_PREFIX + id);
  await kv.srem(INDEX_KEY, id);
}

// ---- Dashboard stats ----
export type TicketStats = {
  total: number;
  open: number;
  byStatus: Record<TicketStatus, number>;
  newCount: number;
  pending: number;
  urgent: number;
  done: number;
  byPriority: Record<string, number>;
  byDept: Record<string, number>;
  byAssignee: { username: string; name: string; open: number }[];
  avgResolutionMs: number | null;
};

export function computeStats(tickets: WebTicket[]): TicketStats {
  const byStatus = Object.fromEntries(
    TICKET_STATUSES.map((s) => [s, 0]),
  ) as Record<TicketStatus, number>;
  const byPriority: Record<string, number> = {};
  const byDept: Record<string, number> = {};
  const assigneeMap = new Map<string, { name: string; open: number }>();

  let urgent = 0;
  let resolutionSum = 0;
  let resolutionCount = 0;

  for (const t of tickets) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    byDept[t.requestingDept] = (byDept[t.requestingDept] ?? 0) + 1;

    const isOpen = (OPEN_STATUSES as TicketStatus[]).includes(t.status);
    if (t.priority === "urgent" && isOpen) urgent++;

    if (isOpen && t.assigneeUsername) {
      const cur = assigneeMap.get(t.assigneeUsername) ?? {
        name: t.assigneeName ?? t.assigneeUsername,
        open: 0,
      };
      cur.open++;
      assigneeMap.set(t.assigneeUsername, cur);
    }

    if (t.resolvedAt) {
      resolutionSum += t.resolvedAt - t.createdAt;
      resolutionCount++;
    }
  }

  const open = OPEN_STATUSES.reduce((n, s) => n + byStatus[s], 0);

  return {
    total: tickets.length,
    open,
    byStatus,
    newCount: byStatus.new,
    pending: byStatus.triage + byStatus.in_dev + byStatus.waiting,
    urgent,
    done: byStatus.done + byStatus.closed,
    byPriority,
    byDept,
    byAssignee: [...assigneeMap.entries()]
      .map(([username, v]) => ({ username, name: v.name, open: v.open }))
      .sort((a, b) => b.open - a.open),
    avgResolutionMs: resolutionCount > 0 ? resolutionSum / resolutionCount : null,
  };
}
