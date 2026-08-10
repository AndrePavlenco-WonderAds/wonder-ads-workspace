// POST /api/auth/impersonate  { username } → passa a ver a app como essa
//                                             pessoa (só SuperAdmins).
// DELETE /api/auth/impersonate               → volta a ser quem fez login.
//
// Reemite o MESMO cookie de sessão com o campo `as` dentro da carga
// assinada. O `u` — quem fez login — nunca muda: é o que garante que o
// caminho de volta existe sempre, e é sobre ele que se faz a autorização.
//
// Vive sob /api/auth/* de propósito: essa árvore está fora do matcher do
// middleware (é o próprio portão), e portanto o DELETE continua a passar
// mesmo com a lente ativa a bloquear todos os writes. Sem isso, entrar na
// pele de um consultor era uma porta sem fecho por dentro.
//
// O prazo da sessão NÃO se estica em nenhuma das duas operações: uma volta
// pelo seletor não pode valer uma semana de sessão nova sem password.

import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  issueSession,
} from "@/lib/auth/session";
import { getCurrentSession, isRealUserAdmin } from "@/lib/auth/server";
import { findEmployeeByUsername } from "@/lib/auth/credentials";

export const runtime = "nodejs";

/** Segundos que faltam ao prazo original, para o cookie reemitido morrer
 *  ao mesmo tempo que o antigo. Nunca negativo. */
function remainingMaxAge(expiresAt: number): number {
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  }
  // A autorização é sobre QUEM FEZ LOGIN, não sobre quem está a ser visto —
  // senão a primeira troca para um consultor trancava todas as seguintes.
  if (!(await isRealUserAdmin())) {
    return NextResponse.json(
      { error: "Não há permissões suficientes." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const raw = (body as { username?: unknown })?.username;
  const username = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!username) {
    return NextResponse.json({ error: "username é obrigatório." }, { status: 400 });
  }
  const target = findEmployeeByUsername(username);
  if (!target) {
    return NextResponse.json(
      { error: "Não há ninguém com esse username." },
      { status: 404 },
    );
  }

  // Escolher-se a si próprio é o mesmo que largar a lente — não é erro.
  const as = target.username === session.u ? null : target.username;
  const { cookieValue } = await issueSession(session.u, {
    as,
    expiresAt: session.exp,
  });
  const res = NextResponse.json({
    ok: true,
    viewingAs: as,
    name: target.name,
    role: target.role,
    dept: target.dept,
  });
  res.cookies.set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.min(remainingMaxAge(session.exp), SESSION_MAX_AGE_SECONDS),
  });
  return res;
}

export async function DELETE() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  }
  // Voltar a si próprio não precisa de permissão nenhuma: é a saída, e uma
  // saída que se possa recusar não é uma saída.
  const { cookieValue } = await issueSession(session.u, {
    as: null,
    expiresAt: session.exp,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.min(remainingMaxAge(session.exp), SESSION_MAX_AGE_SECONDS),
  });
  return res;
}
