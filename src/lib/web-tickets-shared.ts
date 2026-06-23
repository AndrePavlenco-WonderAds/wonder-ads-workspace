// Client-safe shared types + presentation constants for the global Web
// Ticketing system. No server-only imports (no @vercel/kv, no crypto) so
// this can be pulled into "use client" components. The KV store
// (web-tickets-store.ts) re-uses these and adds persistence + Slack.
//
// Anyone in the workspace — regardless of department — can file a Web
// ticket from the home page. The Web team triages, assigns, and works
// them inside /web/tickets.

// ---- Status ----
export const TICKET_STATUSES = [
  "new",
  "triage",
  "in_dev",
  "waiting",
  "done",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_META: Record<
  TicketStatus,
  { label: string; dot: string; tag: string }
> = {
  new: {
    label: "Novo",
    dot: "bg-sky-400",
    tag: "border-sky-400/40 bg-sky-500/15 text-sky-100",
  },
  triage: {
    label: "Em análise",
    dot: "bg-violet-400",
    tag: "border-violet-400/40 bg-violet-500/20 text-violet-100",
  },
  in_dev: {
    label: "Em desenvolvimento",
    dot: "bg-amber-400",
    tag: "border-amber-400/40 bg-amber-500/15 text-amber-100",
  },
  waiting: {
    label: "A aguardar informação",
    dot: "bg-orange-400",
    tag: "border-orange-400/40 bg-orange-500/15 text-orange-100",
  },
  done: {
    label: "Concluído",
    dot: "bg-emerald-400",
    tag: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  },
  closed: {
    label: "Fechado",
    dot: "bg-white/45",
    tag: "border-white/20 bg-white/[0.06] text-white/65",
  },
};

/** Statuses that count as "open" (still need work). */
export const OPEN_STATUSES: TicketStatus[] = [
  "new",
  "triage",
  "in_dev",
  "waiting",
];
/** Statuses that count as "resolved" for the avg-resolution metric. */
export const RESOLVED_STATUSES: TicketStatus[] = ["done", "closed"];

// ---- Category ----
export const TICKET_CATEGORIES = [
  "bug",
  "feature",
  "change",
  "improvement",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  bug: "Bug",
  feature: "Nova funcionalidade",
  change: "Alteração",
  improvement: "Melhoria",
  other: "Outro",
};

// ---- Priority ----
export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_PRIORITY_META: Record<
  TicketPriority,
  { label: string; rank: number; tag: string; emoji: string }
> = {
  low: {
    label: "Baixa",
    rank: 0,
    tag: "border-white/15 bg-white/[0.05] text-white/65",
    emoji: "⚪",
  },
  medium: {
    label: "Média",
    rank: 1,
    tag: "border-amber-400/35 bg-amber-500/12 text-amber-100",
    emoji: "🟡",
  },
  high: {
    label: "Alta",
    rank: 2,
    tag: "border-orange-400/45 bg-orange-500/15 text-orange-100",
    emoji: "🟠",
  },
  urgent: {
    label: "Urgente",
    rank: 3,
    tag: "border-rose-400/50 bg-rose-500/20 text-rose-100",
    emoji: "🔴",
  },
};

// ---- Requesting department ("DPT Pedinte") ----
export const REQUESTING_DEPTS = [
  "seo",
  "ads",
  "commercial",
  "administracao",
] as const;
export type RequestingDept = (typeof REQUESTING_DEPTS)[number];

/** String-keyed so legacy tickets saved with the old "web" / "other"
 *  values still render a sensible label. */
export const REQUESTING_DEPT_LABEL: Record<string, string> = {
  seo: "SEO",
  ads: "ADS",
  commercial: "Comercial",
  administracao: "Administração",
  // legacy values (pre-v74.40)
  web: "Web",
  other: "Outro",
};

// ---- Record shapes ----
export type TicketAttachment = {
  id: string;
  name: string;
  url: string;
  kind: "image" | "video" | "document" | "link";
  addedAt: number;
};

export type TicketComment = {
  id: string;
  authorUsername: string;
  authorName: string;
  body: string;
  createdAt: number;
};

export type TicketEventKind =
  | "created"
  | "status"
  | "assigned"
  | "priority"
  | "comment"
  | "edited";

export type TicketEvent = {
  id: string;
  kind: TicketEventKind;
  actorUsername: string;
  actorName: string;
  message: string;
  at: number;
};

export type WebTicket = {
  id: string;
  /** Human-friendly sequential number (#1, #2 …). */
  seq: number;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  requestingDept: RequestingDept;
  /** Project / client this request relates to (free text, e.g. "WonderAds"). */
  project: string;
  /** Access credentials / links the requester pasted in (free text). */
  accesses: string;
  authorUsername: string;
  authorName: string;
  status: TicketStatus;
  assigneeUsername: string | null;
  assigneeName: string | null;
  attachments: TicketAttachment[];
  comments: TicketComment[];
  history: TicketEvent[];
  createdAt: number;
  updatedAt: number;
  /** First time the ticket reached a resolved status — drives the
   *  average-resolution-time metric. */
  resolvedAt: number | null;
};

export function ticketRef(t: Pick<WebTicket, "seq">): string {
  return `#${t.seq}`;
}
