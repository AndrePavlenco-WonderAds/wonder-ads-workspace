// Server-only auth helpers — give pages + API routes a clean way to
// answer "who is logged in" and "are they a SuperAdmin" without each
// caller re-implementing the cookie read.
//
// Designed for Node-runtime callers (server components + route handlers
// that don't run in Edge). Middleware reads the session directly via
// session.ts/readSession() so it stays Edge-compatible.
//
// DUAS IDENTIDADES, UMA SESSÃO (v76.41). Quando um SuperAdmin está a ver a
// app como outra pessoa, há duas respostas certas para «quem é o
// utilizador?» e cada uma serve um propósito:
//
//   getCurrentEmployee()  → a pessoa VISTA. É o que toda a app deve usar:
//                           páginas, menus, gates de departamento. É o que
//                           faz o SuperAdmin ver mesmo o que o outro vê,
//                           com os mesmos limites — uma imitação que não
//                           herdasse os limites não provava nada.
//   getRealEmployee()     → quem fez login. Só para o banner de aviso, para
//                           o botão de voltar, e para autorizar a própria
//                           troca de pele.
//
// `isCurrentUserAdmin()` segue a pessoa vista de propósito: a ver como um
// consultor, o /admin fecha-se — que é exatamente o que se foi lá espreitar.

import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  effectiveUsername,
  isImpersonating,
  readSession,
  type SessionPayload,
} from "./session";
import {
  getEmployeeDisplay,
  isAdminUsername,
  type EmployeeCredential,
} from "./credentials";

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

type EmployeeView = Pick<
  EmployeeCredential,
  "username" | "name" | "role" | "dept"
> & { isAdmin: boolean };

function toView(username: string | null): EmployeeView | null {
  if (!username) return null;
  const display = getEmployeeDisplay(username);
  return display ? { username, ...display } : null;
}

/** O utilizador EFETIVO — a pessoa que está a ser vista, quando há uma
 *  lente ativa, senão quem fez login. É este que a app inteira usa. */
export async function getCurrentEmployee(): Promise<EmployeeView | null> {
  const session = await getCurrentSession();
  return toView(effectiveUsername(session));
}

/** Quem FEZ LOGIN, ignorando a lente. Só para o banner, o botão de voltar
 *  e a autorização de trocar de pele. */
export async function getRealEmployee(): Promise<EmployeeView | null> {
  const session = await getCurrentSession();
  return toView(session?.u ?? null);
}

/** O estado do «Ver como»: quem está a ver e quem está a ser visto, ou
 *  null quando não há lente nenhuma. */
export async function getImpersonation(): Promise<{
  real: EmployeeView;
  viewing: EmployeeView;
} | null> {
  const session = await getCurrentSession();
  if (!isImpersonating(session)) return null;
  const real = toView(session!.u);
  const viewing = toView(session!.as!);
  return real && viewing ? { real, viewing } : null;
}

/** True when the request carries a valid session whose EFFECTIVE username
 *  has the `isAdmin` flag. A ver como um consultor isto é `false` — o
 *  /admin fecha-se, tal como se fecha para ele. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const session = await getCurrentSession();
  return isAdminUsername(effectiveUsername(session));
}

/** True quando QUEM FEZ LOGIN é SuperAdmin, haja lente ou não. É esta que
 *  autoriza trocar de pele — senão, a primeira troca para um consultor
 *  trancava o caminho para todas as seguintes. */
export async function isRealUserAdmin(): Promise<boolean> {
  const session = await getCurrentSession();
  return isAdminUsername(session?.u);
}
