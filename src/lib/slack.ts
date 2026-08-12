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

/** Webhook for the #client-wins channel — celebratory monthly-report
 *  highlights. No fallback to the Web channel: wins must land only in their
 *  own channel, so when this env var is missing every call is a silent no-op
 *  and the feature stays inert until the webhook is wired on Vercel. */
function clientWinsWebhookUrl(): string | undefined {
  return process.env.SLACK_CLIENT_WINS_WEBHOOK_URL || undefined;
}

export function clientWinsSlackConfigured(): boolean {
  return Boolean(clientWinsWebhookUrl());
}

/** Post a monthly-report win to #client-wins. Same never-throws contract as
 *  postToWebSlack; no-op (returns false) when the webhook isn't configured. */
export async function postClientWinToSlack(payload: {
  text: string;
  blocks?: unknown[];
}): Promise<boolean> {
  return postToWebhook(clientWinsWebhookUrl(), payload);
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

/** Webhook do canal #ausencias — pedidos de ausência da equipa. Sem
 *  fallback para outros canais: uma folha de RH não pode aterrar no canal
 *  da equipa Web por uma env var em falta. Sem SLACK_AUSENCIAS_WEBHOOK_URL
 *  no Vercel, cada post é um no-op silencioso e a app segue em frente. */
function ausenciasWebhookUrl(): string | undefined {
  return process.env.SLACK_AUSENCIAS_WEBHOOK_URL || undefined;
}

export function ausenciasSlackConfigured(): boolean {
  return Boolean(ausenciasWebhookUrl());
}

/** Post para o #ausencias. Mesmo contrato never-throws dos restantes. */
export async function postAusenciasToSlack(payload: {
  text: string;
  blocks?: unknown[];
}): Promise<boolean> {
  return postToWebhook(ausenciasWebhookUrl(), payload);
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
