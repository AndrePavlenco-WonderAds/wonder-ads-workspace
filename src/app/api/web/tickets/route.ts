// Global Web Ticketing — collection endpoints.
//   GET  → list all tickets (any logged-in employee).
//   POST → create a ticket (any logged-in employee, regardless of dept).
//          Fires a Slack notification to the Web channel.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { getEmployeeDisplay, getWebAssignees } from "@/lib/auth/credentials";
import {
  getAllTickets,
  nextTicketSeq,
  normaliseTicket,
  newTicketId,
  saveTicket,
  ticketsStorageConfigured,
} from "@/lib/web-tickets-store";
import {
  REQUESTING_DEPT_LABEL,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY_META,
  ticketRef,
  type TicketEvent,
  type WebTicket,
} from "@/lib/web-tickets-shared";
import { postToWebSlack } from "@/lib/slack";

export const runtime = "nodejs";

export async function GET() {
  if (!ticketsStorageConfigured) {
    return NextResponse.json({ tickets: [] });
  }
  const tickets = await getAllTickets();
  return NextResponse.json({ tickets });
}

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!ticketsStorageConfigured) {
    return NextResponse.json(
      { error: "Armazenamento não configurado." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  if (typeof o.title !== "string" || !o.title.trim()) {
    return NextResponse.json(
      { error: "O título é obrigatório." },
      { status: 400 },
    );
  }

  // Optional forced assignment — only honour a username that is a real
  // Web designer (Mike / Renan / Gustavo / Cylas).
  const webUsernames = new Set(getWebAssignees().map((a) => a.username));
  const forcedUser =
    typeof o.assigneeUsername === "string" && webUsernames.has(o.assigneeUsername)
      ? o.assigneeUsername
      : null;
  const forcedName = forcedUser
    ? getEmployeeDisplay(forcedUser)?.name ?? forcedUser
    : null;

  const seq = await nextTicketSeq();
  const id = newTicketId();
  const history: TicketEvent[] = [
    {
      id: `ev_${Math.random().toString(36).slice(2, 8)}`,
      kind: "created",
      actorUsername: employee.username,
      actorName: employee.name,
      message: `Ticket criado por ${employee.name}.`,
      at: Date.now(),
    },
  ];
  if (forcedUser) {
    history.push({
      id: `ev_${Math.random().toString(36).slice(2, 9)}`,
      kind: "assigned",
      actorUsername: employee.username,
      actorName: employee.name,
      message: `Atribuição forçada a ${forcedName}.`,
      at: Date.now(),
    });
  }

  const ticket = normaliseTicket(
    {
      ...o,
      authorUsername: employee.username,
      authorName: employee.name,
      status: "new",
      assigneeUsername: forcedUser,
      assigneeName: forcedName,
      history,
    },
    id,
    seq,
  );
  await saveTicket(ticket);

  // Fire-and-await Slack (never throws). Build the direct link from the
  // request origin so it works across previews + prod without an env.
  const origin = new URL(req.url).origin;
  void notifyCreated(ticket, origin);

  return NextResponse.json({ ticket }, { status: 201 });
}

async function notifyCreated(t: WebTicket, origin: string) {
  const link = `${origin}/web/tickets/${t.id}`;
  const prio = TICKET_PRIORITY_META[t.priority];
  const header = `${prio.emoji} Novo ticket Web ${ticketRef(t)} — ${t.title}`;
  await postToWebSlack({
    text: header,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${header}*` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Departamento:*\n${REQUESTING_DEPT_LABEL[t.requestingDept]}` },
          { type: "mrkdwn", text: `*Prioridade:*\n${prio.label}` },
          { type: "mrkdwn", text: `*Categoria:*\n${TICKET_CATEGORY_LABEL[t.category]}` },
          { type: "mrkdwn", text: `*Autor:*\n${t.authorName}` },
        ],
      },
      ...(t.description
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `>${t.description.slice(0, 280).replace(/\n/g, "\n>")}`,
              },
            },
          ]
        : []),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Abrir ticket" },
            url: link,
            style: "primary",
          },
        ],
      },
    ],
  });
}
