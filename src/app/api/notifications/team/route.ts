// O Superadmin limpa notificações da equipa em nome de outra pessoa (v77.40).
//   POST { username?, ids? }
//     • username + ids  → essas linhas dessa pessoa
//     • username        → tudo o que essa pessoa tem em aberto
//     • nada            → a equipa toda (menos o próprio)
//
// Só SuperAdmin EFETIVO: a ver como um consultor, o painel de equipa nem
// aparece, e a API fecha-se da mesma maneira. A validação dos ids é feita em
// `clearTeamNotifications` contra a mesma lista que o painel mostrou.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import { clearTeamNotifications } from "@/lib/notifications/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  if (!employee.isAdmin) {
    return NextResponse.json(
      { error: "Só um Superadmin pode limpar notificações da equipa." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { username, ids } = (body ?? {}) as {
    username?: unknown;
    ids?: unknown;
  };
  if (username !== undefined && (typeof username !== "string" || !username.trim())) {
    return NextResponse.json({ error: "username inválido." }, { status: 400 });
  }
  if (
    ids !== undefined &&
    (!Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > 500 ||
      !ids.every((i) => typeof i === "string" && i.trim()))
  ) {
    return NextResponse.json({ error: "ids inválidos." }, { status: 400 });
  }
  if (ids !== undefined && username === undefined) {
    return NextResponse.json(
      { error: "ids exigem o username da pessoa." },
      { status: 400 },
    );
  }

  try {
    const result = await clearTeamNotifications(
      {
        username: typeof username === "string" ? username : null,
        ids: Array.isArray(ids) ? (ids as string[]) : null,
      },
      employee.username,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Notificações: limpeza da equipa falhou:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
