// Global Web Ticketing — single-ticket endpoints.
//   GET    → fetch one ticket.
//   PATCH  → update fields (status / priority / assignee / title / desc /
//            attachments) OR append a comment ({ comment: "..." }).
//            Records a history event for each meaningful change. Status
//            changes do NOT notify Slack (only new-ticket creation does).
//   DELETE → remove the ticket (author or any Web-dept member / admin).

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  canAccessDept,
  findEmployeeByUsername,
  getEmployeeDisplay,
  webDeliveryRights,
} from "@/lib/auth/credentials";
import { DEADLINE_DENIAL_MESSAGE, deadlineWriteDenial } from "@/lib/web-projects-store";
import {
  DELIVERY_REVISION_REQUIRED_MESSAGE,
  normaliseDeliveryRevision,
  requiresDeliveryRevision,
} from "@/lib/web-shared";
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
  TICKET_TO_BOARD_COLUMN,
  type TicketEvent,
  type WebTicket,
} from "@/lib/web-tickets-shared";

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

  const nextStatus =
    typeof o.status === "string" ? o.status : prev.status;
  const statusChanged = nextStatus !== prev.status;

  // --- Nova linha de entrega prevista ----------------------------------
  // Devolver o trabalho a In Progress depois de Client Feedback significa
  // que a data anterior deixou de ser verdade. Exige-se a nova data e o
  // motivo — no servidor, porque é aqui que passam TODAS as mudanças de
  // estado (a ficha, o board por drag, e qualquer chamada à mão).
  const prevColumn = TICKET_TO_BOARD_COLUMN[prev.status];
  const nextColumn =
    TICKET_TO_BOARD_COLUMN[nextStatus as WebTicket["status"]] ?? prevColumn;
  let newRevision: ReturnType<typeof normaliseDeliveryRevision> = null;
  if (requiresDeliveryRevision(prevColumn, nextColumn)) {
    newRevision = normaliseDeliveryRevision(
      o.deliveryRevision,
      { username: employee.username, name: employee.name },
      Date.now(),
    );
    if (!newRevision) {
      return NextResponse.json(
        {
          error: DELIVERY_REVISION_REQUIRED_MESSAGE,
          code: "delivery_revision_required",
        },
        { status: 400 },
      );
    }
  }

  // --- Data de entrega prevista ---------------------------------------
  // Mesmas regras dos projetos e a MESMA função a decidir: write-once, posta
  // por quem constrói e corrigida só por um SuperAdmin. Reusar a função em
  // vez de a copiar é o que garante que as duas metades do departamento não
  // divergem quando a regra mudar.
  const rights = webDeliveryRights(findEmployeeByUsername(employee.username));
  const denial = deadlineWriteDenial(o, prev, rights);
  if (denial) {
    return NextResponse.json(
      { error: DEADLINE_DENIAL_MESSAGE[denial] },
      { status: 403 },
    );
  }
  const requestedDeadline =
    typeof o.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline)
      ? o.deadline
      : o.deadline === null || o.deadline === ""
        ? null
        : undefined;
  const deadlineChanged =
    requestedDeadline !== undefined && requestedDeadline !== prev.deadline;
  const deadlineState = deadlineChanged
    ? {
        deadline: requestedDeadline,
        deadlineSetByUsername: requestedDeadline ? employee.username : null,
        deadlineSetByName: requestedDeadline ? employee.name : null,
        deadlineSetAt: requestedDeadline ? Date.now() : null,
      }
    : {
        deadline: prev.deadline,
        deadlineSetByUsername: prev.deadlineSetByUsername,
        deadlineSetByName: prev.deadlineSetByName,
        deadlineSetAt: prev.deadlineSetAt,
      };

  // --- Field updates: build the merged payload + history diff ---
  const history = [...prev.history];
  if (deadlineChanged) {
    history.push(
      evt(
        "status",
        employee.username,
        employee.name,
        requestedDeadline
          ? `Entrega prevista: ${requestedDeadline}`
          : "Entrega prevista removida.",
      ),
    );
  }
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

  // `deadlineState` vai DEPOIS do payload: um board desatualizado a
  // reenviar a data antiga não pode desfazer o que já está trancado.
  if (newRevision) {
    history.push(
      evt(
        "status",
        employee.username,
        employee.name,
        `Nova entrega prevista ${newRevision.date} — ${newRevision.note}`,
      ),
    );
  }

  const next = normaliseTicket(
    {
      ...prev,
      ...o,
      ...deadlineState,
      deliveryRevisions: newRevision
        ? [...prev.deliveryRevisions, newRevision]
        : prev.deliveryRevisions,
      history,
    },
    prev.id,
    prev.seq,
    prev,
  );
  await saveTicket(next);

  // Note: status changes do NOT notify Slack — only new-ticket creation
  // does (see POST /api/web/tickets). The team didn't want the channel
  // pinged on every status move.

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
