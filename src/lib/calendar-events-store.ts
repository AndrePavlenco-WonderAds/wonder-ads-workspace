// Custom calendar events for the Admin → Overview Calendário view.
// These are manually-added blocks the team pins to a day — fiscal
// obligations ("entregar IVA até dia 5"), reminders, deadlines — each
// with a colour, title and description. Invoices are NOT stored here;
// they're derived live from each client's invoiceDate.
//
// Stored as a single KV array under `admin-calendar-events` (low volume,
// one admin team) — a get/set pair, never a per-id key sprawl.

import { kv } from "@vercel/kv";

const KEY = "admin-calendar-events";

export const calendarStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

/** Selectable accent colours for a custom event. Mapped to concrete
 *  Tailwind classes in the calendar UI. */
export const EVENT_COLORS = [
  "red",
  "amber",
  "green",
  "blue",
  "violet",
  "cyan",
  "slate",
] as const;
export type EventColor = (typeof EVENT_COLORS)[number];

export type CalendarEvent = {
  id: string;
  /** ISO yyyy-mm-dd the event sits on. */
  date: string;
  title: string;
  description: string;
  color: EventColor;
  createdAt: number;
};

const MAX_EVENTS = 1000;

export function sanitizeEvents(arr: unknown): CalendarEvent[] {
  if (!Array.isArray(arr)) return [];
  const out: CalendarEvent[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
      continue;
    }
    const color = (EVENT_COLORS as readonly string[]).includes(
      e.color as string,
    )
      ? (e.color as EventColor)
      : "violet";
    out.push({
      id:
        typeof e.id === "string" && e.id.length > 0
          ? e.id
          : crypto.randomUUID(),
      date: e.date,
      title:
        typeof e.title === "string" && e.title.trim().length > 0
          ? e.title.trim().slice(0, 200)
          : "Sem título",
      description:
        typeof e.description === "string"
          ? e.description.slice(0, 2000)
          : "",
      color,
      createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
    });
    if (out.length >= MAX_EVENTS) break;
  }
  return out;
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  if (!calendarStorageConfigured) return [];
  try {
    const stored = await kv.get<unknown>(KEY);
    return sanitizeEvents(stored);
  } catch (err) {
    console.error("calendar-events KV read failed:", err);
    return [];
  }
}

export async function saveCalendarEvents(
  events: unknown,
): Promise<CalendarEvent[]> {
  if (!calendarStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const clean = sanitizeEvents(events);
  await kv.set(KEY, clean);
  return clean;
}
