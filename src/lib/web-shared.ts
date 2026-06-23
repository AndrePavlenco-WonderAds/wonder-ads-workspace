// Client-safe shared types + presentation constants for the Web Dept
// board. Deliberately free of any server-only imports (no node:crypto,
// no @vercel/kv) so it can be pulled into "use client" components. The
// KV store (web-projects-store.ts) re-uses these types and adds the
// server-only `secretEnc` fields + persistence on top.

export const WEB_STATUSES = [
  "negotiation",
  "in_progress",
  "client_feedback",
  "migration",
  "done",
] as const;
export type WebStatus = (typeof WEB_STATUSES)[number];

export const WEB_STATUS_LABEL: Record<WebStatus, string> = {
  negotiation: "Not Started",
  in_progress: "In Progress",
  client_feedback: "Client Feedback",
  migration: "Migration",
  done: "Done",
};

/** Tailwind class bundles per status — board column accent + card tag. */
export const WEB_STATUS_META: Record<
  WebStatus,
  { label: string; short: string; dot: string; tag: string; column: string }
> = {
  negotiation: {
    label: "Not Started",
    short: "Not Started",
    dot: "bg-white/55",
    tag: "border-white/20 bg-white/[0.06] text-white/75",
    column: "border-white/12",
  },
  in_progress: {
    label: "In Progress",
    short: "In Progress",
    dot: "bg-amber-400",
    tag: "border-amber-400/40 bg-amber-500/15 text-amber-100",
    column: "border-amber-400/35",
  },
  client_feedback: {
    label: "Client Feedback",
    short: "Client Feedback",
    dot: "bg-violet-400",
    tag: "border-violet-400/40 bg-violet-500/20 text-violet-100",
    column: "border-violet-400/35",
  },
  migration: {
    label: "Migration",
    short: "Migration",
    dot: "bg-sky-400",
    tag: "border-sky-400/40 bg-sky-500/15 text-sky-100",
    column: "border-sky-400/35",
  },
  done: {
    label: "Done",
    short: "Done",
    dot: "bg-emerald-400",
    tag: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
    column: "border-emerald-400/35",
  },
};

export const WEB_PRIORITIES = ["low", "medium", "high"] as const;
export type WebPriority = (typeof WEB_PRIORITIES)[number];

export const WEB_PRIORITY_META: Record<
  WebPriority,
  { label: string; tag: string }
> = {
  low: { label: "Low", tag: "border-white/15 bg-white/[0.05] text-white/65" },
  medium: {
    label: "Med",
    tag: "border-amber-400/35 bg-amber-500/12 text-amber-100",
  },
  high: {
    label: "High",
    tag: "border-rose-400/40 bg-rose-500/15 text-rose-100",
  },
};

export const WEB_CRED_KINDS = [
  "wordpress",
  "hosting",
  "ftp",
  "domain",
  "database",
  "other",
] as const;
export type WebCredKind = (typeof WEB_CRED_KINDS)[number];

export const WEB_CRED_KIND_LABEL: Record<WebCredKind, string> = {
  wordpress: "WordPress",
  hosting: "Hosting / cPanel",
  ftp: "FTP / SFTP",
  domain: "Domain registrar",
  database: "Database",
  other: "Other",
};

// ---- Shared (browser-safe) record shapes ----

export type WebComment = {
  id: string;
  authorUsername: string;
  authorName: string;
  body: string;
  createdAt: number;
};

export type WebAssetFile = {
  id: string;
  name: string;
  url: string;
  kind: "image" | "video" | "document" | "link";
  addedAt: number;
};

export type WebResource = {
  id: string;
  label: string;
  url: string;
};

/** Browser-facing credential — no ciphertext, just whether one is set. */
export type PublicWebCredential = {
  id: string;
  label: string;
  kind: WebCredKind;
  url?: string;
  username?: string;
  notes?: string;
  updatedAt: number;
  hasSecret: boolean;
};

export type PublicWebAssets = {
  notes: string;
  dos: string[];
  donts: string[];
  brandingKitUrl?: string;
  brandingFiles: WebAssetFile[];
  onboardingFormUrl?: string;
  onboardingFiles: WebAssetFile[];
  files: WebAssetFile[];
  credentials: PublicWebCredential[];
  resources: WebResource[];
};

export type PublicWebProject = {
  id: string;
  name: string;
  clientName: string;
  assigneeUsername: string;
  assigneeName: string;
  status: WebStatus;
  priority: WebPriority;
  startDate: string | null;
  deadline: string | null;
  order: number;
  comments: WebComment[];
  assets: PublicWebAssets;
  createdAt: number;
  updatedAt: number;
};

export type WebActivityKind =
  | "created"
  | "moved"
  | "edited"
  | "comment"
  | "asset"
  | "deleted";

export type WebActivity = {
  id: string;
  projectId: string;
  projectName: string;
  actorUsername: string;
  actorName: string;
  kind: WebActivityKind;
  message: string;
  from?: WebStatus;
  to?: WebStatus;
  at: number;
};
