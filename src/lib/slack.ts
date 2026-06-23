// Minimal Slack Incoming-Webhook poster. No SDK — just a fetch to the
// webhook URL configured per channel via env. Every call is a no-op when
// the relevant webhook env var is missing, so the app never breaks in
// environments where Slack isn't wired up (local dev, previews).
//
// Set SLACK_WEB_WEBHOOK_URL on Vercel to the Web team's channel webhook
// (https://api.slack.com/messaging/webhooks).

export function slackWebConfigured(): boolean {
  return Boolean(process.env.SLACK_WEB_WEBHOOK_URL);
}

/** Post a Block Kit message to the Web team channel. Returns true on a
 *  2xx, false otherwise (or when no webhook is configured). Never
 *  throws — Slack delivery must never block a ticket write. */
export async function postToWebSlack(payload: {
  text: string;
  blocks?: unknown[];
}): Promise<boolean> {
  const url = process.env.SLACK_WEB_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error("[slack] post failed:", err);
    return false;
  }
}
