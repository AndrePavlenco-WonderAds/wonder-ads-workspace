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

/** Webhook for release/changelog announcements. Falls back to the Web
 *  channel webhook when its own env isn't set, so the feature works out
 *  of the box and can later be pointed at a dedicated #updates channel. */
function changelogWebhookUrl(): string | undefined {
  return (
    process.env.SLACK_CHANGELOG_WEBHOOK_URL ||
    process.env.SLACK_WEB_WEBHOOK_URL ||
    undefined
  );
}

export function changelogSlackConfigured(): boolean {
  return Boolean(changelogWebhookUrl());
}

/** Post to the changelog/announcements channel. Same contract as
 *  postToWebSlack but a different webhook. */
export async function postChangelogToSlack(payload: {
  text: string;
  blocks?: unknown[];
}): Promise<boolean> {
  return postToWebhook(changelogWebhookUrl(), payload);
}

/** Post a Block Kit message to the Web team channel. Returns true on a
 *  2xx, false otherwise (or when no webhook is configured). Never
 *  throws — Slack delivery must never block a ticket write. */
export async function postToWebSlack(payload: {
  text: string;
  blocks?: unknown[];
}): Promise<boolean> {
  return postToWebhook(process.env.SLACK_WEB_WEBHOOK_URL, payload);
}

async function postToWebhook(
  url: string | undefined,
  payload: { text: string; blocks?: unknown[] },
): Promise<boolean> {
  if (!url) return false;
  // Hard 5s timeout so a slow/hanging Slack call can never block the
  // ticket write that's awaiting it.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    return res.ok;
  } catch (err) {
    console.error("[slack] post failed:", err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
