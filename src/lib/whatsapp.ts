// Minimal WhatsApp poster via Whapi.cloud (https://whapi.cloud) — a gateway
// that links a real WhatsApp number as a "linked device" (QR code, like
// WhatsApp Web) and exposes a REST API. We use it because the official Meta
// Cloud API only reaches groups the API itself created (max 8 people, and
// only for Official Business Accounts) — it can't post into the SEO team's
// existing group.
//
// Env (Vercel):
//   WHAPI_TOKEN             — the channel's API token (Whapi dashboard)
//   WHATSAPP_SEO_GROUP_ID   — the SEO DPT group chat id, e.g. 1203…@g.us
//                             (/api/admin/whatsapp/seo-group lists the ids)
//
// Same contract as src/lib/slack.ts: every call is a silent no-op when the
// env isn't set, and nothing here ever throws — a WhatsApp hiccup must never
// fail the write that triggered it.

const WHAPI_BASE = "https://gate.whapi.cloud";
const TIMEOUT_MS = 8000;

function whapiToken(): string | undefined {
  return process.env.WHAPI_TOKEN || undefined;
}

export function whatsappConfigured(): boolean {
  return Boolean(whapiToken());
}

export function seoGroupId(): string | undefined {
  return process.env.WHATSAPP_SEO_GROUP_ID?.trim() || undefined;
}

export function seoGroupConfigured(): boolean {
  return whatsappConfigured() && Boolean(seoGroupId());
}

/** Send a plain-text message (WhatsApp markup: *bold*, _italic_) to a chat
 *  id — a group id ends in `@g.us`. Returns true on a 2xx. */
export async function sendWhatsAppText(to: string, body: string): Promise<boolean> {
  const token = whapiToken();
  if (!token || !to) return false;
  try {
    const res = await fetch(`${WHAPI_BASE}/messages/text`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, body }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(
        `[whatsapp] send failed: HTTP ${res.status}`,
        (await res.text().catch(() => "")).slice(0, 300),
      );
    }
    return res.ok;
  } catch (err) {
    console.error("[whatsapp] send failed:", err);
    return false;
  }
}

/** Post to the SEO DPT group. No-op (false) until both env vars are set. */
export async function postToSeoWhatsAppGroup(body: string): Promise<boolean> {
  const to = seoGroupId();
  if (!to) return false;
  return sendWhatsAppText(to, body);
}

export type WhatsAppGroup = { id: string; name: string; participants: number | null };

/** Groups the linked number belongs to — used once, to find the SEO group's
 *  id. Null when the token is missing or Whapi rejects the call. Each call
 *  counts against the plan's monthly API-request quota, so never poll this. */
export async function listWhatsAppGroups(): Promise<WhatsAppGroup[] | null> {
  const token = whapiToken();
  if (!token) return null;
  try {
    const res = await fetch(`${WHAPI_BASE}/groups?count=100`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[whatsapp] list groups failed: HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as {
      groups?: { id?: string; name?: string; participants_count?: number }[];
    };
    return (json.groups ?? [])
      .filter((g): g is { id: string; name?: string; participants_count?: number } =>
        typeof g.id === "string",
      )
      .map((g) => ({
        id: g.id,
        name: g.name ?? "(sem nome)",
        participants: typeof g.participants_count === "number" ? g.participants_count : null,
      }));
  } catch (err) {
    console.error("[whatsapp] list groups failed:", err);
    return null;
  }
}
