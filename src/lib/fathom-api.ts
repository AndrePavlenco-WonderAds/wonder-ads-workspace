// Fathom API client — Stage 1 (single team key in env).
//
// Single env var: FATHOM_API_KEY (generated from Fathom user settings
// → API Access → fathom.video/customize#api-access-header). Key holder
// is treated as "the team" — every call to the workspace's Add Call
// Notes flow runs as that Fathom user.
//
// When Stage 2 lands (per-user keys in localStorage), the callers
// pass `apiKey` directly. Stage 3 (OAuth) replaces `apiKey` with a
// per-user session token. Both upgrades are isolated to this file.

const FATHOM_BASE = "https://api.fathom.ai/external/v1";

export const fathomConfigured = Boolean(process.env.FATHOM_API_KEY);

type FathomSpeaker = {
  display_name: string;
  matched_calendar_invitee_email?: string | null;
};

type FathomTranscriptLine = {
  speaker: FathomSpeaker;
  text: string;
  timestamp: string;
};

type FathomMeeting = {
  recording_id: number;
  share_url: string;
  url?: string;
  title?: string;
  meeting_title?: string;
  created_at?: string;
  recorded_by?: { email?: string; name?: string } | string;
  calendar_invitees?: Array<{ email?: string; name?: string }>;
  transcript?: FathomTranscriptLine[];
  default_summary?: string;
  action_items?: Array<{ description?: string } | string>;
};

type FathomMeetingsResponse = {
  meetings?: FathomMeeting[];
  items?: FathomMeeting[];
  next_cursor?: string | null;
  cursor?: string | null;
};

/** Result of resolving a Fathom share URL via the API. */
export type ResolvedFathomCall = {
  recordingId: number;
  shareUrl: string;
  title: string;
  createdAt: string | null;
  recordedBy: string | null;
  /** Flattened transcript as a single string with "Speaker: text" lines. */
  transcript: string;
  /** AI-generated summary, when Fathom has one. */
  summary: string | null;
  /** Bulleted list of action items, joined with "\n". */
  actionItems: string | null;
};

/** Custom error so callers can distinguish "config missing" vs "not found" vs
 *  "Fathom errored". Carries an HTTP status so route handlers can pass
 *  through the right response code. */
export class FathomApiError extends Error {
  status: number;
  code: "no_key" | "not_found" | "upstream" | "rate_limited" | "bad_url";
  constructor(
    message: string,
    code: FathomApiError["code"],
    status: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Pull the share token out of a Fathom share URL. We don't actually
 *  use the token (the API doesn't accept tokens directly) — we just use
 *  it as a sanity check that the URL is shape-correct, and compare the
 *  full canonical URL against `meeting.share_url` from the API. */
export function isFathomShareUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      (u.hostname === "fathom.video" || u.hostname === "www.fathom.video") &&
      /^\/share\/[A-Za-z0-9_-]+/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

/** Normalise so http vs https, www vs not, and trailing slashes match. */
function normaliseShareUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.replace(/^www\./, "");
    u.protocol = "https:";
    u.search = "";
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "");
    return `https://${u.hostname}${path}`;
  } catch {
    return raw.trim().replace(/\/+$/, "");
  }
}

/** Fetch + paginate the /meetings endpoint until we find the meeting
 *  whose share_url matches the user-pasted URL. Most calls processed
 *  by the workspace will be recent, so we usually hit it on page 1.
 *  We give up after MAX_PAGES to avoid burning the 60/min rate limit
 *  on a fishing expedition. */
const MAX_PAGES = 5;
const PAGE_SIZE_HINT = 50;

