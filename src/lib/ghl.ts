// Minimal GoHighLevel "Inbound Webhook" poster. The WhatsApp itself goes out
// from a GHL workflow (Inbound Webhook trigger → Send WhatsApp template) on the
// agency's official WhatsApp Business number — the workspace only fires the
// webhook with the data the template needs.
//
// Why GHL and not a WhatsApp group: the number on GHL lives on Meta's Cloud
// API, which can't post into normal groups, and connecting it to an unofficial
// gateway would risk the agency's verified number. So: one private message per
// recipient, official and template-based.
//
// Env (Vercel):
//   GHL_NPS_WEBHOOK_URL — the workflow's Inbound Webhook URL (treat as a
//                         secret: whoever has it can trigger messages)
//
// Same contract as src/lib/slack.ts: a silent no-op when the env isn't set,
// and nothing here ever throws.

const TIMEOUT_MS = 8000;

function npsWebhookUrl(): string | undefined {
  return process.env.GHL_NPS_WEBHOOK_URL?.trim() || undefined;
}

export function ghlNpsWebhookConfigured(): boolean {
  return Boolean(npsWebhookUrl());
}

/** POST a flat JSON payload to the NPS workflow. Returns true on a 2xx. */
export async function postToGhlNpsWebhook(
  payload: Record<string, string | number | boolean>,
): Promise<boolean> {
  const url = npsWebhookUrl();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(
        `[ghl] NPS webhook failed: HTTP ${res.status}`,
        (await res.text().catch(() => "")).slice(0, 300),
      );
    }
    return res.ok;
  } catch (err) {
    console.error("[ghl] NPS webhook failed:", err);
    return false;
  }
}
