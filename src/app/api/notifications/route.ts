// Marcar uma notificação como concluída (ou reabri-la).
//   POST { id, resolved }
//
// Só se escreve o estado da PESSOA AUTENTICADA, e só para ids que o motor
// gerou mesmo para ela. Sem essa segunda verificação, qualquer sessão válida
// podia escrever chaves arbitrárias no seu próprio registo — inofensivo hoje,
// mas é o tipo de porta que se fecha antes de precisar dela.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  getUserNotifications,
  type UserNotification,
} from "@/lib/notifications/server";
import { setNotificationResolved } from "@/lib/notifications/state-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { id, resolved } = (body ?? {}) as { id?: unknown; resolved?: unknown };
  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "id em falta." }, { status: 400 });
  }
  if (typeof resolved !== "boolean") {
    return NextResponse.json(
      { error: "resolved tem de ser booleano." },
      { status: 400 },
    );
  }

  const viewer = {
    username: employee.username,
    name: employee.name,
    dept: employee.dept,
  };

  let list: UserNotification[];
  try {
    list = await getUserNotifications(viewer);
  } catch (err) {
    console.error("Notificações: cálculo falhou no POST:", err);
    return NextResponse.json(
      { error: "Não foi possível ler as notificações." },
      { status: 500 },
    );
  }
  if (!list.some((n) => n.id === id)) {
    return NextResponse.json(
      { error: "Notificação desconhecida ou já fora do período." },
      { status: 404 },
    );
  }

  try {
    await setNotificationResolved(viewer.username, id, resolved, Date.now());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
