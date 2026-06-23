// Post a workspace changelog entry to Slack (announcements channel) via
// the bot webhook. Admin-only. Defaults to the latest release; an
// explicit { version } can be passed to re-send an older one.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { CHANGELOG, type ChangelogEntry } from "@/lib/changelog";
import {
  changelogSlackConfigured,
  postChangelogToSlack,
} from "@/lib/slack";

export const runtime = "nodejs";

/** Markdown → Slack mrkdwn: `**bold**` → `*bold*`. Backticks + emoji
 *  already render natively in Slack. */
function toSlackMrkdwn(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "*$1*");
}

function buildMessage(entry: ChangelogEntry) {
  const header = `:sparkles: *Wonder Ads Workspace v${entry.version}* — ${entry.title}`;
  const bullets = entry.highlights
    .map((h) => `• ${toSlackMrkdwn(h)}`)
    .join("\n");
  return {
    text: header,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: header } },
      { type: "section", text: { type: "mrkdwn", text: bullets } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Release ${entry.date} · changelog interno do workspace`,
          },
        ],
      },
    ],
  };
}

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee || !employee.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!changelogSlackConfigured()) {
    return NextResponse.json(
      {
        error:
          "Webhook do Slack não configurado (SLACK_CHANGELOG_WEBHOOK_URL ou SLACK_WEB_WEBHOOK_URL).",
      },
      { status: 503 },
    );
  }

  let version: string | undefined;
  try {
    const body = (await req.json()) as { version?: unknown };
    if (typeof body?.version === "string") version = body.version;
  } catch {
    /* default to latest */
  }

  const entry = version
    ? CHANGELOG.find((e) => String(e.version) === version)
    : CHANGELOG[0];
  if (!entry) {
    return NextResponse.json(
      { error: "Versão não encontrada." },
      { status: 404 },
    );
  }

  const ok = await postChangelogToSlack(buildMessage(entry));
  if (!ok) {
    return NextResponse.json(
      { error: "O Slack rejeitou a mensagem. Tenta novamente." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, version: String(entry.version) });
}
