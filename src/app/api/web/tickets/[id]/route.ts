// Global Web Ticketing — single-ticket endpoints.
//   GET    → fetch one ticket.
//   PATCH  → update fields (status / priority / assignee / title / desc /
//            attachments) OR append a comment ({ comment: "..." }).
//            Records a history event for each meaningful change and fires
//            a Slack notification when the status changes.
//   DELETE → remove the ticket (author or any Web-dept member / admin).

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { canAccessDept, getEmployeeDisplay } from "@/lib/auth/credentials";
import {
  deleteTicket,
  getTicket,
  normaliseTicket,
  saveTicket,
  ticketsStorageConfigured,
} from "@/lib/web-tickets-store";
import {
  TICKET_PRIORITY_META,
  TICKET_STATUS_META,
  ticketRef,
  type TicketEvent,
  type WebTicket,
} from "@/lib/web-tickets-shared";
import { postToWebSlack } from "@/lib/slack";

export const runtime = "nodejs";

function evt(
  kind: TicketEvent["kind"],
  actorUsername: string,
  actorName: string,
  message: string,
): TicketEvent {
  return {
    id: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    kind,
    actorUsername,
    actorName,
    message,
    at: Date.now(),
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const ticket = await getTicket(id);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ticket });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const prev = await getTicket(id);
  if (!prev) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const o = (body ?? {}) as Record<string, unknown>;

  // --- Comment-only patch ---
  if (typeof o.comment === "string" && o.comment.trim()) {
    const comment = {
      id: `cm_${Date.now().toString(36)}`,
      authorUsername: employee.username,
      authorName: employee.name,
      body: o.comment.trim(),
      createdAt: Date.now(),
    };
    const next = normaliseTicket(
      {
        ...prev,
        comments: [...prev.comments, comment],
        history: [
          ...prev.history,
          evt("comment", employee.username, employee.name, `${employee.name} comentou.`),
        ],
      },
      prev.id,
      prev.seq,
      prev,
    );
    await saveTicket(next);
    return NextResponse.json({ ticket: next });
  }

  // --- Field updates: build the merged payload + history diff ---
  const history = [...prev.history];
  const nextStatus =
    typeof o.status === "string" ? o.status : prev.status;
  const statusChanged = nextStatus !== prev.status;

  if (statusChanged) {
    history.push(
      evt(
        "status",
        employee.username,
        employee.name,
        `Estado: ${TICKET_STATUS_META[prev.status].label} → ${
          TICKET_STATUS_META[nextStatus as WebTicket["status"]]?.label ?? nextStatus
        }`,
      ),
    );
  }
  if (typeof o.priority === "string" && o.priority !== prev.priority) {
    history.push(
      evt(
        "priority",
        employee.username,
        employee.name,
        `Prioridade: ${TICKET_PRIORITY_META[prev.priority].label} → ${
          TICKET_PRIORITY_META[o.priority as WebTicket["priority"]]?.label ?? o.priority
        }`,
      ),
    );
  }
  if (
    "assigneeUsername" in o &&
    (o.assigneeUsername || null) !== prev.assigneeUsername
  ) {
    const newName = o.assigneeUsername
      ? getEmployeeDisplay(String(o.assigneeUsername))?.name ??
        String(o.assigneeName ?? o.assigneeUsername)
      : null;
    history.push(
      evt(
        "assigned",
        employee.username,
        employee.name,
        newName ? `Atribuído a ${newName}.` : "Atribuição removida.",
      ),
    );
    if (o.assigneeUsername) o.assigneeName = newName;
  }

  const next = normaliseTicket(
    { ...prev, ...o, history },
    prev.id,
    prev.seq,
    prev,
  );
  await saveTicket(next);

  if (statusChanged) {
    const origin = new URL(req.url).origin;
    void notifyStatus(next, prev.status, employee.name, origin);
  }

  return NextResponse.json({ ticket: next });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const prev = await getTicket(id);
  if (!prev) return NextResponse.json({ ok: true });

  const canDelete =
    employee.isAdmin ||
    prev.authorUsername === employee.username ||
    canAccessDept(employee.username, "web");
  if (!canDelete) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (!ticketsStorageConfigured) return NextResponse.json({ ok: true });
  await deleteTicket(id);
  return NextResponse.json({ ok: true });
}

async function notifyStatus(
  t: WebTicket,
  from: WebTicket["status"],
  actorName: string,
  origin: string,
) {
  const meta = TICKET_STATUS_META[t.status];
  const link = `${origin}/web/tickets/${t.id}`;
  const header = `${meta.dot ? "🔔" : ""} Ticket ${ticketRef(t)} — ${t.title}`.trim();
  await postToWebSlack({
    text: `${header} → ${meta.label}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${header}*\nEstado: *${TICKET_STATUS_META[from].label}* → *${meta.label}*  ·  por ${actorName}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Abrir ticket" },
            url: link,
          },
        ],
      },
    ],
  });
}