export async function resolveFathomCallByShareUrl(
  shareUrlRaw: string,
): Promise<ResolvedFathomCall> {
  if (!fathomConfigured) {
    throw new FathomApiError(
      "FATHOM_API_KEY not configured.",
      "no_key",
      503,
    );
  }
  if (!isFathomShareUrl(shareUrlRaw)) {
    throw new FathomApiError(
      "That doesn't look like a Fathom share URL — expected https://fathom.video/share/...",
      "bad_url",
      400,
    );
  }
  const target = normaliseShareUrl(shareUrlRaw);
  const key = process.env.FATHOM_API_KEY!;

  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      include_transcript: "true",
      include_summary: "true",
      include_action_items: "true",
      limit: String(PAGE_SIZE_HINT),
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${FATHOM_BASE}/meetings?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      throw new FathomApiError(
        "Fathom rejected the API key. Check FATHOM_API_KEY in Vercel and that the key hasn't been revoked.",
        "upstream",
        502,
      );
    }
    if (res.status === 429) {
      throw new FathomApiError(
        "Hit Fathom's 60 calls/min rate limit. Wait a minute and try again.",
        "rate_limited",
        429,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new FathomApiError(
        `Fathom API error ${res.status}: ${body.slice(0, 200)}`,
        "upstream",
        502,
      );
    }

    const data = (await res.json()) as FathomMeetingsResponse;
    const list = data.meetings ?? data.items ?? [];
    const match = list.find(
      (m) => normaliseShareUrl(m.share_url ?? "") === target,
    );
    if (match) return shapeMatch(match);

    cursor = data.next_cursor ?? data.cursor ?? null;
    if (!cursor) break;
  }

  throw new FathomApiError(
    "Couldn't find this Fathom recording in your account. Either the URL belongs to a different Fathom workspace than the one that issued FATHOM_API_KEY, or the recording is older than the last ~250 meetings.",
    "not_found",
    404,
  );
}

function shapeMatch(m: FathomMeeting): ResolvedFathomCall {
  const transcript = (m.transcript ?? [])
    .map(
      (line) =>
        `${line.speaker?.display_name ?? "Speaker"} [${line.timestamp ?? "00:00:00"}]: ${line.text}`,
    )
    .join("\n");
  const actionItems = Array.isArray(m.action_items)
    ? m.action_items
        .map((a) => (typeof a === "string" ? a : (a.description ?? "")))
        .filter(Boolean)
        .map((a) => `- ${a}`)
        .join("\n") || null
    : null;
  const recordedBy =
    typeof m.recorded_by === "string"
      ? m.recorded_by
      : (m.recorded_by?.email ?? m.recorded_by?.name ?? null);
  return {
    recordingId: m.recording_id,
    shareUrl: m.share_url,
    title: m.meeting_title ?? m.title ?? "Untitled call",
    createdAt: m.created_at ?? null,
    recordedBy,
    transcript,
    summary: m.default_summary ?? null,
    actionItems,
  };
}

/** Compose a single text blob that the existing call-notes analyzer
 *  can ingest. AI summary first (highest signal), action items, then
 *  transcript. Keeps within the 60k char ceiling the analyzer enforces
 *  by truncating the transcript if needed. */
export function composeAnalyzerInput(call: ResolvedFathomCall): string {
  const parts: string[] = [];
  parts.push(`Meeting: ${call.title}`);
  if (call.recordedBy) parts.push(`Recorded by: ${call.recordedBy}`);
  if (call.createdAt) parts.push(`Date: ${call.createdAt}`);
  parts.push("");
  if (call.summary) {
    parts.push("## AI Summary");
    parts.push(call.summary);
    parts.push("");
  }
  if (call.actionItems) {
    parts.push("## Action Items");
    parts.push(call.actionItems);
    parts.push("");
  }
  if (call.transcript) {
    parts.push("## Transcript");
    parts.push(call.transcript);
  }
  const full = parts.join("\n");
  // Analyzer enforces 60k cap. Reserve 1k headroom for safety.
  const CAP = 59_000;
  if (full.length <= CAP) return full;
  return full.slice(0, CAP) + "\n…[truncated]";
}
