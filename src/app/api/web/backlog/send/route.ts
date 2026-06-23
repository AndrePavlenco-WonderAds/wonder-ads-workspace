// Post a (possibly edited) Web backlog straight to the Slack channel via
// the incoming webhook. Sending — unlike pasting — makes mention tokens
// render: we rewrite "@Full Name" → "<@MEMBERID>" and "@channel"/"@here"
// → "<!channel>"/"<!here>" so people and broadcasts are real, clickable
// mentions in the posted message.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts, linkifySlackMentions } from "@/lib/auth/credentials";
import { postToWebSlack, slackWebConfigured } from "@/lib/slack";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("web")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!slackWebConfigured()) {
    return NextResponse.json(
      {
        error:
          "O webhook do Slack não está configurado (SLACK_WEB_WEBHOOK_URL).",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const raw = (body as { text?: unknown })?.text;
  if (typeof raw !== "string" || !raw.trim()) {
    return NextResponse.json({ error: "Texto vazio." }, { status: 400 });
  }

  // Real mentions: people first, then the broadcast tokens. Order matters
  // so "@channel" isn't caught by a person-name regex (it won't be, but
  // keep broadcasts explicit).
  let text = linkifySlackMentions(raw);
  text = text
    .replace(/@channel\b/g, "<!channel>")
    .replace(/@here\b/g, "<!here>");

  const ok = await postToWebSlack({ text });
  if (!ok) {
    return NextResponse.json(
      { error: "O Slack rejeitou a mensagem. Tenta novamente." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
